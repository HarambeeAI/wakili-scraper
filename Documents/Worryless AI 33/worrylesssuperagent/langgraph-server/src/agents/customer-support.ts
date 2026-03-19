/**
 * customer-support.ts — Customer Support agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> csTools -> llmNode -> writeMemory -> respond
 *
 * The csTools node runs BEFORE the LLM and injects real support data
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
  listTickets,
  detectChurnRisk,
} from "../tools/customer-support/index.js";
import type { CSClassification } from "../tools/customer-support/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const CUSTOMER_SUPPORT_SYSTEM_PROMPT = `You are the Customer Support specialist for this business.

Your role: Handle all customer-facing support operations. You manage the full support lifecycle — from initial ticket triage through resolution and follow-up — and proactively monitor customer health to prevent churn.

Key capabilities:
- Ticket creation, triage, and management (priority assignment, routing, status updates)
- Knowledge base search and RAG-grounded response drafting
- Customer health scoring (engagement + ticket frequency + sentiment analysis)
- Churn risk detection (pattern matching on historical churn signals)
- Post-resolution follow-up (7-day check-in after ticket closure)
- Proactive at-risk customer flagging (3+ tickets per week = at-risk signal)

When answering:
- Always acknowledge the customer's specific issue, not a generic version of it
- Provide concrete next steps, not vague advice
- Flag urgent or escalating situations for immediate attention
- When drafting responses, match the business's communication style
- Identify patterns across tickets to surface systemic product/service issues
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real customer support tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Ticket management: create, list, and update support tickets
- Knowledge base: search KB articles and draft RAG-grounded responses
- Customer health: score customer health and detect churn risk signals`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyCSRequest(content: string): CSClassification {
  return {
    isCreateTicket: /\b(create|open|new|submit|file).*(ticket|issue|case|request)\b/i.test(content),
    isListTickets: /\b(list|show|get|view|open).*(ticket|issue|case|queue)\b/i.test(content),
    isUpdateTicket: /\b(update|close|resolve|change.*status).*(ticket|issue|case)\b/i.test(content),
    isSearchKB: /\b(search|find|look up|knowledge|help|how to|documentation|faq)\b/i.test(content),
    isHealthScore: /\b(health|score|satisfaction|customer.*health)\b/i.test(content),
    isChurnDetection: /\b(churn|at.?risk|losing|retention|leaving)\b/i.test(content),
  };
}

// ── CS Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Customer Support data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.csToolResults.
 */
export function createCSToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyCSRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isListTickets) {
      try {
        toolResults.tickets = await listTickets(state.userId);
      } catch (err) {
        console.error("[cs-tools] listTickets failed:", err);
      }
    }

    if (cls.isChurnDetection) {
      try {
        toolResults.churnRisks = await detectChurnRisk(state.userId);
      } catch (err) {
        console.error("[cs-tools] detectChurnRisk failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isCreateTicket)
      toolResults.needsInput = {
        requestType: "createTicket",
        message: "Need customer ID, subject, and description to create a ticket",
      };
    if (cls.isUpdateTicket)
      toolResults.needsInput = {
        requestType: "updateTicket",
        message: "Need ticket ID and new status or resolution details",
      };
    if (cls.isSearchKB)
      toolResults.needsInput = {
        requestType: "searchKB",
        message: "Need search query to look up knowledge base articles",
      };
    if (cls.isHealthScore)
      toolResults.needsInput = {
        requestType: "healthScore",
        message: "Need customer ID to compute health score",
      };

    return {
      businessContext: {
        ...state.businessContext,
        csToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Customer Support agent graph.
 *
 * Graph topology: __start__ -> readMemory -> csTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createCustomerSupportGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.CUSTOMER_SUPPORT,
    systemPrompt: CUSTOMER_SUPPORT_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("csTools", createCSToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "csTools")
    .addEdge("csTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
