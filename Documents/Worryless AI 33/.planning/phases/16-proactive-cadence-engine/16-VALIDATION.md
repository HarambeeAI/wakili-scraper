---
phase: 16
slug: proactive-cadence-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CAD-01 | unit | `vitest run src/lib/__tests__/cadence-config.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | CAD-02 | unit | `vitest run src/lib/__tests__/cadence-dispatcher.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | CAD-03 | unit | `vitest run src/lib/__tests__/proactive-runner.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | CAD-04 | unit | `vitest run src/lib/__tests__/heartbeat-prompts.test.ts` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | CAD-05 | unit | `vitest run src/lib/__tests__/morning-briefing.test.ts` | ❌ W0 | ⬜ pending |
| 16-04-01 | 04 | 2 | CAD-06 | unit | `vitest run src/lib/__tests__/event-triggers.test.ts` | ❌ W0 | ⬜ pending |
| 16-05-01 | 05 | 3 | CAD-07, CAD-08 | integration | `vitest run src/lib/__tests__/cadence-integration.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/cadence-config.test.ts` — stubs for CAD-01
- [ ] `src/lib/__tests__/cadence-dispatcher.test.ts` — stubs for CAD-02
- [ ] `src/lib/__tests__/proactive-runner.test.ts` — stubs for CAD-03
- [ ] `src/lib/__tests__/heartbeat-prompts.test.ts` — stubs for CAD-04
- [ ] `src/lib/__tests__/morning-briefing.test.ts` — stubs for CAD-05
- [ ] `src/lib/__tests__/event-triggers.test.ts` — stubs for CAD-06
- [ ] `src/lib/__tests__/cadence-integration.test.ts` — stubs for CAD-07, CAD-08

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Morning briefing arrives by 8am in user timezone | CAD-05 | Requires real cron execution + timezone | Set agent cadence to 1 min, verify message appears in CoS chat within window |
| Event trigger fires on viral post | CAD-06 | Requires simulated external event data | Insert mock analytics row exceeding threshold, verify immediate enqueue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
