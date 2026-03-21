---
phase: 22-api-server
plan: 04
subsystem: api
tags: [express, firecrawl, apify, gemini, pg, csv-parser, google-oauth, outreach]

# Dependency graph
requires:
  - phase: 22-api-server (22-01)
    provides: "Express scaffold with auth middleware, pg pool, Gemini client"
provides:
  - "POST /api/crawl-business-website — Firecrawl website crawl + Gemini analysis + artifact storage"
  - "POST /api/parse-datasheet — CSV/TSV parsing with batch row insertion"
  - "POST /api/generate-leads — Apify lead generation with location validation"
  - "POST /api/generate-outreach — Gemini-powered personalized cold outreach emails"
  - "POST /api/planning-agent — Task template CRUD with cron scheduling"
  - "POST /api/sync-gmail-calendar — Google integration check with business context"
affects: [frontend-migration, api-server]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Firecrawl/Apify external API passthrough with process.env keys", "Business knowledge injection into LLM prompts via pg pool queries"]

key-files:
  created:
    - api-server/src/routes/crawlWebsite.ts
    - api-server/src/routes/parseDatasheet.ts
    - api-server/src/routes/generateLeads.ts
    - api-server/src/routes/generateOutreach.ts
    - api-server/src/routes/planningAgent.ts
    - api-server/src/routes/syncGmailCalendar.ts
  modified:
    - api-server/src/index.ts

key-decisions:
  - "Used getGeminiOpenAI() lazy init pattern (aligned with parallel agent changes to gemini.ts)"
  - "Inserted artifacts individually rather than batch INSERT to handle partial failures gracefully"
  - "syncGmailCalendar returns placeholder response (no googleapis dependency needed yet — original edge function was also placeholder)"

patterns-established:
  - "Business knowledge fetch pattern: pool.query profiles + business_artifacts, concatenate into LLM context string"
  - "External API passthrough: keep fetch calls to Firecrawl/Apify unchanged, only swap env var access and auth"

requirements-completed: [API-08, API-09, API-10, API-11, API-12, API-13]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 22 Plan 04: Business Data Routes Summary

**6 business data routes ported (crawl-website, parse-datasheet, generate-leads, generate-outreach, planning-agent, sync-gmail-calendar) with Firecrawl/Apify API passthrough, Gemini LLM, and pg pool for DB**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T09:52:54Z
- **Completed:** 2026-03-21T09:57:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Ported 6 Supabase Edge Functions to Express route handlers
- All Deno globals replaced (Deno.env.get -> process.env, serve() -> export const handler)
- Supabase client replaced with pg pool parameterized queries across all routes
- Lovable AI Gateway replaced with Gemini OpenAI-compat client
- External API calls (Firecrawl, Apify) preserved with only env var access changed

## Task Commits

Each task was committed atomically:

1. **Task 1: Port crawl-business-website, parse-datasheet, generate-leads** - `2212998` (feat)
2. **Task 2: Port generate-outreach, planning-agent, sync-gmail-calendar** - `b3d20fb` (feat)

## Files Created/Modified
- `api-server/src/routes/crawlWebsite.ts` - Website crawl via Firecrawl + Gemini analysis + artifact DB storage
- `api-server/src/routes/parseDatasheet.ts` - CSV/TSV parser with batch row insertion
- `api-server/src/routes/generateLeads.ts` - Apify lead finder with location validation and DB storage
- `api-server/src/routes/generateOutreach.ts` - Gemini-powered personalized outreach email generation
- `api-server/src/routes/planningAgent.ts` - Task template CRUD with cron scheduling (initialize/enable/disable)
- `api-server/src/routes/syncGmailCalendar.ts` - Google integration check with business context
- `api-server/src/index.ts` - Added 6 route imports and registrations

## Decisions Made
- Used `getGeminiOpenAI()` lazy init pattern instead of direct `geminiOpenAI` export (aligned with parallel agent's refactor of gemini.ts to avoid test crashes)
- Inserted business artifacts individually rather than batch to handle partial failures gracefully
- syncGmailCalendar kept as placeholder (original edge function was also placeholder — actual Google API calls will be wired when googleapis is added)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted to getGeminiOpenAI() lazy init API**
- **Found during:** Task 1 (crawlWebsite route)
- **Issue:** gemini.ts was refactored by a parallel agent from `export const geminiOpenAI` to `export function getGeminiOpenAI()` for lazy initialization
- **Fix:** Updated all Gemini usage calls to `getGeminiOpenAI().chat.completions.create()`
- **Files modified:** crawlWebsite.ts, generateOutreach.ts
- **Verification:** tsc --noEmit passes (errors only in unrelated orchestrator.ts from another plan)
- **Committed in:** 2212998, b3d20fb

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation to parallel agent's API change. No scope creep.

## Issues Encountered
- index.ts was being concurrently modified by parallel agents (22-02, 22-03, 22-05) — each commit only staged files that were locally changed, avoiding merge conflicts

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 business data routes are registered and compile cleanly
- Frontend can target these routes once API server is deployed on Railway
- External API keys (FIRECRAWL_API_KEY, APIFY_API_TOKEN) must be set in Railway environment

## Self-Check: PASSED

- All 6 route files exist on disk
- Commit 2212998 found in git log
- Commit b3d20fb found in git log

---
*Phase: 22-api-server*
*Completed: 2026-03-21*
