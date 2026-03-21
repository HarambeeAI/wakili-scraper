---
phase: 21
slug: auth-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | worrylesssuperagent/vitest.config.ts |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | AUTH-01 | integration | `curl -s https://<logto>/oidc/.well-known/openid-configuration` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | AUTH-06 | integration | `curl -s https://<logto>/api/connectors` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | AUTH-01 | unit | `npx vitest run src/__tests__/useAuth.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | AUTH-02, AUTH-03 | unit | `npx vitest run src/__tests__/authMiddleware.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 2 | AUTH-04 | integration | `grep -r "auth.uid()" worrylesssuperagent/src/` | ❌ W0 | ⬜ pending |
| 21-02-03 | 02 | 2 | AUTH-05 | integration | `curl -H "Authorization: Bearer <token>" <api>/health` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worrylesssuperagent/src/__tests__/useAuth.test.ts` — stubs for AUTH-01 (Logto provider integration)
- [ ] `worrylesssuperagent/src/__tests__/authMiddleware.test.ts` — stubs for AUTH-02, AUTH-03 (JWT validation middleware)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logto console email/password sign-in config | AUTH-01 | Requires Logto admin console | Verify sign-in experience has email connector enabled |
| Google OAuth redirect URI registration | AUTH-06 | Requires Logto admin console + Google Cloud Console | Complete Google OAuth flow end-to-end in browser |
| SSE connection rejection without JWT | AUTH-03 | Requires live LangGraph server | Attempt SSE connect without Authorization header, expect 401 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
