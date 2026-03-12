# Codebase Concerns

**Analysis Date:** 2026-03-12

---

## Security Considerations

**`.env` file not in `.gitignore`:**
- Risk: Supabase credentials and API keys committed to version control
- Files: `worrylesssuperagent/.gitignore`, `worrylesssuperagent/.env`
- Current mitigation: None - `.env` is present in the repo root but `.gitignore` only excludes `*.local` patterns, not `.env` directly
- Recommendations: Add `.env` and `.env.*` to `.gitignore` immediately. Rotate any exposed keys.

**Wildcard CORS on all edge functions:**
- Risk: Every Supabase Edge Function uses `"Access-Control-Allow-Origin": "*"`, allowing any origin to call these endpoints
- Files: All 15 functions under `worrylesssuperagent/supabase/functions/*/index.ts`
- Current mitigation: None - functions rely entirely on Supabase auth tokens passed by the caller
- Recommendations: Restrict CORS to the production domain. Validate the `Authorization` header server-side in each function rather than trusting CORS alone.

**`userId` accepted from request body in edge functions without verification:**
- Risk: Several functions accept `userId` directly from the JSON request body (e.g., `planning-agent`, `generate-leads`, `crawl-business-website`) without verifying the JWT belongs to that user. A caller can pass any `userId` and the function will operate on that user's data using the service role key.
- Files: `worrylesssuperagent/supabase/functions/planning-agent/index.ts` (line 165), `worrylesssuperagent/supabase/functions/generate-leads/index.ts` (line 69), `worrylesssuperagent/supabase/functions/crawl-business-website/index.ts` (line 34)
- Current mitigation: None
- Recommendations: Extract `userId` from the verified JWT (`req.headers.get("Authorization")`) rather than from the request body.

**Frontend uses `VITE_SUPABASE_PUBLISHABLE_KEY` to call edge functions directly:**
- Risk: The client sends `Authorization: Bearer <VITE_SUPABASE_PUBLISHABLE_KEY>` when calling the orchestrator. This is the anon key, which bypasses RLS when the service role key is used server-side. Combined with the `userId`-from-body issue above, privilege escalation is possible.
- Files: `worrylesssuperagent/src/components/chat/ChatInterface.tsx` (line 233)
- Current mitigation: None beyond Supabase RLS on the Supabase client itself (not the edge functions)
- Recommendations: Edge functions should validate the JWT and derive `userId` server-side.

**Public Supabase Storage bucket used for uploaded files:**
- Risk: Uploaded files (PDFs, spreadsheets, invoices) are stored with publicly accessible URLs with no expiry
- Files: `worrylesssuperagent/src/components/chat/ChatInterface.tsx` (lines 115-126) - uses `getPublicUrl` on `chat-attachments` bucket
- Current mitigation: None - URLs are fully public and permanent
- Recommendations: Use signed URLs with short expiry for sensitive business documents.

---

## Tech Debt

**Duplicated system prompts across two chat functions:**
- Issue: `chat-with-agent/index.ts` and `orchestrator/index.ts` both define full system prompts for accountant, marketer, sales_rep, and personal_assistant. `chat-with-agent` appears to be a legacy version that does not support tool calling, business knowledge, or streaming.
- Files: `worrylesssuperagent/supabase/functions/chat-with-agent/index.ts`, `worrylesssuperagent/supabase/functions/orchestrator/index.ts`
- Impact: Agent behavior will diverge silently if one is updated and the other is not; maintenance burden is doubled
- Fix approach: Deprecate `chat-with-agent` and route all chat through the orchestrator, or extract shared prompt definitions to a shared module.

**Duplicated `fetchBusinessKnowledge` function across three edge functions:**
- Issue: Nearly identical implementations exist in `orchestrator/index.ts`, `generate-outreach/index.ts`, and `run-scheduled-tasks/index.ts`
- Files: Listed above, roughly lines 122-190 in orchestrator, lines 13-59 in generate-outreach, lines 191-237 in run-scheduled-tasks
- Impact: Bug fixes or schema changes must be applied in three places
- Fix approach: Extract to a shared Deno module imported by all functions.

**Duplicated `calculateNextRun` cron parser:**
- Issue: Custom, minimal cron expression parser duplicated verbatim in both `planning-agent/index.ts` (line 356) and `run-scheduled-tasks/index.ts` (line 555)
- Files: `worrylesssuperagent/supabase/functions/planning-agent/index.ts`, `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts`
- Impact: Cron parsing bugs must be fixed twice; function only handles daily/weekly/monthly — no support for more complex expressions
- Fix approach: Shared utility module or use a Deno cron library.

**`planning-agent` uses `any` type for Supabase client and task parameters:**
- Issue: `fetchBusinessContext(supabase: any, userId: string)` and `personalizeTask(task: any, businessContext: any, ...)` suppress TypeScript type safety
- Files: `worrylesssuperagent/supabase/functions/planning-agent/index.ts` (lines 127, 140)
- Impact: Refactoring is error-prone; type mismatches go undetected at compile time
- Fix approach: Import `SupabaseClient` type from `@supabase/supabase-js` and define proper interfaces.

**Hardcoded Supabase client version mismatch across functions:**
- Issue: Some edge functions import `@supabase/supabase-js@2.39.3` while others import `@2.86.0`
- Files: `worrylesssuperagent/supabase/functions/generate-leads/index.ts` (line 2 — v2.39.3), `worrylesssuperagent/supabase/functions/generate-content/index.ts` (line 2 — v2.39.3), `worrylesssuperagent/supabase/functions/generate-outreach/index.ts` (line 2 — v2.39.3) vs `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts` (line 2 — v2.86.0)
- Impact: Potential behavioral differences between function versions; older version may lack security patches
- Fix approach: Pin all functions to the same version (v2.86.0) and update via a shared `deno.json` import map.

**Agent task record saving defaults `orchestrator`/`general` agent type to `accountant`:**
- Issue: When the orchestrator responds without a specific agent type, the code explicitly maps `"orchestrator"` and `"general"` to `"accountant"` as a fallback — a silent, incorrect attribution
- Files: `worrylesssuperagent/src/components/chat/ChatInterface.tsx` (lines 307-309, 336-338)
- Impact: Task history in the database incorrectly labels orchestrator responses as accountant tasks, making analytics and audit trails unreliable
- Fix approach: Store a proper `"orchestrator"` agent type or extend the DB enum.

**`deno.land/std@0.168.0` is an old pinned version:**
- Issue: All edge functions import from `https://deno.land/std@0.168.0/http/server.ts`, which is over 2 years behind the current standard library
- Files: All 15 edge functions
- Impact: Missing bug fixes, performance improvements, and compatibility updates
- Fix approach: Migrate to Deno's `Deno.serve()` API (available since std@0.190.0+) to eliminate the std import entirely.

---

## Performance Bottlenecks

**Business knowledge base fetched on every chat request:**
- Problem: For every message sent, the orchestrator function makes 2-3 separate Supabase queries (profiles, business_artifacts, user_datasheets) before calling the AI model
- Files: `worrylesssuperagent/supabase/functions/orchestrator/index.ts` (lines 122-190 `fetchBusinessKnowledge`)
- Cause: No caching layer; knowledge base is re-assembled from raw rows on every invocation
- Improvement path: Cache the knowledge base string in Supabase (e.g., a `profiles.knowledge_base_cache` column, invalidated on artifact update) or use Deno KV for session-scoped caching.

**Dashboard loads 8 parallel Supabase queries on every mount with no caching:**
- Problem: `DashboardOverview` fires 8 `Promise.all` queries to different tables on every render, with no React Query cache, loading state per-query, or incremental rendering
- Files: `worrylesssuperagent/src/components/dashboard/DashboardOverview.tsx` (lines 57-66)
- Cause: Direct `supabase.*` calls in `useEffect` with no query library integration
- Improvement path: Wrap with `@tanstack/react-query` (already installed) for caching and stale-while-revalidate behavior.

**Orchestrator: single tool call only — multi-step tasks silently truncated:**
- Problem: The orchestrator processes only `toolCalls[0]` (the first tool call), ignoring any additional tool calls the model may return
- Files: `worrylesssuperagent/supabase/functions/orchestrator/index.ts` (line 791 `const call = toolCalls[0]`)
- Cause: No agentic loop implemented
- Improvement path: Iterate over all tool calls in sequence or implement an agentic loop with follow-up AI calls.

**File content fetched and base64-encoded inside the edge function for large attachments:**
- Problem: `fetchFileContent` in the orchestrator downloads the full file binary and encodes it to base64 in memory per request, with no size limit
- Files: `worrylesssuperagent/supabase/functions/orchestrator/index.ts` (lines 662-676)
- Cause: No streaming or size check
- Improvement path: Add a size guard (e.g., skip files >5MB) and return a descriptive placeholder instead.

---

## Fragile Areas

**Cron expression parser — incomplete and untested:**
- Files: `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts` (lines 555-597), `worrylesssuperagent/supabase/functions/planning-agent/index.ts` (lines 356-415)
- Why fragile: The custom `calculateNextRun` only handles three patterns (daily, weekly, monthly). Any cron expression with a non-wildcard month, compound day-of-week, or step values (`*/15`) falls through to the default of `+24h`. No tests exist.
- Safe modification: Do not add new schedule frequencies without extending the parser. Prefer a tested cron library.
- Test coverage: Zero — no test files exist anywhere in the project.

**AI response JSON parsing with regex fallback:**
- Files: `worrylesssuperagent/supabase/functions/generate-outreach/index.ts` (line 182), `worrylesssuperagent/supabase/functions/crawl-business-website/index.ts` (line 156), `worrylesssuperagent/supabase/functions/orchestrator/index.ts` (lines 641-644)
- Why fragile: Relies on regex `\{[\s\S]*\}` to extract JSON from LLM responses. If the model wraps output in markdown code fences or includes multiple JSON objects, extraction silently returns partial or wrong data.
- Safe modification: Always request structured output from the model using the `response_format: { type: "json_object" }` parameter if the gateway supports it, and validate the parsed result against a schema.

**`outreach email save_outreach_email` falls back to first available lead:**
- Files: `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts` (lines 364-373)
- Why fragile: If no `leadId` is provided, the function silently attaches the outreach email to the user's chronologically first lead, which is almost certainly wrong
- Safe modification: Return an error rather than silently misattributing data.

**Conversation history passed unbounded to the AI:**
- Files: `worrylesssuperagent/src/components/chat/ChatInterface.tsx` (lines 219-223)
- Why fragile: Full conversation history is sent to the orchestrator on every message. Long conversations will eventually exceed the model's context window, causing truncation or errors with no user feedback.
- Safe modification: Limit to the last N messages (e.g., 20) or implement summarization for older turns.

**`planning-agent` re-initializes all task templates on every `initialize` call:**
- Files: `worrylesssuperagent/supabase/functions/planning-agent/index.ts` (lines 177-264)
- Why fragile: There is no check for existing templates before inserting. Calling `initialize` twice (e.g., if the user toggles automation off and on) creates duplicate scheduled tasks.
- Safe modification: Use `upsert` with a unique constraint on `(user_id, agent_type, title)` for task templates, or check for existing records before inserting.

---

## Missing Critical Features

**No test suite:**
- Problem: Zero test files exist (verified via glob search)
- Blocks: Confident refactoring, CI/CD quality gates, catching regressions in cron parsing, JSON parsing, and tool dispatch logic
- Priority: High

**No error monitoring or alerting:**
- Problem: Errors in edge functions are only logged via `console.error` with no integration to a monitoring service (Sentry, Datadog, etc.)
- Blocks: Proactive detection of AI gateway failures, Apify timeouts, or database errors affecting scheduled tasks running unattended
- Priority: High

**Gmail and Instagram integrations are stubs:**
- Problem: Both integrations are shown as "Coming Soon" in the UI with disabled buttons. The `sync-gmail-calendar` edge function exists but is not wired to real OAuth flows.
- Files: `worrylesssuperagent/src/components/settings/SettingsPage.tsx` (lines 441-460), `worrylesssuperagent/supabase/functions/sync-gmail-calendar/index.ts`
- Blocks: Personal assistant email management, direct social media posting — both are core product features
- Priority: High

**No rate limiting on edge functions:**
- Problem: No per-user request throttling exists at the application layer. A single user can trigger unlimited AI calls (each costing API credits) or lead generation runs (each using Apify quota).
- Blocks: Cost control and abuse prevention
- Priority: Medium

**Scheduled tasks have no retry mechanism:**
- Problem: If a scheduled task fails (e.g., AI gateway timeout), it is immediately marked `failed` with no exponential backoff or retry count
- Files: `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts` (lines 766-777)
- Blocks: Reliability of autonomous agent automation — a transient error permanently stops a recurring task
- Priority: Medium

---

## Test Coverage Gaps

**Edge functions — zero coverage:**
- What's not tested: Tool dispatch logic in `orchestrator`, cron calculation, lead transformation from Apify response, JSON parsing fallbacks, business knowledge assembly
- Files: All files under `worrylesssuperagent/supabase/functions/`
- Risk: Silent regressions in agent routing, incorrect next-run calculations, corrupt data saved from AI tool calls
- Priority: High

**Frontend components — zero coverage:**
- What's not tested: `ChatInterface` streaming SSE parsing, `DashboardOverview` stat calculations, `ConversationalOnboarding` multi-step flow
- Files: All files under `worrylesssuperagent/src/`
- Risk: SSE buffer handling bugs in `ChatInterface.tsx` (lines 268-303) are particularly risky and invisible without tests
- Priority: High

---

*Concerns audit: 2026-03-12*
