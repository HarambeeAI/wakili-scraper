import { Annotation } from "@langchain/langgraph";
import type { WizardAnswers, CalendarPost } from "@/types/calendar";

export const CalendarAgentState = Annotation.Root({
  organizationId: Annotation<string>,
  wizardAnswers: Annotation<WizardAnswers | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  businessProfile: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  brandGuidelines: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  marketResearch: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  marketingStrategy: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  calendarId: Annotation<string>({ value: (_prev, next) => next, default: () => "" }),
  calendarPosts: Annotation<CalendarPost[]>({ value: (_prev, next) => next, default: () => [] }),
  contentPillars: Annotation<string[]>({ value: (_prev, next) => next, default: () => [] }),
  calendarApproved: Annotation<boolean>({ value: (_prev, next) => next, default: () => false }),
  generatedContentCount: Annotation<number>({ value: (_prev, next) => next, default: () => 0 }),
  emitEvent: Annotation<(event: string, data: Record<string, unknown>) => void>,
});

export type CalendarAgentStateType = typeof CalendarAgentState.State;
