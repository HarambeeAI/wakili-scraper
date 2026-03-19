---
phase: 18-agent-to-ui-data-pipeline-fix
plan: "01"
subsystem: langgraph-server/agents
tags: [generative-ui, accountant, sales-rep, uiComponents, pipeline]
dependency_graph:
  requires:
    - "17-01: SSE endpoint emits ui_components event"
    - "17-02: GenerativeUIRenderer handles pl_report, cashflow_chart, invoice_tracker, data_table, pipeline_kanban"
  provides:
    - "Accountant tools node populates uiComponents for P&L, cashflow, invoice, budget queries"
    - "Sales Rep tools node populates uiComponents for pipeline analysis queries"
  affects:
    - "AgentState.uiComponents accumulator (append-only, reducer: [...prev, ...next])"
    - "GenerativeUIRenderer rendering path for all 5 Accountant/Sales UI types"
tech_stack:
  added: []
  patterns:
    - "uiComponents accumulator: spread-only-if-nonempty (...uiComponents.length > 0 ? { uiComponents } : {}) avoids empty array appends"
    - "Type assertions (as PLReport, as CashflowProjection, etc.) after toolResults Record<string, unknown> dispatch"
key_files:
  created: []
  modified:
    - "worrylesssuperagent/langgraph-server/src/agents/accountant.ts"
    - "worrylesssuperagent/langgraph-server/src/agents/sales-rep.ts"
decisions:
  - "Spread-only-if-nonempty pattern for uiComponents return — avoids appending empty arrays to accumulator on turns where no matching tool was dispatched"
  - "PLReport.months mapped month-over-month to InlinePLTable PLRow format: current=current month netProfit, previous=next array element netProfit, change=difference"
  - "CashflowProjection mapped to two-point AreaChart data array: [Starting cash, Projected balance] with income/expenses breakdown"
  - "PipelineStageRow[] mapped to PipelineKanban deals: id=status slug, name='{count} deals', status=stage, value=total_deal_value??0"
  - "data_table columns hardcoded as Category/Budgeted/Actual/Variance/Variance% — matches DataTable's {key, label}[] column contract"
  - "variancePct formatted as '+N.1%' string inline in data mapping — display-ready without requiring frontend formatting logic"
metrics:
  duration: "3 min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 18 Plan 01: Agent-to-UI Data Pipeline Wire-Up Summary

**One-liner:** Accountant and Sales Rep tool nodes now populate `state.uiComponents` with typed UIComponent arrays — closing the broken E2E data pipeline between agent tool results and GenerativeUIRenderer.

## What Was Built

The generative UI pipeline had all three pieces in place (SSE endpoint, frontend renderer, frontend handler) but agents never wrote data to `state.uiComponents`. This plan closes that gap for both agents.

### Task 1: Accountant tools node — `accountant.ts`

Added imports for `UIComponent`, `PLReport`, `CashflowProjection`, and `BudgetComparison`. After all tool dispatch blocks, a `const uiComponents: UIComponent[] = []` array is built with:

- **pl_report** (when `cls.isPLQuery && toolResults.plReport`): Transforms `PLReport.months[]` to `InlinePLTable` PLRow format with month-over-month comparison (current/previous/change columns).
- **cashflow_chart** (when `cls.isCashflowQuery && toolResults.cashflow`): Maps `CashflowProjection` to a two-point AreaChart data array showing Starting vs Projected with income/expenses breakdown.
- **invoice_tracker** (when `(cls.isInvoiceQuery || cls.isChaseInvoice) && toolResults.invoices.length > 0`): Passes the raw invoice array to `InvoiceTrackerTable`.
- **data_table** (when `cls.isBudgetQuery && toolResults.budgetComparison.length > 0`): Emits `BudgetComparison[]` as DataTable with 5 columns (Category, Budgeted, Actual, Variance, Variance %) — fulfills **GUI-04**.

Return spreads `uiComponents` only when non-empty.

### Task 2: Sales Rep tools node — `sales-rep.ts`

Added imports for `UIComponent` and `PipelineAnalysis`. After tool dispatch blocks, builds:

- **pipeline_kanban** (when `classification.isPipelineAnalysis && toolResults.pipeline`): Transforms `PipelineAnalysis.byStage[]` to `PipelineKanban` deals array with `{ id: status, name: 'N deals', status, value: total_deal_value ?? 0 }`.

Return spreads `uiComponents` only when non-empty.

## Verification

- `npx tsc --noEmit` on `src/agents/` — zero errors
- `grep -n "uiComponents"` confirms presence in both files (6 lines accountant, 3 lines sales-rep)
- `grep -n "data_table"` confirms GUI-04 emission at accountant.ts:284
- Pre-existing errors in `heartbeat-prompts.test.ts` are out-of-scope (string | undefined narrowing, unrelated to this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `worrylesssuperagent/langgraph-server/src/agents/accountant.ts` modified
- [x] `worrylesssuperagent/langgraph-server/src/agents/sales-rep.ts` modified
- [x] Commit `2795faf` — accountant.ts uiComponents wiring
- [x] Commit `f88ee29` — sales-rep.ts uiComponents wiring
- [x] TypeScript compiles with zero errors in agents directory
- [x] All 4 Accountant UIComponent types present (pl_report, cashflow_chart, invoice_tracker, data_table)
- [x] Sales Rep pipeline_kanban UIComponent present
