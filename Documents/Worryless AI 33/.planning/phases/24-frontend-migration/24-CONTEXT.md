# Phase 24: Frontend Migration - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The frontend runs entirely on Railway with no Supabase dependency — Logto handles auth, all data fetching calls the Express API server, and the Vite build is served by Nginx. This phase replaces all `@supabase/supabase-js` usage across 29 files, activates the already-wired Logto auth flow, and creates a Dockerfile for static Nginx serving.

Requirements: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, RAIL-06.

</domain>

<decisions>
## Implementation Decisions

### API Client Strategy
- **D-01:** Create a centralized `src/lib/api.ts` client that wraps `fetch()` with auth token injection, base URL from `VITE_API_URL`, JSON parsing, and error normalization
- **D-02:** The client exposes typed methods matching the existing Supabase patterns: `api.from("table").select()` is NOT replicated — instead use simple `api.get("/api/endpoint")`, `api.post("/api/endpoint", body)` patterns
- **D-03:** Auth token comes from `useAuth().getAccessToken()` (Logto) — the API client accepts a token parameter, hooks pass it in
- **D-04:** React Query (`@tanstack/react-query` v5, already installed but unused) should be adopted for data fetching hooks that replace direct Supabase queries — provides caching, loading states, and invalidation

### Database Query Replacement
- **D-05:** All 29 files with `supabase.from(table).select/insert/update/delete` calls are replaced with `fetch()` calls to corresponding Express API routes
- **D-06:** New Express routes are needed for CRUD operations that currently go through the Supabase client directly (profiles, invoices, transactions, leads, social_posts, notifications, user_agents, business_artifacts, tasks, threads, datasheets, outreach_emails, agent_assets, push_subscriptions, heartbeat_configs, agent_memory)
- **D-07:** The API server (Phase 22) already has auth middleware — new routes follow the same pattern: `req.user.sub` for user_id, direct SQL via `pool.query()`

### Supabase Realtime Replacement
- **D-08:** Replace Supabase Realtime subscriptions with polling via React Query's `refetchInterval` — 30-second polling for notifications, 60-second for team data
- **D-09:** No SSE or WebSocket replacement needed — polling is sufficient for dashboard data that doesn't need sub-second updates
- **D-10:** `useNotifications` switches from `postgres_changes` channel to React Query polling on a `/api/notifications` endpoint

### Supabase Storage Replacement
- **D-11:** File uploads (MarketerAgent agent_assets, AccountantAgent datasheets) are converted to multipart form uploads to new Express routes that write to the Railway volume filesystem or return base64
- **D-12:** `getPublicUrl()` calls are replaced with API-served file URLs (e.g., `/api/files/:id`) — the API server serves files from the volume or database

### Auth Switchover
- **D-13:** Big-bang swap — remove `Auth.tsx` Supabase auth entirely, replace with Logto sign-in redirect flow
- **D-14:** `LogtoProvider` is already wrapping the app (Phase 21). `useAuth()` hook (Phase 21) already provides `userId`, `token`, `signIn`, `signOut`
- **D-15:** Dashboard auth guard switches from `supabase.auth.getSession()` to `useLogto().isAuthenticated` check
- **D-16:** `Auth.tsx` page becomes a redirect to Logto hosted login (`signIn()` redirect) — no custom login form needed (Logto provides its own)
- **D-17:** Callback.tsx (already exists) handles OIDC callback and redirects to `/dashboard`

### SSE/LangGraph Connection
- **D-18:** `useAgentChat` already does direct `fetch()` to LangGraph proxy — update the base URL from Supabase function URL to `VITE_API_URL/api/langgraph-proxy`
- **D-19:** Auth header switches from Supabase session token to Logto access token

### Environment Variables
- **D-20:** Remove: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- **D-21:** Add/configure: `VITE_API_URL` (Railway API server URL), `VITE_LANGGRAPH_URL` (if direct LangGraph access needed), `VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `VITE_LOGTO_API_RESOURCE`, `VITE_VAPID_PUBLIC_KEY`

### Nginx Dockerfile
- **D-22:** Multi-stage Docker build: Node.js stage for `npm run build`, Nginx stage serves `/usr/share/nginx/html`
- **D-23:** Nginx config includes SPA fallback (`try_files $uri $uri/ /index.html`), gzip, and cache headers for static assets
- **D-24:** `railway.toml` with `[build]` and `[deploy]` sections, health check on port 80

### Claude's Discretion
- React Query configuration (stale time, retry policies)
- Exact API client error handling structure
- File upload size limits and validation
- Nginx cache header durations
- Whether to create a ProtectedRoute component or keep Dashboard-level redirect

</decisions>

<specifics>
## Specific Ideas

- Edge Function invocations (`supabase.functions.invoke("name", { body })`) map 1:1 to `api.post("/api/name", body)` — same shape, different transport
- The 7 Edge Function calls (spawn-agent-team, crawl-business-website, generate-content, parse-datasheet, generate-outreach, sync-gmail-calendar, send-test-email) already have Express equivalents from Phase 22
- `useLangGraphFlag` hook reads a `use_langgraph` boolean from profiles — this can be removed entirely (always true on Railway, no dual-mode needed)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and in `.planning/REQUIREMENTS.md` §Frontend Migration (FE).

### Prior phase context
- `.planning/phases/23-scheduling-migration/23-01-SUMMARY.md` — Redis/BullMQ infrastructure (for push subscription endpoint awareness)
- `.planning/phases/23-scheduling-migration/23-02-SUMMARY.md` — Cadence worker + push helper (VAPID key handling)

### Existing Logto integration
- `worrylesssuperagent/src/integrations/logto/client.ts` — Logto config (endpoint, appId, apiResource from VITE_ vars)
- `worrylesssuperagent/src/hooks/useAuth.ts` — Logto auth hook (userId, token, signIn, signOut)
- `worrylesssuperagent/src/pages/Callback.tsx` — OIDC callback handler

### API Server routes (Phase 22)
- `worrylesssuperagent/langgraph-server/src/api/` — All Express routes that frontend will call

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/integrations/logto/client.ts` — Logto config ready, just needs env vars populated
- `src/hooks/useAuth.ts` — Complete Logto auth hook, unused but ready to replace Supabase auth
- `src/pages/Callback.tsx` — OIDC callback handler, ready for Logto redirect flow
- `@tanstack/react-query` v5.83.0 — Installed as dependency, QueryClientProvider likely already in tree

### Established Patterns
- `supabase.functions.invoke("name", { body })` → converts cleanly to `fetch(API_URL + "/api/name", { method: "POST", body: JSON.stringify(body), headers })` — same request/response shape
- Components use `useState` + `useEffect` for data loading — can be progressively migrated to React Query `useQuery`
- Auth guards use `useEffect` redirect pattern — Logto's `useLogto().isAuthenticated` is a drop-in boolean replacement

### Integration Points
- `src/App.tsx` — Route definitions, LogtoProvider already wrapping
- `src/hooks/useAgentChat.ts` — SSE streaming, needs base URL + auth header swap
- `src/integrations/supabase/client.ts` — Central import point, removing this file cascades all changes
- 29 component files import `supabase` — each needs conversion to API client calls

### Files to Modify (by category)
**Auth (3 files):** Auth.tsx, Dashboard.tsx, App.tsx
**Hooks (7 files):** useAgentChat, useTeamData, useHeartbeatConfig, useLangGraphFlag, useNotifications, usePushSubscription, useAgentWorkspace
**Agent panels (4 files):** AccountantAgent, MarketerAgent, SalesRepAgent, PersonalAssistantAgent
**Dashboard (5 files):** DashboardHeader, DashboardOverview, TaskList, BusinessArtifacts, CreateTaskDialog, AutomationPanel
**Onboarding (3 files):** BusinessOnboarding, AgentTeamSelector, ConversationalOnboarding
**Chat (1 file):** ChatInterface
**Settings (1 file):** SettingsPage
**Other (2 files):** GenericAgentPanel, NavLink (if auth-dependent)
**New files (3):** src/lib/api.ts, Dockerfile, nginx.conf

</code_context>

<deferred>
## Deferred Ideas

- ProtectedRoute wrapper component — could be added but current redirect pattern works
- React Query adoption for ALL data fetching — could do progressive migration, converting hooks as they're touched
- WebSocket/SSE realtime replacement — polling sufficient for v2.1, real realtime can come in v2.2

</deferred>

---

*Phase: 24-frontend-migration*
*Context gathered: 2026-03-21*
