// PA meeting tools: prepareMeetingBrief
// Covers PA-07

import { google } from "googleapis";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getGoogleClient } from "./google-auth.js";
import { callLLM } from "../../llm/client.js";
import { ragRetrieveByText } from "../../tools/rag-retrieval.js";
import type { MeetingBrief } from "./types.js";

/**
 * PA-07: Prepare a meeting brief by synthesizing calendar event details,
 * recent email history with attendees, and related Drive/RAG documents.
 */
export async function prepareMeetingBrief(
  userId: string,
  eventId: string,
): Promise<MeetingBrief & { message: string }> {
  const auth = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth });
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch the calendar event
  const { data: event } = await calendar.events.get({
    calendarId: "primary",
    eventId,
  });

  const eventSummary = event.summary ?? "(no title)";
  const eventDescription = event.description ?? null;
  const attendeeList = (event.attendees ?? []).map((a) => ({
    email: a.email ?? "",
    name: a.displayName ?? undefined,
  }));

  // Gather recent emails with each attendee
  const attendeesWithEmails: MeetingBrief["attendees"] = [];

  for (const attendee of attendeeList) {
    if (!attendee.email) continue;

    const recentEmailSnippets: string[] = [];

    try {
      const { data: msgList } = await gmail.users.messages.list({
        userId: "me",
        q: `from:${attendee.email}`,
        maxResults: 3,
      });

      if (msgList.messages && msgList.messages.length > 0) {
        await Promise.all(
          msgList.messages.map(async (msg) => {
            const { data: detail } = await gmail.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "metadata",
              metadataHeaders: ["Subject", "Date"],
            });
            const subject =
              detail.payload?.headers?.find((h) => h.name === "Subject")?.value ??
              "(no subject)";
            recentEmailSnippets.push(`"${subject}": ${detail.snippet ?? ""}`);
          }),
        );
      }
    } catch {
      // Non-fatal: proceed without email history for this attendee
    }

    attendeesWithEmails.push({
      ...attendee,
      recentEmails: recentEmailSnippets,
    });
  }

  // RAG search for related documents
  const ragResults = await ragRetrieveByText(userId, eventSummary, 3);
  const relatedDocs = ragResults.map((doc) => ({
    title: doc.source ?? "Document",
    url: doc.source ?? "",
  }));

  // Build context for LLM briefing synthesis
  const attendeeContext = attendeesWithEmails
    .map((a) => {
      const emails =
        a.recentEmails && a.recentEmails.length > 0
          ? `\n  Recent emails: ${a.recentEmails.join("; ")}`
          : "";
      return `- ${a.name ?? a.email} <${a.email}>${emails}`;
    })
    .join("\n");

  const docsContext =
    ragResults.length > 0
      ? ragResults
          .map((d) => `[${d.source}]: ${d.content.slice(0, 300)}`)
          .join("\n\n")
      : "No related documents found.";

  const llmResult = await callLLM(
    [
      new SystemMessage(
        "Create a concise meeting brief (5-7 bullet points). Include purpose, key attendees, agenda items, relevant context, and any action items to prepare.",
      ),
      new HumanMessage(
        `Meeting: ${eventSummary}\nDescription: ${eventDescription ?? "None provided"}\n\nAttendees:\n${attendeeContext}\n\nRelated documents:\n${docsContext}\n\nPlease write a concise meeting brief.`,
      ),
    ],
  );

  return {
    eventSummary,
    attendees: attendeesWithEmails,
    agenda: eventDescription,
    relatedDocs,
    briefing: llmResult.content,
    message: `Meeting brief: ${eventSummary}`,
  };
}
