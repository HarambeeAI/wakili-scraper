---
phase: 13-accountant-sales-rep-agent-tools
plan: 05
subsystem: api
tags: [langgraph, sales, pipeline, typescript, postgresql, llm]

# Dependency graph
requires:
  - phase: 13-04
    provides: 6 first-half sales tools (generateLeads, enrichLeadData, researchProspect, composeOutreach, sendOutreach, trackEmailEngagement) + types.ts
  - phase: 13-01
    provides: shared DB pool, base-agent exports (createLLMNode, createRespondNode), AgentState
  - phase: 12-04
    provides: cosTools node pattern that salesTools node mirrors
provides:
  - deal-tools.ts: updateDealStatus + scheduleFollowUp + detectStaleDeals (SALES-07, 08, 12)
  - proposal-tools.ts: createProposal via LLM stored in agent_assets (SALES-09)
  - pipeline-tools.ts: analyzePipeline + forecastRevenue with weighted pipeline model (SALES-10, 11)
  - tools/sales/index.ts: barrel export of all 9 sales tools + types
  - sales-rep.ts rewritten: classifySalesRequest (regex) + createSalesToolsNode + tool-wired graph topology
affects: [14-marketer-personal-assistant-tools, 15-integrations, agent-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "salesTools node pattern: data-gathering before LLM — mirrors cosTools from Phase 12"
    - "STAGE_WEIGHTS map for weighted pipeline revenue projection"
    - "STALE_THRESHOLDS per-stage map for intelligent staleness detection"
    - "classifySalesRequest regex heuristics — deterministic routing without LLM cost"

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/sales/deal-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/proposal-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/pipeline-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/index.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/agents/sales-rep.ts
    - worrylesssuperagent/langgraph-server/src/graph/supervisor.ts

key-decisions:
  - "salesTools node follows cosTools pattern exactly — deterministic classification before LLM, results in businessContext.salesToolResults"
  - "Tools requiring extracted params (leadId, URL, query) set needsInput:true + requestType — LLM parses specifics from message"
  - "createSubgraphNode factory typed as any in supervisor.ts — heterogeneous graph topologies (salesTools vs accountantTools nodes) cannot share a typed factory signature"
  - "forecastRevenue calls analyzePipeline internally — single query abstraction for pipeline data"
  - "detectStaleDeals filters in JS after DB pre-filter (>5 days) — STALE_THRESHOLDS applied post-query for flexibility"

patterns-established:
  - "Tool-wired agent pattern: readMemory -> {agent}Tools -> llmNode -> writeMemory -> respond"
  - "Regex classifier exports as named function for testability (classifySalesRequest)"
  - "Terminal deal stages (converted/closed_won/closed_lost/lost) always get threshold 999 — never flagged as stale"

requirements-completed: [SALES-07, SALES-08, SALES-09, SALES-10, SALES-11, SALES-12]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 13 Plan 05: Sales Rep Advanced Tools + Graph Rewrite Summary

**All 12 Sales Rep tools complete: deal management (ENUM-validated), proposal generation via LLM, weighted pipeline analytics, revenue forecasting, and sales-rep graph rewritten with deterministic salesTools node between readMemory and llmNode.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T06:00:00Z
- **Completed:** 2026-03-19T06:12:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 6 new sales tools (SALES-07 through SALES-12): deal status update with extended ENUM validation, follow-up scheduling writing to agent_tasks, stale deal detection with per-stage thresholds, LLM-powered proposal generation stored in agent_assets, pipeline analysis with conversion rates, and 30/60/90-day revenue forecasting using weighted pipeline model
- Sales barrel index exports all 9 tools + types from a single entry point
- Sales Rep agent graph rewritten from simple createBaseAgentGraph wrapper to custom tool-wired topology: readMemory -> salesTools -> llmNode -> writeMemory -> respond
- classifySalesRequest uses 12 regex patterns for deterministic routing (zero LLM calls for classification)
- System prompt updated to reflect real tool access — removed "no tool access yet" disclaimer

## Task Commits

Each task was committed atomically:

1. **Task 1: Deal management + Proposal generation + Pipeline analysis tools** - `a7dc776` (feat)
2. **Task 2: Sales barrel index + agent graph rewrite with tool node** - `9dff13f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/tools/sales/deal-tools.ts` - updateDealStatus (ENUM-validated), scheduleFollowUp (agent_tasks insert), detectStaleDeals (per-stage thresholds)
- `src/tools/sales/proposal-tools.ts` - createProposal: fetches lead context, LLM generates HTML proposal, stores in agent_assets
- `src/tools/sales/pipeline-tools.ts` - analyzePipeline (stage counts, conversion rate, total value), forecastRevenue (STAGE_WEIGHTS + historical monthly avg)
- `src/tools/sales/index.ts` - Barrel export of all 9 tools + type re-exports
- `src/agents/sales-rep.ts` - Full rewrite: classifySalesRequest, createSalesToolsNode, createSalesRepGraph with salesTools node
- `src/graph/supervisor.ts` - createSubgraphNode typed as any to support heterogeneous compiled graph types

## Decisions Made
- `createSubgraphNode` in supervisor.ts changed from `ReturnType<typeof createAccountantGraph>` to `any` — the accountant has `accountantTools` node, the sales rep now has `salesTools` node; TypeScript structural comparison fails across different node sets. Using `any` matches the existing `DIRECT_REPORT_FACTORIES` pattern already in that file.
- Tools requiring input parameters (leadId, URL, search query) signal via `needsInput:true + requestType` rather than attempting extraction — the LLM receives the user message and can identify the needed inputs itself
- `forecastRevenue` reuses `analyzePipeline` rather than duplicating its SQL — clean abstraction, one source of truth for pipeline data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed supervisor.ts createSubgraphNode factory type mismatch**
- **Found during:** Task 2 (sales-rep.ts graph rewrite)
- **Issue:** `createSubgraphNode` was typed as `factory: (cp?: PostgresSaver) => ReturnType<typeof createAccountantGraph>`. After the sales-rep graph gained a `salesTools` node (different topology from accountant's `accountantTools` node), TypeScript's structural comparison of the compiled graph return types produced 3 errors on lines 223-225
- **Fix:** Changed the factory parameter type from the specific `ReturnType<typeof createAccountantGraph>` to `any`, matching the `DIRECT_REPORT_FACTORIES` map which already uses `(cp?: PostgresSaver) => any`
- **Files modified:** `src/graph/supervisor.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `9dff13f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - structural type bug from heterogeneous graph topologies)
**Impact on plan:** Fix necessary for compilation. No behavior change — runtime invocation unchanged.

## Issues Encountered
None beyond the supervisor.ts type fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 Sales Rep tools complete and barrel-exported — Phase 14 (Marketer + PA tools) can proceed
- Sales Rep graph topology matches Accountant graph topology (both use tool-wired pattern) — consistent architecture
- supervisor.ts now supports any heterogeneous compiled graph factory via `any` typing

---
*Phase: 13-accountant-sales-rep-agent-tools*
*Completed: 2026-03-19*
