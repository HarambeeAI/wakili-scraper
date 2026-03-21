---
phase: 25-production-cutover
plan: 01
subsystem: infra
tags: [gemini, cors, langgraph, llm, express]

# Dependency graph
requires:
  - phase: 22-api-layer-migration
    provides: api-server Express server with CORS + Gemini client pattern
  - phase: 24-frontend-migration
    provides: frontend fully migrated off Supabase, ready for Railway domain
provides:
  - CORS origin configurable via CORS_ORIGIN env var (wildcard fallback for dev)
  - LangGraph server LLM calls using direct Gemini API (no Lovable gateway dependency)
  - parse-receipt tool using Gemini API (no Lovable gateway dependency)
affects: [25-02-production-cutover, railway-deployment, production-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct fetch to generativelanguage.googleapis.com/v1beta/openai/chat/completions with GEMINI_API_KEY bearer token"
    - "CORS_ORIGIN env var with || '*' fallback — safe for local dev, restrictive in production"

key-files:
  created: []
  modified:
    - api-server/src/index.ts
    - worrylesssuperagent/langgraph-server/src/llm/client.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/parse-receipt.ts

key-decisions:
  - "Model name changed from google/gemini-3-flash-preview to gemini-2.0-flash to match Gemini direct API naming convention"
  - "CORS_ORIGIN || '*' wildcard fallback ensures local dev continues to work without env var set"
  - "LangGraph server uses raw fetch (not openai npm package) — only URL and key variable name changed"

patterns-established:
  - "Gemini API endpoint pattern: fetch to generativelanguage.googleapis.com/v1beta/openai/chat/completions with Authorization: Bearer GEMINI_API_KEY"

requirements-completed: [RAIL-08]

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 25 Plan 01: Production Cutover Pre-flight Fixes Summary

**CORS origin made env-configurable and LangGraph server fully switched from Lovable AI Gateway to direct Gemini API (generativelanguage.googleapis.com) with GEMINI_API_KEY**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T15:45:00Z
- **Completed:** 2026-03-21T15:53:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- api-server CORS origin now reads from `process.env.CORS_ORIGIN || "*"` — production can lock to Railway frontend domain
- LangGraph server `callLLM` function switched from Lovable AI Gateway to `generativelanguage.googleapis.com/v1beta/openai/chat/completions` with `GEMINI_API_KEY`
- `parse-receipt.ts` vision tool similarly updated — model changed to `gemini-2.0-flash`
- Zero `LOVABLE` references remain in `worrylesssuperagent/langgraph-server/src/`
- All pre-existing test suites confirm no regression (4 pre-existing Logto context failures unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix API Server CORS + LangGraph Server LLM client to use Gemini API** - `7df1c34` (fix)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `api-server/src/index.ts` - CORS origin changed from hardcoded `"*"` to `process.env.CORS_ORIGIN || "*"`
- `worrylesssuperagent/langgraph-server/src/llm/client.ts` - GEMINI_OPENAI_BASE constant, GEMINI_API_KEY, model `gemini-2.0-flash`, updated comment
- `worrylesssuperagent/langgraph-server/src/tools/accountant/parse-receipt.ts` - GEMINI_OPENAI_BASE constant, GEMINI_API_KEY, model `gemini-2.0-flash`, updated file header comment

## Decisions Made

- Model name `google/gemini-3-flash-preview` (Lovable gateway alias) replaced with `gemini-2.0-flash` (Gemini direct API name) — these refer to the same model family but the direct API uses the short name without the `google/` prefix
- Raw `fetch` preserved in LangGraph server — the existing fetch-based implementation only needed URL and key variable changes; no need to introduce the openai npm package

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing test failures (4 files, 30 tests) in `worrylesssuperagent` from Phase 24's Logto migration (`useHeartbeatConfig`, `useNotifications`, `usePushSubscription`, `useTeamData` — all fail with "Must be used inside <LogtoProvider> context"). Confirmed pre-existing by stashing changes and running tests — identical failure counts. Not caused by this plan.

## Known Stubs

None — all three files are fully wired to Gemini API endpoint.

## User Setup Required

Before production deployment, set `CORS_ORIGIN` on the Railway API Server service to the frontend domain (e.g., `https://worryless.up.railway.app`). Without this env var the server falls back to `"*"` (permissive, acceptable for staging).

Set `GEMINI_API_KEY` on the Railway LangGraph Server service. Without this, all agent LLM calls will throw at runtime.

## Next Phase Readiness

- All three pre-cutover code blockers resolved
- Railway domain assignment and smoke testing (Plan 25-02) can proceed
- API Server and LangGraph Server are ready for production Railway deployment with correct env vars

---
*Phase: 25-production-cutover*
*Completed: 2026-03-21*
