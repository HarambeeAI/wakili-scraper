---
phase: 14-marketer-persistent-browser
plan: 03
subsystem: tools
tags: [playwright, hitl, analytics, scheduling, content-library, marketer, typescript]

# Dependency graph
requires:
  - phase: 14-marketer-persistent-browser
    provides: Browser manager (getPage, checkSessionValid), marketer type contracts
  - phase: 11-agent-graph-topology-+-memory-foundation
    provides: HITL interrupt handler (interruptForApproval)
  - phase: 13-accountant-sales-rep-agent-tools
    provides: Shared DB pool pattern, tool file conventions
provides:
  - schedulePost tool for future post scheduling (MKT-04)
  - publishPost tool with HITL approval gate and Playwright browser publishing (MKT-05)
  - fetchPostAnalytics tool for DB-stored or live-scraped metrics (MKT-06)
  - analyzePostPerformance tool with LLM WHY reasoning (MKT-07)
  - manageContentLibrary tool for asset search and reuse (MKT-12)
affects: [14-04, 14-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [hitl-before-browser-action, session-check-before-hitl, page-close-in-finally]

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/marketer/schedule-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/publish-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/analytics-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/schedule-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/publish-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/analytics-tools.test.ts
  modified: []

key-decisions:
  - "callLLMWithStructuredOutput uses string schema description (not Zod) -- matches actual API signature from llm/client.ts"
  - "vi.mock factories use top-level vi.fn() references instead of object literals -- avoids vitest hoisting ReferenceError"

patterns-established:
  - "HITL-before-browser: checkSessionValid -> interruptForApproval -> getPage (never touch browser without approval)"
  - "page.close() in finally block for all Playwright tool operations -- prevents context leak"
  - "Mock pattern for browser tools: declare mock fns at top level, wire into vi.mock factory via closures"

requirements-completed: [MKT-04, MKT-05, MKT-06, MKT-07, MKT-12]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 14 Plan 03: Schedule, Publish, Analytics Summary

**5 marketer tools for the full post lifecycle: schedule with future datetime, HITL-gated Playwright publishing, live analytics scraping, LLM performance analysis with WHY reasoning, and content library search**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T06:23:33Z
- **Completed:** 2026-03-19T06:28:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- schedulePost inserts social_posts with status='scheduled' and returns post ID
- publishPost checks session validity, gates on HITL approval, then publishes via Playwright with platform-specific automation for X, LinkedIn, Instagram, TikTok
- fetchPostAnalytics returns stored DB metrics or scrapes live data via Playwright page.evaluate
- analyzePostPerformance queries published posts and uses callLLMWithStructuredOutput to identify top/bottom performers with WHY reasoning
- manageContentLibrary searches agent_assets with text ILIKE and asset_type filters, truncates content to 200 chars
- 17 passing unit tests across 3 test files with mocked DB, browser, HITL, and LLM

## Task Commits

Each task was committed atomically:

1. **Task 1: Schedule + content library tools + tests** - `fe7a8d5` (feat)
2. **Task 2: Publish + analytics tools + tests** - `6a26dce` (feat)

## Files Created/Modified
- `worrylesssuperagent/langgraph-server/src/tools/marketer/schedule-tools.ts` - schedulePost + manageContentLibrary
- `worrylesssuperagent/langgraph-server/src/tools/marketer/publish-tools.ts` - publishPost with HITL + Playwright
- `worrylesssuperagent/langgraph-server/src/tools/marketer/analytics-tools.ts` - fetchPostAnalytics + analyzePostPerformance
- `worrylesssuperagent/langgraph-server/src/tools/marketer/schedule-tools.test.ts` - 6 unit tests
- `worrylesssuperagent/langgraph-server/src/tools/marketer/publish-tools.test.ts` - 6 unit tests
- `worrylesssuperagent/langgraph-server/src/tools/marketer/analytics-tools.test.ts` - 5 unit tests

## Decisions Made
- Used string schema description for callLLMWithStructuredOutput instead of Zod schema (plan referenced Zod but actual API uses string schema)
- Restructured vi.mock factories to use top-level vi.fn() references to avoid vitest hoisting ReferenceError with object literals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed callLLMWithStructuredOutput signature mismatch**
- **Found during:** Task 2 (analytics-tools.ts)
- **Issue:** Plan code used `{ schema: PerformanceSchema, ... }` with Zod, but actual API is `callLLMWithStructuredOutput(messages, schemaString, options)`
- **Fix:** Replaced Zod schema with JSON string description, adapted call signature to `(messages, PERFORMANCE_SCHEMA, { systemPrompt, ... })`
- **Files modified:** analytics-tools.ts
- **Verification:** TypeScript compiles, tests pass
- **Committed in:** 6a26dce (Task 2 commit)

**2. [Rule 1 - Bug] Fixed vitest mock hoisting ReferenceError**
- **Found during:** Task 2 (test files)
- **Issue:** `vi.mock` factories referenced `mockPage` object declared below -- vitest hoists mocks above declarations causing ReferenceError
- **Fix:** Declared individual mock fns (mockGoto, mockEvaluate, etc.) at top level, wired into factory via arrow function closures
- **Files modified:** publish-tools.test.ts, analytics-tools.test.ts
- **Verification:** All 17 tests pass
- **Committed in:** 6a26dce (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. API signature mismatch would have caused runtime errors. Mock hoisting would prevent tests from running. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 post lifecycle tools ready for Plan 04 (marketer graph integration)
- HITL pattern established for publishPost -- same pattern usable for any future high-risk browser actions
- Analytics tools ready for dashboard integration

---
*Phase: 14-marketer-persistent-browser*
*Completed: 2026-03-19*
