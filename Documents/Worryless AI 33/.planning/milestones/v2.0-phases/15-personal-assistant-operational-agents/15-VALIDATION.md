---
phase: 15
slug: personal-assistant-operational-agents
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
updated: 2026-03-19
---

# Phase 15 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `worrylesssuperagent/langgraph-server/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent/langgraph-server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent/langgraph-server && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx vitest run <relevant-test-file>`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 15-01-01 | 01 | 1 | Foundation | structural | `test -f ../supabase/migrations/20260320000001_ops_agent_tables.sql && node -e "require('googleapis')"` | pending |
| 15-01-02 | 01 | 1 | Foundation | type-check | `npx tsc --noEmit` | pending |
| 15-02-01 | 02 | 2 | PA-01..PA-04 | unit | `npx vitest run src/tools/pa/email-tools.test.ts --reporter=verbose` | pending |
| 15-02-02 | 02 | 2 | PA-05..PA-10 | unit | `npx vitest run src/tools/pa/calendar-tools.test.ts --reporter=verbose` | pending |
| 15-03-01 | 03 | 2 | OPS-01 | unit | `npx vitest run src/tools/customer-support/ticket-tools.test.ts --reporter=verbose` | pending |
| 15-03-02 | 03 | 2 | OPS-02 | unit | `npx vitest run src/tools/legal/contract-tools.test.ts --reporter=verbose` | pending |
| 15-03-03 | 03 | 2 | OPS-03 | unit | `npx vitest run src/tools/hr/recruiting-tools.test.ts --reporter=verbose` | pending |
| 15-04-01 | 04 | 2 | OPS-04 | unit | `npx vitest run src/tools/pr/media-tools.test.ts --reporter=verbose` | pending |
| 15-04-02 | 04 | 2 | OPS-05 | unit | `npx vitest run src/tools/procurement/supplier-tools.test.ts --reporter=verbose` | pending |
| 15-05-01 | 05 | 2 | OPS-06 | unit | `npx vitest run src/tools/data-analyst/query-tools.test.ts --reporter=verbose` | pending |
| 15-05-02 | 05 | 2 | OPS-07 | unit | `npx vitest run src/tools/operations/project-tools.test.ts --reporter=verbose` | pending |
| 15-06-01 | 06 | 3 | PA-* | unit | `npx vitest run src/agents/personal-assistant.test.ts --reporter=verbose` | pending |
| 15-06-02 | 06 | 3 | OPS-* (CS, Legal, HR, PR) | type-check | `npx tsc --noEmit` | pending |
| 15-06-03 | 06 | 3 | OPS-* (Procurement, DA, Ops) | unit | `npx vitest run src/agents/ops-classification.test.ts --reporter=verbose` | pending |

---

## Test Files Created By Plans

Tests are created alongside implementations (no separate Wave 0 needed):

| Test File | Created In | Requirements Covered |
|-----------|-----------|----------------------|
| `src/tools/pa/email-tools.test.ts` | Plan 02, Task 1 | PA-01, PA-02, PA-03, PA-04 |
| `src/tools/pa/calendar-tools.test.ts` | Plan 02, Task 2 | PA-05, PA-06, PA-09, PA-10 |
| `src/tools/customer-support/ticket-tools.test.ts` | Plan 03, Task 1 | OPS-01 |
| `src/tools/legal/contract-tools.test.ts` | Plan 03, Task 2 | OPS-02 |
| `src/tools/hr/recruiting-tools.test.ts` | Plan 03, Task 3 | OPS-03 |
| `src/tools/pr/media-tools.test.ts` | Plan 04, Task 1 | OPS-04 |
| `src/tools/procurement/supplier-tools.test.ts` | Plan 04, Task 2 | OPS-05 |
| `src/tools/data-analyst/query-tools.test.ts` | Plan 05, Task 1 | OPS-06 |
| `src/tools/operations/project-tools.test.ts` | Plan 05, Task 2 | OPS-07 |
| `src/agents/personal-assistant.test.ts` | Plan 06, Task 1 | PA classification |
| `src/agents/ops-classification.test.ts` | Plan 06, Task 3 | All 7 ops classification |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth token refresh | PA-01 | Requires real Google OAuth flow | Sign in with Google, verify token stored in integrations table |
| Gmail inbox read with real data | PA-02 | Requires real Gmail account | Send test email, verify PA reads and categorizes it |
| Calendar event creation | PA-06 | Requires real Google Calendar | Create event via PA, verify appears in Google Calendar |
| HITL approval flow for email send | PA-04 | Requires UI interaction | Trigger email send, verify approval prompt appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test files created alongside implementations (no Wave 0 stubs needed)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
