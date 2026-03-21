---
phase: 22-api-server
plan: 05
subsystem: api
tags: [express, resend, web-push, vapid, email, push-notifications]

# Dependency graph
requires:
  - phase: 22-01
    provides: Express scaffold, auth middleware, DB pool
provides:
  - send-validation-email route using Resend SDK
  - send-test-email route using Resend SDK
  - push subscription CRUD (create/delete) with web-push VAPID
  - sendPushNotification utility for scheduling system
  - Lazy SDK initialization pattern for test-safe module loading
affects: [23-scheduling, frontend-migration]

# Tech tracking
tech-stack:
  added: [resend, web-push]
  patterns: [lazy-sdk-initialization, resend-email-template]

key-files:
  created:
    - api-server/src/routes/sendValidationEmail.ts
    - api-server/src/routes/sendTestEmail.ts
    - api-server/src/routes/pushSubscriptions.ts
    - api-server/.gitignore
  modified:
    - api-server/src/index.ts
    - api-server/src/lib/gemini.ts
    - api-server/src/lib/geminiImage.ts
    - api-server/src/routes/generateContent.ts
    - api-server/src/routes/chatWithAgent.ts
    - api-server/src/routes/spawnAgentTeam.ts
    - api-server/src/routes/generateOutreach.ts
    - api-server/src/routes/crawlWebsite.ts
    - api-server/src/routes/orchestrator.ts
    - api-server/src/__tests__/spawnAgentTeam.test.ts
    - api-server/src/__tests__/push.test.ts

key-decisions:
  - "Lazy SDK initialization via getter functions prevents test crashes from missing env vars"
  - "Push subscription uses DELETE+INSERT instead of ON CONFLICT UPSERT to avoid needing unique constraint"

patterns-established:
  - "Lazy SDK init: all external SDK clients (OpenAI, Resend, GoogleGenAI) use getter functions instead of module-level constructors"

requirements-completed: [API-14, API-15, RAIL-05]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 22 Plan 05: Email Routes, Push Subscriptions, and Full Build Verification Summary

**Resend-powered email routes (validation + test), web-push VAPID subscription CRUD, and lazy SDK init pattern fixing all test suites**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T09:53:15Z
- **Completed:** 2026-03-21T10:01:39Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Ported send-validation-email and send-test-email from Deno Edge Functions to Express routes using Resend SDK
- Implemented push subscription create/delete routes with web-push VAPID configuration
- Exported sendPushNotification utility for Phase 23 scheduling system
- Fixed module-level SDK instantiation across all routes (OpenAI, Resend, GoogleGenAI) with lazy getter pattern
- Full test suite green (19 tests, 5 files), TypeScript compiles cleanly, dist/index.js produced

## Task Commits

Each task was committed atomically:

1. **Task 1: Port email routes and implement push subscription routes** - `2e16be3` (feat)
2. **Task 2: Verify full api-server builds, fix lazy SDK init** - `e092c37` (fix)

## Files Created/Modified
- `api-server/src/routes/sendValidationEmail.ts` - Validation email route using Resend SDK with task/validator DB lookup
- `api-server/src/routes/sendTestEmail.ts` - Test email route using Resend SDK with user profile personalization
- `api-server/src/routes/pushSubscriptions.ts` - Push subscription CRUD and sendPushNotification utility
- `api-server/src/index.ts` - Registered 4 new routes (send-validation-email, send-test-email, push-subscriptions POST/DELETE)
- `api-server/src/__tests__/push.test.ts` - 4 tests: sendPushNotification, create validation, delete validation
- `api-server/src/lib/gemini.ts` - Lazy getGeminiOpenAI() replacing module-level constructor
- `api-server/src/lib/geminiImage.ts` - Lazy getGenAI() replacing module-level constructor
- `api-server/src/routes/generateContent.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/routes/chatWithAgent.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/routes/spawnAgentTeam.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/routes/generateOutreach.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/routes/crawlWebsite.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/routes/orchestrator.ts` - Updated to use getGeminiOpenAI()
- `api-server/src/__tests__/spawnAgentTeam.test.ts` - Updated mock to use getGeminiOpenAI factory
- `api-server/.gitignore` - Added node_modules/ and dist/

## Decisions Made
- Used lazy getter functions (getGeminiOpenAI, getResend, getGenAI) instead of module-level SDK constructors to prevent test environment crashes when API keys are unset
- Push subscription uses DELETE+INSERT pattern instead of ON CONFLICT UPSERT to avoid dependency on a unique constraint that may not exist on the push_subscriptions table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed module-level SDK instantiation crashing test suite**
- **Found during:** Task 2 (full build verification)
- **Issue:** OpenAI constructor in gemini.ts throws when OPENAI_API_KEY/GEMINI_API_KEY is unset; Resend constructor throws when RESEND_API_KEY is unset. This crashed health.test.ts, auth.test.ts, and spawnAgentTeam.test.ts because importing index.ts triggers all route imports.
- **Fix:** Replaced all module-level SDK constructors with lazy getter functions that only instantiate on first call. Updated all 6 route files and 1 test file.
- **Files modified:** gemini.ts, geminiImage.ts, generateContent.ts, chatWithAgent.ts, spawnAgentTeam.ts, generateOutreach.ts, crawlWebsite.ts, orchestrator.ts, spawnAgentTeam.test.ts
- **Verification:** All 19 tests pass, TypeScript compiles cleanly
- **Committed in:** e092c37

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for test suite correctness. Established lazy-init pattern for all future SDK usage.

## Issues Encountered
- Docker daemon not running on host machine; Docker build step skipped per plan instructions (Dockerfile structure verified in 22-01)

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all routes are fully wired with Resend SDK and web-push.

## Next Phase Readiness
- All 15 routes from plans 22-02 through 22-05 are registered (langgraph-proxy from 22-04 may still be in progress as parallel execution)
- Push subscription infrastructure ready for Phase 23 scheduling system (sendPushNotification exported)
- Email routes ready for frontend integration
- Full test suite green, TypeScript clean

---
*Phase: 22-api-server*
*Completed: 2026-03-21*
