import type { CalendarAgentStateType } from "../calendar-state";
import { db } from "@/lib/db";
import { brandFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CLARIFYING_QUESTIONS } from "../prompts/calendar-prompts";

export async function askCalendarQuestions(
  state: CalendarAgentStateType,
): Promise<Partial<CalendarAgentStateType>> {
  const files = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.organizationId, state.organizationId));

  const businessProfile = files.find((f) => f.type === "business_profile")?.content || "";
  const brandGuidelines = files.find((f) => f.type === "brand_guidelines")?.content || "";
  const marketResearch = files.find((f) => f.type === "market_research")?.content || "";
  const marketingStrategy = files.find((f) => f.type === "marketing_strategy")?.content || "";

  state.emitEvent("message", {
    role: "agent",
    content:
      "Great news -- your brand DNA is ready! Before I create your content calendar, I need a few quick clarifications to make sure it's perfectly tailored to your goals.",
  });

  const questions = JSON.parse(CLARIFYING_QUESTIONS);
  state.emitEvent("question_card", {
    questions,
    wizardId: `calendar-wizard-${state.organizationId}`,
  });

  return {
    businessProfile,
    brandGuidelines,
    marketResearch,
    marketingStrategy,
  };
}
