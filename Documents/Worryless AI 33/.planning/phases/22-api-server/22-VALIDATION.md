---
phase: 22
slug: api-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (matches LangGraph server) |
| **Config file** | `api-server/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `cd api-server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd api-server && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api-server && npx vitest run src/__tests__/health.test.ts src/__tests__/auth.test.ts`
- **After every plan wave:** Run `cd api-server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | API-01 | integration | `npx vitest run src/__tests__/health.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | API-01 | integration | `npx vitest run src/__tests__/auth.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | API-04 | integration | `npx vitest run src/__tests__/spawnAgentTeam.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | API-16 | unit | `npx vitest run src/__tests__/langgraphProxy.test.ts` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | API-06 | integration | `npx vitest run src/__tests__/generateImage.test.ts` | ❌ W0 | ⬜ pending |
| 22-05-01 | 05 | 3 | SCHED-05 | unit | `npx vitest run src/__tests__/push.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api-server/vitest.config.ts` — vitest config
- [ ] `api-server/src/__tests__/health.test.ts` — GET /health returns 200
- [ ] `api-server/src/__tests__/auth.test.ts` — 401 on missing/invalid JWT
- [ ] `api-server/src/__tests__/spawnAgentTeam.test.ts` — 200 on valid JWT (mocked pg + gemini)
- [ ] `api-server/src/__tests__/langgraphProxy.test.ts` — SSE header assertions
- [ ] `api-server/src/__tests__/push.test.ts` — web-push VAPID (mocked)
- [ ] `api-server/src/__tests__/generateImage.test.ts` — Imagen 3 response (mocked)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE streams chunks in real time on Railway | API-16 | Requires Railway deployment + nginx proxy | Deploy to Railway, open browser dev tools Network tab, call `/api/langgraph-proxy`, verify chunks arrive incrementally |
| Imagen 3 API key has access enabled | API-06 | Requires Google Cloud Console configuration | Call `POST /api/generate-image` with a test prompt, verify 200 response with `imageUrl` |
| Railway health check passes | RAIL-05 | Requires Railway deployment | Deploy, verify service shows "Healthy" in Railway dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
