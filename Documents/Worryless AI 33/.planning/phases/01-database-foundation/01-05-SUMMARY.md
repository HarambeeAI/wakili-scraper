---
phase: 01-database-foundation
plan: 05
subsystem: auth
tags: [jwt, supabase, deno, edge-functions, security, prompt-injection]

# Dependency graph
requires: []
provides:
  - JWT-verified userId extraction in planning-agent, generate-leads, crawl-business-website
  - HTTP 401 on missing/invalid Authorization header in all three functions
  - sanitizeWorkspaceContent() shared utility in _shared/sanitize.ts
affects:
  - Phase 3 workspace editor save (imports sanitize.ts)
  - Phase 4 heartbeat runner (imports sanitize.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JWT identity: extract userId from auth.getUser() via Authorization header, never from request body"
    - "Auth client vs service-role client: use anon-key client for identity check, service-role for DB writes"
    - "Shared edge function utilities: _shared/ directory with relative ../_ imports"

key-files:
  created:
    - worrylesssuperagent/supabase/functions/_shared/sanitize.ts
  modified:
    - worrylesssuperagent/supabase/functions/planning-agent/index.ts
    - worrylesssuperagent/supabase/functions/generate-leads/index.ts
    - worrylesssuperagent/supabase/functions/crawl-business-website/index.ts

key-decisions:
  - "Two Supabase clients per function: anon-key client for JWT verification, service-role for DB writes — service role unchanged"
  - "crawl-business-website validation guard changed from !websiteUrl || !userId to !websiteUrl only — userId now guaranteed by JWT check upstream"

patterns-established:
  - "JWT extraction pattern: get Authorization header, create anon-key client, call auth.getUser(), extract user.id — applied consistently across all functions"
  - "Auth fail-fast: return 401 immediately before any body parse or business logic"

requirements-completed: [SEC-01, SEC-03]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 01 Plan 05: Security Hardening — JWT userId Extraction + Sanitize Utility

**Three edge functions now extract userId from verified JWT (not request body), returning 401 on missing/invalid auth; shared sanitizeWorkspaceContent() utility created for Phase 3/4 prompt injection defense**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-12T17:25:05Z
- **Completed:** 2026-03-12T17:27:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `_shared/sanitize.ts` with 12 prompt injection regex patterns, exported as `sanitizeWorkspaceContent()` — ready for Phase 3 and Phase 4 imports
- Fixed user ID spoofing vulnerability in all three functions: userId now comes from the verified Supabase JWT, not the request body
- All three functions return HTTP 401 (not 500) when Authorization header is absent or the token is invalid
- Existing callers that use `supabase.functions.invoke` are unaffected — the SDK automatically passes the session JWT in the Authorization header

## Task Commits

Each task was committed atomically (in the nested `worrylesssuperagent/` repo):

1. **Task 1: Create shared sanitize.ts utility module** - `418f91c` (feat)
2. **Task 2: Fix userId security vulnerability in 3 edge functions** - `ae3033a` (fix)

## Files Created/Modified

- `worrylesssuperagent/supabase/functions/_shared/sanitize.ts` - New shared module exporting sanitizeWorkspaceContent() with 12 injection patterns
- `worrylesssuperagent/supabase/functions/planning-agent/index.ts` - JWT extraction added; body no longer destructures userId
- `worrylesssuperagent/supabase/functions/generate-leads/index.ts` - JWT extraction added; userId removed from body destructure
- `worrylesssuperagent/supabase/functions/crawl-business-website/index.ts` - JWT extraction added; userId removed from body destructure; validation guard simplified

## Decisions Made

- **Two Supabase clients per function:** anon-key client is created solely for `auth.getUser()` verification, then the service-role client is used for all database operations. The service-role client in `planning-agent` was explicitly preserved unchanged as the plan specified.
- **crawl-business-website validation guard:** Changed from `!websiteUrl || !userId` to `!websiteUrl` only. The `userId` check is now redundant because the JWT block above it already guarantees a valid `userId` or returns 401 first.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The `worrylesssuperagent/` directory is a nested git repository within the parent `.planning` repo. Commits for the source code changes were made inside the nested repo (`worrylesssuperagent/`) rather than the parent repo. Planning metadata commits remain in the parent repo. This is the existing project structure and required no remediation.

## User Setup Required

None — no new environment variables or external service configuration required. The `SUPABASE_ANON_KEY` env var used for JWT verification is already available in all Supabase Edge Functions by default.

## Next Phase Readiness

- Phase 3 workspace editor save endpoint can import `sanitizeWorkspaceContent` from `'../_shared/sanitize.ts'` immediately
- Phase 4 heartbeat runner can do the same
- All three security-hardened functions are ready to deploy — no further auth changes needed

---
*Phase: 01-database-foundation*
*Completed: 2026-03-12*
