import { StateGraph, Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import {
  AGENT_TYPES,
  COO_REPORTS,
  AGENT_DISPLAY_NAMES,
  type AgentTypeId,
} from "../types/agent-types.js";
import { callLLMWithStructuredOutput } from "../llm/client.js";
import { createReadMemoryNode } from "../memory/read-memory.js";

// Import all 7 operational agent graph factories
import { createCustomerSupportGraph } from "./customer-support.js";
import { createLegalComplianceGraph } from "./legal-compliance.js";
import { createHRGraph } from "./hr.js";
import { createPRCommsGraph } from "./pr-comms.js";
import { createProcurementGraph } from "./procurement.js";
import { createDataAnalystGraph } from "./data-analyst.js";
import { createOperationsGraph } from "./operations.js";

// ── COO Router Prompt ────────────────────────────────────────────────────────

const COO_ROUTER_PROMPT = `You are the COO (Chief Operating Officer) router. Your job is to analyze the user's message and determine which operational department should handle it.

Available departments:
- customer_support: Customer tickets, support queries, customer health, churn detection
- legal_compliance: Contracts, legal review, compliance, regulatory matters
- hr: Hiring, recruitment, employee onboarding, performance reviews, job postings
- pr_comms: Press releases, media coverage, brand sentiment, public communications
- procurement: Supplier search, purchase orders, vendor management, quote comparison
- data_analyst: Data queries, analytics, KPIs, statistical analysis, anomaly detection
- operations: Project management, milestones, process optimization, SOPs, bottleneck analysis

Classify the message to EXACTLY ONE department.`;

const ROUTING_SCHEMA = `{ "department": "one of: customer_support | legal_compliance | hr | pr_comms | procurement | data_analyst | operations", "reasoning": "brief explanation of why this department" }`;

// ── Router Node ──────────────────────────────────────────────────────────────

// Router node: LLM classifies the request, returns Command to route to the appropriate subgraph
function createRouterNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const { data } = await callLLMWithStructuredOutput<{
      department: string;
      reasoning: string;
    }>([new HumanMessage(content)], ROUTING_SCHEMA, {
      systemPrompt: COO_ROUTER_PROMPT,
      temperature: 0.1,
    });

    // Validate department is in COO_REPORTS — fallback to operations if unexpected
    const targetAgent: AgentTypeId = COO_REPORTS.includes(
      data.department as AgentTypeId,
    )
      ? (data.department as AgentTypeId)
      : AGENT_TYPES.OPERATIONS;

    return new Command({
      goto: targetAgent,
      update: {
        agentType: targetAgent,
      },
    });
  };
}

// ── Subgraph Node Wrappers ───────────────────────────────────────────────────

// Each operational agent is wrapped as an invoke-delegate node.
// LangGraph JS supports passing a compiled graph directly to addNode, but to
// avoid subgraph checkpointer conflicts we use the invoke-delegate pattern:
// the COO graph invokes each subgraph synchronously and merges the state update.
//
// Factory typed as `any` — heterogeneous compiled graph topologies (csTools,
// legalTools, hrTools, etc.) cannot share a typed factory signature because
// TypeScript narrows StateGraph generics per addNode call. Follows Phase 13-05 pattern.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSubgraphNode(
  factory: (cp?: PostgresSaver) => any,
  checkpointer?: PostgresSaver,
) {
  return async (state: typeof AgentState.State) => {
    const graph = factory(checkpointer);
    const result = await graph.invoke(state);
    return result;
  };
}

// ── COO Graph Factory ────────────────────────────────────────────────────────

/**
 * Creates the COO level-2 supervisor StateGraph.
 *
 * Topology:
 *   __start__ -> readMemory -> router -> [one of 7 ops subgraph nodes] -> __end__
 *
 * The router node returns Command({ goto: agentType }) to direct execution to
 * the correct operational agent subgraph. Each subgraph node invokes the full
 * base-agent graph (readMemory -> llmNode -> writeMemory -> respond) and returns
 * its state update back into the COO graph state.
 *
 * The COO itself is compiled WITHOUT a checkpointer — the parent Chief of Staff
 * graph owns persistence. Pass `checkpointer` only when running the COO standalone.
 */
export function createCOOGraph(checkpointer?: PostgresSaver) {
  // Cast to `any` to allow dynamic node registration via COO_REPORTS loop.
  // TypeScript narrows the StateGraph generic on each `.addNode()` call, making
  // iterative registration with string keys impossible without the cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder: any = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("router", createRouterNode(), {
      ends: [...COO_REPORTS],
    })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "router");

  // Map of agent type ID to graph factory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opsFactories: Record<string, (cp?: PostgresSaver) => any> = {
    [AGENT_TYPES.CUSTOMER_SUPPORT]: createCustomerSupportGraph,
    [AGENT_TYPES.LEGAL_COMPLIANCE]: createLegalComplianceGraph,
    [AGENT_TYPES.HR]: createHRGraph,
    [AGENT_TYPES.PR_COMMS]: createPRCommsGraph,
    [AGENT_TYPES.PROCUREMENT]: createProcurementGraph,
    [AGENT_TYPES.DATA_ANALYST]: createDataAnalystGraph,
    [AGENT_TYPES.OPERATIONS]: createOperationsGraph,
  };

  // Register each operational agent as a subgraph node
  for (const agentType of COO_REPORTS) {
    const factory = opsFactories[agentType];
    if (factory) {
      builder = builder.addNode(
        agentType,
        createSubgraphNode(factory, checkpointer),
      );
      builder = builder.addEdge(agentType, "__end__");
    }
  }

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return builder.compile(compileOpts);
}

// Re-export display name for convenient access by parent graphs
export const COO_DISPLAY_NAME = AGENT_DISPLAY_NAMES[AGENT_TYPES.COO];
