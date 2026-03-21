# Roadmap: Worryless AI — Proactive Multi-Agent Platform

## Milestones

- ✅ **v1.0 Proactive Multi-Agent Foundation** — Phases 1-9 (shipped 2026-03-17)
- ✅ **v2.0 Agent Intelligence Layer** — Phases 10-18 (shipped 2026-03-20)
- 🚧 **v2.1 Railway Deployment** — Phases 19-25 (in progress)

## Phases

<details>
<summary>✅ v1.0 Proactive Multi-Agent Foundation (Phases 1-9) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Database Foundation (5/5 plans) — completed 2026-03-12
- [x] Phase 2: Agent Spawner + Team Selector (5/5 plans) — completed 2026-03-17
- [x] Phase 3: MD Workspace Editor + Marketplace (5/5 plans) — completed 2026-03-13
- [x] Phase 4: Heartbeat System (6/6 plans) — completed 2026-03-13
- [x] Phase 5: Org View + Notifications (5/5 plans) — completed 2026-03-13
- [x] Phase 6: Heartbeat Bug Fixes (2/2 plans) — completed 2026-03-17
- [x] Phase 7: Workspace Prompt Wiring + Push Opt-In (4/4 plans) — completed 2026-03-17
- [x] Phase 8: Phase Verifications (4/4 plans) — completed 2026-03-17
- [x] Phase 9: Tech Debt Cleanup (3/3 plans) — completed 2026-03-17

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.0 Agent Intelligence Layer (Phases 10-18) — SHIPPED 2026-03-20</summary>

- [x] Phase 10: LangGraph Infrastructure (4/4 plans) — completed 2026-03-18
- [x] Phase 11: Agent Graph Topology + Memory Foundation (5/5 plans) — completed 2026-03-18
- [x] Phase 12: Chief of Staff Tools + Governance (4/4 plans) — completed 2026-03-19
- [x] Phase 13: Accountant + Sales Rep Agent Tools (5/5 plans) — completed 2026-03-19
- [x] Phase 14: Marketer + Persistent Browser (5/5 plans) — completed 2026-03-19
- [x] Phase 15: Personal Assistant + Operational Agents (6/6 plans) — completed 2026-03-19
- [x] Phase 16: Proactive Cadence Engine (5/5 plans) — completed 2026-03-19
- [x] Phase 17: Generative UI + Onboarding Redesign (5/5 plans) — completed 2026-03-19
- [x] Phase 18: Agent-to-UI Data Pipeline Fix (4/4 plans) — completed 2026-03-20

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

### 🚧 v2.1 Railway Deployment (In Progress)

**Milestone Goal:** Migrate the entire Worryless AI platform off Supabase onto Railway — self-hosted PostgreSQL, self-hosted auth (Logto), Edge Functions converted to Express API routes, direct Gemini API replacing Lovable gateway, and full production deployment.

#### Phases

- [x] **Phase 19: Infrastructure Provisioning** - Railway Postgres, Redis, Logto, and private networking live (completed 2026-03-21)
- [x] **Phase 20: Database Migration** - All 20+ sanitized migrations applied to Railway Postgres (completed 2026-03-21)
- [x] **Phase 21: Auth Wiring** - Logto issuing JWTs, JWT middleware on API and LangGraph servers (completed 2026-03-21)
- [x] **Phase 22: API Server** - 17 Express routes replacing all Supabase Edge Functions (completed 2026-03-21)
- [x] **Phase 23: Scheduling Migration** - BullMQ + node-cron replacing pg_cron + pgmq in LangGraph server (completed 2026-03-21)
- [ ] **Phase 24: Frontend Migration** - Supabase client removed, Logto auth + Railway API wired in
- [ ] **Phase 25: Production Cutover** - Domains assigned, env vars finalized, smoke test passes

## Phase Details

### Phase 19: Infrastructure Provisioning
**Goal**: All Railway services (Postgres, Redis, Logto, private networking) are live and reachable before any application code is written
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: RAIL-01, RAIL-02, RAIL-03, RAIL-07, ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. Railway PostgreSQL service is running with pgvector extension confirmed via `SELECT * FROM pg_extension WHERE extname = 'vector'`
  2. Railway Redis service is running and reachable from the project's internal network
  3. Logto service is deployed on Railway, the admin console is accessible, and email/password sign-in method is enabled
  4. All services resolve each other via Railway private networking (`*.railway.internal` hostnames) without exposing internal ports publicly
  5. All external API keys (GEMINI, FIRECRAWL, APIFY, RESEND, GOOGLE_CLIENT_ID/SECRET) and VAPID keys are set as Railway service variables
**Plans**: 3 plans

Plans:
- [ ] 19-01: Provision Railway Postgres (pgvector 18 trixie template) + Redis services
- [ ] 19-02: Deploy Logto on Railway (Docker `logto/logto:latest`) with dedicated schema on shared Postgres
- [ ] 19-03: Configure Railway reference variables, private networking, and all external API keys

### Phase 20: Database Migration
**Goal**: All application schema is applied to Railway Postgres with Supabase-specific extensions stripped, so every table, index, and seed row exists and is queryable
**Depends on**: Phase 19
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05
**Success Criteria** (what must be TRUE):
  1. `RAILWAY_MIGRATION.sql` applies cleanly to a fresh Railway Postgres instance with zero errors
  2. All 20+ application tables exist in the `public` schema with correct columns, indexes, and constraints
  3. The `langgraph` schema exists with `checkpoints`, `checkpoint_writes`, and `store` tables
  4. The `document_embeddings` table exists with pgvector column and the `vector` extension active
  5. The `profiles` table references `public.users` (not `auth.users`) and no `auth.*`, `pgmq.*`, `cron.*`, or `vault.*` references remain in any schema object
**Plans**: 2 plans

Plans:
- [x] 20-01-PLAN.md — Author RAILWAY_MIGRATION.sql (sanitize 36 Supabase migrations with 7 passes)
- [x] 20-02-PLAN.md — Apply migration to Railway Postgres and verify all schemas + seed data

### Phase 21: Auth Wiring
**Goal**: Logto is the authoritative identity provider — it issues JWTs that both the API server and LangGraph server validate, and Google OAuth is configured for Personal Assistant integrations
**Depends on**: Phase 19 (Logto deployed), Phase 20 (users table exists)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. A user can sign in with email/password via Logto and receive a JWT with a `sub` claim
  2. The API server rejects requests without a valid Logto JWT with a 401 response
  3. The LangGraph server rejects direct SSE connections without a valid Logto JWT with a 401 response
  4. The `sub` claim from the JWT is correctly extracted and passed as `user_id` in all database queries (no `auth.uid()` calls remain)
  5. Google OAuth redirect URIs are registered in Logto and a Personal Assistant user can complete the Google OAuth flow
**Plans**: 2 plans

Plans:
- [x] 21-01-PLAN.md — Install @logto/react, create LogtoConfig + useAuth hook + Callback page, wrap App.tsx with LogtoProvider
- [x] 21-02-PLAN.md — Install jose, create verifyLogtoJWT JWKS middleware, apply to all LangGraph server routes, replace body user_id with JWT sub

### Phase 22: API Server
**Goal**: A Railway Express service hosts all 17 route equivalents of the former Supabase Edge Functions, using direct Gemini API (Gemini Imagen 3 for images), with every route protected by Logto JWT middleware and scoped to the requesting user
**Depends on**: Phase 20 (schema exists), Phase 21 (Logto JWKS available)
**Requirements**: RAIL-05, API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10, API-11, API-12, API-13, API-14, API-15, API-16, API-17
**Success Criteria** (what must be TRUE):
  1. The Express API server is deployed on Railway and responds to `GET /health` with 200
  2. A valid JWT produces a 200 from at least one data-returning route (e.g., `POST /api/spawn-agent-team`); an invalid JWT produces a 401 on all routes
  3. `POST /api/generate-content` returns LLM-generated text using direct Gemini API (no Lovable gateway)
  4. `POST /api/generate-image` and `POST /api/generate-invoice-image` return images generated by Gemini Imagen 3
  5. `GET /api/langgraph-proxy` (SSE) streams chunks in real time to the client — no buffering delay — with `X-Accel-Buffering: no` confirmed active
**Plans**: 5 plans

Plans:
- [x] 22-01-PLAN.md — Scaffold Express API server with CORS, JSON, Logto JWT middleware, pg pool, Gemini clients, shared utilities, Dockerfile, railway.toml, vitest config + test scaffolds
- [x] 22-02-PLAN.md — Implement core agent routes (chat-with-agent, orchestrator, spawn-agent-team, langgraph-proxy SSE)
- [x] 22-03-PLAN.md — Implement content + image generation routes (generate-content, generate-image, generate-invoice-image) with Gemini Imagen 3
- [x] 22-04-PLAN.md — Implement business data routes (crawl-business-website, parse-datasheet, generate-leads, generate-outreach, planning-agent, sync-gmail-calendar)
- [x] 22-05-PLAN.md — Implement utility routes (send-validation-email, send-test-email) + web-push VAPID notifications, verify full build

### Phase 23: Scheduling Migration
**Goal**: The LangGraph server runs the proactive cadence engine entirely through BullMQ + node-cron (no pg_cron, no pgmq), so scheduled agent runs, heartbeats, daily briefings, and push notifications survive process restarts
**Depends on**: Phase 19 (Redis live), Phase 20 (schema + get_due_cadence_agents function), Phase 22 (can run in parallel with Phase 22)
**Requirements**: RAIL-04, SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05
**Success Criteria** (what must be TRUE):
  1. The LangGraph server is deployed on Railway via Docker with Playwright Chromium installed and the persistent volume mounted at `/playwright-data`
  2. A node-cron tick fires every 5 minutes and enqueues due agents to BullMQ — confirmed via queue depth in Redis
  3. A BullMQ worker processes a heartbeat job by calling `graph.invoke()` and completing without error
  4. Daily briefing and morning digest jobs are registered as BullMQ repeatable jobs and appear in the queue on schedule
  5. The `get_due_cadence_agents()` SQL function executes on Railway Postgres without referencing pg_cron or pgmq
**Plans**: 3 plans

Plans:
- [x] 23-01-PLAN.md — Dockerfile + railway.toml for Playwright volume, install BullMQ/ioredis/node-cron deps, create Redis connection factory
- [x] 23-02-PLAN.md — Implement cadence-dispatcher (node-cron tick -> BullMQ enqueue), cadence-worker (BullMQ -> graph.invoke()), push-helper, wire into index.ts
- [x] 23-03-PLAN.md — Verify get_due_cadence_agents() SQL function, implement BullMQ repeatable jobs for daily briefing + morning digest

### Phase 24: Frontend Migration
**Goal**: The frontend runs entirely on Railway with no Supabase dependency — Logto handles auth, all data fetching calls the Express API server, and the Vite build is served by Nginx
**Depends on**: Phase 21 (Logto auth), Phase 22 (API Server live)
**Requirements**: RAIL-06, FE-01, FE-02, FE-03, FE-04, FE-05, FE-06
**Success Criteria** (what must be TRUE):
  1. `@supabase/supabase-js` does not appear in the frontend bundle or `package.json`
  2. A new user can open the Railway frontend URL, register via Logto, complete onboarding, and reach the dashboard without any Supabase calls in the network tab
  3. An authenticated user's agent chat sends SSE requests to the Railway LangGraph server URL and receives streaming responses
  4. The environment variables `VITE_API_URL`, `VITE_LANGGRAPH_URL`, and `VITE_LOGTO_*` are set to Railway endpoints and the app builds cleanly with them
  5. The Vite build is packaged into a Nginx Docker container and deployed as a Railway service serving the SPA
**Plans**: 5 plans

Plans:
- [ ] 24-01-PLAN.md — Create frontend api.ts client + core CRUD routes in API server (profiles, notifications, team-data, tasks, artifacts, user-agents, agent-types, workspaces)
- [ ] 24-02-PLAN.md — Add agent-specific CRUD routes (leads, invoices, social-posts, transactions, datasheets, outreach-emails) + migrate Auth.tsx/Dashboard.tsx to Logto
- [ ] 24-03-PLAN.md — Migrate all 9 hooks from Supabase to api.ts + React Query, migrate useAgentChat SSE to Railway URL, delete useLangGraphFlag
- [ ] 24-04-PLAN.md — Migrate all 16 component files from Supabase to api.ts (dashboard, onboarding, agents, chat, settings)
- [ ] 24-05-PLAN.md — Delete Supabase files, remove package, create Dockerfile + nginx.conf + railway.toml for Nginx container

### Phase 25: Production Cutover
**Goal**: All Railway services have their public domains assigned, the platform is accessible end-to-end via Railway-generated URLs, and a full smoke test confirms every critical user flow works
**Depends on**: Phase 22, Phase 23, Phase 24
**Requirements**: RAIL-08
**Success Criteria** (what must be TRUE):
  1. Railway-generated domains are assigned to the Frontend, API Server, and LangGraph Server services
  2. A first-time user can register, complete onboarding, activate an agent team, and send a message to the Chief of Staff from the public Railway frontend URL
  3. A scheduled agent heartbeat fires, processes, and surface an insight in the dashboard without manual intervention
  4. Image generation (via Gemini Imagen 3) and email sending (via Resend) both complete successfully from the production environment
**Plans**: 1 plan

Plans:
- [ ] 25-01: Assign Railway domains to all public services, set CORS origins to production frontend domain, run full smoke test checklist

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v1.0 | 5/5 | Complete | 2026-03-12 |
| 2. Agent Spawner + Team Selector | v1.0 | 5/5 | Complete | 2026-03-17 |
| 3. MD Workspace Editor + Marketplace | v1.0 | 5/5 | Complete | 2026-03-13 |
| 4. Heartbeat System | v1.0 | 6/6 | Complete | 2026-03-13 |
| 5. Org View + Notifications | v1.0 | 5/5 | Complete | 2026-03-13 |
| 6. Heartbeat Bug Fixes | v1.0 | 2/2 | Complete | 2026-03-17 |
| 7. Workspace Prompt Wiring + Push Opt-In | v1.0 | 4/4 | Complete | 2026-03-17 |
| 8. Phase Verifications | v1.0 | 4/4 | Complete | 2026-03-17 |
| 9. Tech Debt Cleanup | v1.0 | 3/3 | Complete | 2026-03-17 |
| 10. LangGraph Infrastructure | v2.0 | 4/4 | Complete | 2026-03-18 |
| 11. Agent Graph Topology + Memory | v2.0 | 5/5 | Complete | 2026-03-18 |
| 12. Chief of Staff Tools + Governance | v2.0 | 4/4 | Complete | 2026-03-19 |
| 13. Accountant + Sales Rep Tools | v2.0 | 5/5 | Complete | 2026-03-19 |
| 14. Marketer + Persistent Browser | v2.0 | 5/5 | Complete | 2026-03-19 |
| 15. PA + Operational Agents | v2.0 | 6/6 | Complete | 2026-03-19 |
| 16. Proactive Cadence Engine | v2.0 | 5/5 | Complete | 2026-03-19 |
| 17. Generative UI + Onboarding | v2.0 | 5/5 | Complete | 2026-03-19 |
| 18. Agent-to-UI Data Pipeline Fix | v2.0 | 4/4 | Complete | 2026-03-20 |
| 19. Infrastructure Provisioning | v2.1 | 0/3 | Complete    | 2026-03-21 |
| 20. Database Migration | v2.1 | 2/2 | Complete    | 2026-03-21 |
| 21. Auth Wiring | v2.1 | 2/2 | Complete    | 2026-03-21 |
| 22. API Server | v2.1 | 5/5 | Complete    | 2026-03-21 |
| 23. Scheduling Migration | v2.1 | 3/3 | Complete    | 2026-03-21 |
| 24. Frontend Migration | v2.1 | 0/5 | Not started | - |
| 25. Production Cutover | v2.1 | 0/1 | Not started | - |

---
*Roadmap created: 2026-03-12*
*Milestone v1.0: Proactive Multi-Agent Foundation — shipped 2026-03-17*
*Milestone v2.0: Agent Intelligence Layer — shipped 2026-03-20*
*Milestone v2.1: Railway Deployment — roadmap created 2026-03-21*
