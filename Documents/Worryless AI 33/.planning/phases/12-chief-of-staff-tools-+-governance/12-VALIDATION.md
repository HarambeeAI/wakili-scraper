---
phase: 12
slug: chief-of-staff-tools-governance
status: draft
nyquist_compliant: false
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
| 12-01-01 | 01 | 1 | GOV-01 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | GOV-02 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | GOV-03 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

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
| Atomic checkout prevents double-claim | GOV-03 | Requires concurrent execution simulation | Run two cadence instances simultaneously, verify only one claims each task |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
