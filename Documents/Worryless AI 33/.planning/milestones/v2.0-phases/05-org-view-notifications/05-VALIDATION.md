---
phase: 5
slug: org-view-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 5 — Validation Strategy

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
| 5-01-01 | 01 | 0 | NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06 | unit stub | `npx vitest run src/__tests__/useNotifications.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | ORG-02, ORG-03 | unit stub | `npx vitest run src/__tests__/useTeamData.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | NOTIF-01, NOTIF-02 | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "initial count"` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | NOTIF-02 | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "realtime"` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 1 | NOTIF-05 | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "markRead"` | ❌ W0 | ⬜ pending |
| 5-02-04 | 02 | 1 | NOTIF-05 | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "markAllRead"` | ❌ W0 | ⬜ pending |
| 5-02-05 | 02 | 1 | NOTIF-06 | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "navigation"` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | ORG-02, ORG-03 | unit | `npx vitest run src/__tests__/useTeamData.test.ts -t "team data"` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | ORG-03 | unit | `npx vitest run src/__tests__/useTeamData.test.ts -t "status"` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | NOTIF-03 | manual | N/A — requires HTTPS + service worker | manual only | ⬜ pending |
| 5-05-01 | 05 | 2 | ORG-01, ORG-04, ORG-05 | manual | N/A — visual component | manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worrylesssuperagent/src/__tests__/useNotifications.test.ts` — stubs for NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06
- [ ] `worrylesssuperagent/src/__tests__/useTeamData.test.ts` — stubs for ORG-02, ORG-03 (includes `getHeartbeatStatus` pure function test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push subscription stored in push_subscriptions | NOTIF-03 | Requires HTTPS + real browser service worker registration | Open app over HTTPS, grant push permission, verify row appears in push_subscriptions table via Supabase Studio |
| Urgent push notification delivered to browser | NOTIF-03 | Browser push delivery requires live service interaction | Trigger urgent heartbeat finding, verify notification appears in OS notification center |
| Urgent email sent via Resend | NOTIF-04 | Already tested in Phase 4; email delivery requires live Resend call | Verify in Resend dashboard that urgent finding email was dispatched |
| Team view renders two-tier org chart | ORG-01 | Visual layout verification | Navigate to Team view, confirm Chief of Staff at top, other agents below in grid |
| Agent card click navigates to agent panel | ORG-04 | React component click navigation | Click agent card, confirm correct agent panel opens |
| Add Agent button opens marketplace | ORG-05 | Visual component interaction | Click Add Agent in Team view, confirm marketplace view opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
