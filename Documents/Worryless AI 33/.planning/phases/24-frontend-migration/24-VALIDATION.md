---
phase: 24
slug: frontend-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | worrylesssuperagent/vitest.config.ts |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | FE-01, FE-03 | build | `cd worrylesssuperagent && npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-01-02 | 01 | 1 | FE-03 | unit | `npx vitest run src/__tests__/auth` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 2 | FE-02 | unit | `npx vitest run src/__tests__/hooks` | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 2 | FE-02 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-03-01 | 03 | 3 | FE-04 | unit | `npx vitest run src/__tests__/useAgentChat` | ✅ | ⬜ pending |
| 24-03-02 | 03 | 3 | FE-05 | build | `npx vite build` | ✅ | ⬜ pending |
| 24-03-03 | 03 | 3 | RAIL-06, FE-06 | build | `docker build -t frontend .` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Dockerfile for Nginx frontend container (created in plan 24-03)
- [ ] nginx.conf with SPA fallback (created in plan 24-03)

*Existing vitest infrastructure covers unit testing needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logto sign-in redirect flow | FE-03 | Requires browser + Logto instance | Open app, click sign in, verify redirect to Logto, complete login, verify redirect to dashboard |
| Network tab shows no Supabase calls | FE-01 | Requires browser DevTools | Open dashboard, check network tab for any *.supabase.co requests |
| SSE streaming from Railway LangGraph | FE-04 | Requires live Railway deployment | Send agent message, verify SSE events from Railway URL in network tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
