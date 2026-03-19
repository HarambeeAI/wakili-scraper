/**
 * legal-compliance.ts — Legal & Compliance agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> legalTools -> llmNode -> writeMemory -> respond
 *
 * The legalTools node runs BEFORE the LLM and injects real contract and compliance data
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
  listContracts,
  contractCalendar,
} from "../tools/legal/index.js";
import type { LegalClassification } from "../tools/legal/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const LEGAL_COMPLIANCE_SYSTEM_PROMPT = `You are the Legal & Compliance specialist for this business.

Your role: Manage all legal, contractual, and regulatory matters. You protect the business from legal risk through proactive contract review, calendar tracking, regulatory monitoring, and template drafting.

Key capabilities:
- Contract review with risk flag identification and key term extraction
- Contract calendar tracking (renewals, expirations, milestone dates)
- Regulatory monitoring (jurisdiction-specific + industry-specific changes)
- Template drafting (NDA, MSA, SOW, employment agreements, vendor contracts)
- Legal risk scoring and prioritized recommendations
- Compliance audit facilitation (quarterly checklists, policy reviews)

When answering:
- Always identify legal risks explicitly — do not bury them in qualifications
- Prioritize risks by severity (HIGH: immediate action required, MEDIUM: address this quarter, LOW: monitor)
- For contracts, extract key terms: parties, payment terms, termination clauses, IP ownership, liability caps
- Flag approaching deadlines proactively (30-day warning for renewals)
- Caveat that responses are for informational purposes and do not constitute legal advice
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real legal and compliance tools. When you have tool results in your context, use them to provide precise, risk-aware responses.

Available tools:
- Contract management: create, list, and review contracts with risk flag identification
- Contract calendar: track upcoming renewals and expirations (default 90-day window)
- Template drafting: generate NDA, MSA, SOW, and other agreement templates
- Regulatory monitoring: scan for jurisdiction-specific and industry-specific regulatory changes`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyLegalRequest(content: string): LegalClassification {
  return {
    isReviewContract: /\b(review|analyze|check|assess).*(contract|agreement|terms)\b/i.test(content),
    isListContracts: /\b(list|show|all|active).*(contract|agreement)\b/i.test(content),
    isDraftTemplate: /\b(draft|create|template|write).*(nda|msa|sow|contract|agreement)\b/i.test(content),
    isContractCalendar: /\b(renewal|expir|upcoming|calendar|deadline).*(contract|agreement)?\b/i.test(content),
    isMonitorRegulatory: /\b(regulat|compliance|legal.*change|law.*update|policy)\b/i.test(content),
  };
}

// ── Legal Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Legal & Compliance data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.legalToolResults.
 */
export function createLegalToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyLegalRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isListContracts) {
      try {
        toolResults.contracts = await listContracts(state.userId);
      } catch (err) {
        console.error("[legal-tools] listContracts failed:", err);
      }
    }

    if (cls.isContractCalendar) {
      try {
        toolResults.contractCalendar = await contractCalendar(state.userId);
      } catch (err) {
        console.error("[legal-tools] contractCalendar failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isReviewContract)
      toolResults.needsInput = {
        requestType: "reviewContract",
        message: "Need contract ID to review",
      };
    if (cls.isDraftTemplate)
      toolResults.needsInput = {
        requestType: "draftTemplate",
        message: "Need template type (NDA, MSA, SOW, etc.) and party details",
      };
    if (cls.isMonitorRegulatory)
      toolResults.needsInput = {
        requestType: "monitorRegulatory",
        message: "Need jurisdiction and industry to monitor regulatory changes",
      };

    return {
      businessContext: {
        ...state.businessContext,
        legalToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Legal & Compliance agent graph.
 *
 * Graph topology: __start__ -> readMemory -> legalTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createLegalComplianceGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.LEGAL_COMPLIANCE,
    systemPrompt: LEGAL_COMPLIANCE_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("legalTools", createLegalToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "legalTools")
    .addEdge("legalTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
