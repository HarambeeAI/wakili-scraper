import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  websiteUrl: Annotation<string>,
  selectedServices: Annotation<string[]>,
  organizationId: Annotation<string>,

  crawledContent: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  crawledHtml: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  screenshots: Annotation<string[]>({
    value: (_prev, next) => next,
    default: () => [],
  }),
  logoUrl: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  extractedStyles: Annotation<{ colors: string[]; fonts: string[] }>({
    value: (_prev, next) => next,
    default: () => ({ colors: [], fonts: [] }),
  }),
  siteMetadata: Annotation<Record<string, string | undefined>>({
    value: (_prev, next) => next,
    default: () => ({}),
  }),

  businessProfile: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  brandGuidelines: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  marketResearch: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),
  marketingStrategy: Annotation<string>({
    value: (_prev, next) => next,
    default: () => "",
  }),

  emitEvent: Annotation<(event: string, data: Record<string, unknown>) => void>,
});

export type AgentStateType = typeof AgentState.State;
