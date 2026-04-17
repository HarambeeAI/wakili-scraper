import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  websiteUrl: Annotation<string>,
  selectedServices: Annotation<string[]>,
  organizationId: Annotation<string>,

  crawledContent: Annotation<string>({ default: () => "" }),
  crawledHtml: Annotation<string>({ default: () => "" }),
  screenshots: Annotation<string[]>({ default: () => [] }),
  logoUrl: Annotation<string | null>({ default: () => null }),
  extractedStyles: Annotation<{ colors: string[]; fonts: string[] }>({
    default: () => ({ colors: [], fonts: [] }),
  }),
  siteMetadata: Annotation<Record<string, string | undefined>>({
    default: () => ({}),
  }),

  businessProfile: Annotation<string>({ default: () => "" }),
  brandGuidelines: Annotation<string>({ default: () => "" }),
  marketResearch: Annotation<string>({ default: () => "" }),
  marketingStrategy: Annotation<string>({ default: () => "" }),

  emitEvent: Annotation<
    (event: string, data: Record<string, unknown>) => void
  >,
});

export type AgentStateType = typeof AgentState.State;
