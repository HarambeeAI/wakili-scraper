import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { AgentTypeId } from "./agent-types.js";

// UI component directive shape (for generative UI in Phase 17)
export interface UIComponent {
  type: string;          // e.g. "chart", "table", "approval_card", "kanban"
  props: Record<string, unknown>;
}

// Pending approval shape for HITL interrupt flow
export interface PendingApproval {
  id: string;
  action: string;        // e.g. "send_email", "publish_post", "create_po"
  agentType: AgentTypeId;
  description: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Response metadata attached to each agent reply
export interface ResponseMetadata {
  agentType: AgentTypeId;
  agentDisplayName: string;
  tokensUsed?: number;
  toolCalls?: string[];
  delegatedTo?: AgentTypeId[];
}

// Memory context loaded from LangGraph Store before agent runs
export interface MemoryContext {
  agentMemory: Record<string, unknown>;
  businessContext: Record<string, unknown>;
}

// The shared state Annotation for all agent graphs
export const AgentState = Annotation.Root({
  // Inherited: messages channel with message list reducer
  ...MessagesAnnotation.spec,

  // User identity — injected by the server route from the proxy
  userId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),

  // Which agent type is currently executing
  agentType: Annotation<AgentTypeId | "">({
    reducer: (_prev, next) => next,
    default: () => "" as AgentTypeId | "",
  }),

  // Business context loaded from user's profile/onboarding data
  businessContext: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),

  // UI component directives for generative UI (Phase 17)
  uiComponents: Annotation<UIComponent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Pending HITL approvals
  pendingApprovals: Annotation<PendingApproval[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Response metadata from the last agent execution
  responseMetadata: Annotation<ResponseMetadata | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Memory context loaded from Store (read before, written after)
  memoryContext: Annotation<MemoryContext>({
    reducer: (_prev, next) => next,
    default: () => ({ agentMemory: {}, businessContext: {} }),
  }),
});
