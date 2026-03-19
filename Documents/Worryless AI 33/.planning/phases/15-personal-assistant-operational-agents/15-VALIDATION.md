---
phase: 15
slug: personal-assistant-operational-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 15 — Validation Strategy

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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | PA-01, PA-02 | unit | `npx vitest run gmail-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | PA-03, PA-04, PA-05 | unit | `npx vitest run calendar-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | PA-06, PA-07, PA-08 | unit | `npx vitest run drive-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | PA-09, PA-10 | unit | `npx vitest run pa-briefing-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | OPS-01, OPS-02 | unit | `npx vitest run support-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 2 | OPS-03, OPS-04 | unit | `npx vitest run legal-hr-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 2 | OPS-05, OPS-06 | unit | `npx vitest run pr-procurement-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-02 | 04 | 2 | OPS-07 | unit | `npx vitest run data-ops-tools.test.ts` | ❌ W0 | ⬜ pending |
| 15-05-01 | 05 | 3 | PA-* | unit | `npx vitest run personal-assistant.test.ts` | ❌ W0 | ⬜ pending |
| 15-05-02 | 05 | 3 | OPS-* | unit | `npx vitest run coo.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tools/pa/gmail-tools.test.ts` — stubs for PA-01, PA-02
- [ ] `src/tools/pa/calendar-tools.test.ts` — stubs for PA-03, PA-04, PA-05
- [ ] `src/tools/pa/drive-tools.test.ts` — stubs for PA-06, PA-07, PA-08
- [ ] `src/tools/pa/pa-briefing-tools.test.ts` — stubs for PA-09, PA-10
- [ ] `src/tools/ops/support-tools.test.ts` — stubs for OPS-01, OPS-02
- [ ] `src/tools/ops/legal-hr-tools.test.ts` — stubs for OPS-03, OPS-04
- [ ] `src/tools/ops/pr-procurement-tools.test.ts` — stubs for OPS-05, OPS-06
- [ ] `src/tools/ops/data-ops-tools.test.ts` — stubs for OPS-07
- [ ] `src/agents/personal-assistant.test.ts` — stubs for PA graph classification
- [ ] `src/agents/coo.test.ts` — stubs for COO routing classification

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth token refresh | PA-01 | Requires real Google OAuth flow | Sign in with Google, verify token stored in integrations table |
| Gmail inbox read with real data | PA-02 | Requires real Gmail account | Send test email, verify PA reads and categorizes it |
| Calendar event creation | PA-04 | Requires real Google Calendar | Create event via PA, verify appears in Google Calendar |
| HITL approval flow for email send | PA-05 | Requires UI interaction | Trigger email send, verify approval prompt appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
