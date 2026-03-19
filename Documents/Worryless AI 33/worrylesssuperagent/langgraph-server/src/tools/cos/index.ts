/**
 * tools/cos/index.ts — Barrel export for all Chief of Staff tools.
 *
 * These are plain async/sync functions (NOT LangChain Tool objects).
 * The CoS agent calls them explicitly in its LLM node based on request classification.
 *
 * Tool map:
 *   COS-01  compileMorningBriefing  — heartbeat log + agent_tasks + calendar placeholder
 *   COS-02  createDelegationCommand — LangGraph Command with goalChain for single-agent routing
 *   COS-03  createFanOutSends       — LangGraph Command with Send[] for parallel dispatch
 *   COS-04  queryCrossAgentMemory   — Cross-namespace Store search aggregating all agent memories
 *   COS-05  correlateFindings       — LLM structured-output cross-agent pattern detection
 *   COS-06  trackActionItems        — agent_tasks query for active CoS-tracked items
 *   COS-07  assessAgentHealth       — user_agents + heartbeat_log health grid
 */

export {
  compileMorningBriefing,
  type BriefingSection,
  type BriefingItem,
} from "./compile-morning-briefing.js";

export {
  createDelegationCommand,
  type DelegationRequest,
} from "./delegate-to-agent.js";

export {
  createFanOutSends,
  type FanOutRequest,
} from "./fan-out-to-agents.js";

export {
  queryCrossAgentMemory,
  type CrossAgentMemoryResult,
} from "./query-cross-agent-memory.js";

export {
  correlateFindings,
  type CorrelationResult,
  type FindingInput,
  type Correlation,
} from "./correlate-findings.js";

export {
  trackActionItems,
  type ActionItem,
} from "./track-action-items.js";

export {
  assessAgentHealth,
  type AgentHealthReport,
  type AgentHealthEntry,
} from "./assess-agent-health.js";
