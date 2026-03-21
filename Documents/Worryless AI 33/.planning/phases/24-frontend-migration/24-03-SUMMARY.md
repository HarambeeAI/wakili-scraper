---
phase: 24-frontend-migration
plan: 03
subsystem: frontend-hooks
tags: [react-query, api-migration, hooks, supabase-removal, sse-migration]
dependency_graph:
  requires: [phase-24-01, phase-24-02]
  provides: [useNotifications-react-query, useTeamData-react-query, useHeartbeatConfig-react-query, useCadenceConfig-react-query, useAgentWorkspace-react-query, useAgentMarketplace-react-query, usePushSubscription-api, useAgentChat-railway-sse]
  affects: [all-hook-consumers, HeartbeatConfigSection, CadenceConfigSection, AgentChatView, PushOptIn, AgentMarketplace]
tech_stack:
  added: []
  patterns: [react-query-v5-useQuery, react-query-v5-useMutation, react-query-invalidateQueries, polling-refetchInterval, sse-with-bearer-token]
key_files:
  created: []
  modified:
    - worrylesssuperagent/src/hooks/useNotifications.ts
    - worrylesssuperagent/src/hooks/useTeamData.ts
    - worrylesssuperagent/src/hooks/useHeartbeatConfig.ts
    - worrylesssuperagent/src/hooks/useCadenceConfig.ts
    - worrylesssuperagent/src/hooks/useAgentWorkspace.ts
    - worrylesssuperagent/src/hooks/useAgentMarketplace.ts
    - worrylesssuperagent/src/hooks/usePushSubscription.ts
    - worrylesssuperagent/src/hooks/useAgentChat.ts
    - worrylesssuperagent/src/__tests__/useAgentChat.test.ts
    - api-server/src/routes/userAgents.ts
  deleted:
    - worrylesssuperagent/src/hooks/useLangGraphFlag.ts
decisions:
  - "usePushSubscription unsubscribe uses raw fetch with DELETE+body since api.ts delete() method does not accept a body parameter"
  - "useCadenceConfig optimistic update via queryClient.setQueryData with merged patch, then debounced mutation (500ms) for server sync"
  - "useAgentWorkspace handleReset calls /api/agent-types to get default_${fileType}_md for reset content"
  - "getCadenceConfig route updated to include heartbeat_enabled in SELECT — required by useCadenceConfig which exposes heartbeatEnabled to UI"
  - "useLangGraphFlag.ts was untracked (not git-committed); deleted from filesystem — no git rm needed"
  - "useAgentChat.test.ts updated to mock @/hooks/useAuth and @/lib/api instead of supabase/useLangGraphFlag"
metrics:
  duration_seconds: 504
  tasks_completed: 2
  files_created: 0
  files_modified: 10
  files_deleted: 1
  completed_date: "2026-03-21"
---

# Phase 24 Plan 03: Hook Migration Summary

**One-liner:** All 9 data-fetching hooks migrated from supabase.from() to api.ts + React Query polling; useAgentChat SSE rewired to VITE_API_URL/api/langgraph-proxy with Logto token; useLangGraphFlag.ts deleted.

## What Was Built

### Task 1: 7 Read-Only and Config Hooks Migrated to React Query + api.ts

Each hook replaced `supabase.from()` calls with `useQuery`/`useMutation` from `@tanstack/react-query` plus `api.ts` fetch wrapper.

| Hook | queryKey | Endpoint | refetchInterval |
|------|----------|----------|-----------------|
| `useNotifications` | `['notifications', userId]` | GET /api/notifications | 30s |
| `useTeamData` | `['team-data', userId]` | GET /api/team-data | 60s |
| `useHeartbeatConfig` | `['heartbeat', agentTypeId]` | GET/PATCH /api/user-agents/:id/heartbeat | none |
| `useCadenceConfig` | `['cadence', agentTypeId]` | GET/PATCH /api/user-agents/:id/cadence | none |
| `useAgentWorkspace` | `['workspace', agentTypeId, fileType]` | GET/PATCH /api/workspaces/:id/:fileType | none |
| `useAgentMarketplace` | `['agent-types']` + `['user-agents', userId]` | GET /api/agent-types, GET/POST/PATCH /api/user-agents | none |
| `usePushSubscription` | local state | POST /api/push-subscriptions, DELETE /api/push-subscriptions | none |

**Realtime channels removed:** `useNotifications` had `supabase.channel('notifications:${userId}')` and `useTeamData` had `supabase.channel('team:${userId}')` — both replaced by React Query `refetchInterval` polling.

**Return type signatures preserved:** All 7 hooks return identical shapes so zero component changes needed.

**useCadenceConfig pattern:** Optimistic update via `queryClient.setQueryData` merging the patch, then 500ms debounced `useMutation` to persist to server. This preserves the original debounced-save UX.

**useAgentWorkspace:** `handleReset` calls `api.get('/api/agent-types', { token })`, finds the matching agent type by `id`, and reads `default_${fileType}_md` column — same data source as the original supabase `available_agent_types` query.

**usePushSubscription:** Subscribe uses `api.post('/api/push-subscriptions', { endpoint, keys })`. Unsubscribe uses raw `fetch` with `method: 'DELETE'` and JSON body `{ endpoint }` because `api.ts`'s `delete()` method does not accept a body parameter (and the server's `deletePushSubscription` reads endpoint from `req.body`).

### Task 2: useAgentChat Migrated to Railway SSE + useLangGraphFlag Deleted

**useAgentChat.ts changes:**
- Removed `supabase` import and all `supabase.auth.getSession()` calls
- Removed `useLangGraphFlag` and `getChatEndpoint` imports
- Added `useAuth()` for `token` (Logto Bearer token)
- Added `VITE_API_URL` — all URLs now target Railway API server
- URL mapping:
  - `${supabaseUrl}/functions/v1/langgraph-proxy/threads/${userId}` → `${API_URL}/api/langgraph-proxy/threads/${userId}`
  - `${supabaseUrl}/functions/v1/langgraph-proxy/invoke/stream` → `${API_URL}/api/langgraph-proxy/invoke/stream`
  - `${supabaseUrl}/functions/v1/langgraph-proxy/invoke/resume` → `${API_URL}/api/langgraph-proxy/invoke/resume`
- Auth header: `session?.access_token` → `token` from useAuth
- `supabase.from("profiles").select("business_stage")` → `api.get("/api/profiles/me", { token })`
- Dual-mode branching (`if (useLangGraph)` ... `else`) removed — always takes LangGraph SSE path (D-18)
- SSE ReadableStream reading logic unchanged

**useLangGraphFlag.ts deleted:** The file was untracked (no previous git commit); deleted from filesystem.

**useAgentChat.test.ts updated (Rule 1 auto-fix):**
- Removed `vi.mock('@/integrations/supabase/client', ...)` and `vi.mock('@/hooks/useLangGraphFlag', ...)`
- Added `vi.mock('@/hooks/useAuth', ...)` returning `{ token: 'test-token', userId: 'test-user-id' }`
- Added `vi.mock('@/lib/api', ...)` returning mock `api.get` for `/api/profiles/me → { business_stage: 'growth' }`
- Env variable changed from `VITE_SUPABASE_URL` to `VITE_API_URL`

## Commits

- `4935b78` — feat(24-03): migrate 7 hooks from supabase to api.ts + React Query
- `01699ba` — feat(24-03): migrate useAgentChat to Railway SSE + delete useLangGraphFlag

## Verification

- `grep -rc "supabase" worrylesssuperagent/src/hooks/` → 0 for every hook file
- `test ! -f worrylesssuperagent/src/hooks/useLangGraphFlag.ts` → passes (file deleted)
- `grep -c "useQuery" worrylesssuperagent/src/hooks/useNotifications.ts` → 3
- `grep -c "refetchInterval" worrylesssuperagent/src/hooks/useNotifications.ts` → 1
- `grep "VITE_API_URL" worrylesssuperagent/src/hooks/useAgentChat.ts` → matches
- `npx tsc --noEmit` (worrylesssuperagent) → 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getCadenceConfig route missing heartbeat_enabled in SELECT**
- **Found during:** Task 1 (useCadenceConfig migration)
- **Issue:** The original `useCadenceConfig` hook fetched `cadence_config, heartbeat_enabled` from `user_agents`, but the API route `getCadenceConfig` only selected `cadence_config` — the `heartbeatEnabled` return value would always be `undefined`, defaulting to `true` (incorrect for agents with heartbeat disabled)
- **Fix:** Added `heartbeat_enabled` to the SELECT in `getCadenceConfig` route
- **Files modified:** `api-server/src/routes/userAgents.ts`
- **Commit:** `4935b78`

**2. [Rule 1 - Bug] useAgentChat.test.ts referenced deleted useLangGraphFlag module**
- **Found during:** Task 2 (useLangGraphFlag deletion)
- **Issue:** `useAgentChat.test.ts` mocked `@/hooks/useLangGraphFlag` and `@/integrations/supabase/client` — both removed by this migration; tests would fail to import
- **Fix:** Rewrote mocks to use `@/hooks/useAuth` and `@/lib/api` matching the new hook dependencies
- **Files modified:** `worrylesssuperagent/src/__tests__/useAgentChat.test.ts`
- **Commit:** `01699ba`

## Known Stubs

None — all hooks now wire to real API endpoints returning real data from Railway PostgreSQL.

## Self-Check: PASSED

- `worrylesssuperagent/src/hooks/useNotifications.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useTeamData.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useHeartbeatConfig.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useCadenceConfig.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useAgentWorkspace.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useAgentMarketplace.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/usePushSubscription.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useAgentChat.ts` exists: FOUND
- `worrylesssuperagent/src/hooks/useLangGraphFlag.ts` does NOT exist: CONFIRMED
- Commit `4935b78` exists: FOUND
- Commit `01699ba` exists: FOUND
