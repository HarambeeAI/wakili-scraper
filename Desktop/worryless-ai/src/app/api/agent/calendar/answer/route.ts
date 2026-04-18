import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentRuns, brandFiles, chatMessages, contentCalendars, calendarPosts as calendarPostsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCalendarEventEmitters } from "../start/route";
import type { WizardAnswers } from "@/types/calendar";

export async function POST(req: NextRequest) {
  const { runId, organizationId, answers, action } = await req.json() as {
    runId: string;
    organizationId: string;
    answers?: WizardAnswers;
    action?: "approve_calendar";
  };

  const emitEvent = (event: string, data: Record<string, unknown>) => {
    const listeners = getCalendarEventEmitters(runId);
    listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch {}
    });

    if (event === "message" || event === "status") {
      db.insert(chatMessages)
        .values({
          organizationId,
          role: ((data.role as string) || "system") as "agent" | "user" | "system",
          content: (data.content as string) || (data.message as string) || "",
          type: event === "status" ? "status" : "text",
        })
        .catch(console.error);
    }
  };

  const files = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.organizationId, organizationId));

  const brandDocs = {
    businessProfile: files.find((f) => f.type === "business_profile")?.content || "",
    brandGuidelines: files.find((f) => f.type === "brand_guidelines")?.content || "",
    marketResearch: files.find((f) => f.type === "market_research")?.content || "",
    marketingStrategy: files.find((f) => f.type === "marketing_strategy")?.content || "",
  };

  if (answers) {
    const { generateCalendar } = await import("@/lib/agent/nodes/generate-calendar");
    const { presentCalendar } = await import("@/lib/agent/nodes/present-calendar");

    (async () => {
      try {
        const state: Record<string, unknown> = {
          organizationId,
          wizardAnswers: answers,
          ...brandDocs,
          calendarId: "",
          calendarPosts: [],
          contentPillars: [],
          calendarApproved: false,
          generatedContentCount: 0,
          emitEvent,
        };

        const genResult = await generateCalendar(state as any);
        Object.assign(state, genResult);

        await presentCalendar(state as any);

        await db.update(agentRuns)
          .set({
            tasks: {
              ask_calendar_questions: "completed",
              generate_calendar: "completed",
              present_calendar: "completed",
              generate_content_batch: "pending",
            },
          })
          .where(eq(agentRuns.id, runId))
          .catch(console.error);
      } catch (err) {
        console.error("Calendar generation failed:", err);
        emitEvent("error", { message: "Calendar generation failed. Please try again." });
      }
    })();

    return NextResponse.json({ status: "generating" });
  }

  if (action === "approve_calendar") {
    const { generateContentBatch } = await import("@/lib/agent/nodes/generate-content-batch");

    const calendars = await db
      .select()
      .from(contentCalendars)
      .where(eq(contentCalendars.organizationId, organizationId));

    const latestCalendar = calendars[calendars.length - 1];
    if (!latestCalendar) {
      return NextResponse.json({ error: "No calendar found" }, { status: 404 });
    }

    const posts = await db
      .select()
      .from(calendarPostsTable)
      .where(eq(calendarPostsTable.calendarId, latestCalendar.id));

    await db
      .update(contentCalendars)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(contentCalendars.id, latestCalendar.id));

    (async () => {
      try {
        await generateContentBatch({
          organizationId,
          wizardAnswers: latestCalendar.wizardAnswers as any,
          ...brandDocs,
          calendarId: latestCalendar.id,
          calendarPosts: posts as any,
          contentPillars: latestCalendar.contentPillars,
          calendarApproved: true,
          generatedContentCount: 0,
          emitEvent,
        } as any);

        await db.update(agentRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            tasks: {
              ask_calendar_questions: "completed",
              generate_calendar: "completed",
              present_calendar: "completed",
              generate_content_batch: "completed",
            },
          })
          .where(eq(agentRuns.id, runId))
          .catch(console.error);

        emitEvent("complete", { status: "completed" });
      } catch (err) {
        console.error("Content generation failed:", err);
        emitEvent("error", { message: "Content generation encountered issues. Some posts may need manual attention." });
      }
    })();

    return NextResponse.json({ status: "generating_content" });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
