/**
 * hr.ts — HR agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> hrTools -> llmNode -> writeMemory -> respond
 *
 * The hrTools node runs BEFORE the LLM and injects real HR and recruiting data
 * into state.businessContext so the LLM always has live data to reason over.
 *
 * Tool dispatch is deterministic (regex heuristics), not LLM function-calling.
 */

import { StateGraph } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import { AGENT_TYPES } from "../types/agent-types.js";
import {
  createLLMNode,
  createRespondNode,
  type BaseAgentConfig,
} from "./base-agent.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";
import {
  listCandidates,
} from "../tools/hr/index.js";
import type { HRClassification } from "../tools/hr/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const HR_SYSTEM_PROMPT = `You are the HR specialist for this business.

Your role: Manage the full hiring lifecycle and employee experience. From job posting through candidate screening, offer, onboarding, and performance reviews — you own every step of the people management process.

Key capabilities:
- Job posting drafting (role-specific, legally compliant, compelling)
- Resume screening and structured scoring (skills fit, experience fit, culture signals)
- Candidate pipeline tracking (prospecting → applied → screened → interview → offer → hired)
- Onboarding plan creation (30/60/90-day structured plans with milestones)
- Performance review facilitation (goal setting, mid-year check-ins, annual reviews)
- Position health monitoring (roles open >30 days trigger outreach strategy)
- New hire check-in scheduling (30/60/90-day automated follow-ups)

When answering:
- Keep hiring criteria objective and role-relevant to avoid bias
- Be specific about timelines — vague deadlines create poor candidate experience
- For active positions, always know the current pipeline status
- Flag when positions remain open too long (>30 days) with recommended actions
- Ensure onboarding plans are actionable, not generic templates
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real HR and recruiting tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Job posting: draft and publish role-specific job postings
- Resume screening: structured scoring of candidates against role requirements
- Candidate tracking: add and update candidate pipeline status
- Candidate list: view full hiring pipeline by position or stage
- Onboarding plans: create 30/60/90-day structured onboarding plans
- Performance reviews: facilitate goal setting and structured review cycles`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyHRRequest(content: string): HRClassification {
  return {
    isCreateJobPosting: /\b(create|write|draft|post).*(job|position|role|opening)\b/i.test(content),
    isScreenResume: /\b(screen|review|evaluate|assess).*(resume|cv|candidate|applicant)\b/i.test(content),
    isTrackCandidate: /\b(add|track|new).*(candidate|applicant)\b/i.test(content),
    isListCandidates: /\b(list|show|all|pipeline).*(candidate|applicant|position)\b/i.test(content),
    isOnboardingPlan: /\b(onboard|30.?60.?90|new.*hire|welcome)\b/i.test(content),
    isPerformanceReview: /\b(performance|review|feedback|evaluation|appraisal)\b/i.test(content),
  };
}

// ── HR Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the HR data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.hrToolResults.
 */
export function createHRToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyHRRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isListCandidates) {
      try {
        toolResults.candidates = await listCandidates(state.userId);
      } catch (err) {
        console.error("[hr-tools] listCandidates failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isCreateJobPosting)
      toolResults.needsInput = {
        requestType: "createJobPosting",
        message: "Need job title, requirements, and compensation range",
      };
    if (cls.isScreenResume)
      toolResults.needsInput = {
        requestType: "screenResume",
        message: "Need candidate ID and position ID to screen resume",
      };
    if (cls.isTrackCandidate)
      toolResults.needsInput = {
        requestType: "trackCandidate",
        message: "Need candidate name, email, and position ID",
      };
    if (cls.isOnboardingPlan)
      toolResults.needsInput = {
        requestType: "onboardingPlan",
        message: "Need employee name, role, and start date for onboarding plan",
      };
    if (cls.isPerformanceReview)
      toolResults.needsInput = {
        requestType: "performanceReview",
        message: "Need employee ID and review period for performance review",
      };

    return {
      businessContext: {
        ...state.businessContext,
        hrToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled HR agent graph.
 *
 * Graph topology: __start__ -> readMemory -> hrTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createHRGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.HR,
    systemPrompt: HR_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("hrTools", createHRToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "hrTools")
    .addEdge("hrTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
