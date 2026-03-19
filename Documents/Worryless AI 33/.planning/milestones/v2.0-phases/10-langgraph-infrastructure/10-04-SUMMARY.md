---
phase: 10-langgraph-infrastructure
plan: "04"
subsystem: infra
tags: [langgraph, feature-flag, supabase, typescript, react-hook]

# Dependency graph
requires:
  - phase: 10-01
    provides: profiles.use_langgraph column migration (DB column that this plan types and reads)
provides:
  - useLangGraphFlag hook: reads use_langgraph feature flag from profiles table
  - getChatEndpoint helper: resolves legacy orchestrator vs langgraph-proxy URL
  - Updated Supabase TypeScript types with use_langgraph on profiles
  - document_embeddings table TypeScript type definition
affects: [phase-17-generative-ui, chat-routing, langgraph-proxy-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feature flag hook: useState + useEffect + supabase query + cancelled cleanup"
    - "Safe fallback: any error defaults to false (legacy behavior preserved)"
    - "TypeScript manual type extension: add fields to generated Supabase types"

key-files:
  created:
    - worrylesssuperagent/src/hooks/useLangGraphFlag.ts
  modified:
    - worrylesssuperagent/src/integrations/supabase/types.ts

key-decisions:
  - "useLangGraphFlag defaults to false on any error so legacy orchestrator is always the safe fallback"
  - "getChatEndpoint is a pure helper function (not a hook) for ease of use in non-React contexts"
  - "document_embeddings TypeScript type added now to avoid type errors when 10-03 migrations are applied"
  - "embedding typed as string | null because pgvector columns are serialized as strings by the Supabase JS client"

patterns-established:
  - "Feature flag pattern: hook reads boolean from profiles, returns { flag, loading, error }"
  - "Endpoint routing pattern: getChatEndpoint(useLangGraph) returns full Edge Function URL"

requirements-completed: [INFRA-06, INFRA-07]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 10 Plan 04: Frontend Feature Flag Hook Summary

**useLangGraphFlag React hook + getChatEndpoint helper that reads profiles.use_langgraph and routes to legacy orchestrator (false) or langgraph-proxy (true), with safe false fallback on errors**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T20:30:00Z
- **Completed:** 2026-03-18T20:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Updated Supabase TypeScript types: `use_langgraph: boolean` added to profiles Row, Insert, Update types
- Added `document_embeddings` table type (Row/Insert/Update) for Phase 10-03 pgvector column
- Created `useLangGraphFlag` hook that fetches flag from `profiles` on mount, cancels on unmount
- Created `getChatEndpoint(useLangGraph: boolean)` helper that resolves correct Edge Function URL
- TypeScript compiles without errors after all changes

## Task Commits

Each task was committed atomically (in worrylesssuperagent repo):

1. **Task 1: Update Supabase TypeScript types** - `6300166` (feat)
2. **Task 2: Create useLangGraphFlag hook** - `36ffb45` (feat)

## Files Created/Modified
- `worrylesssuperagent/src/integrations/supabase/types.ts` - Added `use_langgraph` to profiles Row/Insert/Update; added `document_embeddings` table type
- `worrylesssuperagent/src/hooks/useLangGraphFlag.ts` - New hook: reads use_langgraph flag, exports `useLangGraphFlag` and `getChatEndpoint`

## Decisions Made
- `useLangGraphFlag` defaults to `false` on any error so all users always fall back to the legacy orchestrator safely
- `getChatEndpoint` is a pure function (not a hook) so it can be called from both React components and non-React utilities
- `document_embeddings` TypeScript type added proactively to prevent type errors when Phase 10-03 pgvector migrations are live

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `worrylesssuperagent/` is a separate git repository (not tracked in the parent repo). All commits were made inside `worrylesssuperagent/` git repo directly.

## User Setup Required

None - no external service configuration required. The hook reads from the existing profiles table; the DB column is handled by Phase 10-01 migration.

## Next Phase Readiness
- Feature flag plumbing complete; Phase 17 (Generative UI) can call `useLangGraphFlag()` and `getChatEndpoint()` to route chat requests
- The hook is purely additive - no existing ChatInterface.tsx or Dashboard.tsx changes needed until Phase 17
- `document_embeddings` TypeScript type ready for any code that queries that table

---
*Phase: 10-langgraph-infrastructure*
*Completed: 2026-03-18*
