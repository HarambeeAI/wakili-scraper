---
phase: 7
slug: workspace-prompt-wiring-push-optin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (jsdom environment) |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | WS-07 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | WS-07 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | ✅ | ⬜ pending |
| 7-02-01 | 02 | 1 | WS-07 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 2 | NOTIF-03 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/usePushSubscription.test.ts` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 2 | NOTIF-03 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/usePushSubscription.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/usePushSubscription.test.ts` — stubs for NOTIF-03 opt-in subscribe path (it.todo stubs acceptable for Wave 0)
- [ ] `supabase/functions/_shared/buildWorkspacePrompt.ts` — Deno mirror of `src/lib/buildWorkspacePrompt.ts` (needed by Plans 07-01 and 07-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push opt-in prompt displays on first dashboard load | NOTIF-03 | Browser push permission API not automatable in Vitest | Log in as a user who has not opted in, load Dashboard, verify prompt/banner appears |
| Push opt-in prompt displays during onboarding completion | NOTIF-03 | Browser push permission API not automatable in Vitest | Complete onboarding as a new user, verify push opt-in step/modal appears |
| Deno `_shared/buildWorkspacePrompt.ts` identical to src copy | WS-07 | File comparison, not runtime behavior | `diff worrylesssuperagent/src/lib/buildWorkspacePrompt.ts worrylesssuperagent/supabase/functions/_shared/buildWorkspacePrompt.ts` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
