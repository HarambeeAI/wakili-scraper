// PA email tools: readEmails, triageInbox, draftEmailResponse, sendEmail
// Covers PA-01, PA-02, PA-03, PA-04

import { google } from "googleapis";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getGoogleClient } from "./google-auth.js";
import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";
import type {
  EmailMessage,
  TriagedEmail,
  DraftedEmail,
} from "./types.js";

// Helper: extract text body from Gmail message parts
function extractBody(payload: {
  body?: { data?: string | null } | null;
  parts?: Array<{
    mimeType?: string | null;
    body?: { data?: string | null } | null;
  }> | null;
} | null | undefined): string {
  if (!payload) return "";

  // Try direct body first
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Walk parts for text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    // Fallback: first part with data
    for (const part of payload.parts) {
      if (part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  }

  return "";
}

/**
 * PA-01: Read recent inbox emails from Gmail.
 * Returns a structured array of EmailMessage objects.
 */
export async function readEmails(
  userId: string,
  maxResults: number = 20,
): Promise<{ emails: EmailMessage[]; count: number }> {
  const auth = await getGoogleClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "is:inbox",
  });

  if (!data.messages || data.messages.length === 0) {
    return { emails: [], count: 0 };
  }

  const emails = await Promise.all(
    data.messages.map(async (msg) => {
      const { data: detail } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      const headers = detail.payload?.headers || [];
      const email: EmailMessage = {
        id: detail.id ?? "",
        threadId: detail.threadId ?? "",
        subject: headers.find((h) => h.name === "Subject")?.value ?? "(no subject)",
        from: headers.find((h) => h.name === "From")?.value ?? "",
        to: headers.find((h) => h.name === "To")?.value ?? undefined,
        date: headers.find((h) => h.name === "Date")?.value ?? "",
        snippet: detail.snippet ?? "",
        labelIds: detail.labelIds ?? [],
      };
      return email;
    }),
  );

  return { emails, count: emails.length };
}

/**
 * PA-02: Triage inbox by urgency and topic via LLM.
 * Categorizes recent emails into urgent/high/normal/low and suggests actions.
 */
export async function triageInbox(
  userId: string,
): Promise<{ triaged: TriagedEmail[]; summary: string }> {
  const { emails } = await readEmails(userId, 20);

  if (emails.length === 0) {
    return {
      triaged: [],
      summary: "Your inbox is clear -- no new emails.",
    };
  }

  const emailList = emails
    .map(
      (e, i) =>
        `${i + 1}. ID: ${e.id}\n   From: ${e.from}\n   Subject: ${e.subject}\n   Snippet: ${e.snippet}`,
    )
    .join("\n\n");

  const schemaDescription = `{ "emails": [{ "id": "string", "urgency": "urgent|high|normal|low", "topic": "string", "suggestedAction": "respond|delegate|archive|follow_up", "reason": "string" }] }`;

  const { data } = await callLLMWithStructuredOutput<{
    emails: Array<{
      id: string;
      urgency: "urgent" | "high" | "normal" | "low";
      topic: string;
      suggestedAction: "respond" | "delegate" | "archive" | "follow_up";
      reason: string;
    }>;
  }>(
    [
      new HumanMessage(
        `Categorize each of these inbox emails by urgency and topic:\n\n${emailList}`,
      ),
    ],
    schemaDescription,
    {
      systemPrompt:
        "Categorize each email by urgency and topic. Consider sender importance, subject line, and content snippet.",
    },
  );

  // Map LLM output back to TriagedEmail with full subject/from from readEmails
  const triaged: TriagedEmail[] = (data.emails ?? []).map((classified) => {
    const original = emails.find((e) => e.id === classified.id);
    return {
      id: classified.id,
      subject: original?.subject ?? "",
      from: original?.from ?? "",
      urgency: classified.urgency,
      topic: classified.topic,
      suggestedAction: classified.suggestedAction,
      reason: classified.reason,
    };
  });

  const urgentCount = triaged.filter((e) => e.urgency === "urgent").length;
  const highCount = triaged.filter((e) => e.urgency === "high").length;
  const normalCount = triaged.filter((e) => e.urgency === "normal").length;
  const lowCount = triaged.filter((e) => e.urgency === "low").length;

  const summary = `${urgentCount} urgent, ${highCount} high priority, ${normalCount} normal, ${lowCount} low priority`;

  return { triaged, summary };
}

/**
 * PA-03: Draft an email response using LLM, matching user communication style.
 * Fetches the full email thread and generates a professional, concise reply.
 */
export async function draftEmailResponse(
  userId: string,
  emailId: string,
  instructions?: string,
): Promise<DraftedEmail> {
  const auth = await getGoogleClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch full email for body content
  const { data: detail } = await gmail.users.messages.get({
    userId: "me",
    id: emailId,
    format: "full",
  });

  const headers = detail.payload?.headers ?? [];
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
  const fromAddress = headers.find((h) => h.name === "From")?.value ?? "";
  const body = extractBody(detail.payload as Parameters<typeof extractBody>[0]);

  const userMessage =
    `Original email:\nFrom: ${fromAddress}\nSubject: ${subject}\n\n${body}` +
    (instructions ? `\n\nUser instructions: ${instructions}` : "");

  const result = await callLLM(
    [
      new SystemMessage(
        "You are drafting an email response. Match the user's communication style: professional but concise. Draft a complete response to the email below.",
      ),
      new HumanMessage(userMessage),
    ],
  );

  return {
    to: fromAddress,
    subject: `Re: ${subject}`,
    body: result.content,
    threadId: detail.threadId ?? undefined,
    inReplyTo: emailId,
  };
}

/**
 * PA-04: Send an email via Gmail API, with mandatory HITL approval.
 * Constructs a MIME message, base64url-encodes it, and calls gmail.users.messages.send.
 */
export async function sendEmail(
  userId: string,
  agentType: string,
  email: DraftedEmail,
): Promise<{ sent: boolean; messageId?: string; message: string }> {
  const approval = interruptForApproval({
    action: "send_email",
    agentType: agentType as any,
    description: `Send email to ${email.to}: "${email.subject}"`,
    payload: email as unknown as Record<string, unknown>,
  });

  if (!approval.approved) {
    return { sent: false, message: "Email send cancelled by user." };
  }

  const auth = await getGoogleClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  // Construct RFC 2822 MIME message
  const mimeLines = [
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    email.body,
  ];
  const rawMessage = mimeLines.join("\r\n");

  // Base64url encode (URL-safe, no padding padding issues)
  const base64Message = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64Message,
      threadId: email.threadId,
    },
  });

  return {
    sent: true,
    messageId: result.data.id ?? undefined,
    message: `Email sent to ${email.to}`,
  };
}
