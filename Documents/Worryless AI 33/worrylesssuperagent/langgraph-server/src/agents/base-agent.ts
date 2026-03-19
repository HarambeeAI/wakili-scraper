import { StateGraph, Command } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import type { ResponseMetadata } from "../types/agent-state.js";
import { AGENT_DISPLAY_NAMES, type AgentTypeId } from "../types/agent-types.js";
import { callLLM } from "../llm/client.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";
import {
  checkTokenBudget,
  incrementTokenUsage,
} from "../governance/token-budget.js";
import { writeAuditLog } from "../governance/audit-log.js";

export interface BaseAgentConfig {
  agentType: AgentTypeId;
  systemPrompt: string;
  temperature?: number; // default 0.7
  maxTokens?: number; // default 2048
}

// Builds the LLM node for a specific agent — injects memory and business context
// Includes governance hooks: token budget check (pre-call), audit log + token increment (post-call)
function createLLMNode(config: BaseAgentConfig) {
  return async (state: typeof AgentState.State) => {
    // Extract last message content for audit log (type guard handles BaseMessage content union)
    const lastMsg = state.messages[state.messages.length - 1];
    const content =
      typeof lastMsg.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg.content);

    // GOV-02: Check token budget before LLM call — halt if exhausted
    const budgetStatus = await checkTokenBudget(state.userId, config.agentType);
    if (budgetStatus.paused) {
      return {
        messages: [
          new AIMessage({
            content: `I've reached my monthly token budget limit (${budgetStatus.usedPct.toFixed(0)}% used). Please ask your Chief of Staff to approve a budget override so I can continue working.`,
          }),
        ],
        responseMetadata: {
          agentType: config.agentType,
          agentDisplayName: AGENT_DISPLAY_NAMES[config.agentType],
          tokensUsed: 0,
          budgetPaused: true,
        } as ResponseMetadata,
      };
    }

    const memoryStr =
      Object.keys(state.memoryContext.agentMemory).length > 0
        ? `\n\nYour accumulated memory/learnings:\n${JSON.stringify(state.memoryContext.agentMemory, null, 2)}`
        : "";

    const bizStr =
      Object.keys(state.memoryContext.businessContext).length > 0
        ? `\n\nBusiness context:\n${JSON.stringify(state.memoryContext.businessContext, null, 2)}`
        : "";

    // GOV-03: Inject goal ancestry into system prompt when present
    const goalStr =
      state.goalChain && state.goalChain.length > 0
        ? `\n\nGoal context (why you're doing this):\n${state.goalChain.map((g) => `- ${g.level}: ${g.description}`).join("\n")}`
        : "";

    const fullSystemPrompt = config.systemPrompt + memoryStr + bizStr + goalStr;

    const result = await callLLM(state.messages, {
      systemPrompt: fullSystemPrompt,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
    });

    // GOV-01: Write audit log entry (fire-and-forget — do NOT await in hot path)
    writeAuditLog({
      userId: state.userId,
      agentTypeId: config.agentType,
      action: "llm_response",
      input: {
        messageCount: state.messages.length,
        lastMessagePreview: content.slice(0, 200),
      },
      output: {
        contentLength: result.content.length,
        contentPreview: result.content.slice(0, 200),
      },
      tokensUsed: result.tokensUsed,
      goalChain: state.goalChain ?? null,
    }).catch((err) => console.error("[audit-log] Write failed:", err));

    // GOV-02: Increment token usage counter (fire-and-forget)
    incrementTokenUsage(
      state.userId,
      config.agentType,
      result.tokensUsed,
    ).catch((err) => console.error("[token-budget] Increment failed:", err));

    return {
      messages: [new AIMessage({ content: result.content })],
      responseMetadata: {
        agentType: config.agentType,
        agentDisplayName: AGENT_DISPLAY_NAMES[config.agentType],
        tokensUsed: result.tokensUsed,
        ...(budgetStatus.warned ? { budgetWarning: true } : {}),
      } as ResponseMetadata,
    };
  };
}

// Respond node: routes the completed response back to the parent supervisor graph
function createRespondNode() {
  return async (state: typeof AgentState.State) => {
    return new Command({
      graph: Command.PARENT,
      update: {
        messages: state.messages,
        responseMetadata: state.responseMetadata,
      },
    });
  };
}

/**
 * Factory: creates a compiled StateGraph for any agent type.
 *
 * Graph flow: __start__ -> readMemory -> llmNode -> writeMemory -> respond
 *
 * The `respond` node issues Command({ graph: Command.PARENT }) to route the
 * subgraph result back to the parent Chief of Staff or COO supervisor graph.
 *
 * @param config  Agent type identifier + role-specific system prompt + LLM settings
 * @param checkpointer  Optional PostgresSaver for state persistence (subgraphs typically
 *                      inherit checkpointing from the parent graph, so this is optional here)
 */
export function createBaseAgentGraph(
  config: BaseAgentConfig,
  checkpointer?: PostgresSaver,
) {
  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
