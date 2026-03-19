---
phase: 15
plan: 05
subsystem: langgraph-server/tools
tags: [data-analyst, operations, tools, sql, z-score, project-management, sop]
dependency_graph:
  requires: ["15-01"]
  provides: ["data-analyst-tools", "operations-tools"]
  affects: ["15-agent-rewrites"]
tech_stack:
  added: []
  patterns:
    - "QUERY_TEMPLATES: pre-defined safe SQL map, LLM selects key not SQL"
    - "z-score anomaly detection reused from accountant/anomaly-tools.ts"
    - "Recharts-compatible ChartData: auto-detected xKey/yKey"
    - "isPureNumeric guard: Number() check prevents date strings parsing as numbers"
    - "Project ownership check before milestone insert (SELECT before INSERT)"
    - "mockQuery.mockReset() in beforeEach prevents test cross-contamination"
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/data-analyst/query-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/data-analyst/analysis-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/data-analyst/index.ts
    - worrylesssuperagent/langgraph-server/src/tools/data-analyst/query-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/operations/project-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/operations/process-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/operations/index.ts
    - worrylesssuperagent/langgraph-server/src/tools/operations/project-tools.test.ts
  modified: []
decisions:
  - "isPureNumeric strict check (Number() not parseFloat()) — prevents date strings like '2026-01' from being extracted as numeric values during z-score analysis"
  - "mockQuery.mockReset() in beforeEach (not vi.clearAllMocks()) — preserves getPool mock implementation while clearing call history"
  - "Extreme outlier test requires 10+ normal data points — with small datasets, z-score of outlier approaches but cannot strictly exceed 2.0 due to the outlier inflating its own stdDev"
metrics:
  duration: "~9 minutes"
  completed: "2026-03-19"
  tasks_completed: 2
  files_created: 8
  tests_added: 20
---

# Phase 15 Plan 05: Data Analyst + Operations Tools Summary

**One-liner:** 11 tools for Data Analyst (QUERY_TEMPLATES safe SQL + z-score anomaly + Recharts charts + KPI aggregation) and Operations (project CRUD + milestone tracking + bottleneck analysis + LLM SOP drafting), all 20 unit tests passing.

## What Was Built

### Task 1: Data Analyst Tools (OPS-06)

**`src/tools/data-analyst/query-tools.ts`** — 2 tools:
- `crossFunctionalQuery(userId, queryType)`: Selects from 7 pre-defined `QUERY_TEMPLATES` (revenue_by_month, expenses_by_category, leads_by_status, invoice_summary, posts_by_platform, support_ticket_summary, project_status). Never executes LLM-generated SQL. Returns `QueryResult` with UI-SPEC message strings.
- `kpiAggregation(userId)`: Runs 5 templates concurrently via `Promise.all`, derives total revenue, conversion rate, avg invoice value, open tickets, active projects. Returns `KPISummary` with 5 metrics across 5 data sources.

**`src/tools/data-analyst/analysis-tools.ts`** — 3 tools:
- `statisticalAnalysis(userId, queryType)`: Pure math on DB results — mean, median, stdDev, min, max, count.
- `anomalyDetection(userId, queryType)`: Z-score analysis (|z| > 2.0 threshold), same mathematical pattern as `accountant/anomaly-tools.ts`. Uses `isPureNumeric` guard to correctly identify numeric columns vs date strings.
- `generateChart(userId, queryType, chartType)`: Recharts-compatible `ChartData` output, auto-detects `xKey` (first non-numeric column) and `yKey` (first numeric column).

**`src/tools/data-analyst/index.ts`** — barrel exports all 5 tools + type re-exports from `types.ts`.

**`src/tools/data-analyst/query-tools.test.ts`** — 9 tests covering crossFunctionalQuery (valid/unknown/empty), kpiAggregation (multi-source/empty), anomalyDetection (outlier flagged/no anomalies/bad queryType).

### Task 2: Operations Tools (OPS-07)

**`src/tools/operations/project-tools.ts`** — 5 tools:
- `createProject(userId, name, description?, startDate?, dueDate?)`: INSERT into `public.projects` RETURNING id.
- `addMilestone(userId, projectId, title, dueDate?, owner?)`: Verifies project ownership with SELECT before INSERT into `public.project_milestones`.
- `listProjects(userId, status?)`: SELECT with optional status filter, calculates `ProjectStatusSummary`, UI-SPEC message strings.
- `trackMilestones(userId, projectId, milestoneId?, newStatus?)`: Ownership check, optional UPDATE status, SELECT all milestones ordered by due_date.
- `analyzeBottlenecks(userId)`: JOIN query for `pm.status = 'blocked'`, counts unique affected projects via `Set`.

**`src/tools/operations/process-tools.ts`** — 1 tool:
- `draftSOP(userId, processName, context?)`: `callLLMWithStructuredOutput` with SOP schema, system prompt instructing actionable step-by-step documentation.

**`src/tools/operations/index.ts`** — barrel exports all 6 tools + type re-exports from `types.ts`.

**`src/tools/operations/project-tools.test.ts`** — 11 tests covering createProject (full/minimal), addMilestone (ownership check/error), listProjects (summary/empty/status filter), analyzeBottlenecks (blocked/clean), draftSOP (with/without context).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] isPureNumeric guard for numeric column extraction**
- **Found during:** Task 1 (anomalyDetection test failure)
- **Issue:** `parseFloat("2026-01")` returns 2026 — date strings in `month` columns were being extracted as numeric values, causing z-score calculation to use dates instead of actual values like `total`.
- **Fix:** Replaced `parseFloat()` with `Number()` check via `isPureNumeric()` helper — `Number("2026-01")` returns `NaN`, correctly skipping date strings.
- **Files modified:** `analysis-tools.ts`
- **Commit:** b00119f (included in task 1 commit)

**2. [Rule 1 - Bug] Test mock cross-contamination via shared mockQuery call history**
- **Found during:** Task 2 (addMilestone `toHaveBeenNthCalledWith` assertion failed)
- **Issue:** `vi.clearAllMocks()` in `beforeEach` resets the `getPool` mock's return value, breaking all subsequent tests. Using `mockQuery.mockReset()` only resets `mockQuery` call history and the `Once` queue, while preserving the `getPool(() => { query: mockQuery })` factory.
- **Fix:** Changed `vi.clearAllMocks()` to `mockQuery.mockReset()` + `mockQuery.mockResolvedValue({ rows: [] })` in `beforeEach`.
- **Files modified:** `query-tools.test.ts`, `project-tools.test.ts`
- **Commit:** both task commits

**3. [Rule 1 - Bug] Z-score outlier test data — math boundary**
- **Found during:** Task 1 (anomalyDetection outlier test)
- **Issue:** With 4 normal values + 1 extreme outlier (e.g., 5000 → 50000), the outlier inflates its own mean and stdDev, making z-score approach but not strictly exceed 2.0. The condition `> 2.0` was never triggered.
- **Fix:** Used 10 normal values + 1 outlier. With sufficient "normal" baseline, z-score computes correctly (~3.16 for 10000 vs ~100 baseline).
- **Files modified:** `query-tools.test.ts`
- **Commit:** b00119f

## Self-Check: PASSED

All 8 created files verified on disk. Both commits (b00119f, 12000df) verified in git log. TypeScript --noEmit exits 0. 20/20 tests pass.
