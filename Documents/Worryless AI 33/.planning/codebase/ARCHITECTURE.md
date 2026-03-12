# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Multi-tenant SaaS with client-side React frontend and serverless backend via Supabase Edge Functions

**Key Characteristics:**
- Frontend-heavy React SPA (Vite + TypeScript) communicates directly with Supabase for data and with Edge Functions for AI processing
- All AI workloads run in Deno-based Supabase Edge Functions, not in the browser
- Row-Level Security (RLS) enforced at the database level; every table scopes data by `user_id`
- No custom API server — Supabase serves as the sole backend (auth, database, storage, edge functions)
- Orchestrator edge function routes multi-agent tasks; specialist edge functions handle domain-specific work

## Layers

**Presentation Layer:**
- Purpose: Renders UI, manages local component state, initiates data fetches
- Location: `worrylesssuperagent/src/`
- Contains: Pages (`src/pages/`), feature components (`src/components/`), shared UI primitives (`src/components/ui/`)
- Depends on: Supabase client, Edge Functions (via `supabase.functions.invoke`)
- Used by: End users via browser

**Supabase Integration Layer:**
- Purpose: Single typed client that wraps all database, auth, storage, and function calls
- Location: `worrylesssuperagent/src/integrations/supabase/`
- Key files: `client.ts` (singleton client), `types.ts` (auto-generated DB types)
- Depends on: Supabase project credentials via env vars
- Used by: All React components and pages that need data or auth

**Edge Function Layer (Backend):**
- Purpose: AI inference, scheduled task execution, external integrations, data processing
- Location: `worrylesssuperagent/supabase/functions/`
- Contains: 15 Deno TypeScript functions, each in its own directory with a single `index.ts`
- Depends on: Supabase service-role key, `LOVABLE_API_KEY`, external APIs (Google Gmail/Calendar, image generation)
- Used by: Frontend (via `supabase.functions.invoke`) and Supabase cron scheduler

**Database Layer:**
- Purpose: Persistent multi-tenant data storage with access control
- Location: `worrylesssuperagent/supabase/migrations/`
- Contains: Postgres tables with RLS policies, triggers, and enum types
- All tables include `user_id UUID REFERENCES auth.users(id)` for tenant isolation

## Data Flow

**User Chat with Orchestrator (AI Chief of Staff):**

1. User types message in `src/components/chat/ChatInterface.tsx`
2. Optional file attachments uploaded to Supabase Storage bucket `chat-attachments`
3. Frontend calls `supabase.functions.invoke('orchestrator', { body: { message, conversationHistory, attachments } })`
4. `supabase/functions/orchestrator/index.ts` classifies intent and routes to specialist sub-prompt or calls `chat-with-agent`
5. Orchestrator calls Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with model `google/gemini-3-flash-preview`
6. AI response (and any tool call results) returned to frontend and rendered via `ReactMarkdown`

**Specialist Agent Interaction (e.g., Accountant):**

1. User interacts with `src/components/agents/AccountantAgent.tsx`
2. Component fetches data directly from Supabase tables (`invoices`, `transactions`, `user_datasheets`, `datasheet_rows`) via typed client
3. For AI-assisted actions, component calls `supabase.functions.invoke('orchestrator')` with agent context
4. Edge function enriches prompt with business profile data from `profiles` and `business_artifacts` tables
5. AI response used to generate content or take tool actions (save invoice, generate social post, etc.)

**Scheduled Automation Flow:**

1. `planning-agent` edge function initialises task templates and `agent_tasks` rows on user onboarding completion
2. Supabase cron invokes `run-scheduled-tasks` periodically
3. `run-scheduled-tasks` queries `agent_tasks` where `status = 'scheduled'` and `next_run_at <= now()`
4. Each due task is executed by calling the appropriate agent prompt with business context
5. Results saved back to domain tables (invoices, social_posts, leads, outreach_emails)
6. High-risk tasks (`risk_level = 'high'`) are held in `pending_approval` status until user approves

**User Onboarding Flow:**

1. New user signs up via `src/pages/Auth.tsx` → Supabase trigger `on_auth_user_created` creates profile row
2. `src/pages/Dashboard.tsx` checks `profiles.onboarding_completed` on load
3. If `false`, renders `src/components/onboarding/ConversationalOnboarding.tsx` (multi-step wizard)
4. On completion, `crawl-business-website` edge function optionally fetches website context
5. `planning-agent` edge function called with `action: "initialize"` to seed task templates and automation settings
6. `profiles.onboarding_completed` set to `true`; dashboard renders normally

**State Management:**
- No global state library (no Redux/Zustand/Context beyond Supabase's auth listener)
- Each page/component manages its own local state via `useState`/`useEffect`
- Auth state detected via `supabase.auth.onAuthStateChange` in `Dashboard.tsx` and `Auth.tsx`
- Active dashboard view tracked as `ActiveView` string union in `Dashboard.tsx` and passed down via props

## Key Abstractions

**Agent (Domain Specialist):**
- Purpose: An AI persona scoped to a business function (accountant, marketer, sales_rep, personal_assistant)
- Frontend examples: `src/components/agents/AccountantAgent.tsx`, `src/components/agents/MarketerAgent.tsx`, `src/components/agents/SalesRepAgent.tsx`, `src/components/agents/PersonalAssistantAgent.tsx`
- Backend examples: agent configs in `supabase/functions/chat-with-agent/index.ts`, `supabase/functions/orchestrator/index.ts`
- Pattern: Each agent has a system prompt, temperature setting, and maps to `agent_type` enum in the database

**Edge Function:**
- Purpose: Serverless Deno function handling a discrete AI or integration task
- Pattern: Each function exports `serve(async (req) => { ... })`, handles CORS preflight, parses JSON body, calls Lovable AI Gateway or external service, returns JSON
- All functions include `corsHeaders` with `Access-Control-Allow-Origin: *`

**Business Artifact:**
- Purpose: Contextual knowledge unit stored about a user's business (website content, uploaded docs, team info)
- Table: `business_artifacts` with `artifact_type`, `title`, `content`, `metadata` columns
- Used by: Orchestrator and scheduled task functions to enrich AI prompts with business context

**Task Template:**
- Purpose: A reusable scheduled-work definition with cron expression and risk level
- Table: `task_templates` (created per user during onboarding via `planning-agent`)
- Risk levels: `low` (auto-execute) vs `high` (require user approval before action)

**Validator:**
- Purpose: A person designated to approve AI outputs before they take effect (e.g., before an email is sent)
- Table: `agent_validators` — one per agent type per user
- Used in: `src/components/settings/SettingsPage.tsx`, onboarding wizard

## Entry Points

**Frontend Application:**
- Location: `worrylesssuperagent/index.html` → `worrylesssuperagent/src/main.tsx` (not shown but implied by Vite SPA structure)
- Triggers: Browser loads the SPA
- Responsibilities: Bootstraps React, sets up router with routes `/` (Index), `/auth` (Auth), `/dashboard` (Dashboard), `*` (NotFound)

**Landing Page:**
- Location: `worrylesssuperagent/src/pages/Index.tsx`
- Triggers: Unauthenticated visit to `/`
- Responsibilities: Renders marketing sections (Hero, Why, Specialists, HowItWorks, Pricing, FAQ, CTA, Footer)

**Auth Page:**
- Location: `worrylesssuperagent/src/pages/Auth.tsx`
- Triggers: Unauthenticated user navigated to `/auth` or redirected from dashboard
- Responsibilities: Email/password sign-in and sign-up via `supabase.auth`; redirects to `/dashboard` on success

**Dashboard Page:**
- Location: `worrylesssuperagent/src/pages/Dashboard.tsx`
- Triggers: Authenticated user navigates to `/dashboard`
- Responsibilities: Auth guard, onboarding gate, view routing via `ActiveView` string switch, renders sidebar + header + content

**Orchestrator Edge Function:**
- Location: `worrylesssuperagent/supabase/functions/orchestrator/index.ts`
- Triggers: `supabase.functions.invoke('orchestrator', ...)` from `ChatInterface` component
- Responsibilities: Multi-agent routing, tool-use execution, business-context injection, AI response generation

**Run Scheduled Tasks Edge Function:**
- Location: `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts`
- Triggers: Supabase cron schedule
- Responsibilities: Polls `agent_tasks` for due tasks, executes them via AI agents, saves results, reschedules recurring tasks

## Error Handling

**Strategy:** Try/catch at edge function boundary; toast notifications in the frontend; no centralized error boundary observed

**Patterns:**
- Edge functions return `{ error: message }` JSON with appropriate HTTP status codes (500, 429, 402)
- Frontend checks `response.error` or `data?.error` after `supabase.functions.invoke` and calls `toast({ variant: "destructive" })`
- 429 rate-limit and 402 payment-required errors from Lovable AI Gateway have dedicated handling in `chat-with-agent/index.ts`
- Database errors from Supabase client are checked as `{ error }` destructured returns
- `console.error` used for server-side logging in all edge functions

## Cross-Cutting Concerns

**Logging:** `console.error` and `console.log` in edge functions; no structured logging or external log sink
**Validation:** Basic client-side validation in forms (required fields, file type checks, minLength); no shared validation library
**Authentication:** Supabase Auth with email/password; sessions persisted in `localStorage`; `supabase.auth.onAuthStateChange` used as the auth state listener in both `Auth.tsx` and `Dashboard.tsx`
**CORS:** All edge functions include a shared `corsHeaders` object with wildcard origin; OPTIONS preflight handled at the top of every `serve` handler
**Business Context Injection:** Every AI-facing edge function fetches `profiles` and `business_artifacts` for the requesting user and prepends them to the system prompt before calling the LLM

---

*Architecture analysis: 2026-03-12*
