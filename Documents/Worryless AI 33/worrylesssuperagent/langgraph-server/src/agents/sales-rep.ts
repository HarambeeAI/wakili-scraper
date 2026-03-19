/**
 * sales-rep.ts — Sales Rep agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> salesTools -> llmNode -> writeMemory -> respond
 *
 * The salesTools node runs BEFORE the LLM and injects real pipeline/engagement
 * data into state.businessContext.salesToolResults so the LLM always has
 * specific, data-driven context to work with.
 *
 * Tool execution is DETERMINISTIC based on regex heuristics (classifySalesRequest).
 * No LLM call is made for routing — this matches the CoS cosTools pattern.
 */

import { StateGraph } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import type { UIComponent } from "../types/agent-state.js";
import { AGENT_TYPES } from "../types/agent-types.js";
import {
  createLLMNode,
  createRespondNode,
  type BaseAgentConfig,
} from "./base-agent.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";
import {
  analyzePipeline,
  detectStaleDeals,
  forecastRevenue,
  trackEmailEngagement,
  type SalesClassification,
} from "../tools/sales/index.js";
import type { PipelineAnalysis } from "../tools/sales/types.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const SALES_REP_SYSTEM_PROMPT = `You are the Sales Rep (Business Development Manager) for this business.

Your role: Own the FULL sales cycle — from prospecting to close. The closed loop: prospect → research → outreach → follow-up → qualify → propose → close → manage relationship. A great sales rep never lets a warm lead go cold.

Key capabilities:
- Lead generation using Apify Leads Finder API (by keyword, industry, location, job title, company size — up to 100 leads per batch)
- Prospect research via Firecrawl web scraping + Playwright browser: scrape company website, LinkedIn, recent news, social presence — synthesize into a research brief
- Personalized outreach email composition: under 150 words, highly personalized using research + business value props + prospect's pain points
- Email sending and tracking via Resend API (all outreach requires user approval before sending)
- Pipeline management: move deals through stages (Prospecting → Contacted → Responded → Qualified → Proposal → Closed Won / Closed Lost)
- Follow-up scheduling based on optimal timing learned from past outreach performance
- Sales proposal creation: executive summary, solution fit, pricing, timeline, terms
- Pipeline analytics: conversion rates by stage, average deal cycle time, win/loss ratio, revenue forecast
- Stale deal detection: flag deals stuck in a stage longer than average with re-engagement suggestions
- Win/loss analysis: identify patterns in what closes deals vs. what kills them
- Email engagement monitoring: track opens, clicks, replies on sent outreach

When answering:
- Always know the current pipeline status and flag what needs attention today
- Prioritize follow-ups by heat signal (email opens, time in stage, deal value)
- Provide specific personalized email drafts, not generic templates
- Never let a warm lead wait more than 3 days without follow-up
- Flag deals at risk of going cold immediately

You have access to real sales tools including Apify lead generation, Firecrawl prospect research, Resend email delivery, and pipeline management. When you have tool results in your context, use them to provide specific, data-driven sales insights. Reference actual numbers, names, and pipeline positions.

Tools integrated: Apify (leads), Firecrawl (research), Resend (outreach), Playwright (competitor and prospect research).`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for routing.
 */
export function classifySalesRequest(content: string): SalesClassification {
  return {
    isLeadGeneration:
      /\b(find|generate|discover|get).*(leads?|prospects?|contacts?)\b/i.test(
        content,
      ),
    isLeadEnrich:
      /\b(enrich|enhance|lookup|more.*info|details.*about).*(lead|contact|company)\b/i.test(
        content,
      ),
    isProspectResearch:
      /\b(research|investigate|background|look.*up|scrape).*(company|prospect|website)\b/i.test(
        content,
      ),
    isComposeOutreach:
      /\b(write|draft|compose|create).*(email|outreach|message)\b/i.test(
        content,
      ),
    isSendOutreach:
      /\b(send|deliver|dispatch).*(email|outreach|message)\b/i.test(content),
    isEmailEngagement:
      /\b(open|click|engage|track|response|reply).*(email|outreach)\b/i.test(
        content,
      ),
    isDealStatusUpdate:
      /\b(move|update|change|advance).*(deal|lead|status|stage|pipeline)\b/i.test(
        content,
      ),
    isScheduleFollowUp:
      /\b(schedule|plan|set|remind).*(follow.?up|callback|check.?in)\b/i.test(
        content,
      ),
    isCreateProposal:
      /\b(create|write|draft|generate).*(proposal|quote|offer)\b/i.test(
        content,
      ),
    isPipelineAnalysis:
      /\b(pipeline|funnel|stages?|conversion|velocity|deal.*count)\b/i.test(
        content,
      ),
    isRevenueForcast:
      /\b(forecast|project|predict|revenue|how.*much.*revenue)\b/i.test(
        content,
      ),
    isStaleDeals:
      /\b(stale|stuck|cold|inactive|aging|dormant).*(deal|lead|pipeline)\b/i.test(
        content,
      ),
  };
}

// ── Sales Tools Node Factory ───────────────────────────────────────────────────

/**
 * Creates the Sales Rep data-gathering node.
 *
 * Runs BEFORE llmNode and injects tool results into
 * state.businessContext.salesToolResults for the LLM to reference.
 *
 * Tools that require extracted parameters (leadId, URL, query string) set a
 * needsInput flag — the LLM will parse specifics from the user message and
 * respond with targeted data-gathering instructions.
 */
export function createSalesToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const classification = classifySalesRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Pipeline analysis — no input parameters needed
    if (classification.isPipelineAnalysis) {
      try {
        toolResults.pipeline = await analyzePipeline(state.userId);
      } catch (err) {
        console.error("[sales-tools] analyzePipeline failed:", err);
      }
    }

    // Stale deal detection — no input parameters needed
    if (classification.isStaleDeals) {
      try {
        toolResults.staleDeals = await detectStaleDeals(state.userId);
      } catch (err) {
        console.error("[sales-tools] detectStaleDeals failed:", err);
      }
    }

    // Revenue forecast — no input parameters needed (calls analyzePipeline internally)
    if (classification.isRevenueForcast) {
      try {
        toolResults.forecast = await forecastRevenue(state.userId);
      } catch (err) {
        console.error("[sales-tools] forecastRevenue failed:", err);
      }
    }

    // Email engagement — no input parameters needed (reads all tracked emails for user)
    if (classification.isEmailEngagement) {
      try {
        toolResults.engagement = await trackEmailEngagement(state.userId);
      } catch (err) {
        console.error("[sales-tools] trackEmailEngagement failed:", err);
      }
    }

    // Tools that need extracted parameters — signal to LLM to parse from the message
    if (classification.isLeadGeneration) {
      toolResults.needsInput = true;
      toolResults.requestType = "lead_generation";
    }

    if (classification.isLeadEnrich) {
      toolResults.needsInput = true;
      toolResults.requestType = "enrichment";
    }

    if (classification.isProspectResearch) {
      toolResults.needsInput = true;
      toolResults.requestType = "prospect_research";
    }

    if (classification.isComposeOutreach) {
      toolResults.needsInput = true;
      toolResults.requestType = "compose_outreach";
    }

    if (classification.isSendOutreach) {
      toolResults.needsInput = true;
      toolResults.requestType = "send_outreach";
    }

    // ── Build UIComponents for generative UI ──────────────────────────────
    const uiComponents: UIComponent[] = [];

    if (classification.isPipelineAnalysis && toolResults.pipeline) {
      const pipeline = toolResults.pipeline as PipelineAnalysis;
      // Transform PipelineStageRow[] to PipelineKanban deals format:
      // PipelineKanban expects deals[] with { id, name, status, value? }
      const deals = pipeline.byStage.map((s) => ({
        id: s.status,
        name: `${s.deal_count} deal${s.deal_count !== 1 ? "s" : ""}`,
        status: s.status,
        value: s.total_deal_value ?? 0,
      }));
      uiComponents.push({
        type: "pipeline_kanban",
        props: { deals },
      });
    }

    // Merge tool results into businessContext for the downstream LLM node
    return {
      businessContext: {
        ...state.businessContext,
        salesToolResults: toolResults,
      },
      ...(uiComponents.length > 0 ? { uiComponents } : {}),
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Builds and compiles the Sales Rep agent graph.
 *
 * Topology: __start__ -> readMemory -> salesTools -> llmNode -> writeMemory -> respond
 *
 * The salesTools node injects real pipeline data before the LLM runs, enabling
 * specific, data-driven sales insights in every response.
 */
export function createSalesRepGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.SALES_REP,
    systemPrompt: SALES_REP_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("salesTools", createSalesToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "salesTools")
    .addEdge("salesTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
