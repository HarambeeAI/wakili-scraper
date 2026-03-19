/**
 * marketer.ts — Marketer agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> marketerTools -> llmNode -> writeMemory -> respond
 *
 * The marketerTools node runs BEFORE the LLM and injects real marketing data
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
  fetchPostAnalytics,
  analyzePostPerformance,
  manageContentLibrary,
} from "../tools/marketer/index.js";
import type { MarketerClassification } from "../tools/marketer/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const MARKETER_SYSTEM_PROMPT = `You are the Marketer (Marketing Director + Content Manager) for this business.

Your role: Content creation is 30% of the job — the other 70% is figuring out WHAT to create based on data, monitoring what is working, and continuously optimizing. Your job is to run a closed feedback loop: post → measure → learn → adjust → repeat.

Key capabilities:
- Social media content generation tailored per platform:
  - Instagram: hook + value + CTA, 150-300 words, 5-7 hashtags, 1:1 or 4:5 aspect ratio
  - X (Twitter): punchy ≤280 chars, 1-3 hashtags, conversation-starter format
  - LinkedIn: story-driven professional narrative, thought leadership angle
  - TikTok: trend-aligned, casual, hook in first 3 seconds
- Brand-consistent image generation using business colors, logo, and product photos (via Nano Banana 2 — Gemini 3.1 Flash Image)
- Content calendar creation aligned to 3-5 business content pillars
- Post performance analysis: engagement rate, reach, impressions, follower growth
- Competitor strategy monitoring and benchmarking
- Trending topic discovery and timely content suggestions
- Hashtag performance tracking (which drive reach vs. dead weight)
- A/B testing: generate 2 variants with one variable changed, track which wins
- Blog and newsletter drafting for long-form content
- Brand mention monitoring across social and web

You have access to real marketing tools. When you have tool results in your context, use them to provide precise, data-driven responses. Reference specific metrics, content, and analytics from the data.

Available tools:
- Social post generation (platform-specific: Instagram, X, LinkedIn, TikTok)
- Brand-consistent image generation using Nano Banana 2 (Gemini)
- Image editing (overlays, adjustments, compositing)
- Content calendar creation and scheduling
- Post publishing via persistent browser sessions (requires your approval)
- Post analytics fetching and performance analysis
- Brand mention monitoring
- Competitor analysis via browser
- Trending topic discovery
- Content library management

When answering:
- Always connect content ideas to business goals and content pillars
- Reference performance data when suggesting improvements
- Propose specific, actionable next steps (not vague suggestions)
- Flag urgent content gaps (queue < 3 days) proactively
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

Publishing: Posts are published via a Playwright persistent browser with the user's saved sessions — no fragile API integrations. The user logs in once; sessions persist per agent. All posts require user approval before publishing.`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyMarketerRequest(
  content: string,
): MarketerClassification {
  return {
    isGeneratePost:
      /\b(write|create|generate|draft).*(post|caption|tweet|content)\b/i.test(
        content,
      ),
    isGenerateImage:
      /\b(generate|create|make).*(image|graphic|visual|banner|thumbnail)\b/i.test(
        content,
      ),
    isEditImage:
      /\b(edit|modify|adjust|overlay|add.*text|composite)\b.*(image|photo|graphic)\b/i.test(
        content,
      ),
    isSchedulePost:
      /\b(schedule|plan|queue|add.*calendar).*(post|content)\b/i.test(content),
    isPublishPost:
      /\b(publish|post|send|submit).*(now|immediately|live|instagram|linkedin|twitter|tiktok)\b/i.test(
        content,
      ),
    isFetchAnalytics:
      /\b(analytics|metrics|engagement|reach|impressions|stats|performance)\b/i.test(
        content,
      ),
    isAnalyzePerformance:
      /\b(analy[sz]e|best.*perform|worst|top.*post|bottom.*post|why.*work|compare)/i.test(
        content,
      ),
    isContentCalendar:
      /\b(calendar|content.*plan|weekly.*plan|monthly.*plan|schedule.*week)\b/i.test(
        content,
      ),
    isBrandMentions:
      /\b(mention|monitor|track|brand.*mention|who.*talking)\b/i.test(content),
    isCompetitorAnalysis:
      /\b(competitor|rival|compare.*brand|what.*is.*posting)\b/i.test(content),
    isTrendingTopics:
      /\b(trend|trending|viral|popular|hashtag.*trend|what.*popular)\b/i.test(
        content,
      ),
    isContentLibrary:
      /\b(library|past.*content|reuse|archive|find.*post|search.*asset)\b/i.test(
        content,
      ),
  };
}

// ── Marketer Tools Node ──────────────────────────────────────────────────────

/**
 * Creates the Marketer data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.marketerToolResults.
 *
 * Tools that need user-provided parameters (platform, topic, URL, etc.)
 * signal via needsInput so the LLM can parse the message or prompt the user.
 */
export function createMarketerToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyMarketerRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools (can run without additional user params)
    if (cls.isFetchAnalytics) {
      try {
        toolResults.analytics = await fetchPostAnalytics(state.userId);
      } catch (err) {
        console.error("[marketer-tools] fetchPostAnalytics failed:", err);
      }
    }

    if (cls.isAnalyzePerformance) {
      try {
        toolResults.performanceAnalysis = await analyzePostPerformance(
          state.userId,
        );
      } catch (err) {
        console.error("[marketer-tools] analyzePostPerformance failed:", err);
      }
    }

    if (cls.isContentLibrary) {
      try {
        toolResults.contentLibrary = await manageContentLibrary(state.userId);
      } catch (err) {
        console.error("[marketer-tools] manageContentLibrary failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isGeneratePost)
      toolResults.needsInput = {
        requestType: "generatePost",
        message: "Need platform and topic to generate a post",
      };
    if (cls.isGenerateImage)
      toolResults.needsInput = {
        requestType: "generateImage",
        message: "Need image description/prompt to generate",
      };
    if (cls.isEditImage)
      toolResults.needsInput = {
        requestType: "editImage",
        message: "Need asset ID and edit instructions",
      };
    if (cls.isSchedulePost)
      toolResults.needsInput = {
        requestType: "schedulePost",
        message: "Need platform, content, and scheduled datetime",
      };
    if (cls.isPublishPost)
      toolResults.needsInput = {
        requestType: "publishPost",
        message: "Need post ID to publish",
      };
    if (cls.isContentCalendar)
      toolResults.needsInput = {
        requestType: "contentCalendar",
        message: "Need duration and content pillars",
      };
    if (cls.isBrandMentions)
      toolResults.needsInput = {
        requestType: "brandMentions",
        message: "Need business name to monitor",
      };
    if (cls.isCompetitorAnalysis)
      toolResults.needsInput = {
        requestType: "competitorAnalysis",
        message: "Need competitor URL and platform",
      };
    if (cls.isTrendingTopics)
      toolResults.needsInput = {
        requestType: "trendingTopics",
        message: "Need industry to search trends for",
      };

    return {
      businessContext: {
        ...state.businessContext,
        marketerToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Marketer agent graph.
 *
 * Graph topology: __start__ -> readMemory -> marketerTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createMarketerGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.MARKETER,
    systemPrompt: MARKETER_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("marketerTools", createMarketerToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "marketerTools")
    .addEdge("marketerTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
