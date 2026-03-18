import { StateGraph, Command } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import { AGENT_DISPLAY_NAMES, type AgentTypeId } from "../types/agent-types.js";
import { callLLM } from "../llm/client.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";

export interface BaseAgentConfig {
  agentType: AgentTypeId;
  systemPrompt: string;
  temperature?: number;  // default 0.7
  maxTokens?: number;    // default 2048
}

// Builds the LLM node for a specific agent — injects memory and business context
function createLLMNode(config: BaseAgentConfig) {
  return async (state: typeof AgentState.State) => {
    const memoryStr =
      Object.keys(state.memoryContext.agentMemory).length > 0
        ? `\n\nYour accumulated memory/learnings:\n${JSON.stringify(state.memoryContext.agentMemory, null, 2)}`
        : "";

    const bizStr =
      Object.keys(state.memoryContext.businessContext).length > 0
        ? `\n\nBusiness context:\n${JSON.stringify(state.memoryContext.businessContext, null, 2)}`
        : "";

    const fullSystemPrompt = config.systemPrompt + memoryStr + bizStr;

    const result = await callLLM(state.messages, {
      systemPrompt: fullSystemPrompt,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
    });

    return {
      messages: [new AIMessage({ content: result.content })],
      responseMetadata: {
        agentType: config.agentType,
        agentDisplayName: AGENT_DISPLAY_NAMES[config.agentType],
        tokensUsed: result.tokensUsed,
      },
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
