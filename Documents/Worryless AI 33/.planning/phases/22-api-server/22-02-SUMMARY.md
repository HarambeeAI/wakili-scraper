---
phase: 22-api-server
plan: 02
subsystem: api
tags: [express, gemini, pg, sse, orchestrator, chat, agent-team]

requires:
  - phase: 22-01
    provides: API server scaffold with auth middleware, db pool, gemini client

provides:
  - chatWithAgent Express route handler (Gemini OpenAI-compat endpoint)
  - orchestrator Express route handler with 11 tool-calling functions
  - spawnAgentTeam Express route handler with LLM-based agent recommendation
  - langgraphProxy SSE streaming proxy with anti-buffering headers

affects: [22-03, 22-04, 22-05, frontend-migration]

tech-stack:
  added: []
  patterns:
    - "Lazy Resend initialization to prevent test-time crashes (same pattern as gemini)"
    - "ChatCompletionCreateParamsNonStreaming cast for OpenAI SDK type safety"
    - "app.use for Express 5 wildcard sub-path matching (path-to-regexp v8 compat)"

key-files:
  created:
    - api-server/src/routes/chatWithAgent.ts
    - api-server/src/routes/orchestrator.ts
    - api-server/src/routes/spawnAgentTeam.ts
    - api-server/src/routes/langgraphProxy.ts
  modified:
    - api-server/src/index.ts
    - api-server/src/__tests__/spawnAgentTeam.test.ts
    - api-server/src/__tests__/langgraphProxy.test.ts
    - api-server/src/routes/sendValidationEmail.ts

key-decisions:
  - "Orchestrator uses direct geminiOpenAI calls instead of fetching separate edge functions for content/leads/outreach"
  - "langgraphProxy uses app.use() for sub-path routing (Express 5 path-to-regexp v8 does not support /* wildcards)"
  - "Resend lazy-initialized to prevent test crash (same pattern as gemini lazy init)"

patterns-established:
  - "Route translation pattern: Deno serve() -> export const handler: RequestHandler"
  - "DB translation: supabase.from().select().eq() -> pool.query('SELECT ... WHERE col = $1', [val])"
  - "LLM translation: fetch(LOVABLE_GATEWAY) -> geminiOpenAI.chat.completions.create()"

requirements-completed: [API-02, API-03, API-04, API-16, API-17]

duration: 10min
completed: 2026-03-21
---

# Phase 22 Plan 02: Core Agent Routes Summary

**Ported 4 agent routes (chat-with-agent, orchestrator, spawn-agent-team, langgraph-proxy) from Deno edge functions to Express handlers using pg pool and Gemini OpenAI-compat endpoint with SSE streaming.**

## What Was Built

### Task 1: chat-with-agent, orchestrator, spawn-agent-team (13a00ad)

- **chatWithAgent.ts** (166 lines): Accepts message + agent type, fetches workspace files from pg, builds system prompt with workspace block, calls Gemini via OpenAI-compat SDK. No Deno globals, no Supabase client.

- **orchestrator.ts** (870 lines): Largest route. Implements 11 tool-calling functions (delegate_to_accountant/marketer/sales_rep/personal_assistant, generate_social_content, generate_outreach_email, generate_leads, save_invoice, save_transaction, query_user_data, answer_directly). All DB operations use parameterized pg pool queries. All LLM calls use geminiOpenAI. Business knowledge base, workspace blocks, and datasheet context fetched per-request.

- **spawnAgentTeam.ts** (148 lines): Fetches agent catalog from pg, builds constrained system prompt, calls Gemini for recommendations. extractJson() and filterRecommendations() helpers ported and exported for testing.

- **spawnAgentTeam.test.ts** (8 tests): Unit tests for extractJson, filterRecommendations. Integration tests for the full route with mocked pg pool and Gemini.

### Task 2: langgraph-proxy SSE (0ba2524)

- **langgraphProxy.ts** (80 lines): Sets Content-Type: text/event-stream, Cache-Control: no-cache, X-Accel-Buffering: no, then calls res.flushHeaders() before any data. Reads upstream ReadableStream chunk-by-chunk via reader.read() loop. Forwards JWT Authorization header and injects user_id from JWT into body.

- **langgraphProxy.test.ts** (6 tests): Verifies SSE headers, chunk piping, error handling, and JWT forwarding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Resend constructor crash in sendValidationEmail.ts**
- **Found during:** Task 1 (test execution)
- **Issue:** `new Resend(process.env.RESEND_API_KEY)` at module level crashed when RESEND_API_KEY unset during tests
- **Fix:** Lazy-initialized with `getResend()` pattern (same as gemini lazy init)
- **Files modified:** api-server/src/routes/sendValidationEmail.ts
- **Commit:** 13a00ad

**2. [Rule 3 - Blocking] Express 5 wildcard route syntax**
- **Found during:** Task 2 (test execution)
- **Issue:** Express 5 uses path-to-regexp v8 which rejects `/*` and `:path+` syntax
- **Fix:** Used `app.use("/api/langgraph-proxy", handler)` for sub-path matching
- **Commit:** 0ba2524

**3. [Rule 1 - Bug] Gemini module API change**
- **Found during:** Task 1 (linter auto-applied)
- **Issue:** Parallel agent changed gemini.ts to lazy `getGeminiOpenAI()` pattern
- **Fix:** All route files adapted to use `getGeminiOpenAI()` instead of direct `geminiOpenAI` export
- **Commit:** 13a00ad

## Verification

- All 25 tests pass across 6 test files
- `npx tsc --noEmit` exits 0 with zero type errors
- Zero hits for `Deno`, `LOVABLE_AI_GATEWAY`, or `createClient` in api-server/src/routes/

## Self-Check: PASSED

All 6 key files exist. Both commit hashes (13a00ad, 0ba2524) verified in git log.
