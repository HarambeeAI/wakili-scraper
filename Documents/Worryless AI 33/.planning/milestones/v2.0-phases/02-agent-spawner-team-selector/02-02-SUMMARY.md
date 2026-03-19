---
phase: 02-agent-spawner-team-selector
plan: 02
subsystem: api
tags: [deno, supabase-edge-functions, llm, jwt, catalog-filtering, tdd]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: available_agent_types table with id, display_name, description, skill_config columns
  - phase: 02-agent-spawner-team-selector-01
    provides: skill_config seed data verified for all 13 agent types
provides:
  - spawn-agent-team Supabase edge function returning catalog-validated agent recommendations
  - extractJson pure function (exported) that strips LLM markdown fences
  - filterRecommendations pure function (exported) that guards catalog IDs, excludes defaults, caps at 5
  - Unit test suite (6 Deno.test blocks) covering all filtering and extraction edge cases
affects:
  - 02-03 (AgentTeamSelector UI component consumes this function's {recommendations, allAgents} response shape)

# Tech tracking
tech-stack:
  added: [deno (installed via curl installer for test runner), deno.land/std@0.168.0/testing/asserts.ts]
  patterns:
    - TDD RED-GREEN: test file committed first in failing state, then implementation makes all pass
    - Two-client Supabase pattern: anon-key for JWT verify, service-role for DB reads
    - Graceful LLM degradation: all LLM errors return empty recommendations array, never 500
    - Prompt-only JSON instruction (no response_format parameter) matching existing function conventions

key-files:
  created:
    - worrylesssuperagent/supabase/functions/spawn-agent-team/index.ts
    - worrylesssuperagent/supabase/functions/spawn-agent-team/spawn.test.ts
  modified: []

key-decisions:
  - "LOVABLE_API_KEY (not LOVABLE_AI_GATEWAY_KEY) is the correct bearer token env var — matches crawl-business-website pattern"
  - "filterRecommendations exported from index.ts so spawn.test.ts can import and test pure logic without HTTP"
  - "LLM errors return {recommendations: [], allAgents: [...]} with 200 status — no 500 thrown to client"

patterns-established:
  - "Pure helper exports pattern: edge functions export testable pure functions (extractJson, filterRecommendations) alongside serve handler"
  - "Catalog ID guard: always filter LLM output against DB-sourced Set before returning to client"

requirements-completed: [SPAWN-01, SPAWN-02]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 2 Plan 02: Spawn Agent Team Edge Function Summary

**Deno edge function with catalog-ID-guard, markdown-fence stripper, and 6-test TDD suite preventing LLM hallucinations from reaching the INSERT layer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T19:35:40Z
- **Completed:** 2026-03-12T19:41:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created spawn-agent-team edge function using the two-client Supabase pattern (anon-key JWT verify, service-role catalog fetch)
- Exported `extractJson` and `filterRecommendations` pure functions that prevent hallucinated agent IDs from ever reaching a DB insert
- All 6 Deno unit tests pass: fences stripped, catalog validation enforced, defaults excluded, cap at 5, malformed LLM output returns empty array
- Response shape `{recommendations, allAgents}` matches the interface contract Plan 03 (AgentTeamSelector) expects

## Task Commits

Each task was committed atomically:

1. **Task 1: Create spawn.test.ts with catalog ID filtering unit tests** - `294c1d3` (test - RED phase)
2. **Task 2: Create spawn-agent-team edge function index.ts** - `fb7a853` (feat - GREEN phase)

_Note: TDD tasks have separate RED (test) and GREEN (implementation) commits_

## Files Created/Modified
- `worrylesssuperagent/supabase/functions/spawn-agent-team/index.ts` - Deno edge function: JWT verify, catalog fetch, LLM call, ID filtering, response
- `worrylesssuperagent/supabase/functions/spawn-agent-team/spawn.test.ts` - 6 Deno unit tests for extractJson and filterRecommendations pure functions

## Decisions Made
- Used `LOVABLE_API_KEY` as the bearer token env var (matches crawl-business-website — confirmed by reading that file before writing)
- Exported pure functions from index.ts to enable direct unit testing without needing an HTTP server
- LLM failures return graceful empty recommendations (200 with empty array) rather than propagating a 500 error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed Deno runtime for test execution**
- **Found during:** Task 1 (test verification)
- **Issue:** Deno not installed on this machine; could not run `deno test` verification command
- **Fix:** Installed Deno via official curl installer to `/Users/anthonysure/.deno/bin/deno`
- **Files modified:** None (system-level install)
- **Verification:** `deno test spawn.test.ts` ran successfully after install
- **Committed in:** N/A (tooling install, not code change)

---

**Total deviations:** 1 auto-fixed (1 blocking - missing tooling)
**Impact on plan:** Required to run verification. No scope creep.

## Issues Encountered
- Git root is at `/Users/anthonysure` (home directory) not at project root — commits must be run from `worrylesssuperagent/` which has its own `.git`. All commits ran from the correct repo.

## User Setup Required
None - no external service configuration required. The function uses env vars already present in the Supabase project (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`).

## Next Phase Readiness
- spawn-agent-team function is ready to deploy and consume from Plan 03 (AgentTeamSelector React component)
- The `{recommendations, allAgents}` response shape is locked and tested
- No blockers for Plan 03

---
*Phase: 02-agent-spawner-team-selector*
*Completed: 2026-03-12*

## Self-Check: PASSED

- index.ts: FOUND
- spawn.test.ts: FOUND
- 02-02-SUMMARY.md: FOUND
- commit 294c1d3: FOUND
- commit fb7a853: FOUND
