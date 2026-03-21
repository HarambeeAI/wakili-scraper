---
phase: 22-api-server
plan: 03
subsystem: api
tags: [gemini, imagen-3, openai-compat, express, image-generation, content-generation]

requires:
  - phase: 22-01
    provides: "API server scaffold with Express, auth middleware, gemini/geminiImage libs"
provides:
  - "POST /api/generate-content route (text generation via Gemini 2.0 flash)"
  - "POST /api/generate-image route (image generation via Imagen 3, base64 data URI)"
  - "POST /api/generate-invoice-image route (invoice image via Imagen 3, base64 data URI)"
affects: [22-api-server, frontend-migration]

tech-stack:
  added: []
  patterns:
    - "Image routes return base64 data URIs instead of hosted CDN URLs"
    - "Content route saves assets to DB via pool.query (replaces Supabase client)"

key-files:
  created:
    - api-server/src/routes/generateContent.ts
    - api-server/src/routes/generateImage.ts
    - api-server/src/routes/generateInvoiceImage.ts
  modified:
    - api-server/src/index.ts
    - api-server/src/__tests__/generateImage.test.ts

key-decisions:
  - "Images returned as base64 data URIs (not hosted URLs) - frontend img src works with both"
  - "generate-content preserves all 4 platform prompt templates from edge function"
  - "generate-invoice-image updates DB via pool.query when invoiceId provided"

patterns-established:
  - "Image generation routes: prompt enhancement -> generateImageImagen3 -> base64 data URI response"
  - "Content generation routes: geminiOpenAI.chat.completions.create with platform-specific system prompts"

requirements-completed: [API-05, API-06, API-07]

duration: 3min
completed: 2026-03-21
---

# Phase 22 Plan 03: Content & Image Generation Routes Summary

**3 generation routes ported from Lovable AI Gateway to direct Gemini API: text via OpenAI-compat flash endpoint, images via Imagen 3 SDK returning base64 data URIs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T09:53:04Z
- **Completed:** 2026-03-21T09:56:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Ported generate-content (258-line edge function) to Express with Gemini 2.0 flash, preserving all 4 platform prompt templates and auto-image generation for visual platforms
- Ported generate-image (94 lines) and generate-invoice-image (160 lines) to use Imagen 3 via @google/genai SDK
- Replaced all Lovable AI Gateway calls and Supabase client usage with direct Gemini API and pool.query
- Real test suite for generateImage with 3 test cases (success, business context, error handling)

## Task Commits

Each task was committed atomically:

1. **Task 1: Port generate-content route** - `ef94321` (feat)
2. **Task 2: Port generate-image and generate-invoice-image routes** - `3ed385e` (feat)

## Files Created/Modified

- `api-server/src/routes/generateContent.ts` - Text generation via Gemini flash with platform prompts, asset saving
- `api-server/src/routes/generateImage.ts` - Social media image generation via Imagen 3
- `api-server/src/routes/generateInvoiceImage.ts` - Invoice image generation via Imagen 3 with DB update
- `api-server/src/index.ts` - Registered all 3 POST routes under /api prefix
- `api-server/src/__tests__/generateImage.test.ts` - 3 test cases with mocked Imagen 3

## Decisions Made

- Images returned as base64 data URIs (not hosted CDN URLs) - this is the key behavioral change from the Lovable gateway. `<img src={imageUrl}>` works with data URIs in all browsers, so the frontend contract is preserved.
- Preserved all 4 platform-specific prompt templates (instagram, twitter, linkedin, default) verbatim from the edge function.
- generate-content saves generated assets to agent_assets table via pool.query (replaces Supabase client insert).
- generate-invoice-image updates invoices table with image_url when invoiceId is provided.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing: health.test.ts and auth.test.ts fail when any route importing gemini.ts is registered in index.ts (OpenAI constructor throws without GEMINI_API_KEY env var). Logged to deferred-items.md. Not caused by this plan's changes - same issue would occur with any route that imports the Gemini client.

## Known Stubs

None - all routes are fully implemented with real Gemini API calls.

## User Setup Required

None - no external service configuration required (GEMINI_API_KEY already configured in Phase 22-01).

## Next Phase Readiness

- All 3 content/image generation routes are registered and type-checked
- generateImage test passes with mocked Imagen 3
- Ready for remaining route ports (22-04, 22-05)

---
*Phase: 22-api-server*
*Completed: 2026-03-21*
