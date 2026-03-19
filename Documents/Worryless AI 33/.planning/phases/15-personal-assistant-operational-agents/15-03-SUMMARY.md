---
phase: 15
plan: 03
subsystem: langgraph-server/src/tools
tags: [customer-support, legal, hr, tools, rag, llm, sql]
dependency_graph:
  requires: ["15-01"]
  provides: ["OPS-01-tools", "OPS-02-tools", "OPS-03-tools"]
  affects: ["15-04", "15-05"]
tech_stack:
  added: []
  patterns:
    - "vi.hoisted() for vitest mock factories that reference shared mock objects"
    - "callLLMWithStructuredOutput with string schema for structured tool outputs"
    - "Parameterized SQL via shared DB pool (getPool) for all CRUD operations"
    - "ragRetrieveByText for KB RAG search in customer support"
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/customer-support/ticket-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/customer-support/health-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/customer-support/index.ts
    - worrylesssuperagent/langgraph-server/src/tools/customer-support/ticket-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/legal/contract-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/legal/compliance-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/legal/index.ts
    - worrylesssuperagent/langgraph-server/src/tools/legal/contract-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/hr/recruiting-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/hr/people-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/hr/index.ts
    - worrylesssuperagent/langgraph-server/src/tools/hr/recruiting-tools.test.ts
  modified: []
decisions:
  - "[Phase 15-03]: vi.hoisted() pattern used for all test mock factories — consistent with Phase 14 pattern, avoids TDZ ReferenceError with vi.mock factory closures"
  - "[Phase 15-03]: screenResume fetches candidate name in a second query after UPDATE — avoids requiring name in the function signature, keeps API minimal"
  - "[Phase 15-03]: monitorRegulatory includes JSON parse fallback for raw text — LLM may return non-JSON on edge cases, fallback wraps content gracefully"
  - "[Phase 15-03]: contractCalendar uses INTERVAL cast ('$n days')::INTERVAL — parameterized interval injection compatible with pg driver"
metrics:
  duration: "6 min"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_created: 12
  tests_passing: 23
---

# Phase 15 Plan 03: Operational Agent Tools (CS, Legal, HR) Summary

**One-liner:** 18 typed async tool functions across Customer Support (ticket CRUD + KB RAG + churn), Legal (contract CRUD + LLM review + calendar + templates), and HR (candidate tracking + LLM screening + onboarding) — all parameterized SQL, barrel-indexed, 23 tests passing.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Customer Support tools | 186f4e3 | ticket-tools.ts, health-tools.ts, index.ts, ticket-tools.test.ts |
| 2 | Legal tools | 3d94b72 | contract-tools.ts, compliance-tools.ts, index.ts, contract-tools.test.ts |
| 3 | HR tools | 94ae767 | recruiting-tools.ts, people-tools.ts, index.ts, recruiting-tools.test.ts |

## What Was Built

### Customer Support (OPS-01) — 6 tools
- `createTicket` — INSERT into public.support_tickets, returns `#ticketId -- "subject"` message
- `listTickets` — SELECT with optional status filter, ordered DESC
- `updateTicket` — UPDATE with automatic `resolved_at = now()` on status='resolved'
- `searchKBAndDraftResponse` — calls `ragRetrieveByText(userId, query, 5, "customer_support")` then `callLLM` to draft grounded response
- `scoreCustomerHealth` — computes 0-100 score from ticket frequency + avg resolution time
- `detectChurnRisk` — flags customers with >=3 tickets in 30 days (medium), >=5 (high)

### Legal (OPS-02) — 6 tools
- `createContract` — INSERT into public.contracts with optional value/dates
- `listContracts` — SELECT with optional status filter
- `reviewContract` — `callLLMWithStructuredOutput` for risk flags + key terms, UPDATEs contracts table with results
- `draftTemplate` — `callLLM` for NDA/MSA/SOW/etc generation
- `contractCalendar` — SELECT renewals within N days using INTERVAL cast
- `monitorRegulatory` — LLM-only tool for industry regulatory summaries

### HR (OPS-03) — 6 tools
- `trackCandidate` — INSERT into public.candidates (email optional/nullable)
- `listCandidates` — SELECT with dynamic filters for position and/or status
- `screenResume` — `callLLMWithStructuredOutput` for 4-score assessment, UPDATEs candidates with scores + sets status='screened'
- `createJobPosting` — `callLLMWithStructuredOutput` for structured job posting generation
- `createOnboardingPlan` — 30/60/90-day milestone plan via LLM structured output
- `performanceReview` — `callLLM` for narrative performance review draft

## Test Results

```
Test Files  3 passed (3)
     Tests  23 passed (23)
  Duration  630ms
```

- Customer support: 8 tests (createTicket, listTickets x3, updateTicket x2, searchKBAndDraftResponse x2)
- Legal: 8 tests (createContract, listContracts x3, reviewContract x2, contractCalendar x2)
- HR: 7 tests (trackCandidate x2, screenResume, listCandidates x4)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for mock factories**
- **Found during:** Task 1 (first test run)
- **Issue:** `vi.mock` factory closures that reference variables defined at module scope throw `ReferenceError: Cannot access before initialization` due to vitest hoisting
- **Fix:** Wrapped all mock references in `vi.hoisted()` — same pattern established in Phase 14-04 and 14-05
- **Files modified:** ticket-tools.test.ts (then applied to all subsequent test files)
- **Commit:** 186f4e3

**2. [Rule 1 - Bug] Test array index off-by-one in createTicket test**
- **Found during:** Task 1 test run
- **Issue:** Test checked `params[2]` for customerName but INSERT params order is `[userId, customerName, customerEmail, subject]` — customerName is `params[1]`
- **Fix:** Corrected index to `params[1]`
- **Files modified:** ticket-tools.test.ts
- **Commit:** 186f4e3

## Self-Check: PASSED

All 12 files exist on disk. All 3 task commits verified in git log.
