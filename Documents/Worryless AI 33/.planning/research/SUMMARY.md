# Project Research Summary

**Project:** Worryless AI v2.1 — Railway Deployment Migration
**Domain:** Infrastructure migration — Supabase to self-hosted Railway (multi-agent SaaS platform)
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Worryless AI v2.1 is a full-platform infrastructure migration — not a feature milestone. The product (a multi-agent AI SaaS with proactive scheduling, LangGraph graph execution, and streaming chat) already exists and runs on Supabase. The goal is to replicate every capability on a self-hosted Railway stack: Logto replaces Supabase Auth, a new Express API server replaces 21 Supabase Edge Functions (Deno), BullMQ + Redis replaces pg_cron + pgmq, and Railway PostgreSQL replaces Supabase's managed database. The LangGraph server is already on Railway and requires only minor changes. The frontend needs its Supabase client dependency stripped and rewired to Logto and the new Express API.

The recommended build order is strictly dependency-driven: infrastructure first (Railway Postgres, Redis, Logto), then database migration (sanitized SQL migrations with Supabase-specific extensions stripped), then the Express API server (21 routes + auth middleware), then LangGraph server cadence additions (BullMQ dispatcher + worker), then frontend rewiring. This order is non-negotiable — every subsequent layer depends on the one before it. No end-to-end testing is possible until Logto issues JWTs, Postgres has all schemas applied, and the Express API server is returning 200s.

The highest-risk elements are (1) auth user UUID preservation during migration from Supabase to Logto — a mismatch orphans every row of user data in all 20+ tables — and (2) the API surface conversion volume (21 functions spanning 6 categories) combined with two silent failure modes: Deno-specific globals that compile as valid TypeScript but crash at Node.js runtime, and SSE streaming that requires explicit `X-Accel-Buffering: no` headers to prevent Railway's nginx from buffering agent response chunks. Both must be caught in staging before any production cutover.

---

## Key Findings

### Recommended Stack

The v2.1 stack minimizes net-new packages. The LangGraph server already has `express ^4.21.0`, `@google/genai ^1.46.0`, `pg ^8.13.0`, and `@langchain/langgraph ^1.2.3` installed. New packages are limited to `jose ^6.2.2` (JWT verification via Logto JWKS) and `web-push ^3.6.5` on the Express API server, and `@logto/react ^4.0.13` on the frontend. Logto itself is deployed as a Docker service (`logto/logto:latest`) with no npm footprint. BullMQ + Redis replaces the pg_cron + pgmq scheduling pattern with a single Redis service that Railway offers natively.

**Core technologies:**

- **Railway PostgreSQL (pgvector 18 trixie template):** App data store + LangGraph checkpoints/store — pgvector pre-installed, pg_cron and pgmq extensions replaced by BullMQ
- **Logto (Docker, self-hosted):** OIDC/OAuth 2.1 identity provider replacing Supabase Auth — one-click Railway template, PostgreSQL-backed, issues standard JWTs, shares the Railway Postgres instance via a dedicated `logto` schema
- **Express API server (new Railway service):** Replaces all 21 Supabase Edge Functions — stateless, JWT-validated via `jose` + Logto JWKS, connects directly to Railway Postgres with `pg`, never uses Supabase client SDK
- **BullMQ + Railway Redis:** Persistent job queue replacing pgmq — survives process restarts, cron scheduling via `node-cron` dispatcher in the LangGraph server process replaces pg_cron
- **`jose ^6.2.2`:** JWKS-based JWT verification in Express — 20-line middleware, no session state, no per-request Logto roundtrip
- **`@google/genai ^1.46.0` (already installed):** Direct Gemini API access — removes Lovable AI Gateway dependency, eliminates 10-50ms proxy overhead; use the OpenAI-compatible endpoint (`/v1beta/openai/chat/completions`) to preserve response format without rewriting parsers
- **`@logto/react ^4.0.13`:** React SPA auth SDK — replaces all `supabase.auth.*` calls with OIDC authorization code flow
- **`web-push ^3.6.5`:** VAPID push notifications in Express — replaces Deno JSR `@negrel/webpush` used in Edge Functions

**What NOT to add:**
- BullMQ workers belong in the LangGraph server process (not the API server) — workers call `graph.invoke()` directly
- `@supabase/supabase-js` must not appear in the Express API server — it cannot connect to Railway's vanilla Postgres
- `@google/generative-ai` is deprecated (August 2025) — `@google/genai` is already installed and is the correct package
- `@logto/node` / `@logto/express` are session-based SDKs for SSR apps, not for stateless JWT APIs

**Details:** `.planning/research/STACK.md`

---

### Expected Features

This milestone has no new user-facing features. The scope is infrastructure parity — every existing Worryless AI capability must work identically on the Railway stack before v2.1 is live.

**Must replicate (table stakes — missing = platform non-functional):**

- Railway Postgres with pgvector provisioned, all 20+ migrations applied (with `auth.*`, `vault.*`, `pgmq.*`, `cron.*`, `pg_net.*` references stripped)
- Logto deployed on Railway, issuing JWTs with preserved user UUIDs matching existing `user_id` foreign keys across all tables
- Express JWT middleware validating Logto tokens — all `/api/*` routes protected
- BullMQ + Redis deployed — heartbeat dispatcher and proactive-runner functional
- All 21 Edge Functions converted: 13 HTTP routes + 6 BullMQ workers/scheduled jobs + 2 utility routes
- Direct Gemini SDK replacing Lovable AI Gateway — all LLM calls functional with preserved OpenAI-compatible response format
- Image generation model replacement (Gemini Imagen 3 or Stability AI) — Nano Banana 2 does not exist outside Lovable
- LangGraph server DATABASE_URL updated to Railway Postgres — chat persistence and agent memory intact
- Frontend `@supabase/supabase-js` removed, all hooks rewired to call `/api/*` via `@logto/react`-injected tokens
- Google OAuth redirect URIs updated to Logto in Google Cloud Console

**Differentiators (post-migration improvements, not required for v2.1 launch):**

- BullMQ dashboard (Bull Board) for job monitoring
- Railway private networking between API server and LangGraph server
- Logto OIDC provider capabilities for future MCP server auth
- Logto custom JWT claims (`user_id`, `plan` embedded in token to eliminate DB lookup per request)
- RBAC roles for future plan tiers

**One external decision required before image routes can ship:** Nano Banana 2 is Lovable-proprietary. Option A: Gemini Imagen 3 (same vendor, simpler key management). Option B: Stability AI (more options, additional vendor). This decision blocks `generate-image` and `generate-invoice-image` routes and must be made before Phase 3 begins.

**Defer to v2.1.x post-launch:**

- New agent capabilities of any kind
- New tool integrations
- Performance optimization beyond parity
- Bull Board dashboard, Railway private networking, Logto RBAC

**Details:** `.planning/research/FEATURES.md`

---

### Architecture Approach

The target architecture is 6 Railway services in a single project communicating over Railway's private Wireguard network (`.railway.internal` hostnames). The API server is intentionally kept separate from the LangGraph server — LangGraph runs long-lived SSE connections and Playwright (1GB+ image), while the API server runs short CRUD requests. Merging them creates conflicting scaling profiles and forces Playwright re-installation on every API change. BullMQ workers live in the LangGraph server process (not the API server) because they call `graph.invoke()` directly, avoiding an internal HTTP round-trip per scheduled agent run.

**Major components:**

1. **`frontend` (Nginx serving Vite SPA)** — static, no server-side logic; all API calls via `Authorization: Bearer` to api-server; NEW service
2. **`api-server` (new Express/Node.js service)** — 21 former Edge Functions as routes, `jose` JWT middleware, `pg` pool for DB queries, `web-push` for push notifications; NEW service, does not exist yet
3. **`langgraph-server` (existing Railway service, extended)** — adds `node-cron` dispatcher + BullMQ worker for cadence (two new files: `cadence/dispatcher.ts`, `cadence/worker.ts`); minimal env var changes
4. **`postgres` (Railway managed PostgreSQL)** — single DB instance, three schemas: `public` (app data), `langgraph` (checkpoints/store), `logto` (Logto identity); NEW service
5. **`redis` (Railway managed Redis)** — BullMQ queue backing only; two queues: `heartbeat_jobs` and `digest_jobs`; NEW service
6. **`logto` (Docker: `logto/logto:latest`)** — OIDC provider; browser authenticates here, api-server verifies JWKS locally with zero per-request Logto calls; NEW service

**Key patterns:**

- **JWT-stateless auth:** JWKS cached at api-server startup; `sub` claim = user ID; replaces RLS with `WHERE user_id = $1` in every query
- **SSE proxy:** `http-proxy-middleware` from api-server to langgraph-server with `X-Accel-Buffering: no` to prevent Railway nginx buffering
- **Cadence:** `node-cron` tick (every 5 min) in LangGraph server process → BullMQ enqueue to Redis → BullMQ worker calls `graph.invoke()` — mirrors old pg_cron → pgmq pattern with persistence through restarts
- **Railway reference variables:** `${{Postgres.DATABASE_URL}}` injects connection strings across services automatically

**Details:** `.planning/research/ARCHITECTURE.md`

---

### Critical Pitfalls

1. **Auth UUID orphan on user migration** — Supabase and Logto both use UUIDs but generate different values. Every `user_id` FK in 20+ tables becomes a dangling reference if users are re-registered in Logto with new IDs. Prevention: export Supabase `auth.users` UUIDs and import into Logto Management API with explicit `id` field preserved. Verify with a join query before any production cutover.

2. **Supabase password hashes silently rejected by Logto** — Logto defaults to Argon2 on import; bcrypt hashes from Supabase are rejected unless `passwordAlgorithm: "Bcrypt"` is set in the import payload. Result: all migrated users cannot log in. Prevention: always include `passwordAlgorithm: "Bcrypt"` in the import POST; smoke-test with a seed user before bulk migration.

3. **pgmq and pg_cron unavailable on Railway Postgres** — Railway's managed Postgres does not include either extension. Migrations will fail or silently no-op. Prevention: strip all `pgmq.*` and `cron.*` SQL from the Railway migration file; replace with BullMQ + node-cron before running any DB migrations.

4. **Gemini direct API uses different response format than Lovable gateway** — The gateway returns OpenAI-format (`choices[0].message.content`); native Gemini returns `candidates[0].content.parts[0].text`. Using the OpenAI-compatible Gemini endpoint (`/v1beta/openai/chat/completions`) preserves format with zero parser changes — only the base URL and API key header need to change.

5. **SSE streaming buffered by Railway nginx** — Without `X-Accel-Buffering: no`, `res.flushHeaders()`, and `Cache-Control: no-cache` on every SSE route, Railway's nginx buffers all chunks and delivers them at once. The frontend spinner runs indefinitely then all text appears at once. Critical for the `langgraph-proxy` route.

6. **Deno globals crash Node.js at runtime** — `Deno.env.get()`, `jsr:` imports, `https://esm.sh/` URL imports, and `serve()` are valid TypeScript but throw `ReferenceError` at Node.js runtime. Compilation succeeds; errors surface only in production. Prevention: audit all 21 functions with a systematic replacement checklist before deployment.

7. **`auth.users` FK references block Railway Postgres migrations** — 15+ tables reference `REFERENCES auth.users(id)`. Supabase's `auth` schema does not exist on vanilla Postgres. Prevention: create `RAILWAY_MIGRATION.sql` replacing all `auth.users` references with `public.users` before running any migration.

8. **RLS removal creates cross-user data exposure** — Removing Supabase RLS eliminates the database-level safety net. Any Express route missing `WHERE user_id = $1` silently returns all users' data. Prevention: two-user cross-access test for every converted route in staging; consider enabling standard PostgreSQL RLS on Railway as a fallback enforcement layer.

**Details:** `.planning/research/PITFALLS.md`

---

## Implications for Roadmap

Based on combined research, the dependency graph is strict. The following 5-phase structure mirrors the build order established in ARCHITECTURE.md and validated by the pitfall-to-phase mapping in PITFALLS.md. No phase can be fully tested until its prerequisites are complete.

### Phase 1: Infrastructure Foundation + Auth Migration

**Rationale:** Every other service depends on Postgres (schema), Redis (BullMQ queues), and Logto (JWT issuance). Auth UUID preservation is the single highest-risk operation in the entire migration — a mismatch at this stage requires re-keying every FK in 20+ tables under time pressure. It must be resolved first, not last.

**Delivers:** Railway Postgres provisioned (pgvector 18 trixie template), Redis provisioned, Logto deployed and issuing JWTs, all existing Supabase users migrated with UUID and bcrypt hash preservation, smoke-test confirming login with original password, Google OAuth redirect URIs updated to Logto.

**Addresses (FEATURES.md):** Railway Postgres + pgvector, Logto auth deployed, Google OAuth redirect URIs.

**Avoids (PITFALLS.md):** UUID orphan (Pitfall 1), password hash incompatibility (Pitfall 2), JWT format mismatch (Pitfall 3).

**Research flag:** Standard patterns — Logto has an official Railway template and documented user migration API. Postgres provisioning on Railway is well-documented. One task needing care: writing the user migration script against a staging Logto instance with seed data before touching production.

---

### Phase 2: Database Migration (Sanitized SQL Migrations)

**Rationale:** Postgres must exist before migrations can run (Phase 1 dependency). pgmq and pg_cron SQL must be stripped before any migration file touches Railway Postgres — if attempted verbatim, they fail at the extension-missing error and block the entire schema. The `auth.users` FK problem must also be resolved here before any application code can connect to the schema.

**Delivers:** A `RAILWAY_MIGRATION.sql` file that applies all 20+ existing migrations to Railway Postgres with `auth.users` references replaced by `public.users`, pgmq/pg_cron/pg_net/vault SQL stripped, pgvector extension enabled, and the LangGraph schema intact.

**Addresses (FEATURES.md):** All 20+ SQL migrations applied, schema matches v2.0.

**Avoids (PITFALLS.md):** `auth.users` FK failures (Pitfall 7), pgmq unavailable (Pitfall 3), pg_cron unavailable (Pitfall 3).

**Uses (STACK.md):** Railway pgvector 18 trixie template, `pg` direct connection.

**Research flag:** Standard patterns — known exactly which SQL clauses to strip, well-documented. No additional research needed.

---

### Phase 3: Express API Server (21 Edge Function Conversions)

**Rationale:** Requires Postgres schema (Phase 2) and Logto JWKS endpoint (Phase 1). This is the highest-volume phase (21 function conversions) and highest-complexity due to architectural type changes (6 scheduling functions shift from HTTP to BullMQ workers). Must be built before the frontend can be rewired. The image model decision must be made before this phase begins.

**Delivers:** New `api-server` Railway service with: `jose` JWT middleware, `pg` pool, all 13 HTTP routes (chat, orchestrate, langgraph-proxy, agents/spawn, business/crawl, parse-datasheet, generate/content, generate/image, generate/invoice-image, leads, outreach, planning, integrations, email), BullMQ + Redis queues and workers (heartbeat dispatcher, heartbeat runner, proactive runner, daily briefing, morning digest), direct Gemini SDK via OpenAI-compat endpoint replacing Lovable gateway, `web-push` VAPID push notifications, health check endpoint.

**Addresses (FEATURES.md):** All 21 Edge Functions converted, BullMQ + Redis cadence engine functional, direct Gemini SDK, VAPID keys, health check endpoints.

**Avoids (PITFALLS.md):** Deno → Node.js API differences (Pitfall 6), Gemini response format (Pitfall 4), SSE buffering (Pitfall 5), RLS data leak (Pitfall 8), JWT validation (Pitfall 3).

**Uses (STACK.md):** `express ^4.21.0`, `pg ^8.13.0`, `jose ^6.2.2`, `web-push ^3.6.5`, `@google/genai ^1.46.0`, BullMQ, node-cron.

**Research flag:** Needs careful execution — the 6 scheduling functions change architectural type (HTTP → background worker); the SSE proxy pattern requires exact header configuration; the Gemini OpenAI-compat endpoint must be used (not the native endpoint). Run the "Looks Done But Isn't" checklist from PITFALLS.md against every converted function. The BullMQ Redis TLS (`tls: {}` in IORedis connection) must not be missed — BullMQ silently fails to connect without it on Railway.

---

### Phase 4: LangGraph Server Cadence Extensions + Playwright Volume

**Rationale:** Depends on Redis (Phase 1) and Postgres schema (Phase 2). The cadence dispatcher and worker require BullMQ (Redis) and the `get_due_cadence_agents()` SQL function (Postgres). This phase can proceed in parallel with Phase 3 if team size allows — the two phases share infrastructure dependencies but have no code dependencies on each other.

**Delivers:** LangGraph server with BullMQ cadence (`dispatcher.ts` + `worker.ts` wired into `index.ts`), `GEMINI_API_KEY` replacing `LOVABLE_API_KEY`, `DATABASE_URL` updated to Railway Postgres, Playwright volume mounted at `/playwright-data` with `RAILWAY_RUN_UID=0` set for volume permissions.

**Addresses (FEATURES.md):** LangGraph server DATABASE_URL update, chat persistence, agent memory intact post-migration.

**Avoids (PITFALLS.md):** LangGraph UUID namespace alignment (verify checkpoint rows queryable with preserved UUIDs), BullMQ worker in wrong service (Architecture Anti-Pattern 2 from ARCHITECTURE.md).

**Uses (STACK.md):** `node-cron ^4.2.1` (in-process), BullMQ (via Redis), `@google/genai ^1.46.0` (already installed).

**Research flag:** Standard patterns — BullMQ worker pattern is well-documented with working code examples in ARCHITECTURE.md. node-cron API is straightforward. Volume mount config is confirmed in Railway docs. No additional research needed.

---

### Phase 5: Frontend Rewiring + Production Cutover

**Rationale:** Final phase — depends on all API routes being live (Phase 3) and Logto issuing tokens (Phase 1). Frontend cannot be tested end-to-end until the full API surface is available. This phase is high-volume (many hook rewrites) but mechanically straightforward.

**Delivers:** Frontend with `@supabase/supabase-js` removed, `@logto/react` OIDC flow replacing `supabase.auth.*`, all data-fetching hooks (`useTeamData`, `useAgentWorkspace`, `useNotifications`, `usePushSubscription`, etc.) rewired to call `/api/*` with Bearer token injection, Vite build deployed as Nginx Docker container on Railway, custom domains configured, production DNS cutover.

**Addresses (FEATURES.md):** Frontend auth rewire, `@supabase/supabase-js` removal, all `VITE_` env vars updated, custom domains, static frontend hosting.

**Avoids (PITFALLS.md):** Keeping Supabase client SDK in frontend (Technical Debt table), CORS wildcard on Express routes, `GEMINI_API_KEY` leaking into frontend bundle.

**Uses (STACK.md):** `@logto/react ^4.0.13`, direct `fetch()` with Bearer token injection from `useLogto()` hook.

**Research flag:** Standard patterns — `@logto/react` hooks are well-documented in official Logto React quickstart. Hook rewiring is high-volume but mechanical. No additional research needed.

---

### Phase Ordering Rationale

- **Infrastructure before code:** Logto, Postgres, and Redis must exist before any application code can be validated. All API routes require a DB connection, all routes require JWT validation, scheduling requires Redis. These cannot be parallelized with code phases.
- **Database before API server:** The Express server's connection pool fails on startup if the schema is missing. All 13 HTTP routes have DB queries — they must be testable immediately after deployment.
- **API server before frontend:** Frontend hooks that call `/api/*` return 404 or 401 until the Express server is live with correct auth middleware. End-to-end testing requires both.
- **Phase 3 and Phase 4 can run in parallel:** The API server build and LangGraph cadence additions share only the infrastructure dependencies (Postgres + Redis). Neither depends on the other's code.
- **UUID preservation in Phase 1, not Phase 5:** The temptation to migrate auth "at the end" is the single most dangerous planning mistake for this project. User UUIDs are foreign keys in every table. Migrating them last means either running the entire v2.1 stack with no users (untestable) or doing a late-stage re-keying operation under time pressure.

### Research Flags

**Phases needing attention during implementation:**

- **Phase 1 — user migration script:** The Logto Management API import with UUID preservation requires a one-time migration script. Must be validated against a staging Logto instance with seed data before touching production users.
- **Phase 3 — image model decision (external blocker):** Nano Banana 2 has no direct equivalent. Gemini Imagen 3 is the recommended default (same SDK, same API key), but this decision must be explicit before Phase 3 begins — it blocks 2 routes.
- **Phase 3 — scheduling conversion:** 6 functions change from HTTP-triggered (pg_cron calling Edge Function URLs) to BullMQ workers. BullMQ job IDs, `lockDuration` matching old `visibility_timeout`, and concurrency tuning need careful execution. Not research-blocked — patterns are fully documented in ARCHITECTURE.md.

**Phases with standard, well-documented patterns (no additional research needed):**

- **Phase 2 (database migration):** SQL transformation is mechanical — known exactly which clauses to strip.
- **Phase 4 (LangGraph cadence):** node-cron + BullMQ pattern is directly demonstrated in ARCHITECTURE.md with working code examples.
- **Phase 5 (frontend):** `@logto/react` hook replacement follows Logto's React quickstart exactly.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against GitHub releases and npm as of 2026-03-21. `@google/genai ^1.46.0`, `jose ^6.2.2`, `@logto/react ^4.0.13`, `web-push ^3.6.5` all confirmed current. |
| Features | HIGH (migration scope) / MEDIUM (scheduling strategy) | Railway docs confirmed Logto one-click template, pgvector availability, Redis service. Scheduling: STACK.md and ARCHITECTURE.md reached different conclusions on pg_cron availability — the correct synthesis is node-cron (in-process dispatch tick) + BullMQ (job persistence), which eliminates the pg_cron question entirely. |
| Architecture | HIGH | Codebase inspected directly (21 Edge Functions, LangGraph server `index.ts`, persistence layer). Railway private networking, volumes, and reference variables verified via official Railway docs. 6-service topology validated against Railway Hobby plan limits. |
| Pitfalls | HIGH | All 10 critical pitfalls are grounded in either direct codebase inspection (15+ `auth.users` FK references counted, Deno globals catalogued across all 21 functions) or official documentation (Logto user migration API, Gemini OpenAI-compat endpoint, Railway nginx buffering). |

**Overall confidence:** HIGH

### Gaps to Address

- **Image model decision (external, blocks Phase 3):** Nano Banana 2 has no direct equivalent. Gemini Imagen 3 is the recommended default (same SDK, same API key), but a quality comparison against Stability AI has not been evaluated. Decide before Phase 3 begins.
- **Logto shared vs dedicated Postgres for identity data:** ARCHITECTURE.md recommends considering a second Postgres service for Logto isolation; STACK.md recommends the shared instance with a dedicated `logto` schema. Evaluate during Phase 1 — the shared approach is the default unless schema conflicts arise.
- **BullMQ Redis TLS on Railway:** Railway Redis requires `tls: {}` in IORedis connection options for production. One-line config change, but must not be missed during Phase 3 — BullMQ silently fails to connect without it.
- **LangGraph checkpoint data migration:** Existing LangGraph checkpoints use Supabase-issued UUIDs as thread ID prefixes. Since UUIDs are preserved via Logto import, existing checkpoint rows should remain queryable. Verify with a direct query after Phase 2 migrations are applied.
- **CORS origin restriction:** Converted Edge Functions may have `Access-Control-Allow-Origin: *`. Express API server must restrict CORS to the frontend Railway domain in production. Wildcard CORS + JWT = anyone can make authenticated API calls on behalf of logged-in users.

---

## Sources

### Primary (HIGH confidence)

- [Logto React quickstart](https://docs.logto.io/quick-starts/react) — `@logto/react` hooks, OIDC flow for SPA
- [Logto Express API protection](https://docs.logto.io/api-protection/nodejs/express) — `jose` JWKS middleware pattern, recommended by Logto for stateless Express
- [Logto deployment and configuration](https://docs.logto.io/logto-oss/deployment-and-configuration) — port architecture, DB_URL, Logto CLI seed
- [Logto user migration docs](https://docs.logto.io/user-management/user-migration) — `passwordAlgorithm: "Bcrypt"` import field
- [Railway PostgreSQL docs](https://docs.railway.com/databases/postgresql) — extension support, pgvector availability
- [Railway pgvector blog post](https://blog.railway.com/p/hosting-postgres-with-pgvector) — pgvector template details
- [Railway pgcron template](https://railway.com/deploy/pgcron-railway) — pg_cron native availability confirmed
- [Railway private networking docs](https://docs.railway.com/networking/private-networking) — `.railway.internal` hostname resolution, IPv4/IPv6 caveat
- [Railway volumes docs](https://docs.railway.com/reference/volumes) — mount constraints, `RAILWAY_RUN_UID=0` requirement
- [Deploy Logto on Railway](https://railway.com/deploy/logto) — one-click Railway template
- [BullMQ repeatable jobs docs](https://docs.bullmq.io/guide/jobs/repeatable) — cron expression support confirmed
- [Railway fastify-bullmq template](https://github.com/railwayapp-templates/fastify-bullmq) — BullMQ + Redis on Railway reference
- [Gemini OpenAI-compatible endpoint](https://ai.google.dev/gemini-api/docs/openai) — `/v1beta/openai/chat/completions` preserves response format
- [googleapis/js-genai releases](https://github.com/googleapis/js-genai/releases) — `@google/genai` v1.46.0 latest (verified 2026-03-18)
- [google-gemini/deprecated-generative-ai-js](https://github.com/google-gemini/deprecated-generative-ai-js) — `@google/generative-ai` deprecated August 2025
- [panva/jose releases](https://github.com/panva/jose/releases) — v6.2.2 latest verified
- Codebase inspection: `worrylesssuperagent/langgraph-server/`, `supabase/functions/` (21 Edge Functions), `supabase/migrations/` (20+ files) — direct source of truth

### Secondary (MEDIUM confidence)

- [Railway Node.js + Express zero-downtime guide](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) — health check endpoint pattern
- [BullMQ vs node-cron comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) — persistence importance for production schedulers
- [Supabase vs Railway 2026 comparison](https://www.buildmvpfast.com/compare/supabase-vs-railway) — migration context, Edge Functions incompatibility confirmed
- [Gemini API latency overhead research](https://dev.to/pranay_batta/top-5-cloudflare-ai-gateway-alternatives-in-2026-521e) — 10-50ms gateway overhead confirmed

### Tertiary (reference only)

- [pgmq Railway feature request](https://station.railway.com/feedback/support-postgres-extensions-04b914a7) — pgmq not natively supported on Railway (confirms BullMQ replacement is necessary)
- [Supabase RLS security pitfalls](https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9) — cross-user data leak pattern when RLS is removed
- [Better Auth Supabase migration guide](https://better-auth.com/docs/guides/supabase-migration-guide) — bcrypt portability reference

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*
