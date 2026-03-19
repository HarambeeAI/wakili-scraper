/**
 * data-analyst.ts — Data Analyst agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> daTools -> llmNode -> writeMemory -> respond
 *
 * The daTools node runs BEFORE the LLM and injects real cross-functional data
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
import { kpiAggregation } from "../tools/data-analyst/index.js";
import type { DAClassification } from "../tools/data-analyst/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const DATA_ANALYST_SYSTEM_PROMPT = `You are the Data Analyst for this business.

Your role: Surface cross-functional insights from all business data. You have access to every department's data — financial, sales, marketing, support, operations — and you connect dots that no single department can see on its own.

Key capabilities:
- Cross-functional data queries (invoices, leads, social posts, transactions, support tickets, projects)
- Statistical analysis (correlations, regressions, trend analysis, period-over-period comparisons)
- Anomaly detection (Z-score outlier identification across any metric)
- Chart-ready JSON generation (Recharts-compatible: line, bar, pie, scatter with tooltip data)
- KPI aggregation and calculation (revenue, conversion rates, customer health, operational efficiency)
- Daily anomaly scans across all data sources

When answering:
- Always provide context for numbers — "revenue is $50k" means nothing without a comparison
- For anomalies, explain the severity: how many standard deviations, what the expected range was
- Suggest follow-up questions the data raises, not just answers to the question asked
- Generate visualizations (chart data) whenever presenting trends or comparisons
- Connect insights across departments: "the marketing drop in week 3 correlates with the sales pipeline slowdown in week 5"
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

You have access to real data analysis tools. When you have tool results in your context, use them to provide precise, data-driven responses.

Available tools:
- Cross-functional query: query any business entity (invoices, leads, tickets, transactions, projects)
- Statistical analysis: correlations, regressions, trend analysis, period-over-period comparisons
- Anomaly detection: Z-score outlier identification across any metric
- Chart generation: Recharts-compatible JSON for line, bar, pie, and scatter charts
- KPI aggregation: aggregate key business metrics across all departments`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyDARequest(content: string): DAClassification {
  return {
    isCrossFunctionalQuery:
      /\b(query|data|report|show me|what.*is|how.*many|total|revenue|expense|leads|invoice|ticket|project)\b/i.test(
        content,
      ),
    isStatisticalAnalysis:
      /\b(statistic|correlation|regression|mean|median|average|distribution)\b/i.test(
        content,
      ),
    isAnomalyDetection:
      /\b(anomal|outlier|unusual|spike|unexpected|abnormal)/i.test(content),
    isGenerateChart:
      /\b(chart|graph|visual|plot|diagram|bar.*chart|line.*chart|pie.*chart)\b/i.test(
        content,
      ),
    isKPIAggregation:
      /\b(kpi|metric|dashboard|key.*indicator|performance.*indicator|overview|summary)\b/i.test(
        content,
      ),
  };
}

// ── DA Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Data Analyst data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.daToolResults.
 */
export function createDAToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyDARequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools
    if (cls.isKPIAggregation) {
      try {
        toolResults.kpiSummary = await kpiAggregation(state.userId);
      } catch (err) {
        console.error("[da-tools] kpiAggregation failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isCrossFunctionalQuery)
      toolResults.needsInput = {
        requestType: "crossFunctionalQuery",
        message:
          "Need query type (invoices/leads/tickets/transactions/projects) and date range",
      };
    if (cls.isStatisticalAnalysis)
      toolResults.needsInput = {
        requestType: "statisticalAnalysis",
        message:
          "Need metric name and analysis type (correlation, regression, trend)",
      };
    if (cls.isAnomalyDetection)
      toolResults.needsInput = {
        requestType: "anomalyDetection",
        message: "Need metric name to scan for anomalies",
      };
    if (cls.isGenerateChart)
      toolResults.needsInput = {
        requestType: "generateChart",
        message: "Need chart type, data source, and date range",
      };

    return {
      businessContext: {
        ...state.businessContext,
        daToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Data Analyst agent graph.
 *
 * Graph topology: __start__ -> readMemory -> daTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createDataAnalystGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.DATA_ANALYST,
    systemPrompt: DATA_ANALYST_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("daTools", createDAToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "daTools")
    .addEdge("daTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
