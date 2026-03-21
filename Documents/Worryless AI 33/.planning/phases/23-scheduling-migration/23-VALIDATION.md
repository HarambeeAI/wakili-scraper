---
phase: 23
slug: scheduling-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + manual Railway deploy verification |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | RAIL-04 | integration | `docker build` dry run | ❌ W0 | ⬜ pending |
| 23-02-01 | 02 | 2 | SCHED-01, SCHED-02 | unit | `npx vitest run src/__tests__/cadenceDispatcher.test.ts` | ❌ W0 | ⬜ pending |
| 23-02-02 | 02 | 2 | SCHED-04 | unit | `npx vitest run src/__tests__/cadenceWorker.test.ts` | ❌ W0 | ⬜ pending |
| 23-03-01 | 03 | 2 | SCHED-03 | manual | SQL function review on Railway | N/A | ⬜ pending |
| 23-03-02 | 03 | 2 | SCHED-05 | unit | `npx vitest run src/__tests__/repeatableJobs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worrylesssuperagent/src/__tests__/cadenceDispatcher.test.ts` — stubs for SCHED-01, SCHED-02
- [ ] `worrylesssuperagent/src/__tests__/cadenceWorker.test.ts` — stubs for SCHED-04
- [ ] `worrylesssuperagent/src/__tests__/repeatableJobs.test.ts` — stubs for SCHED-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dockerfile builds with Playwright on Railway | RAIL-04 | Requires Railway deploy | Push to Railway, verify deploy logs show Playwright install + volume mount |
| node-cron tick enqueues to BullMQ | SCHED-01 | Requires live Redis | Deploy, check Redis queue depth after 5min |
| get_due_cadence_agents() runs on Railway Postgres | SCHED-03 | Requires production DB | Run SQL function via Railway psql, verify no pg_cron refs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
