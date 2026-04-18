import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentRuns, brandFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const calendarRunEmitters = new Map<
  string,
  Array<(event: string, data: Record<string, unknown>) => void>
>();

export function getCalendarEventEmitters(runId: string) {
  return calendarRunEmitters.get(runId) || [];
}

export function registerCalendarListener(
  runId: string,
  listener: (event: string, data: Record<string, unknown>) => void,
) {
  if (!calendarRunEmitters.has(runId)) {
    calendarRunEmitters.set(runId, []);
  }
  calendarRunEmitters.get(runId)!.push(listener);

  return () => {
    const listeners = calendarRunEmitters.get(runId);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
      if (listeners.length === 0) calendarRunEmitters.delete(runId);
    }
  };
}

export async function POST(req: NextRequest) {
  const { organizationId } = await req.json();

  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId,
      status: "running",
      startedAt: new Date(),
      tasks: {
        ask_calendar_questions: "running",
        generate_calendar: "pending",
        present_calendar: "pending",
        generate_content_batch: "pending",
      },
    })
    .returning();

  const emitEvent = (event: string, data: Record<string, unknown>) => {
    const listeners = getCalendarEventEmitters(run.id);
    listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch {}
    });
  };

  const { askCalendarQuestions } = await import("@/lib/agent/nodes/ask-calendar-questions");

  askCalendarQuestions({
    organizationId,
    wizardAnswers: null,
    businessProfile: "",
    brandGuidelines: "",
    marketResearch: "",
    marketingStrategy: "",
    calendarId: "",
    calendarPosts: [],
    contentPillars: [],
    calendarApproved: false,
    generatedContentCount: 0,
    emitEvent,
  } as any).then(() => {
    db.update(agentRuns)
      .set({
        tasks: {
          ask_calendar_questions: "completed",
          generate_calendar: "pending",
          present_calendar: "pending",
          generate_content_batch: "pending",
        },
      })
      .where(eq(agentRuns.id, run.id))
      .catch(console.error);
  });

  return NextResponse.json({ runId: run.id });
}
