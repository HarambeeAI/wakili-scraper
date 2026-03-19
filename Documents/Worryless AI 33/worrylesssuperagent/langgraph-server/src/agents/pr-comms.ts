/**
 * pr-comms.ts — PR & Communications agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> prTools -> llmNode -> writeMemory -> respond
 *
 * The prTools node runs BEFORE the LLM and injects real PR and media data
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
  analyzeSentiment,
} from "../tools/pr/index.js";
import type { PRClassification } from "../tools/pr/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const PR_COMMS_SYSTEM_PROMPT = `You are the PR & Communications specialist for this business.

Your role: Manage all public-facing communications, media relationships, and brand reputation. You proactively monitor brand presence, draft press materials, and coordinate crisis response when needed.

Key capabilities:
- Press release drafting (launch announcements, milestones, partnerships, executive moves)
- Media mention monitoring (brand name, product names, founder name across web + social)
- Press coverage tracking (publication, journalist, reach, sentiment, follow-up status)
- Brand sentiment analysis (aggregate positive/negative/neutral across channels)
- Crisis response drafting (immediate response, holding statement, full communication plan)
- Journalist relationship management (beat reporters, pitch history, response rates)

When answering:
- Lead with the most newsworthy angle — what makes this story interesting to a journalist?
- For crisis situations, respond immediately with a holding statement recommendation
- Monitor for both positive coverage to amplify and negative coverage to address
- Track which journalists have covered similar stories and have warm relationships
- Ensure all communications are factually accurate and legally reviewed before publication
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real PR and media monitoring tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Press release: draft professional press releases for announcements and milestones
- Media monitoring: scan web and social for brand mentions
- Coverage tracking: log and track press coverage with journalist and publication details
- Sentiment analysis: aggregate brand sentiment across all monitored channels`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyPRRequest(content: string): PRClassification {
  return {
    isDraftPressRelease: /\b(draft|write|create).*(press|release|announcement)\b/i.test(content),
    isMonitorMedia: /\b(monitor|track|scan|mention|media|coverage|press)\b/i.test(content),
    isTrackCoverage: /\b(log|record|add|track).*(coverage|article|press|mention)\b/i.test(content),
    isAnalyzeSentiment: /\b(sentiment|perception|how.*look|public.*opinion|brand.*image)\b/i.test(content),
  };
}

// ── PR Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the PR & Communications data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.prToolResults.
 */
export function createPRToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyPRRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isAnalyzeSentiment) {
      try {
        toolResults.sentimentAnalysis = await analyzeSentiment(state.userId);
      } catch (err) {
        console.error("[pr-tools] analyzeSentiment failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isDraftPressRelease)
      toolResults.needsInput = {
        requestType: "draftPressRelease",
        message: "Need announcement topic, key facts, and quote for press release",
      };
    if (cls.isMonitorMedia)
      toolResults.needsInput = {
        requestType: "monitorMedia",
        message: "Need brand/product name to monitor media mentions",
      };
    if (cls.isTrackCoverage)
      toolResults.needsInput = {
        requestType: "trackCoverage",
        message: "Need publication name, URL, journalist, and sentiment for coverage log",
      };

    return {
      businessContext: {
        ...state.businessContext,
        prToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled PR & Communications agent graph.
 *
 * Graph topology: __start__ -> readMemory -> prTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createPRCommsGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.PR_COMMS,
    systemPrompt: PR_COMMS_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("prTools", createPRToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "prTools")
    .addEdge("prTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
