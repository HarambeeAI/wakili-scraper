---
phase: 21-auth-wiring
plan: 02
subsystem: auth
tags: [jwt, jose, jwks, logto, express-middleware, sse]

# Dependency graph
requires:
  - phase: 21-auth-wiring
    provides: "Plan 01 wired Logto SDK on frontend for JWT acquisition"
  - phase: 10-langgraph-infrastructure
    provides: "LangGraph Express server with routes on Railway"
provides:
  - "verifyLogtoJWT Express middleware using jose JWKS validation"
  - "AuthedRequest type for typed auth context on Express handlers"
  - "All LangGraph server routes protected by JWT auth except /health"
  - "user_id derived from JWT sub claim instead of request body"
  - "X-Accel-Buffering header on SSE route for Railway nginx"
  - "Authorization check on thread access (403 for wrong user)"
affects: [22-api-server-migration, 23-frontend-migration, 24-scheduling-migration]

# Tech tracking
tech-stack:
  added: [jose@6.2.2]
  patterns: [JWKS-based stateless JWT verification, middleware-first auth on Express routes, sub-claim-as-userId pattern]

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/middleware/auth.ts
    - worrylesssuperagent/langgraph-server/src/__tests__/auth.test.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/index.ts
    - worrylesssuperagent/langgraph-server/package.json
    - worrylesssuperagent/langgraph-server/package-lock.json

key-decisions:
  - "Audience validation commented out with TODO — enable once frontend consistently passes resource indicator"
  - "Authorization on /threads/:userId/:threadId returns 403 if JWT sub does not match URL userId"
  - "GET /threads/:userId ignores URL param and uses JWT sub for authorization safety"

patterns-established:
  - "verifyLogtoJWT middleware pattern: import and apply per-route, not globally, to keep /health unprotected"
  - "AuthedRequest type: req.auth.userId is the canonical user identity on all protected routes"
  - "Auth runs before SSE headers — 401 is plain JSON, never malformed SSE"

requirements-completed: [AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 21 Plan 02: LangGraph Server Auth Middleware Summary

**jose JWKS middleware on LangGraph server protecting all routes with Logto JWT validation, extracting user_id from sub claim**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T09:14:30Z
- **Completed:** 2026-03-21T09:18:48Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Installed jose v6 and created verifyLogtoJWT middleware with createRemoteJWKSet + jwtVerify
- Applied auth middleware to all 9 LangGraph server routes (invoke, invoke/stream, invoke/resume, threads CRUD, store CRUD) while keeping /health unprotected
- Replaced req.body.user_id with req.auth.userId (JWT sub claim) on all routes that use user identity
- Added X-Accel-Buffering: no header on SSE route for Railway nginx compatibility
- Added authorization check on /threads/:userId/:threadId preventing cross-user thread access
- Created comprehensive unit tests (6 tests, all passing) covering auth middleware behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jose and create verifyLogtoJWT middleware** - `d7bb336` (feat)
2. **Task 2: Apply auth middleware to routes and replace body user_id with JWT sub** - `69e6d0d` (feat)
3. **Task 3: Unit tests for verifyLogtoJWT middleware** - `0fa334a` (test)

## Files Created/Modified
- `worrylesssuperagent/langgraph-server/src/middleware/auth.ts` - verifyLogtoJWT middleware with JWKS validation, issuer check, sub extraction
- `worrylesssuperagent/langgraph-server/src/index.ts` - All routes protected by auth middleware, user_id from JWT sub
- `worrylesssuperagent/langgraph-server/src/__tests__/auth.test.ts` - 6 unit tests for middleware (missing header, invalid prefix, bad token, valid token, missing sub, health bypass)
- `worrylesssuperagent/langgraph-server/package.json` - jose dependency added
- `worrylesssuperagent/langgraph-server/package-lock.json` - lockfile updated

## Decisions Made
- Audience validation commented out with TODO — Logto frontend SDK needs to consistently pass resource indicator before enabling
- GET /threads/:userId ignores the URL param entirely and uses JWT sub — prevents URL manipulation for unauthorized thread listing
- GET /threads/:userId/:threadId checks JWT sub matches URL userId and returns 403 if mismatched — explicit authorization
- Auth middleware applied per-route (not globally) to keep /health unprotected for Railway healthcheck

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript param type errors on AuthedRequest routes**
- **Found during:** Task 2 (applying middleware to routes)
- **Issue:** Changing `req` to `AuthedRequest` caused `req.params` values to type as `string | string[]` instead of `string`, breaking calls to `getThreadState`, `searchStore`, `getStore`
- **Fix:** Added `as string` casts on `req.params` values for store and thread routes
- **Files modified:** `worrylesssuperagent/langgraph-server/src/index.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors in index.ts
- **Committed in:** `69e6d0d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type cast fix required by Express's generic param typing. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/cadence/heartbeat-prompts.test.ts` (unrelated to this plan) — documented but not fixed per scope boundary rules

## User Setup Required
None - no external service configuration required. LOGTO_ENDPOINT env var is already required by Plan 01 (frontend Logto SDK wiring).

## Next Phase Readiness
- LangGraph server is fully auth-protected — all routes require valid Logto JWT
- API server migration (Phase 22) can follow the same verifyLogtoJWT pattern
- Frontend migration (Phase 23) needs to include Bearer token in all LangGraph API calls

---
*Phase: 21-auth-wiring*
*Completed: 2026-03-21*

## Self-Check: PASSED

All files exist, all commits verified.
