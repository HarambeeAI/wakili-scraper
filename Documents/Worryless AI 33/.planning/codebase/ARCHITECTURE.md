# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Component-driven React SPA with Supabase backend integration, multi-agent orchestration layer, and edge function pipeline.

**Key Characteristics:**
- Single-page application (SPA) built with React + TypeScript + Vite
- Decentralized UI state management via React hooks and TanStack Query
- Real-time data sync via Supabase Realtime subscriptions
- Agent-centric UI: specialized agent panels (Accountant, Marketer, Sales Rep, Personal Assistant) plus generic agent scaffolding
- Serverless backend logic via Deno-based Supabase Edge Functions
- Workspace editor pattern: user-configurable agent instructions with prompt injection sanitization

## Layers

**Presentation (React Components):**
- Purpose: Render UI, capture user input, display agent outputs
- Location: `src/components/`
- Contains: Page components, feature-specific component trees, UI library (shadcn/radix-ui), landing page sections
- Depends on: Hooks, Supabase client, utilities
- Used by: React Router pages

**Pages (Route Handlers):**
- Purpose: Top-level route entry points, orchestrate page-level state
- Location: `src/pages/` (Index.tsx, Auth.tsx, Dashboard.tsx, NotFound.tsx)
- Contains: Auth flow, dashboard layout, landing page
- Depends on: Components, Supabase auth, React Router
- Used by: App.tsx router

**Hooks (State & Side Effects):**
- Purpose: Encapsulate data fetching, subscriptions, workspace state, marketplace logic
- Location: `src/hooks/`
- Contains: useTeamData, useAgentMarketplace, useAgentWorkspace, useNotifications, usePushSubscription, useHeartbeatConfig, custom form/toast hooks
- Depends on: Supabase client, React, lib utilities
- Used by: Components and pages

**Utilities & Lib:**
- Purpose: Pure functions for data transformation, validation, parsing, sanitization
- Location: `src/lib/` (sanitize.ts, heartbeatParser.ts, heartbeatStatus.ts, buildWorkspacePrompt.ts, utils.ts)
- Contains: Workspace prompt injection sanitization, heartbeat log parsing, agent availability status computation
- Depends on: None
- Used by: Hooks, components, tests

**Integration Layer:**
- Purpose: Supabase client instantiation and type definitions
- Location: `src/integrations/supabase/`
- Contains: Supabase client (client.ts), TypeScript type definitions (types.ts - auto-generated)
- Depends on: @supabase/supabase-js
- Used by: All layers

**Edge Functions (Serverless Backend):**
- Purpose: Long-running tasks, agent orchestration, external API calls, scheduled jobs
- Location: `supabase/functions/`
- Contains: 22+ functions including orchestrator, heartbeat-dispatcher, chat-with-agent, generate-content, webhook handlers
- Depends on: Deno stdlib, Supabase client (server-side), shared utilities (_shared/)
- Used by: Frontend via HTTP requests, scheduled triggers, webhooks

**Shared Edge Function Utilities:**
- Purpose: Code shared between Deno edge functions and frontend (duplicated per runtime constraints)
- Location: `supabase/functions/_shared/` and `src/lib/`
- Contains: sanitize.ts (prompt injection filtering - kept in sync across both)
- Depends on: Varies by function
- Used by: Edge functions, workspace editor

## Data Flow

**User Authentication Flow:**

1. User visits "/" (landing) → LandingNav → links to /auth
2. Auth.tsx component → Supabase auth UI
3. On successful auth: auth state change event fires → setUser → redirect to /dashboard
4. Dashboard checks onboarding_completed flag in profiles table → if false, show ConversationalOnboarding overlay

**Dashboard Navigation Flow:**

1. Dashboard.tsx renders SidebarProvider layout
2. DashboardSidebar shows activeView state + userAgents list
3. User clicks agent/view → setActiveView(viewName)
4. Dashboard.renderContent() switch statement → conditional render (agents, chat, settings, marketplace, etc.)

**Workspace Editor Data Flow:**

1. User opens agent (e.g., AccountantAgent) → agent component renders WorkspaceTabs
2. WorkspaceTabs renders WorkspaceEditorLazy (lazy-loaded CodeMirror)
3. useAgentWorkspace hook fetches stored workspace_config from Supabase agent_workspace_files table
4. User edits → WorkspaceEditor.onChange fires → useAgentWorkspace.handleChange queues sanitization + auto-save
5. Sanitizer strips prompt injection patterns → auto-save persists to DB (debounced via ref)

**Chat & Agent Execution:**

1. ChatInterface.tsx sends user message → fetch to /chat-with-agent edge function
2. Edge function routes to orchestrator → determines which agents needed
3. Orchestrator spawns agent team (from spawn-agent-team function) → each agent processes concurrently
4. Results stream back → ChatInterface displays with agent attribution
5. File uploads: attached via chat → stored in Supabase storage → passed as context to agents

**Agent Heartbeat & Monitoring:**

1. run-scheduled-tasks function (CRON) triggers heartbeat-dispatcher
2. heartbeat-dispatcher iterates user agents → spawns heartbeat-runner for each
3. heartbeat-runner executes agent logic (fetch tasks, run decisions) → logs outcomes to agent_heartbeat_log
4. Frontend: useTeamData hook subscribed to agent_heartbeat_log INSERT events → real-time team view updates
5. TeamView renders chiefOfStaff + other agents with lastHeartbeatOutcome (color-coded by severity)

**Push Notifications:**

1. First-time users: ConversationalOnboarding asks for push consent
2. Existing users who missed opt-in: PushOptInBanner shown once per session
3. On consent: usePushSubscription registers service worker → subscribes to push
4. User subscription stored in push_subscriptions table
5. Scheduled jobs send notifications via Supabase push API

**Agent Marketplace:**

1. AgentMarketplace component renders catalog from available_agent_types
2. useAgentMarketplace hook fetches: catalog (all types) + user's active agents (from user_agents)
3. User clicks "Activate" → activateAgent → POST to database (inserts into user_agents)
4. Change event fires → parent's onAgentChange callback → refetch userAgents
5. Dashboard re-renders with new agent in sidebar

**State Management:**

- Local component state: useState for UI state (active view, loading, modals)
- Custom hooks: encapsulate domain state (team data, workspace files, marketplace)
- TanStack Query: would handle server state (not heavily used in current impl, but QueryClientProvider present)
- Supabase Realtime: subscriptions to table changes (agent_heartbeat_log, user_agents)
- localStorage: push notification opt-in flag, user preferences

## Key Abstractions

**Agent Panel Pattern:**
- Purpose: Reusable container for agent-specific views with workspace editor + execution interface
- Examples: `src/components/agents/AccountantAgent.tsx`, `src/components/agents/MarketerAgent.tsx`, `src/components/agents/GenericAgentPanel.tsx`
- Pattern: Each agent exports a component that manages its own state, workspace tab, and execution UI; GenericAgentPanel scaffolds agents not hardcoded

**Workspace File Type Abstraction:**
- Purpose: Normalize agent instructions across multiple config files (Instructions, Memory, Context)
- Examples: `src/lib/buildWorkspacePrompt.ts` defines WorkspaceFileType union
- Pattern: useAgentWorkspace accepts fileType parameter → different SELECT queries per type → single save logic

**Heartbeat Aggregation Abstraction:**
- Purpose: Transform raw heartbeat_log rows into high-level agent availability metrics
- Examples: `src/hooks/useTeamData.ts` (aggregates last 7 days), `src/lib/heartbeatStatus.ts` (severity to display label)
- Pattern: Fetch logs → group by agent → compute lastRunAt, lastSeverity, count → memoize in state

**Sanitization Sync Contract:**
- Purpose: Ensure prompt injection patterns filtered consistently on frontend and backend
- Examples: `src/lib/sanitize.ts` (frontend/vitest), `supabase/functions/_shared/sanitize.ts` (Deno)
- Pattern: Two files with identical regex/replacement logic; checklist comment enforces sync; tests in vitest verify correctness

**Message Attachment Type:**
- Purpose: Represent uploaded files in chat context (image, PDF, CSV, etc.)
- Examples: `src/components/chat/ChatInterface.tsx` defines Attachment type
- Pattern: File upload → validate mime/size → POST to storage → append {id, name, url, type, size} to attachments array → include in chat payload

## Entry Points

**Frontend Entry Point:**
- Location: `src/main.tsx`
- Triggers: Browser loads /
- Responsibilities: Mounts React app into #root DOM element

**App Root:**
- Location: `src/App.tsx`
- Triggers: main.tsx render
- Responsibilities: Wraps entire app with QueryClientProvider, TooltipProvider, Toaster, BrowserRouter; defines top-level routes (/, /auth, /dashboard, /*)

**Edge Function Entry Points:**
- **Orchestrator**: `supabase/functions/orchestrator/index.ts` - Main entry for agent team spawning; called by chat-with-agent
- **Chat Handler**: `supabase/functions/chat-with-agent/index.ts` - Receives user message, routes to agents, streams response
- **Heartbeat Dispatcher**: `supabase/functions/heartbeat-dispatcher/index.ts` - CRON trigger, spawns per-agent heartbeat runners
- **Scheduled Tasks Runner**: `supabase/functions/run-scheduled-tasks/index.ts` - CRON trigger, initiates daily/weekly automation

## Error Handling

**Strategy:** Layered error handling with user feedback via toasts; console logging for debugging; try-catch blocks in critical paths.

**Patterns:**

- **API Errors (fetch/supabase):** Catch block → check error.status / error.message → toast with user-friendly message
  - Example: `src/components/agents/AccountantAgent.tsx` file upload catches network errors, storage quota errors

- **Auth Errors:** Special case in Dashboard useEffect; if !session after auth check → navigate("/auth")
  - Example: `src/pages/Dashboard.tsx` onAuthStateChange subscription redirects on logout

- **Workspace Save Errors:** useAgentWorkspace catches DB write exceptions → toast error → keeps local state
  - Example: Concurrent edits or network failure → user can retry or reset to server version

- **Edge Function Errors:** Return {error: message} in response body; frontend checks response.ok || response.error
  - Example: `src/components/chat/ChatInterface.tsx` handles orchestrator 500 errors gracefully

- **Validation Errors:** Zod schemas in chat uploads (file size, type); sanitization runs before DB write
  - Example: `src/components/chat/ChatInterface.tsx` validates file size < 10MB before upload attempt

## Cross-Cutting Concerns

**Logging:** Console.error/warn for debugging; no centralized logging service. Future: Consider Sentry or similar.
  - Example: `src/pages/Dashboard.tsx` logs onboarding check errors; `src/hooks/useTeamData.ts` logs subscription state

**Validation:** Client-side validation (file type/size) before upload; server-side validation in edge functions (request signature, user_id ownership)
  - Example: `src/components/chat/ChatInterface.tsx` validates ALLOWED_TYPES + MAX_FILE_SIZE; edge functions verify JWT token

**Authentication:** Supabase Auth (JWT-based) with session persistence in localStorage; auth state changes trigger layout updates
  - Example: All edge functions check Authorization header; frontend redirects if auth fails

**Authorization:** Row-level security (RLS) policies in Supabase; frontend enforces by filtering queries to current user_id
  - Example: Dashboard queries by user_id; Supabase RLS prevents cross-user data leakage

---

*Architecture analysis: 2026-03-18*
