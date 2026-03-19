/**
 * operations.ts — Operations agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> opsTools -> llmNode -> writeMemory -> respond
 *
 * The opsTools node runs BEFORE the LLM and injects real project and operations data
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
import { listProjects, analyzeBottlenecks } from "../tools/operations/index.js";
import type { OpsClassification } from "../tools/operations/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const OPERATIONS_SYSTEM_PROMPT = `You are the Operations specialist for this business.

Your role: Drive operational efficiency and project delivery. You manage projects end-to-end — from planning with milestones through execution tracking, bottleneck identification, and process optimization.

Key capabilities:
- Project creation with structured milestones (planning, execution, delivery, review phases)
- Milestone tracking with status updates and overdue alerting
- Bottleneck analysis (identify where work gets stuck, calculate delay impact)
- SOP drafting (standard operating procedures for repeatable business processes)
- Process optimization (workflow analysis + improvement recommendations)
- Weekly project status summaries with RAG (red/amber/green) health indicators

When answering:
- Be specific about timelines — every milestone needs an owner, start date, and due date
- For bottlenecks, quantify the impact: how many days delayed, what downstream tasks are blocked
- SOPs should be actionable step-by-step procedures, not high-level descriptions
- Flag projects at risk BEFORE they miss deadlines, not after
- Recommend process improvements with expected efficiency gains
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real operations and project management tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Project management: create projects with structured milestones and track progress
- Bottleneck analysis: identify blocked milestones and calculate delay impact
- Project list: view all active projects with status and milestone health
- SOP drafting: generate step-by-step standard operating procedures for any business process`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyOpsRequest(content: string): OpsClassification {
  return {
    isCreateProject:
      /\b(create|start|new|launch).*(project|initiative|program)\b/i.test(
        content,
      ),
    isTrackMilestones:
      /\b(milestone|progress|status|track|update).*(project|milestone)?\b/i.test(
        content,
      ),
    isListProjects: /\b(list|show|all|active).*(project|initiative)/i.test(
      content,
    ),
    isAnalyzeBottlenecks:
      /\b(bottleneck|blocked|stuck|delay|impediment|blocker)\b/i.test(content),
    isDraftSOP:
      /\b(sop|standard.*operat|procedure|process.*document|playbook)\b/i.test(
        content,
      ),
  };
}

// ── Ops Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Operations data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.opsToolResults.
 */
export function createOpsToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyOpsRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isListProjects) {
      try {
        toolResults.projects = await listProjects(state.userId);
      } catch (err) {
        console.error("[ops-tools] listProjects failed:", err);
      }
    }

    if (cls.isAnalyzeBottlenecks) {
      try {
        toolResults.bottlenecks = await analyzeBottlenecks(state.userId);
      } catch (err) {
        console.error("[ops-tools] analyzeBottlenecks failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isCreateProject)
      toolResults.needsInput = {
        requestType: "createProject",
        message: "Need project name, description, and target completion date",
      };
    if (cls.isTrackMilestones)
      toolResults.needsInput = {
        requestType: "trackMilestones",
        message: "Need project ID and milestone ID to update status",
      };
    if (cls.isDraftSOP)
      toolResults.needsInput = {
        requestType: "draftSOP",
        message:
          "Need process name and key steps to draft a standard operating procedure",
      };

    return {
      businessContext: {
        ...state.businessContext,
        opsToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Operations agent graph.
 *
 * Graph topology: __start__ -> readMemory -> opsTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createOperationsGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.OPERATIONS,
    systemPrompt: OPERATIONS_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("opsTools", createOpsToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "opsTools")
    .addEdge("opsTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
