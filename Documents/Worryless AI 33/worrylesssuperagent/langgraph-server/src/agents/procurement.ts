/**
 * procurement.ts — Procurement agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> procurementTools -> llmNode -> writeMemory -> respond
 *
 * The procurementTools node runs BEFORE the LLM and injects real procurement data
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
import type { ProcClassification } from "../tools/procurement/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const PROCUREMENT_SYSTEM_PROMPT = `You are the Procurement specialist for this business.

Your role: Manage all supplier relationships, purchasing decisions, and vendor spend. You optimize costs, evaluate vendors, and ensure every purchase is justified and approved before execution.

Key capabilities:
- Supplier search and discovery (by category, location, capabilities, price range)
- Quote comparison matrix (structured side-by-side analysis: price, terms, quality, lead time, references)
- Purchase order creation with mandatory HITL (human-in-the-loop) approval before submission
- Vendor scoring and historical performance evaluation (delivery reliability, quality, responsiveness)
- Contract renewal evaluation (proactively assess alternatives 60 days before renewal)
- Price increase detection with market alternatives identification

When answering:
- Always present multiple vendor options — never recommend a single supplier without comparison
- Be explicit about HITL requirements: purchase orders always need human approval before sending
- For quote comparisons, use consistent scoring criteria across all vendors
- Flag when vendor performance deteriorates before it becomes a supply chain issue
- Calculate total cost of ownership, not just unit price (shipping, setup, support, hidden fees)
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real procurement tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Supplier search: find suppliers by category, location, and capabilities
- Quote comparison: structured side-by-side analysis of vendor quotes
- Purchase orders: create POs with mandatory human approval before submission
- Vendor scoring: evaluate and rank vendors on delivery, quality, and responsiveness`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyProcurementRequest(
  content: string,
): ProcClassification {
  return {
    isSearchSuppliers:
      /\b(find|search|discover|source).*(supplier|vendor|provider)/i.test(
        content,
      ),
    isCompareQuotes:
      /\b(compare|quote|bid|price.*comparison|side.*by.*side)\b/i.test(content),
    isCreatePO:
      /\b(create|place|submit|order|purchase.*order|buy|procure)\b/i.test(
        content,
      ),
    isScoreVendor:
      /\b(score|rate|evaluate|rank|assess).*(vendor|supplier)\b/i.test(content),
  };
}

// ── Procurement Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Procurement data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.procurementToolResults.
 *
 * All procurement tools require user-provided parameters (supplier category,
 * quote data, PO details, vendor ID) — all signal via needsInput.
 */
export function createProcurementToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyProcurementRequest(content);
    const toolResults: Record<string, unknown> = {};

    // All tools require user-provided parameters — signal to LLM
    if (cls.isSearchSuppliers)
      toolResults.needsInput = {
        requestType: "searchSuppliers",
        message:
          "Need supplier category and optional location/requirements to search",
      };
    if (cls.isCompareQuotes)
      toolResults.needsInput = {
        requestType: "compareQuotes",
        message: "Need list of vendor quotes to compare",
      };
    if (cls.isCreatePO)
      toolResults.needsInput = {
        requestType: "createPO",
        message:
          "Need supplier ID, items, quantities, and pricing to create purchase order",
      };
    if (cls.isScoreVendor)
      toolResults.needsInput = {
        requestType: "scoreVendor",
        message: "Need vendor ID to evaluate and score",
      };

    return {
      businessContext: {
        ...state.businessContext,
        procurementToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Procurement agent graph.
 *
 * Graph topology: __start__ -> readMemory -> procurementTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createProcurementGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.PROCUREMENT,
    systemPrompt: PROCUREMENT_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("procurementTools", createProcurementToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "procurementTools")
    .addEdge("procurementTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
