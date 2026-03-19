---
phase: 14-marketer-persistent-browser
plan: 04
subsystem: agent-tools
tags: [firecrawl, playwright, llm, sentiment-analysis, competitor-intelligence, trending-topics]

requires:
  - phase: 14-01
    provides: "browser-manager.ts (getPage), marketer types (BrandMention, CompetitorProfile, TrendingTopic)"
  - phase: 11-01
    provides: "LLM client (callLLMWithStructuredOutput)"
provides:
  - "monitorBrandMentions — Firecrawl search + LLM sentiment classification"
  - "analyzeCompetitor — Playwright browser scraping + LLM structured analysis"
  - "searchTrendingTopics — Firecrawl discovery + LLM relevance scoring"
affects: [14-05, marketer-graph, marketer-tools-node]

tech-stack:
  added: []
  patterns: ["Firecrawl search API for web monitoring (shared with Sales Rep)", "Playwright page.evaluate with string expression to avoid DOM lib", "Graceful degradation on missing API keys (return empty array)"]

key-files:
  created:
    - "worrylesssuperagent/langgraph-server/src/tools/marketer/research-tools.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/marketer/research-tools.test.ts"
  modified: []

key-decisions:
  - "callLLMWithStructuredOutput uses string schema description (not zod) — matches actual API signature"
  - "page.evaluate uses string expression instead of arrow function — avoids TS DOM lib requirement in Node-only tsconfig"
  - "firecrawlSearch extracted as shared helper within research-tools.ts — DRY for monitorBrandMentions and searchTrendingTopics"

patterns-established:
  - "vi.hoisted pattern for vitest mock factories that reference shared mock objects"

requirements-completed: [MKT-09, MKT-10, MKT-11]

duration: 4min
completed: 2026-03-19
---

# Phase 14 Plan 04: Research Tools Summary

**Brand mention monitoring via Firecrawl + sentiment LLM, competitor profile analysis via Playwright browser, and trending topic discovery with relevance scoring**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T06:23:39Z
- **Completed:** 2026-03-19T06:28:09Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments
- monitorBrandMentions searches web via Firecrawl, classifies sentiment via LLM (MKT-09)
- analyzeCompetitor browses competitor social profiles via Playwright, structures findings via LLM (MKT-10)
- searchTrendingTopics discovers industry trends via Firecrawl, scores relevance and suggests content angles (MKT-11)
- 8 unit tests covering all tools, error handling, missing API keys, page cleanup, and fallback profiles

## Task Commits

Each task was committed atomically:

1. **Task 1: Research tools (brand mentions + trending topics + competitor analysis) + tests** - `eb67311` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `worrylesssuperagent/langgraph-server/src/tools/marketer/research-tools.ts` - Three research tool functions: monitorBrandMentions, searchTrendingTopics, analyzeCompetitor
- `worrylesssuperagent/langgraph-server/src/tools/marketer/research-tools.test.ts` - 8 unit tests with vi.hoisted mocks for Firecrawl, LLM, and Playwright

## Decisions Made
- Used string schema description for callLLMWithStructuredOutput (plan's code used zod objects which don't match the actual API that takes a plain string)
- Used string-based page.evaluate expression to avoid adding DOM lib to tsconfig (Node-only server project)
- Extracted firecrawlSearch helper to DRY the Firecrawl API call pattern shared by monitorBrandMentions and searchTrendingTopics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted callLLMWithStructuredOutput call signature**
- **Found during:** Task 1
- **Issue:** Plan used zod schema objects and { schema, temperature, maxTokens } options. Actual API takes positional (messages, schemaString, options) and returns { data, tokensUsed }
- **Fix:** Replaced zod schemas with JSON string descriptions, used positional args, destructured { data } from return value
- **Files modified:** research-tools.ts
- **Verification:** tsc --noEmit passes, all tests pass
- **Committed in:** eb67311

**2. [Rule 3 - Blocking] String-based page.evaluate to avoid DOM types**
- **Found during:** Task 1
- **Issue:** Arrow function in page.evaluate referenced document, causing TS2584 (Cannot find name 'document') since tsconfig has no DOM lib
- **Fix:** Converted to string expression evaluate with explicit type cast
- **Files modified:** research-tools.ts
- **Verification:** tsc --noEmit passes with zero errors in research-tools files
- **Committed in:** eb67311

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Vitest mock hoisting: vi.mock factories cannot reference variables declared at module scope. Resolved with vi.hoisted() pattern to make mock objects available in factory closures.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All marketer research tools complete and tested
- Ready for integration into marketer tools node and graph wiring (Plan 05)
- Pre-existing analytics-tools.ts DOM type error (separate file, out of scope) should be fixed in its own plan

---
*Phase: 14-marketer-persistent-browser*
*Completed: 2026-03-19*

## Self-Check: PASSED
- FOUND: research-tools.ts
- FOUND: research-tools.test.ts
- FOUND: 14-04-SUMMARY.md
- FOUND: commit eb67311
