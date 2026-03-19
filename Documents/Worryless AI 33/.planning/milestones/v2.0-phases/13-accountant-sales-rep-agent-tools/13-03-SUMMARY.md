---
phase: 13-accountant-sales-rep-agent-tools
plan: "03"
subsystem: agent-tools
tags: [langgraph, typescript, accountant, tax, anomaly-detection, hitl, resend, z-score, invoice]

requires:
  - phase: 13-02
    provides: "6 base accountant tools (invoice, transaction, bank statement, receipt, cashflow, P&L) + shared DB pool + types"
  - phase: 12-04
    provides: "cosTools node pattern, interruptForApproval HITL, base-agent createLLMNode/createRespondNode"

provides:
  - "estimateTax: LLM structured output tax estimation with jurisdiction awareness"
  - "trackBudgetVsActual: LangGraph Store budget targets vs actual transaction spend"
  - "detectAnomalousTransactions: z-score > 2.0 statistical outlier detection per category over 90 days"
  - "chaseOverdueInvoice: vendor_email DB resolution, HITL approval, Resend email send"
  - "forecastRunway: burn rate + cash balance runway months with status (healthy/warning/critical)"
  - "generateInvoiceHtml: LLM-generated HTML invoice stored in agent_assets"
  - "src/tools/accountant/index.ts: barrel export of all 10 accountant tools"
  - "Accountant agent graph rewritten: readMemory -> accountantTools -> llmNode -> writeMemory -> respond"
  - "classifyAccountantRequest: regex heuristic classifier for deterministic tool dispatch"

affects:
  - 13-04-sales-rep-tools
  - agent-registry
  - coo-supervisor

tech-stack:
  added: []
  patterns:
    - "Accountant tools node pattern: classifyRequest (regex) -> parallel tool calls -> inject into businessContext.accountantToolResults"
    - "vendor_email NULL guard: return user-readable error before attempting HITL/email send"
    - "z-score anomaly detection: per-category mean+stdDev, flag transactions > 2 standard deviations"
    - "AGENT_GRAPH_REGISTRY typed as Record<AgentTypeId, (cp?) => any> to accommodate graphs with different node sets"

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/accountant/tax-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/anomaly-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/chase-invoice.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/invoice-pdf.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/index.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/agents/accountant.ts
    - worrylesssuperagent/langgraph-server/src/agents/index.ts
    - worrylesssuperagent/langgraph-server/src/graph/supervisor.ts

key-decisions:
  - "AGENT_GRAPH_REGISTRY and DIRECT_REPORT_FACTORIES widened to any return type — TypeScript narrows StateGraph generics per addNode call, making graphs with different node sets incompatible even though runtime behavior is identical"
  - "isChaseInvoice path in accountantTools node fetches overdue invoice list rather than calling chaseOverdueInvoice directly — the HITL interrupt requires a specific invoice ID from the user; LLM prompts for it on the follow-up turn"
  - "forecastRunway returns runwayMonths=999 when netBurn <= 0 (income >= expenses) — signals infinite runway without divide-by-zero"

patterns-established:
  - "Tool node before LLM node: all data-gathering done before LLM call so LLM has real numbers to reference"
  - "Regex-only request classification: no LLM call needed to decide which tools to run"
  - "vendor_email NULL guard pattern: always check DB field before HITL + external API call"

requirements-completed: [ACCT-07, ACCT-08, ACCT-09, ACCT-10, ACCT-11, ACCT-12]

duration: 10min
completed: "2026-03-19"
---

# Phase 13 Plan 03: Accountant Advanced Tools + Graph Rewrite Summary

**6 advanced accountant tools (tax, anomaly z-score, invoice chase with HITL+Resend, runway, HTML invoice) + Accountant graph rewritten from conversational to tool-wired with classifyAccountantRequest node**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-19T05:03:00Z
- **Completed:** 2026-03-19T05:13:42Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- All 12 Accountant tools complete — 6 from Plan 02 + 6 new advanced tools in this plan
- Accountant graph topology rewritten: readMemory -> accountantTools -> llmNode -> writeMemory -> respond (matches cosTools pattern from Phase 12)
- `chaseOverdueInvoice` reads `vendor_email` from `public.invoices`, returns user-readable error if NULL, pauses for HITL via `interruptForApproval`, sends via Resend to vendor email
- `detectAnomalousTransactions` uses per-category z-score (> 2.0 threshold) on 90-day transaction window, returns top 20 outliers sorted by z-score
- `estimateTax` calls `callLLMWithStructuredOutput` with income/expense YTD totals, returns TaxEstimate with disclaimer
- `trackBudgetVsActual` reads budget targets from LangGraph Store (`userId:agent_memory:accountant` / `budget_targets`), compares against current-month transaction actuals

## Task Commits

Each task committed atomically:

1. **Task 1: Advanced accountant tools (tax, anomaly, chase, runway, invoice PDF)** — `b437c12` (feat)
2. **Task 2: Accountant barrel index + agent graph rewrite with tool node** — `44e7fe2` (feat)

## Files Created/Modified

- `src/tools/accountant/tax-tools.ts` — estimateTax (LLM structured output) + trackBudgetVsActual (LangGraph Store + actual spend query)
- `src/tools/accountant/anomaly-tools.ts` — detectAnomalousTransactions (z-score per category, top 20 outliers)
- `src/tools/accountant/chase-invoice.ts` — chaseOverdueInvoice with vendor_email NULL guard, HITL, Resend send to vendor_email
- `src/tools/accountant/invoice-pdf.ts` — forecastRunway (burn rate calculation) + generateInvoiceHtml (LLM HTML, stored in agent_assets)
- `src/tools/accountant/index.ts` — barrel export of all 10 tools + types
- `src/agents/accountant.ts` — full rewrite: classifyAccountantRequest (regex), createAccountantToolsNode, createAccountantGraph with 5-node topology
- `src/agents/index.ts` — AGENT_GRAPH_REGISTRY type widened to `(cp?) => any` (Rule 1 auto-fix)
- `src/graph/supervisor.ts` — DIRECT_REPORT_FACTORIES type widened to `(cp?) => any` (Rule 1 auto-fix)

## Decisions Made

- AGENT_GRAPH_REGISTRY and DIRECT_REPORT_FACTORIES widened to `any` return type: TypeScript narrows StateGraph generic on each `.addNode()` call, so a 5-node graph is a different type from a 4-node graph even with identical state shape. Cast to `any` follows the Phase 11 COO builder precedent.
- isChaseInvoice path fetches overdue invoice list (not chaseOverdueInvoice directly): HITL interrupt requires a specific invoice ID; the LLM prompts the user to specify which invoice on the follow-up turn.
- forecastRunway returns runwayMonths=999 when netBurn <= 0 to signal infinite runway safely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error in AGENT_GRAPH_REGISTRY and DIRECT_REPORT_FACTORIES**
- **Found during:** Task 2 (Accountant graph rewrite)
- **Issue:** Both registries typed as `ReturnType<typeof createAccountantGraph>`. When accountant.ts changed from 4-node to 5-node graph, TypeScript saw an incompatible return type because LangGraph's StateGraph generic narrows on each `.addNode()` call.
- **Fix:** Widened registry types to `(cp?: PostgresSaver) => any` with eslint-disable comment, matching the Phase 11 COO builder cast-to-any precedent.
- **Files modified:** `src/agents/index.ts`, `src/graph/supervisor.ts`
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** `44e7fe2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type incompatibility from graph node count change)
**Impact on plan:** Necessary correctness fix. No scope creep — same pattern established in Phase 11 for COO graph.

## Issues Encountered

None beyond the TypeScript registry type fix above.

## User Setup Required

None — no new external service configuration required. `RESEND_API_KEY` was already required from Phase 13-02.

## Next Phase Readiness

- All 12 Accountant tools complete and wired into the Accountant agent graph
- Accountant graph topology matches the cosTools pattern established in Phase 12
- Ready for Phase 13-04: Sales Rep agent tools (Apify lead scraping, email outreach, pipeline tracking)

---
*Phase: 13-accountant-sales-rep-agent-tools*
*Completed: 2026-03-19*
