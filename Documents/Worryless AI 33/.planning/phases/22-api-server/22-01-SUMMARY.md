---
phase: 22-api-server
plan: 01
subsystem: api
tags: [express, cors, jose, jwt, pg, gemini, openai, vitest, docker, railway]

# Dependency graph
requires:
  - phase: 21-auth-wiring
    provides: Logto JWT middleware pattern (jose JWKS verification)
provides:
  - Express 5 API server scaffold with CORS, JSON parsing, health endpoint
  - Logto JWT auth middleware for all /api/* routes
  - pg Pool singleton for database access
  - Gemini OpenAI-compat client (text) and Imagen 3 helper (images)
  - Shared utilities (buildWorkspacePrompt, heartbeatParser, sanitize)
  - Dockerfile and railway.toml for Railway deployment
  - vitest config and test scaffolds for Wave 2 plans
affects: [22-02, 22-03, 22-04, 22-05]

# Tech tracking
tech-stack:
  added: [express@5, cors, jose, pg, openai, "@google/genai", web-push, resend, vitest, supertest, tsx]
  patterns: [lazy-JWKS-init, global-api-auth-guard, module-export-for-testing]

key-files:
  created:
    - api-server/package.json
    - api-server/tsconfig.json
    - api-server/Dockerfile
    - api-server/railway.toml
    - api-server/vitest.config.ts
    - api-server/src/index.ts
    - api-server/src/middleware/auth.ts
    - api-server/src/db/pool.ts
    - api-server/src/lib/gemini.ts
    - api-server/src/lib/geminiImage.ts
    - api-server/src/shared/buildWorkspacePrompt.ts
    - api-server/src/shared/heartbeatParser.ts
    - api-server/src/shared/sanitize.ts
    - api-server/src/__tests__/health.test.ts
    - api-server/src/__tests__/auth.test.ts
    - api-server/src/__tests__/spawnAgentTeam.test.ts
    - api-server/src/__tests__/langgraphProxy.test.ts
    - api-server/src/__tests__/generateImage.test.ts
    - api-server/src/__tests__/push.test.ts
  modified: []

key-decisions:
  - "Lazy JWKS initialization to avoid crash when LOGTO_ENDPOINT unset in test environment"
  - "Global app.use('/api', verifyLogtoJWT) guard instead of per-route middleware attachment"
  - "OpenAI SDK pointed at Gemini /v1beta/openai/ endpoint for text; @google/genai SDK for Imagen 3 images"

patterns-established:
  - "Lazy env-var access: defer env reads to first invocation, not module load"
  - "Global /api auth guard: app.use('/api', verifyLogtoJWT) — routes just register handlers"
  - "Test isolation: NODE_ENV !== 'test' guards server listen; export app for supertest"

requirements-completed: [RAIL-05, API-01]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 22 Plan 01: API Server Scaffold Summary

**Express 5 API server with Logto JWT auth, pg pool, Gemini clients, shared utilities, Dockerfile, and passing health/auth tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T09:46:20Z
- **Completed:** 2026-03-21T09:50:33Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Created entire api-server/ directory structure as new service sibling to langgraph-server/
- All infrastructure modules compile cleanly: auth middleware, pg pool, Gemini text + image clients
- Shared utilities (buildWorkspacePrompt, heartbeatParser, sanitize) copied from Edge Functions
- Health and auth tests pass: GET /health returns 200, all /api/* routes return 401 without valid JWT
- Dockerfile and railway.toml ready for Railway deployment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create api-server package, infrastructure modules, and shared utilities** - `93bf06e` (feat)
2. **Task 2: Create Express app entry point with health route, vitest config, and test scaffolds** - `c7991d6` (feat)

## Files Created/Modified

- `api-server/package.json` - Express 5 project with all dependencies
- `api-server/tsconfig.json` - TypeScript config matching langgraph-server pattern
- `api-server/Dockerfile` - Multi-stage Docker build for Railway
- `api-server/railway.toml` - Railway deployment config with /health healthcheck
- `api-server/vitest.config.ts` - Vitest config for node environment
- `api-server/src/index.ts` - Express app with CORS, JSON, /health, /api auth guard
- `api-server/src/middleware/auth.ts` - Logto JWT verification with lazy JWKS init
- `api-server/src/db/pool.ts` - Shared pg Pool singleton
- `api-server/src/lib/gemini.ts` - Gemini OpenAI-compat client singleton
- `api-server/src/lib/geminiImage.ts` - Imagen 3 image generation helper
- `api-server/src/shared/buildWorkspacePrompt.ts` - Workspace prompt builder
- `api-server/src/shared/heartbeatParser.ts` - Heartbeat LLM response parser
- `api-server/src/shared/sanitize.ts` - Workspace content sanitizer
- `api-server/src/__tests__/health.test.ts` - Health endpoint test
- `api-server/src/__tests__/auth.test.ts` - Auth middleware rejection tests
- `api-server/src/__tests__/spawnAgentTeam.test.ts` - Stub for 22-02
- `api-server/src/__tests__/langgraphProxy.test.ts` - Stub for 22-02
- `api-server/src/__tests__/generateImage.test.ts` - Stub for 22-03
- `api-server/src/__tests__/push.test.ts` - Stub for 22-05

## Decisions Made

- **Lazy JWKS initialization:** The langgraph-server auth.ts eagerly creates JWKS at module load, which crashes when LOGTO_ENDPOINT is unset (test environment). Changed to lazy init on first request so tests can import the module safely.
- **Global /api auth guard:** Instead of attaching verifyLogtoJWT per-route, applied `app.use('/api', verifyLogtoJWT)` globally. Wave 2 plans just register route handlers without worrying about auth.
- **OpenAI SDK for Gemini text:** Using `openai` npm package pointed at Gemini's `/v1beta/openai/` endpoint preserves `choices[0].message.content` response shape, avoiding parser rewrites. `@google/genai` SDK only used for Imagen 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy JWKS initialization in auth middleware**
- **Found during:** Task 2 (test execution)
- **Issue:** Verbatim copy of langgraph-server auth.ts eagerly calls `new URL(JWKS_URI)` at module load. When LOGTO_ENDPOINT is undefined (test env), `new URL('undefined/oidc/jwks')` throws Invalid URL, crashing all test imports.
- **Fix:** Changed to lazy initialization pattern: JWKS created on first middleware call, not at import time.
- **Files modified:** api-server/src/middleware/auth.ts
- **Verification:** `npx vitest run` passes all 4 tests (health + auth)
- **Committed in:** c7991d6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test environment compatibility. No scope creep.

## Issues Encountered

None beyond the auto-fixed JWKS initialization issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Wave 2 plans (22-02 through 22-05) can import from these shared modules immediately
- `app` exported for route registration in subsequent plans
- Auth middleware globally applied to /api/* -- route handlers just need to be registered
- Test stubs in place for expansion by each subsequent plan

## Self-Check: PASSED

- All 15 key files verified present on disk
- Both task commits (93bf06e, c7991d6) verified in git log
- `npx vitest run` passes 4 tests (2 health, 2 auth + 1 auth = 3 auth tests, total 4)
- `npx tsc --noEmit` exits 0

---
*Phase: 22-api-server*
*Completed: 2026-03-21*
