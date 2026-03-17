---
phase: 8
slug: phase-verifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01 | 01 | 1 | DB-01..07, SEC-01, SEC-03 | artifact check | Verify `01-VERIFICATION.md` exists with explicit PASS/FAIL | ✅ | ⬜ pending |
| 08-02 | 02 | 1 | WS-01..07, MKT-01..04 | artifact check | Verify `03-VERIFICATION.md` exists with explicit PASS/FAIL | ✅ | ⬜ pending |
| 08-03 | 03 | 1 | HB-01..09 | artifact check | Verify `04-VERIFICATION.md` exists with explicit PASS/FAIL | ✅ | ⬜ pending |
| 08-04 | 04 | 1 | NOTIF-01..06, ORG-01..05 | artifact check | Verify `05-VERIFICATION.md` exists with explicit PASS/FAIL | ✅ | ⬜ pending |
| 08-regression | all | all | all | unit | `cd worrylesssuperagent && npx vitest run` — must remain 51 passing, 0 failed | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no new implementation code is produced in Phase 8. The test suite already exists. The only artifacts produced are VERIFICATION.md documents in `.planning/phases/`. Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DB trigger fires on INSERT | DB-04 | Requires live Supabase instance | Run INSERT on relevant table; verify trigger side-effect occurs |
| RLS cross-user isolation | SEC-01 | Requires live Supabase instance | Log in as two separate users; verify row access is isolated |
| pg_cron job execution | HB-01 | Requires live Supabase instance with pg_cron enabled | Check cron schedule in pg_cron.job; verify it runs at expected interval |
| Heartbeat end-to-end flow | HB-09 | Requires deployed Supabase + pgmq | Trigger heartbeat; verify message queued, processed, log written |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
