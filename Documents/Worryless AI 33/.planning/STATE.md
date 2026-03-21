---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Railway Deployment
status: unknown
stopped_at: Completed 22-05-PLAN.md (email routes, push subscriptions, full build verification)
last_updated: "2026-03-21T10:04:51.940Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.
**Current focus:** Phase 22 — api-server

## Current Position

Phase: 23
Plan: Not started

## Performance Metrics

**v1.0 Proactive Multi-Agent Foundation (shipped 2026-03-17):**

- Phases: 9 | Plans: 39

**v2.0 Agent Intelligence Layer (shipped 2026-03-20):**

- Phases: 9 | Plans: 43
- Requirements: 114/114 delivered

**v2.1 Railway Deployment (in progress):**

- Phases: 7 (19-25) | Plans: ~19 (TBD during planning)
- Requirements: 51/51 mapped

## Accumulated Context

### Decisions

Key v2.1 decisions (see PROJECT.md Key Decisions table):

- Logto replaces Supabase Auth (shared Postgres instance with `logto` schema — not separate DB)
- BullMQ + node-cron replaces pg_cron + pgmq (BullMQ workers live in LangGraph server, not API server)
- Gemini Imagen 3 replaces Nano Banana 2 for image generation (same SDK, same API key)
- OpenAI-compatible Gemini endpoint (`/v1beta/openai/`) preserves response parsers — no rewriting
- `jose` JWKS middleware on API server (stateless, no per-request Logto roundtrip)
- BullMQ TLS required for Railway Redis (`tls: {}` in IORedis options) — silent failure without it
- [Phase 20]: Replaced all auth.users FK references with public.users for Logto; dropped all RLS for API-layer enforcement; replaced pgmq with RAISE NOTICE stubs for BullMQ
- [Phase 20]: Table count is 34 (not 35) — 33 app tables + public.users; plan had off-by-one in expected count
- [Phase 21]: LogtoProvider wraps outside QueryClientProvider as outermost provider; useAuth returns API resource access token (not id_token)
- [Phase 21]: jose JWKS middleware on LangGraph server: stateless JWT validation via createRemoteJWKSet + jwtVerify, user_id from sub claim
- [Phase 22]: Lazy JWKS initialization in auth middleware to avoid crash in test environment
- [Phase 22]: Global app.use('/api', verifyLogtoJWT) guard instead of per-route auth middleware
- [Phase 22]: Images returned as base64 data URIs from Imagen 3 (not hosted CDN URLs) - frontend img src compatible
- [Phase 22]: Used getGeminiOpenAI() lazy init pattern aligned with parallel agent refactor
- [Phase 22]: Lazy SDK initialization via getter functions prevents test crashes from missing env vars
- [Phase 22]: Push subscription uses DELETE+INSERT instead of ON CONFLICT UPSERT to avoid unique constraint dependency
- [Phase 22]: Orchestrator uses direct geminiOpenAI calls instead of fetching separate edge functions
- [Phase 22]: langgraphProxy uses app.use() for sub-path routing (Express 5 path-to-regexp v8 rejects /* wildcards)

### Pending Todos

None.

### Blockers/Concerns

- Image model decision (Gemini Imagen 3 confirmed in requirements — unblocked)
- UUID preservation: Logto user import must use `passwordAlgorithm: "Bcrypt"` and explicit `id` field — validate against staging instance first
- SSE routes must set `X-Accel-Buffering: no` + `res.flushHeaders()` — Railway nginx buffers without it

## Session Continuity

Last session: 2026-03-21T10:03:00.558Z
Stopped at: Completed 22-05-PLAN.md (email routes, push subscriptions, full build verification)
Resume file: None
