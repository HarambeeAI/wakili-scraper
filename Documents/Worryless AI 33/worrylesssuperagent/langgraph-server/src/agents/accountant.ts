/**
 * accountant.ts — Accountant agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> accountantTools -> llmNode -> writeMemory -> respond
 *
 * The accountantTools node runs BEFORE the LLM and injects real financial data
 * into state.businessContext so the LLM always has live numbers to reason over.
 *
 * Tool dispatch is deterministic (regex heuristics), not LLM function-calling.
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
  listInvoices,
  calculateCashflowProjection,
  generatePLReport,
  trackBudgetVsActual,
  estimateTax,
  detectAnomalousTransactions,
  forecastRunway,
} from "../tools/accountant/index.js";
import type { AccountantClassification } from "../tools/accountant/index.js";
import type {
  PLReport,
  CashflowProjection,
  BudgetComparison,
} from "../tools/accountant/types.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const ACCOUNTANT_SYSTEM_PROMPT = `You are the Accountant (Fractional CFO + Bookkeeper) for this business.

Your role: Manage ALL money flow — cash management, forecasting, alerting, and optimizing. You record transactions, create invoices, parse bank statements and receipts, generate P&L reports, track budgets, estimate taxes, detect anomalies, and forecast cashflow.

Key capabilities:
- Invoice creation and tracking (create, list, send reminders for overdue)
- Transaction recording with auto-categorization by type (income/expense/transfer)
- Bank statement and receipt parsing (CSV, PDF, photo of receipt)
- Cashflow projection (30/60/90 days) based on recurring patterns + pending invoices
- P&L report generation with month-over-month comparison
- Budget vs. actual tracking per expense category
- Tax liability estimation based on jurisdiction and deductible expenses
- Anomalous transaction detection (amount spikes, unknown vendors, unusual patterns)
- Runway forecasting (months of cash remaining at current burn rate)
- Vendor and recurring payment pattern recognition

You have access to real financial tools. When you have tool results in your context, use them to provide precise, data-driven responses. Reference specific numbers from the data.

When answering:
- Be precise with numbers — never approximate when exact data is available
- Always specify currency and time periods
- Flag urgent financial matters proactively (overdue invoices, low runway, budget overruns)
- Provide actionable recommendations, not just data summaries
- When you lack the data to answer precisely, say exactly what information you need

Proactive monitoring: Daily cashflow snapshots, overdue invoice alerts, budget overrun flags, weekly expense summaries, monthly P&L reports, quarterly tax estimates, and urgent runway warnings when cash drops below 2 months of expenses.`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyAccountantRequest(
  content: string,
): AccountantClassification {
  return {
    isInvoiceQuery:
      /\b(invoices?|bills?|receivables?|outstanding|owed)\b/i.test(content),
    isInvoiceCreate: /\b(create|new|add|make).*(invoice|bill)\b/i.test(content),
    isTransactionRecord:
      /\b(record|log|add).*(transaction|expense|payment|income)\b/i.test(
        content,
      ),
    isBankStatementParse:
      /\b(bank.?statement|csv|upload.*statement|parse.*statement)\b/i.test(
        content,
      ),
    isReceiptParse: /\b(receipt|scan|photo|image.*expense)\b/i.test(content),
    isCashflowQuery:
      /\b(cashflow|cash.?flow|projection|forecast.*cash)\b/i.test(content),
    isPLQuery:
      /\b(p&l|profit.*loss|income.*statement|revenue.*report|financial.*report)\b/i.test(
        content,
      ),
    isBudgetQuery: /\b(budget|spending.*vs|actual.*vs|variance)\b/i.test(
      content,
    ),
    isTaxQuery: /\b(tax|deduction|liability|irs|hmrc)\b/i.test(content),
    isAnomalyQuery:
      /\b(anomal|unusual|suspicious|outlier|weird.*transaction)\b/i.test(
        content,
      ),
    isChaseInvoice:
      /\b(chase|remind|follow.*up.*invoice|overdue.*invoice|payment.*reminder)\b/i.test(
        content,
      ),
    isRunwayQuery: /\b(runway|burn.?rate|how.*long.*cash|months.*left)\b/i.test(
      content,
    ),
    isInvoicePdfGenerate:
      /\b(generate.*invoice|invoice.*pdf|create.*invoice.*doc)\b/i.test(
        content,
      ),
  };
}

// ── Accountant Tools Node ──────────────────────────────────────────────────────

/**
 * Creates the Accountant data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.accountantToolResults.
 *
 * Note: chaseOverdueInvoice uses interruptForApproval (HITL) and IS called
 * inside this graph node context. For the isChaseInvoice path, we fetch
 * overdue invoices instead — the LLM can then guide the user to specify
 * which invoice to chase, and the node handles the interrupt in context.
 */
export function createAccountantToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyAccountantRequest(content);
    const toolResults: Record<string, unknown> = {};

    if (cls.isInvoiceQuery || cls.isChaseInvoice) {
      try {
        toolResults.invoices = await listInvoices(state.userId);
      } catch (err) {
        console.error("[accountant-tools] listInvoices failed:", err);
      }
    }

    if (cls.isChaseInvoice) {
      // Provide overdue invoice list so LLM can prompt user for which invoice to chase.
      // The actual chaseOverdueInvoice with HITL interrupt is invoked in node context
      // when the user specifies an invoice ID in a follow-up turn.
      try {
        toolResults.overdueInvoices = await listInvoices(
          state.userId,
          "overdue",
        );
      } catch (err) {
        console.error("[accountant-tools] listInvoices(overdue) failed:", err);
      }
    }

    if (cls.isCashflowQuery) {
      try {
        toolResults.cashflow = await calculateCashflowProjection(state.userId);
        toolResults.runway = await forecastRunway(state.userId);
      } catch (err) {
        console.error("[accountant-tools] cashflow/runway failed:", err);
      }
    }

    if (cls.isPLQuery) {
      try {
        toolResults.plReport = await generatePLReport(state.userId);
      } catch (err) {
        console.error("[accountant-tools] generatePLReport failed:", err);
      }
    }

    if (cls.isBudgetQuery) {
      try {
        toolResults.budgetComparison = await trackBudgetVsActual(state.userId);
      } catch (err) {
        console.error("[accountant-tools] trackBudgetVsActual failed:", err);
      }
    }

    if (cls.isTaxQuery) {
      try {
        toolResults.taxEstimate = await estimateTax(state.userId);
      } catch (err) {
        console.error("[accountant-tools] estimateTax failed:", err);
      }
    }

    if (cls.isAnomalyQuery) {
      try {
        toolResults.anomalies = await detectAnomalousTransactions(state.userId);
      } catch (err) {
        console.error(
          "[accountant-tools] detectAnomalousTransactions failed:",
          err,
        );
      }
    }

    if (cls.isRunwayQuery) {
      try {
        toolResults.runway = await forecastRunway(state.userId);
      } catch (err) {
        console.error("[accountant-tools] forecastRunway failed:", err);
      }
    }

    // ── Build UIComponents for generative UI ──────────────────────────────
    const uiComponents: UIComponent[] = [];

    if (cls.isPLQuery && toolResults.plReport) {
      const report = toolResults.plReport as PLReport;
      // Transform PLReport.months to InlinePLTable PLRow format:
      // PLRow = { category: string, current: number, previous: number, change: number }
      const rows = report.months.map((m, idx) => {
        const previous =
          idx + 1 < report.months.length ? report.months[idx + 1].netProfit : 0;
        return {
          category: m.month,
          current: m.netProfit,
          previous,
          change: m.netProfit - previous,
        };
      });
      uiComponents.push({
        type: "pl_report",
        props: {
          title: "Profit & Loss Report",
          period: report.months[0]?.month ?? "Current",
          rows,
        },
      });
    }

    if (cls.isCashflowQuery && toolResults.cashflow) {
      // cashflow is a single CashflowProjection object; build chart data array
      const cf = toolResults.cashflow as CashflowProjection;
      uiComponents.push({
        type: "cashflow_chart",
        props: {
          data: [
            {
              period: "Starting",
              balance: cf.startingCash,
              income: 0,
              expenses: 0,
            },
            {
              period: cf.period,
              balance: cf.projectedBalance,
              income: cf.projectedIncome,
              expenses: cf.projectedExpenses,
            },
          ],
        },
      });
    }

    if ((cls.isInvoiceQuery || cls.isChaseInvoice) && toolResults.invoices) {
      const invoices = toolResults.invoices as Array<Record<string, unknown>>;
      if (invoices.length > 0) {
        uiComponents.push({
          type: "invoice_tracker",
          props: { invoices },
        });
      }
    }

    if (cls.isBudgetQuery && toolResults.budgetComparison) {
      // GUI-04: Emit data_table UIComponent for budget vs actual comparison
      // DataTable expects columns: { key, label }[] and data: Record<string, unknown>[]
      const budgetData = toolResults.budgetComparison as BudgetComparison[];
      if (budgetData.length > 0) {
        uiComponents.push({
          type: "data_table",
          props: {
            columns: [
              { key: "category", label: "Category" },
              { key: "budgeted", label: "Budgeted" },
              { key: "actual", label: "Actual" },
              { key: "variance", label: "Variance" },
              { key: "variancePct", label: "Variance %" },
            ],
            data: budgetData.map((row) => ({
              category: row.category,
              budgeted: row.budgeted,
              actual: row.actual,
              variance: row.variance,
              variancePct: `${row.variancePct > 0 ? "+" : ""}${row.variancePct.toFixed(1)}%`,
            })),
          },
        });
      }
    }

    return {
      businessContext: {
        ...state.businessContext,
        accountantToolResults: toolResults,
      },
      ...(uiComponents.length > 0 ? { uiComponents } : {}),
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Accountant agent graph.
 *
 * Graph topology: __start__ -> readMemory -> accountantTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createAccountantGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.ACCOUNTANT,
    systemPrompt: ACCOUNTANT_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("accountantTools", createAccountantToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "accountantTools")
    .addEdge("accountantTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
