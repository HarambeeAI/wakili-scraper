import { StateGraph, Command, Send } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import {
  AGENT_TYPES,
  COS_DIRECT_REPORTS,
  COO_REPORTS,
  AGENT_DISPLAY_NAMES,
  type AgentTypeId,
} from "../types/agent-types.js";
import { callLLM, callLLMWithStructuredOutput } from "../llm/client.js";
import { createReadMemoryNode } from "../memory/read-memory.js";

// Import all direct-report graph factories
import { createAccountantGraph } from "../agents/accountant.js";
import { createMarketerGraph } from "../agents/marketer.js";
import { createSalesRepGraph } from "../agents/sales-rep.js";
import { createPersonalAssistantGraph } from "../agents/personal-assistant.js";
import { createCOOGraph } from "../agents/coo.js";

// ── CoS Router Prompt ─────────────────────────────────────────────────────────

const COS_ROUTER_PROMPT = `You are the Chief of Staff router for a business AI team. Analyze the user's message and decide how to route it.

You manage these direct reports:
- accountant: Financial questions, invoices, transactions, cashflow, P&L, budgets, taxes
- marketer: Content creation, social media, brand, analytics, competitor analysis
- sales_rep: Leads, prospecting, outreach, pipeline, deals, proposals, follow-ups
- personal_assistant: Email, calendar, meetings, tasks, time management, Google Workspace
- coo: Operational matters including customer support, legal/compliance, HR, PR, procurement, data analysis, project management

Routing rules:
1. If the request clearly maps to ONE specialist -> route: "single", agents: ["that_agent"]
2. If the request spans MULTIPLE departments -> route: "multi", agents: ["agent1", "agent2"]
3. If the request is general (how's my business, what should I focus on, team status) -> route: "direct" (you answer directly)
4. For operational topics (contracts, hiring, support tickets, etc.) -> always route to "coo"
5. Never route to more than 3 agents at once

Respond with the classification.`;

const ROUTING_SCHEMA = `{
  "route": "single | multi | direct",
  "agents": ["agent_type_id"],
  "reasoning": "brief explanation"
}`;

const COS_DIRECT_RESPONSE_PROMPT = `You are the Chief of Staff for this business — the CEO's strategic right hand. You synthesize insights across all departments, set priorities, and provide high-level guidance.

When answering directly:
- Draw on the business context and your accumulated memory
- Be concise but actionable
- If you don't have enough information, say what you need
- For specific departmental questions, suggest the user ask the relevant specialist

You are NOT a general chatbot. You are a strategic advisor focused on this specific business.`;

// All valid routing targets: the 5 direct reports + "cosRespond" for direct answers
const ALL_COS_TARGETS = [...COS_DIRECT_REPORTS, "cosRespond"] as string[];

// ── Router Node ───────────────────────────────────────────────────────────────

function createCosRouterNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const { data } = await callLLMWithStructuredOutput<{
      route: "single" | "multi" | "direct";
      agents: string[];
      reasoning: string;
    }>([new HumanMessage(content)], ROUTING_SCHEMA, {
      systemPrompt: COS_ROUTER_PROMPT,
      temperature: 0.1,
    });

    // Direct response — CoS handles it
    if (data.route === "direct" || !data.agents || data.agents.length === 0) {
      return new Command({ goto: "cosRespond" });
    }

    // Validate agents are in COS_DIRECT_REPORTS (or remap operational agents to coo)
    const validatedAgents = data.agents
      .map((a) => {
        if (COS_DIRECT_REPORTS.includes(a as AgentTypeId)) return a;
        // If LLM returns a COO report agent directly, remap to coo
        if (COO_REPORTS.includes(a as AgentTypeId)) return AGENT_TYPES.COO;
        return null;
      })
      .filter((a): a is string => a !== null);

    // Deduplicate (e.g., if multiple operational agents all map to coo)
    const uniqueAgents = [...new Set(validatedAgents)];

    if (uniqueAgents.length === 0) {
      return new Command({ goto: "cosRespond" });
    }

    // Single agent routing via Command
    if (data.route === "single" || uniqueAgents.length === 1) {
      return new Command({
        goto: uniqueAgents[0],
        update: { agentType: uniqueAgents[0] as AgentTypeId },
      });
    }

    // Multi-agent parallel fan-out via Send
    return new Command({
      goto: uniqueAgents.map((agent) => new Send(agent, { ...state, agentType: agent as AgentTypeId })),
    });
  };
}

// ── CoS Respond Node ──────────────────────────────────────────────────────────

function createCosRespondNode() {
  return async (state: typeof AgentState.State) => {
    const result = await callLLM(state.messages, {
      systemPrompt: COS_DIRECT_RESPONSE_PROMPT,
      temperature: 0.7,
      maxTokens: 2048,
    });

    return {
      messages: [new AIMessage({ content: result.content })],
      responseMetadata: {
        agentType: AGENT_TYPES.CHIEF_OF_STAFF as AgentTypeId,
        agentDisplayName: AGENT_DISPLAY_NAMES[AGENT_TYPES.CHIEF_OF_STAFF],
        tokensUsed: result.tokensUsed,
      },
    };
  };
}

// ── Subgraph Node Wrappers ────────────────────────────────────────────────────

// Each direct-report agent is wrapped as an invoke-delegate node.
// This avoids checkpointer conflicts between parent and child graphs.
function createSubgraphNode(
  factory: (cp?: PostgresSaver) => ReturnType<typeof createAccountantGraph>,
  checkpointer?: PostgresSaver,
) {
  return async (state: typeof AgentState.State) => {
    const graph = factory(checkpointer);
    const result = await graph.invoke(state);
    return result;
  };
}

// Graph factory map: agent type ID -> compiled subgraph factory
const DIRECT_REPORT_FACTORIES: Record<
  string,
  (cp?: PostgresSaver) => ReturnType<typeof createAccountantGraph>
> = {
  [AGENT_TYPES.ACCOUNTANT]: createAccountantGraph,
  [AGENT_TYPES.MARKETER]: createMarketerGraph,
  [AGENT_TYPES.SALES_REP]: createSalesRepGraph,
  [AGENT_TYPES.PERSONAL_ASSISTANT]: createPersonalAssistantGraph,
  [AGENT_TYPES.COO]: createCOOGraph,
};

// ── Supervisor Graph Factory ──────────────────────────────────────────────────

/**
 * Creates the Chief of Staff root supervisor StateGraph.
 *
 * Topology:
 *   __start__ -> readMemory -> cosRouter -> [specialist subgraph node] -> __end__
 *                                        -> cosRespond                 -> __end__
 *
 * The cosRouter node calls callLLMWithStructuredOutput to classify the user's
 * message into one of three routing modes:
 *   - "single": Command({ goto: agentType }) for single specialist dispatch
 *   - "multi":  Command({ goto: [Send(agent1,...), Send(agent2,...)] }) for parallel fan-out
 *   - "direct": Command({ goto: "cosRespond" }) for CoS to answer directly
 *
 * The root graph is compiled WITH a checkpointer for full state persistence.
 * Subgraph nodes use the invoke-delegate pattern (no nested checkpointer).
 *
 * @param checkpointer  Optional PostgresSaver — required for production, optional for testing
 */
export function createSupervisorGraph(checkpointer?: PostgresSaver) {
  // Cast to `any` to allow dynamic node registration via COS_DIRECT_REPORTS loop.
  // TypeScript narrows the StateGraph generic on each `.addNode()` call, making
  // iterative registration with string keys impossible without the cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder: any = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("cosRouter", createCosRouterNode(), {
      ends: ALL_COS_TARGETS,
    })
    .addNode("cosRespond", createCosRespondNode())
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "cosRouter")
    .addEdge("cosRespond", "__end__");

  // Register each direct-report agent as an invoke-delegate subgraph node
  for (const agentType of COS_DIRECT_REPORTS) {
    const factory = DIRECT_REPORT_FACTORIES[agentType];
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
