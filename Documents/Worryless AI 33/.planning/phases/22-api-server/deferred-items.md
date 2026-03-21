# Phase 22 Deferred Items

## Pre-existing: health.test.ts and auth.test.ts fail when routes import gemini.ts

**Found during:** 22-03 Task 2 verification
**Issue:** `api-server/src/__tests__/health.test.ts` and `auth.test.ts` import `app` from `index.ts`, which now transitively imports `gemini.ts`. The `new OpenAI(...)` constructor throws if `GEMINI_API_KEY` env var is unset. Tests that only need the Express app (health, auth) break.
**Fix needed:** Either lazy-initialize the OpenAI client (like the JWKS pattern in auth.ts) or set a dummy `GEMINI_API_KEY` in vitest setup.
**Scope:** Pre-existing architectural issue — affects all tests that import the app after any route using gemini is registered.
