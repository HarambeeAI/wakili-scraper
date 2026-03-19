---
phase: 14-marketer-persistent-browser
plan: 02
subsystem: agent-tools
tags: [gemini, genai, llm, content-generation, image-generation, social-media, marketer]

# Dependency graph
requires:
  - phase: 14-marketer-persistent-browser/01
    provides: "Marketer type contracts (types.ts), BrandImageResult, ImageEditResult, ContentCalendarEntry, SocialPlatform"
  - phase: 11-agent-graph-topology-+-memory-foundation
    provides: "callLLM, callLLMWithStructuredOutput LLM client"
  - phase: 13-accountant-sales-rep-agent-tools/01
    provides: "shared DB pool (tools/shared/db.ts)"
provides:
  - "generateSocialPost — platform-specific social post generation for IG, X, LinkedIn, TikTok"
  - "createContentCalendar — structured content calendar with DB persistence to social_posts"
  - "generateBrandImage — Gemini 2.5 Flash Image generation with agent_assets storage"
  - "editImage — multimodal image editing via Gemini with source asset retrieval"
affects: [14-marketer-persistent-browser/03, 14-marketer-persistent-browser/04, 14-marketer-persistent-browser/05]

# Tech tracking
tech-stack:
  added: ["@google/genai (GoogleGenAI SDK for Gemini image generation)"]
  patterns: ["Lazy singleton pattern for GoogleGenAI client", "Platform-specific prompt map pattern for social content"]

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/marketer/content-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/content-tools.test.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/image-tools.ts
    - worrylesssuperagent/langgraph-server/src/tools/marketer/image-tools.test.ts
  modified: []

key-decisions:
  - "callLLMWithStructuredOutput uses string schema description (not Zod) — matched actual LLM client API signature"
  - "GoogleGenAI test mock uses class (not vi.fn().mockImplementation) — new keyword requires constructor-compatible mock"

patterns-established:
  - "PLATFORM_PROMPTS record pattern: Record<SocialPlatform, string> for per-platform prompt customization"
  - "Class-based vi.mock for SDK clients that use `new` keyword (GoogleGenAI pattern)"

requirements-completed: [MKT-01, MKT-02, MKT-03, MKT-08]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 14 Plan 02: Content & Image Generation Tools Summary

**4 marketer tools (generateSocialPost, createContentCalendar, generateBrandImage, editImage) with Gemini image gen and LLM content generation, 6/6 tests passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T06:23:32Z
- **Completed:** 2026-03-19T06:27:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- generateSocialPost with platform-specific prompts for Instagram, X, LinkedIn, TikTok with automatic hashtag extraction
- createContentCalendar using callLLMWithStructuredOutput to generate structured entries persisted as draft rows in social_posts
- generateBrandImage via Gemini 2.5 Flash Image (gemini-2.5-flash-image) with base64 storage in agent_assets
- editImage fetches source image from agent_assets, sends multimodal prompt to Gemini, stores edited result as new asset

## Task Commits

Each task was committed atomically:

1. **Task 1: Content generation tools** - `1c665ee` (feat)
2. **Task 2: Image generation tools** - `46f4ddf` (feat)

## Files Created/Modified
- `src/tools/marketer/content-tools.ts` - generateSocialPost + createContentCalendar with platform prompts
- `src/tools/marketer/content-tools.test.ts` - 3 unit tests with mocked LLM and DB
- `src/tools/marketer/image-tools.ts` - generateBrandImage + editImage using @google/genai SDK
- `src/tools/marketer/image-tools.test.ts` - 3 unit tests with class-based GoogleGenAI mock

## Decisions Made
- callLLMWithStructuredOutput adapted to use string schema description instead of Zod schema (plan referenced Zod but actual API uses string description returning `{ data, tokensUsed }`)
- GoogleGenAI mock uses ES6 class instead of vi.fn().mockImplementation — `new` keyword requires constructor-compatible mock

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed callLLMWithStructuredOutput signature mismatch**
- **Found during:** Task 1 (content-tools.ts)
- **Issue:** Plan used Zod schema + direct return, but actual client.ts uses string schema description and returns `{ data: T; tokensUsed: number }`
- **Fix:** Used string schema description parameter, destructured `{ data }` from return value
- **Files modified:** content-tools.ts, content-tools.test.ts
- **Verification:** TypeScript compiles, tests pass
- **Committed in:** 1c665ee

**2. [Rule 1 - Bug] Fixed GoogleGenAI mock for constructor usage**
- **Found during:** Task 2 (image-tools.test.ts)
- **Issue:** vi.fn().mockImplementation returns plain function, fails when called with `new`
- **Fix:** Used class-based mock `class MockGoogleGenAI { models = { ... } }`
- **Files modified:** image-tools.test.ts
- **Verification:** All 3 image-tools tests pass
- **Committed in:** 46f4ddf

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in research-tools.ts (DOM references) — out of scope, not caused by this plan's changes

## User Setup Required
None - no external service configuration required. GEMINI_API_KEY already documented from Phase 14 research.

## Next Phase Readiness
- Content and image tools ready for integration into marketer graph (Plan 04/05)
- Plan 03 (browser-based tools) can proceed independently
- All 4 tool functions follow established pattern (async, userId first param, typed return)

---
*Phase: 14-marketer-persistent-browser*
*Completed: 2026-03-19*
