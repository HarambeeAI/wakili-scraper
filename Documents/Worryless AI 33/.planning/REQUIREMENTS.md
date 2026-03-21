# Requirements: Worryless AI v2.1 — Railway Deployment

**Defined:** 2026-03-21
**Core Value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.

## v2.1 Requirements

### Infrastructure Provisioning (RAIL)

- [ ] **RAIL-01**: PostgreSQL service provisioned on Railway with pgvector extension enabled
- [ ] **RAIL-02**: Redis service provisioned on Railway for BullMQ job queue
- [ ] **RAIL-03**: Logto Auth service deployed on Railway with dedicated PostgreSQL for identity data
- [x] **RAIL-04**: LangGraph Server deployed on Railway via Docker with Playwright Chromium and persistent volume at `/playwright-data`
- [x] **RAIL-05**: API Server (Express) deployed on Railway replacing all Supabase Edge Functions
- [x] **RAIL-06**: Frontend deployed on Railway as static Nginx container serving Vite build
- [ ] **RAIL-07**: All services connected via Railway private networking (`service.railway.internal:PORT`)
- [x] **RAIL-08**: Railway-generated domains assigned to Frontend, API Server, and LangGraph Server

### Database Migration (DB)

- [x] **DB-01**: All 20+ Supabase migrations sanitized into RAILWAY_MIGRATION.sql (strip pg_cron, pgmq, pg_net, auth.users FK references, RLS policies, Supabase vault references)
- [x] **DB-02**: Sanitized migrations applied to Railway PostgreSQL with all tables, indexes, and seed data created
- [x] **DB-03**: `langgraph` schema created with checkpoints, checkpoint_writes, store tables
- [x] **DB-04**: pgvector extension enabled with document_embeddings table
- [x] **DB-05**: `profiles` table created with `auth.users` FK replaced by standalone `users` table managed by Logto

### Auth Migration (AUTH)

- [x] **AUTH-01**: Logto configured with email/password sign-in method
- [x] **AUTH-02**: `@logto/react` integrated into frontend replacing `@supabase/supabase-js` auth
- [x] **AUTH-03**: Logto JWT validation middleware on API Server using `jose` JWKS
- [x] **AUTH-04**: Logto JWT validation on LangGraph Server for direct SSE connections
- [x] **AUTH-05**: User ID (`sub` claim) extracted from JWT and passed as `user_id` to all database queries (replaces RLS `auth.uid()`)
- [x] **AUTH-06**: Google OAuth configured in Logto for Personal Assistant Gmail/Calendar integration

### API Server — Edge Function Conversion (API)

- [x] **API-01**: Express server with CORS, JSON parsing, and Logto auth middleware deployed as Railway service
- [x] **API-02**: `POST /api/chat-with-agent` route replacing `chat-with-agent` Edge Function
- [x] **API-03**: `POST /api/orchestrator` route replacing `orchestrator` Edge Function
- [x] **API-04**: `POST /api/spawn-agent-team` route replacing `spawn-agent-team` Edge Function
- [x] **API-05**: `POST /api/generate-content` route replacing `generate-content` Edge Function
- [x] **API-06**: `POST /api/generate-image` route replacing `generate-image` Edge Function (using Gemini Imagen 3)
- [x] **API-07**: `POST /api/generate-invoice-image` route replacing `generate-invoice-image` Edge Function (using Gemini Imagen 3)
- [x] **API-08**: `POST /api/generate-leads` route replacing `generate-leads` Edge Function
- [x] **API-09**: `POST /api/generate-outreach` route replacing `generate-outreach` Edge Function
- [x] **API-10**: `POST /api/crawl-business-website` route replacing `crawl-business-website` Edge Function
- [x] **API-11**: `POST /api/parse-datasheet` route replacing `parse-datasheet` Edge Function
- [x] **API-12**: `POST /api/planning-agent` route replacing `planning-agent` Edge Function
- [x] **API-13**: `POST /api/sync-gmail-calendar` route replacing `sync-gmail-calendar` Edge Function
- [x] **API-14**: `POST /api/send-validation-email` route replacing `send-validation-email` Edge Function
- [x] **API-15**: `POST /api/send-test-email` route replacing `send-test-email` Edge Function
- [x] **API-16**: `POST /api/langgraph-proxy` route replacing `langgraph-proxy` Edge Function (SSE proxy with `X-Accel-Buffering: no`)
- [x] **API-17**: All LLM calls use direct Gemini API via OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/`) instead of Lovable AI Gateway

### Scheduling Migration (SCHED)

- [x] **SCHED-01**: node-cron dispatcher tick running inside LangGraph Server process (replaces pg_cron)
- [x] **SCHED-02**: BullMQ worker processing heartbeat/cadence jobs from Redis queue (replaces pgmq)
- [x] **SCHED-03**: `get_due_cadence_agents()` SQL function adapted for Railway (remove pg_cron dependencies)
- [x] **SCHED-04**: Daily briefing, morning digest, and scheduled task runners converted to BullMQ recurring jobs
- [x] **SCHED-05**: Push notifications via `web-push` npm package with VAPID keys (replaces Deno `jsr:@negrel/webpush`)

### Frontend Migration (FE)

- [x] **FE-01**: `@supabase/supabase-js` removed from frontend dependencies
- [x] **FE-02**: All Supabase client calls replaced with `fetch()` to Railway API Server
- [x] **FE-03**: `@logto/react` `LogtoProvider` wrapping app with sign-in/sign-out/callback routes
- [x] **FE-04**: `useAgentChat` hook updated to connect SSE to Railway LangGraph Server URL
- [x] **FE-05**: All environment variables updated (`VITE_API_URL`, `VITE_LANGGRAPH_URL`, `VITE_LOGTO_*`)
- [x] **FE-06**: Vite build outputs static files served by Nginx container on Railway

### Environment & Configuration (ENV)

- [ ] **ENV-01**: All API keys configured as Railway service variables (GEMINI_API_KEY, FIRECRAWL_API_KEY, APIFY_API_TOKEN, RESEND_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] **ENV-02**: VAPID keys generated and configured for push notifications
- [ ] **ENV-03**: DATABASE_URL using Railway internal networking for all services
- [ ] **ENV-04**: Railway reference variables used for inter-service URLs (e.g., `${{API_SERVER.RAILWAY_PUBLIC_DOMAIN}}`)

## v2.2 Requirements (Deferred)

- Custom domain with SSL (app.worryless.ai)
- CI/CD pipeline with GitHub Actions → Railway auto-deploy
- Health monitoring and alerting
- Railway restart policies and auto-scaling
- Supabase data migration scripts (for users with existing data)
- Full Supabase removal (delete Supabase project)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Supabase data migration | Fresh deployment — no existing data to migrate |
| Custom domain setup | Deferred to v2.2 — Railway generated domains sufficient for now |
| CI/CD pipeline | Manual deploy via Railway CLI for v2.1 |
| Kubernetes / container orchestration | Railway handles this natively |
| Multi-region deployment | Single region sufficient for initial deployment |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAIL-01 | Phase 19 | Pending |
| RAIL-02 | Phase 19 | Pending |
| RAIL-03 | Phase 19 | Pending |
| RAIL-04 | Phase 23 | Complete |
| RAIL-05 | Phase 22 | Complete |
| RAIL-06 | Phase 24 | Complete |
| RAIL-07 | Phase 19 | Pending |
| RAIL-08 | Phase 25 | Complete |
| DB-01 | Phase 20 | Complete |
| DB-02 | Phase 20 | Complete |
| DB-03 | Phase 20 | Complete |
| DB-04 | Phase 20 | Complete |
| DB-05 | Phase 20 | Complete |
| AUTH-01 | Phase 21 | Complete |
| AUTH-02 | Phase 21 | Complete |
| AUTH-03 | Phase 21 | Complete |
| AUTH-04 | Phase 21 | Complete |
| AUTH-05 | Phase 21 | Complete |
| AUTH-06 | Phase 21 | Complete |
| API-01 | Phase 22 | Complete |
| API-02 | Phase 22 | Complete |
| API-03 | Phase 22 | Complete |
| API-04 | Phase 22 | Complete |
| API-05 | Phase 22 | Complete |
| API-06 | Phase 22 | Complete |
| API-07 | Phase 22 | Complete |
| API-08 | Phase 22 | Complete |
| API-09 | Phase 22 | Complete |
| API-10 | Phase 22 | Complete |
| API-11 | Phase 22 | Complete |
| API-12 | Phase 22 | Complete |
| API-13 | Phase 22 | Complete |
| API-14 | Phase 22 | Complete |
| API-15 | Phase 22 | Complete |
| API-16 | Phase 22 | Complete |
| API-17 | Phase 22 | Complete |
| SCHED-01 | Phase 23 | Complete |
| SCHED-02 | Phase 23 | Complete |
| SCHED-03 | Phase 23 | Complete |
| SCHED-04 | Phase 23 | Complete |
| SCHED-05 | Phase 22 | Complete |
| FE-01 | Phase 24 | Complete |
| FE-02 | Phase 24 | Complete |
| FE-03 | Phase 24 | Complete |
| FE-04 | Phase 24 | Complete |
| FE-05 | Phase 24 | Complete |
| FE-06 | Phase 24 | Complete |
| ENV-01 | Phase 19 | Pending |
| ENV-02 | Phase 19 | Pending |
| ENV-03 | Phase 19 | Pending |
| ENV-04 | Phase 19 | Pending |

**Coverage:**
- v2.1 requirements: 51 total (note: original count of 48 was a document error — actual count is 51)
- Mapped to phases: 51
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 — traceability mapped to phases 19-25*
