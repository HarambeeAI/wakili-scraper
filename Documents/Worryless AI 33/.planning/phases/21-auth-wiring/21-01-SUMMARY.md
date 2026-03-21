---
phase: 21-auth-wiring
plan: 01
subsystem: auth
tags: [logto, oidc, react, jwt, oauth]

requires:
  - phase: 20-database-migration
    provides: Railway PostgreSQL with public.users table
provides:
  - LogtoConfig export with endpoint, appId, resources env vars
  - useAuth hook (userId, token, isAuthenticated, signIn, signOut)
  - Callback page handling OIDC redirects
  - LogtoProvider wrapping entire App tree
  - /callback route in App.tsx
affects: [21-02-auth-wiring, 22-api-server, 24-frontend-migration]

tech-stack:
  added: ["@logto/react ^4.0.13"]
  patterns: ["useAuth thin wrapper over useLogto", "LogtoProvider as outermost app wrapper"]

key-files:
  created:
    - worrylesssuperagent/src/integrations/logto/client.ts
    - worrylesssuperagent/src/hooks/useAuth.ts
    - worrylesssuperagent/src/pages/Callback.tsx
    - worrylesssuperagent/src/__tests__/useAuth.test.ts
  modified:
    - worrylesssuperagent/src/App.tsx
    - worrylesssuperagent/package.json

key-decisions:
  - "LogtoProvider wraps outside QueryClientProvider as outermost provider"
  - "useAuth returns getAccessToken result for API resource, not id_token"
  - "Existing Supabase Auth.tsx and client.ts preserved for Phase 24 migration"

patterns-established:
  - "useAuth hook pattern: thin wrapper returning userId/token/isAuthenticated/signIn/signOut"
  - "Logto config via VITE_LOGTO_* env vars (endpoint, appId, apiResource)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-06]

duration: 2min
completed: 2026-03-21
---

# Phase 21 Plan 01: Logto Frontend Auth Infrastructure Summary

**@logto/react integration with LogtoProvider, useAuth hook, and OIDC callback page wired into App.tsx**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T09:14:27Z
- **Completed:** 2026-03-21T09:16:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Installed @logto/react and created LogtoConfig referencing VITE_LOGTO_ENDPOINT, VITE_LOGTO_APP_ID, VITE_LOGTO_API_RESOURCE
- Created useAuth hook wrapping useLogto with userId (from sub claim), token (from API resource), isAuthenticated, signIn, signOut
- Created Callback page with useHandleSignInCallback redirecting to /dashboard
- Wrapped App.tsx with LogtoProvider as outermost provider, added /callback route
- 5 unit tests passing for useAuth hook covering authenticated/unauthenticated states and callback URIs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Logto config, useAuth hook, and Callback page** - `ac1545a` (feat)
2. **Task 2: Wrap App.tsx with LogtoProvider and add /callback route** - `a41008b` (feat)
3. **Task 3: Unit tests for useAuth hook** - `e6a412f` (test)

## Files Created/Modified
- `worrylesssuperagent/src/integrations/logto/client.ts` - LogtoConfig with env var references
- `worrylesssuperagent/src/hooks/useAuth.ts` - Thin auth hook wrapping useLogto
- `worrylesssuperagent/src/pages/Callback.tsx` - OIDC callback handler with redirect to /dashboard
- `worrylesssuperagent/src/__tests__/useAuth.test.ts` - 5 unit tests for useAuth hook
- `worrylesssuperagent/src/App.tsx` - LogtoProvider wrapper + /callback route added
- `worrylesssuperagent/package.json` - @logto/react dependency added

## Decisions Made
- LogtoProvider placed as outermost wrapper (outside QueryClientProvider) per Logto docs requirement
- useAuth returns access token for API resource (not id_token) since backend will validate JWTs against the API resource
- Existing Supabase Auth.tsx and supabase/client.ts are NOT modified -- they will be removed in Phase 24 (frontend migration)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Logto admin console setup (app registration, email connector, Google social connector) is a prerequisite documented in client.ts comments and 21-RESEARCH.md.

## Next Phase Readiness
- LogtoProvider and useAuth hook ready for consumption by Phase 21 Plan 02 (protected routes / auth guard)
- API server (Phase 22) can validate JWTs issued by Logto using jose JWKS middleware
- Frontend migration (Phase 24) will replace Supabase auth call sites with useAuth

---
*Phase: 21-auth-wiring*
*Completed: 2026-03-21*
