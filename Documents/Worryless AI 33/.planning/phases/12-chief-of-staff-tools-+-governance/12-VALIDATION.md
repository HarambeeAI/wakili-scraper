---
phase: 12
slug: chief-of-staff-tools-governance
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsc --noEmit (TypeScript compilation check) |
| **Config file** | worrylesssuperagent/langgraph-server/tsconfig.json |
| **Quick run command** | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| **Full suite command** | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **After every plan wave:** Run `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | GOV-01, GOV-02, GOV-03, GOV-04 | sql + compile | `ls worrylesssuperagent/supabase/migrations/20260319000001_agent_audit_log.sql worrylesssuperagent/supabase/migrations/20260319000002_governance_columns.sql` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | GOV-01, GOV-02, GOV-03, GOV-04 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | GOV-02 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | GOV-01, GOV-02, GOV-03 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-03-01 | 03 | 2 | COS-01, COS-06, COS-07 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-03-02 | 03 | 2 | COS-02, COS-03, COS-04, COS-05 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-04-01 | 04 | 3 | COS-01 thru COS-07, GOV-01 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-04-02 | 04 | 3 | COS-02, COS-03, GOV-01, GOV-03 | compile | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Morning briefing aggregates real data | COS-01 | Requires live Supabase with heartbeat + task data | Insert test rows, invoke briefing tool, verify output contains urgency sections |
| Token budget enforcement pauses agent | GOV-02 | Requires multi-invocation state accumulation | Run agent until 80% threshold, verify warning; run to 100%, verify pause |
| Atomic checkout prevents double-claim | GOV-04 | Requires concurrent execution simulation | Run two cadence instances simultaneously, verify only one claims each task |
| Calendar placeholder returns empty array | COS-01 | Requires live invocation | Invoke compileMorningBriefing, verify calendar field is [] |
| createFanOutSends dispatches parallel agents | COS-03 | Requires running supervisor graph with multi-agent request | Send "ask accountant and marketer" to CoS, verify both agents receive the request |
| Audit log written for delegation | GOV-01 | Requires live Supabase + delegation flow | Delegate to agent, query agent_audit_log for delegation action entry |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
