---
phase: 16
slug: proactive-cadence-engine
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
updated: 2026-03-19
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `worrylesssuperagent/langgraph-server/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent/langgraph-server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent/langgraph-server && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/ --reporter=verbose`
- **After every plan wave:** Run `cd worrylesssuperagent/langgraph-server && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CAD-01, CAD-08 | structural | `grep -c "cadence_config" worrylesssuperagent/supabase/migrations/20260320000001_cadence_config.sql && grep -c "cadence_tier" worrylesssuperagent/supabase/migrations/20260320000002_cadence_dispatcher_v2.sql` | N/A (SQL) | green |
| 16-01-02 | 01 | 1 | CAD-02, CAD-03, CAD-04 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/heartbeat-prompts.test.ts --reporter=verbose` | Plan creates | green |
| 16-01-03 | 01 | 1 | CAD-08 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/cadence-config.test.ts --reporter=verbose` | Plan creates | green |
| 16-02-01 | 02 | 1 | CAD-01, CAD-02 | structural | `grep -c "LANGGRAPH_SERVER_URL" worrylesssuperagent/supabase/functions/proactive-runner/index.ts && grep -c "invoke" worrylesssuperagent/supabase/functions/proactive-runner/index.ts` | Plan creates | green |
| 16-02-02 | 02 | 1 | CAD-01, CAD-04 | structural | `grep -c "cadence_tier" worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts && grep -c "get_due_cadence_agents" worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts` | Plan modifies | green |
| 16-02-03 | 02 | 1 | CAD-01, CAD-04 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/cadence-dispatcher.test.ts --reporter=verbose` | Plan creates | green |
| 16-03-01 | 03 | 2 | CAD-07 | structural | `grep -c "check_event_triggers" worrylesssuperagent/supabase/migrations/20260320000003_event_detector.sql` | Plan creates | green |
| 16-03-02 | 03 | 2 | CAD-07 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/event-detector.test.ts --reporter=verbose` | Plan creates | green |
| 16-04-01 | 04 | 2 | CAD-08 | structural | `grep -c "CadenceConfigSection" worrylesssuperagent/src/components/agents/CadenceConfigSection.tsx && grep -c "CadenceConfigSection" worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx` | Plan creates | green |
| 16-05-01 | 05 | 3 | CAD-03, CAD-05, CAD-06 | structural | `grep -c "LANGGRAPH_SERVER_URL" worrylesssuperagent/supabase/functions/send-morning-digest/index.ts && grep -c "EVENT_PROMPTS" worrylesssuperagent/supabase/functions/proactive-runner/index.ts` | Plan modifies | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All test files are created by their respective plan tasks (no phantom Wave 0 gaps):

- [x] `langgraph-server/src/cadence/heartbeat-prompts.test.ts` — created by Plan 16-01 Task 2 (CAD-02, CAD-03, CAD-04)
- [x] `langgraph-server/src/cadence/cadence-config.test.ts` — created by Plan 16-01 Task 3 (CAD-08)
- [x] `langgraph-server/src/cadence/cadence-dispatcher.test.ts` — created by Plan 16-02 Task 3 (CAD-01, CAD-04)
- [x] `langgraph-server/src/cadence/event-detector.test.ts` — created by Plan 16-03 Task 2 (CAD-07)

No orphaned test file references. Every test file listed is created by a specific plan task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Morning briefing arrives by 8am in user timezone | CAD-05 | Requires real cron execution + timezone | Set agent cadence to 1 min, verify message appears in CoS chat within window |
| Event trigger fires on overdue invoice | CAD-07 | Requires simulated external event data | Insert mock invoice row past due date, verify immediate pgmq enqueue |
| CadenceConfigSection renders correctly with toggles | CAD-08 | Visual/interactive UI | Open any agent panel, expand Cadence Configuration, toggle tiers |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or plan-created test files
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all test file references — no phantom paths
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] All vitest commands use `cd worrylesssuperagent/langgraph-server` (server config, not frontend)

**Approval:** ready

---

## Validation Audit 2026-03-19

| Metric | Count |
|--------|-------|
| Structural checks run | 6 |
| Unit test files | 4 |
| Unit tests passing | 141 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 11 task verifications passed (6 structural + 4 unit test suites + 1 cadence suite). No gaps detected.
