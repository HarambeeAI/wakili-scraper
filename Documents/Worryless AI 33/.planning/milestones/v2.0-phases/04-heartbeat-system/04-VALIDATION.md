---
phase: 4
slug: heartbeat-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | HB-03 | unit | `npx vitest run src/__tests__/heartbeatParser.test.ts -t "severity"` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | HB-03 | unit | `npx vitest run src/__tests__/heartbeatParser.test.ts -t "extractJson"` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 0 | HB-05 | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "budget"` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 0 | HB-06 | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "activeHours"` | ❌ W0 | ⬜ pending |
| 4-01-05 | 01 | 0 | SEC-02 | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "SEC-02"` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | HB-08 | unit | `npx vitest run src/__tests__/useHeartbeatConfig.test.ts` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 1 | HB-01/HB-02 | manual | N/A — requires live Supabase pgmq | manual | ⬜ pending |
| 4-04-01 | 04 | 2 | HB-09 | manual | N/A — requires Resend API key + live DB | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/heartbeatParser.test.ts` — stubs for HB-03 (severity parse, extractJson, fail-safe to "ok")
- [ ] `src/__tests__/heartbeatDispatcher.test.ts` — stubs for HB-05 (budget count), HB-06 (active hours), SEC-02 (no body userId)
- [ ] `src/__tests__/useHeartbeatConfig.test.ts` — stubs for HB-08 (hook reads/writes correct columns)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end queue enqueue/dequeue cycle | HB-01, HB-02 | Requires live Supabase pgmq instance | Deploy dispatcher + runner, trigger dispatcher via curl, verify message appears then disappears after runner processes |
| Morning digest sends email with "digest" rows from past 24h | HB-09 | Requires Resend API key + live DB with digest rows | Insert test digest-severity row into `agent_heartbeat_log`, trigger `send-morning-digest` function, verify Resend email received |
| Urgent notification triggers push + email within same invocation | HB-04 | Requires Resend API key + live DB | Trigger runner with mock urgent LLM response, verify both notification row in DB and Resend email delivered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
