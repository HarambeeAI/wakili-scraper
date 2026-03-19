---
phase: 6
slug: heartbeat-bug-fixes
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/useTeamData.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/useTeamData.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | HB-01..09 | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | HB-01..09 | integration | `npx vitest run` | ✅ | ⬜ pending |
| 6-02-01 | 02 | 1 | ORG-04 | unit | `npx vitest run src/__tests__/useTeamData.test.ts` | ✅ | ⬜ pending |
| 6-02-02 | 02 | 1 | ORG-04 | unit | `npx vitest run src/__tests__/useTeamData.test.ts` | ✅ | ⬜ pending |
| 6-02-03 | 02 | 1 | HB-08 | unit | `npx vitest run src/__tests__/useHeartbeatConfig.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files confirmed present on disk — no Wave 0 scaffolding needed.

- `src/__tests__/heartbeatDispatcher.test.ts` — ✅ exists (Phase 4)
- `src/__tests__/useHeartbeatConfig.test.ts` — ✅ exists (Phase 4)
- `src/__tests__/useTeamData.test.ts` — ✅ exists (assertions need updating in Plan 02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Amber dot appears in UI when severity is urgent/headsup/digest | ORG-04 | Visual component rendering | Log in, navigate to OrgView, observe AgentCard amber dot when heartbeat has run |
| Heartbeat job executes end-to-end after field fix | HB-01..09 | Requires running pgmq queue + Supabase functions | Trigger heartbeat dispatch, check logs for runner execution |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
