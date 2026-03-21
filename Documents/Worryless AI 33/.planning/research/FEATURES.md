# Feature Research

**Domain:** Infrastructure Migration — Supabase to Railway full-platform deployment (v2.1)
**Researched:** 2026-03-21
**Confidence:** HIGH (Railway docs, Logto docs verified), MEDIUM (scheduling strategy), HIGH (Express migration pattern)

---

## Migration Scope: What Supabase Provides That Must Be Replicated

This is not a new-feature milestone. Every user-facing capability already exists. The migration must achieve **feature parity** across four infrastructure layers: database, auth, API, and AI model access. Missing any one of these means the platform does not run. There are no table stakes in the product sense — there are migration requirements in the infrastructure sense.

This document reframes the template categories for an infrastructure migration context:
- **Table Stakes** = Supabase capabilities that must be replicated exactly
- **Differentiators** = Infrastructure improvements that become possible post-migration
- **Anti-Features** = Approaches that seem logical but create serious problems

---

## Feature Landscape

### Table Stakes (Must Replicate — Missing = Platform Non-Functional)

These are the Supabase-provided capabilities the Railway stack must replace with full parity. Nothing ships until all of these function correctly.

| Feature | Supabase Equivalent | Complexity | Migration Notes |
|---------|---------------------|------------|-----------------|
| PostgreSQL with pgvector | Supabase managed Postgres + pgvector | MEDIUM | Railway's default Postgres template does not include pgvector. Use the Railway pgvector marketplace template or build a custom Dockerfile. The `tembo/pg17-pgvector` image is the simplest path. HIGH confidence — Railway docs confirmed |
| pg_cron scheduling | Supabase pg_cron + scheduled jobs | HIGH | Not available in Railway's default Postgres. Requires custom Dockerfile (`postgresql-17-cron` apt package + `shared_preload_libraries` config). Recommended: replace entirely with BullMQ + Redis — see Differentiators |
| pgmq message queue | Supabase pgmq extension | HIGH | No native Railway support. The Tembo Docker image (`tembo/pg17-pgmq`) includes it, or build from source. If replaced by BullMQ, this dependency is eliminated entirely |
| Email/password auth + JWT sessions | Supabase Auth (GoTrue server) | MEDIUM | Logto replaces this. Logto has a one-click Railway deploy template. Issues OIDC-compliant JWTs. Uses `jose` library for Express JWT validation against Logto's JWKS endpoint. HIGH confidence — Logto docs verified |
| JWT-protected API access (RLS) | Supabase Auth JWT + PostgreSQL RLS | MEDIUM | RLS policies cannot function on vanilla Postgres without Supabase's auth schema plumbing (`auth.uid()` etc.). Replace with Express middleware: validate Logto JWT, extract `sub` as `user_id`, apply `WHERE user_id = $userId` to all DB queries. Simpler, testable, equivalent for single-tenant-per-user model |
| 21 Edge Function API endpoints | Supabase Edge Functions (Deno runtime) | HIGH | All 21 functions become Express route handlers. Deno-specific APIs (`Deno.env`, `Deno.serve`) and import specifiers (`esm.sh`, `npm:`) rewritten as Node.js. See function inventory below |
| LangGraph server proxy auth | Edge Function `langgraph-proxy` | LOW | LangGraph server is already on Railway. It needs DATABASE_URL updated to the new Railway Postgres instance. The proxy function becomes a thin Express route |
| Gemini AI text generation | Lovable AI Gateway (proprietary) | LOW | Direct `@google/generative-ai` SDK. Model `gemini-2.0-flash` is the functional equivalent of the current Flash model. No gateway intermediary. API key via Railway env var. HIGH confidence — Google AI SDK is stable |
| Image generation | Lovable "Nano Banana 2" (proprietary) | MEDIUM | **Forced model swap — Nano Banana 2 does not exist outside Lovable.** Use Gemini Imagen 3 via `@google/generative-ai` SDK's `generateContent` with image generation, or Stability AI. This is a blocker that needs a decision before image routes can ship |
| Push notification VAPID keys | Supabase Vault / env vars | LOW | Generate fresh VAPID keypair (`web-push generateVAPIDKeys`). Store in Railway env vars. No functional change to subscription flow |
| External API key management | Supabase Vault | LOW | All keys (Firecrawl, Apify, Resend, Gemini, Google OAuth credentials) move to Railway environment variables. Railway env vars are encrypted at rest — equivalent for this use case |
| Google OAuth callbacks | Supabase Auth OAuth redirect URI | MEDIUM | Update Google Cloud Console OAuth app with new redirect URIs pointing to Logto tenant. Logto handles the Google OAuth dance natively; app receives Logto-issued JWT |
| Static frontend hosting | Lovable / Supabase hosting | LOW | Vite `npm run build` output deployed as Railway static service (nginx container) or any CDN. All `VITE_` env vars updated to Railway API server URLs |
| Database schema and migrations | Supabase migrations runner | MEDIUM | 20+ existing `.sql` migration files must be applied in order against Railway Postgres. Strip or skip RLS directives (`CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) — they reference Supabase's `auth` schema which does not exist on vanilla Postgres |

### Edge Function Inventory (21 Functions to Convert to Express Routes)

Railway's suggested approach is full rewrite to Express routes, not running Deno Edge Runtime on Railway. Railway's own docs note Edge Functions are incompatible with self-hosted Supabase on Railway. MEDIUM confidence — Railway docs + buildmvpfast comparison verified.

| Function | Express Route | Complexity | Key Migration Notes |
|----------|--------------|------------|---------------------|
| `chat-with-agent` | `POST /api/chat` | MEDIUM | SSE streaming passes through to LangGraph server. Becomes thin JWT-validated proxy with SSE passthrough |
| `langgraph-proxy` | `POST /api/langgraph/*` | LOW | Already proxied. JWT validation moves to Express middleware. Minimal rewrite |
| `orchestrator` | `POST /api/orchestrate` | MEDIUM | Business logic rewrite from Deno to Node.js |
| `spawn-agent-team` | `POST /api/agents/spawn` | MEDIUM | DB writes only, no streaming |
| `heartbeat-runner` | BullMQ Worker | HIGH | Not an HTTP endpoint — triggered by scheduler. Becomes a BullMQ worker job consuming the heartbeat queue |
| `heartbeat-dispatcher` | BullMQ Repeatable Job | HIGH | Becomes a BullMQ repeatable job (cron expression) replacing the pg_cron trigger |
| `run-scheduled-tasks` | BullMQ Worker | HIGH | Same scheduling pattern as heartbeat-dispatcher |
| `proactive-runner` | BullMQ Worker | HIGH | Core cadence engine. Becomes BullMQ worker processing the proactive jobs queue |
| `send-daily-briefing` | BullMQ Scheduled Job | MEDIUM | Daily email via Resend SDK. BullMQ cron expression replaces pg_cron schedule |
| `send-morning-digest` | BullMQ Scheduled Job | MEDIUM | Same pattern as daily-briefing |
| `planning-agent` | `POST /api/planning` | MEDIUM | LLM call — rewrite Gemini gateway usage to direct SDK |
| `crawl-business-website` | `POST /api/crawl` | LOW | Firecrawl SDK call — straightforward Node.js rewrite |
| `generate-content` | `POST /api/content` | LOW | Direct Gemini SDK call |
| `generate-image` | `POST /api/image` | MEDIUM | Forced model swap. Route is LOW complexity once model is chosen |
| `generate-invoice-image` | `POST /api/invoice-image` | MEDIUM | Same image model dependency |
| `generate-leads` | `POST /api/leads` | LOW | Apify SDK call — straightforward |
| `generate-outreach` | `POST /api/outreach` | LOW | Direct Gemini SDK call |
| `parse-datasheet` | `POST /api/parse` | LOW | File parsing, no AI gateway dependency |
| `sync-gmail-calendar` | `POST /api/sync/gmail` | MEDIUM | Google API calls. OAuth token handling must align with Logto's Google social connector |
| `send-test-email` | `POST /api/email/test` | LOW | Resend SDK — trivial rewrite |
| `send-validation-email` | `POST /api/email/validate` | LOW | Resend SDK — trivial rewrite |

**Summary:** 21 functions → 13 HTTP routes + 6 BullMQ workers/scheduled jobs + 2 utility routes. The 6 scheduling-related functions are the highest complexity because they change architectural type (HTTP → background worker).

---

### Differentiators (Infrastructure Improvements Enabled by Migration)

These are not required for parity but are natural outcomes of the migration that improve the platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| BullMQ + Redis job scheduling | Persistent queue with retries, concurrency control, dead-letter queues. node-cron has no persistence — jobs lost on restart. BullMQ survives process crashes and Railway restarts. Replaces both pg_cron AND pgmq in one move — eliminates two custom Docker dependencies | MEDIUM | Railway has an official fastify-bullmq template. Redis is a first-class Railway service. HIGH confidence |
| Direct Gemini SDK access | Removes Lovable gateway dependency. Eliminates 10–50ms proxy latency overhead. Direct cost visibility via Google AI Studio billing. Access to latest model versions without waiting for gateway support | LOW | `@google/generative-ai` npm package. `gemini-2.0-flash` is the direct current equivalent |
| Logto OIDC provider capabilities | Acts as OAuth 2.1/OIDC provider for third-party integrations. Enables future MCP server auth, enterprise SSO, multi-tenant support. Supabase Auth cannot function as an OIDC provider at all | LOW (v2.1 scope is just email/password parity) | HIGH confidence — Logto docs confirmed. OIDC capabilities are available post-migration without additional work |
| Railway private networking | API server, LangGraph server, and Postgres communicate over Railway's internal network using `railway.internal` hostnames. Eliminates public TLS overhead for service-to-service calls | LOW | Railway docs confirmed. Zero-config after services are in the same project |
| Full Docker control over all services | API server containerized with reproducible builds. No cold-start limitations. Playwright/Chromium dependencies managed identically across LangGraph server and API server | LOW | Already established pattern from LangGraph server |
| Logto custom JWT claims | Embed `user_id`, `plan`, `role` directly into JWT payload. Eliminates extra DB roundtrips for authorization context on every request | LOW | Configured via Logto's custom claims API. Available immediately post-deployment |

---

### Anti-Features (Commonly Attempted, Create Serious Problems)

| Feature | Why Attempted | Why Problematic | Correct Alternative |
|---------|---------------|-----------------|---------------------|
| Keep pg_cron + pgmq on Railway Postgres | Preserve existing scheduling code exactly, avoid rewrite | Railway's default Postgres has no pg_cron. Requires custom Dockerfile with `postgresql-17-cron` apt package and `shared_preload_libraries` config. Any Railway Postgres version update can break the image. pgmq requires a separate Tembo Docker image or build-from-source — two separate custom images to maintain | Replace with BullMQ + Redis. BullMQ supports cron expressions natively (`repeat: { pattern: '0 8 * * *' }`). Migration is a one-time rewrite that eliminates ongoing maintenance of custom Docker images |
| Run Supabase Edge Runtime on Railway | Avoid rewriting 21 Deno functions | Railway explicitly states Edge Functions are incompatible with self-hosted Supabase on Railway. The Edge Runtime container works but lacks logs and functions management. Deno-specific imports (`esm.sh`, `npm:` specifiers) still need rewriting. Operational complexity without benefit | Rewrite functions as Express routes — this is the standard migration path |
| Replicate Supabase RLS in vanilla Postgres | Preserve row-level security at DB layer | Supabase RLS policies use `auth.uid()` and `auth.jwt()` which are functions in Supabase's `auth` schema. These do not exist on vanilla Postgres. Replicating the Supabase auth schema on Railway Postgres is a multi-day engineering effort and creates a maintenance nightmare | Express middleware with `WHERE user_id = $userId` is simpler, fully testable, and equivalent for a single-tenant-per-user model. Authorization belongs in the API layer, not the DB layer, when using a custom auth provider |
| Use Supabase Vault for API key secrets | Keep existing secret management pattern | Supabase Vault is Supabase-proprietary. No Railway equivalent exists. Bridging it requires keeping Supabase alive as a dependency, which defeats the migration | Railway environment variables are the correct replacement. Encrypted at rest, configurable per service, no additional service dependency |
| Use node-cron instead of BullMQ for scheduling | Simpler setup, no Redis dependency | node-cron has no persistence. Jobs are lost if the process restarts (Railway deploys cause restarts). The heartbeat-dispatcher and proactive-runner are the core value engine of Worryless AI — losing scheduled runs silently is a critical production failure mode | BullMQ with Redis. Jobs persist through restarts. Redis on Railway is a one-click service. The Railway fastify-bullmq template demonstrates the exact pattern |
| Keep Lovable gateway for AI calls after migration | Avoid model code changes | Lovable AI Gateway is tied to the Lovable platform. Post-migration, there is no Lovable — the gateway is inaccessible. "Nano Banana 2" does not exist outside Lovable. This is not optional to change | Direct `@google/generative-ai` SDK. Identify Imagen 3 or Stability AI as Nano Banana 2 replacement before image routes are built |

---

## Feature Dependencies

```
[1. Railway Postgres provisioned]
    └──with pgvector──> [2. pgvector embeddings / RAG works]
    └──migrations applied──> [3. All DB schemas exist]
                                 └──required by──> [4. LangGraph PostgresSaver + Store]
                                 └──required by──> [5. All Express API routes (DB queries)]
                                 └──required by──> [6. BullMQ workers (DB reads/writes)]

[7. BullMQ + Redis deployed on Railway]
    └──required by──> [8. heartbeat-dispatcher worker]
    └──required by──> [9. proactive-runner worker]
    └──required by──> [10. heartbeat-runner worker]
    └──required by──> [11. send-daily-briefing job]
    └──required by──> [12. send-morning-digest job]

[13. Logto deployed on Railway]
    └──required by──> [14. Express JWT middleware (jose + JWKS)]
                           └──required by──> [15. All 13 Express HTTP routes]
                           └──required by──> [16. Frontend auth flow]

[17. Direct Gemini SDK configured (API key in Railway env)]
    └──required by──> [18. generate-content route]
    └──required by──> [19. generate-outreach route]
    └──required by──> [20. planning-agent route]
    └──requires decision──> [21. Image model identified (Imagen 3 or Stability AI)]
                                 └──required by──> [22. generate-image route]
                                 └──required by──> [23. generate-invoice-image route]

[24. LangGraph server DATABASE_URL updated to Railway Postgres]
    └──required by──> [25. Chat persistence (PostgresSaver)]
    └──required by──> [26. Agent memory (LangGraph Store)]
    └──required by──> [27. SSE streaming to frontend]

[15. All Express HTTP routes complete]
    └──required by──> [28. Frontend supabase-js removal]
                           └──required by──> [29. Frontend auth rewired to Logto]
                           └──required by──> [30. Production deployment live]

[31. Google Cloud Console OAuth redirect URIs updated to Logto]
    └──required by──> [32. Google OAuth login works]
    └──required by──> [33. sync-gmail-calendar route works]
```

### Dependency Notes

- **Railway Postgres must be provisioned and migrations applied before any Express routes can be tested** — all 13 HTTP routes and 6 workers require an active DB connection.
- **BullMQ + Redis is a hard prerequisite for cadence engine parity** — without it, heartbeat and proactive runs do not fire. The platform is reactive-only and the core value proposition is broken.
- **Logto must issue JWTs before any end-to-end frontend testing is possible** — the entire auth flow is blocked until Logto is live.
- **Image model must be decided before generate-image routes can be completed** — Nano Banana 2 is Lovable-specific with no direct equivalent. This is the only external blocker that cannot be resolved by writing code.
- **LangGraph server is already on Railway and does not need migration** — it only needs DATABASE_URL updated to the new Postgres instance. This is a 5-minute env var change.
- **Google OAuth redirect URIs must be updated in Google Cloud Console** — this is a manual step outside the codebase and can block Gmail/Calendar integration testing if deferred.

---

## MVP Definition

### Launch With (v2.1 — Full Parity, All Items Required)

- [ ] Railway Postgres provisioned with pgvector — database foundation
- [ ] All 20+ SQL migrations applied, RLS directives stripped — schema matches v2.0
- [ ] Logto deployed on Railway, issuing JWTs — auth working
- [ ] Express JWT middleware validating Logto tokens — all routes protected
- [ ] BullMQ + Redis deployed — cadence engine functional
- [ ] All 21 Edge Functions converted (13 HTTP routes + 6 BullMQ workers + 2 utility) — full API surface
- [ ] Direct Gemini SDK replacing Lovable gateway — all LLM calls functional
- [ ] Image model replacement identified and integrated — image generation working
- [ ] LangGraph server DATABASE_URL updated to Railway Postgres — chat persistence works
- [ ] Frontend `@supabase/supabase-js` removed, all calls pointing to Railway API server
- [ ] Frontend auth flow wired to Logto (login, session refresh, logout)
- [ ] Google OAuth redirect URIs updated to Logto in Google Cloud Console
- [ ] All external API keys in Railway env vars (Firecrawl, Apify, Resend, Gemini, Google OAuth)
- [ ] VAPID keys generated and set in Railway env vars — push notifications work
- [ ] Health check endpoints on API server and LangGraph server — Railway zero-downtime deploys
- [ ] Custom domains configured for API server, LangGraph server, and frontend

### Critical Pre-Migration Decision

**Image generation model**: Nano Banana 2 is a Lovable proprietary model that does not exist outside the Lovable platform. This decision must be made before image generation routes can be completed:
- Option A: Gemini Imagen 3 via `@google/generative-ai` SDK — same vendor as text model, simpler key management
- Option B: Stability AI — higher quality options but additional vendor/key
- This is not optional. It blocks two routes (`generate-image`, `generate-invoice-image`).

### Add After Launch (v2.1.x)

- [ ] BullMQ dashboard (Bull Board) for job monitoring and visibility
- [ ] Railway private networking between API server and LangGraph server (public networking works at launch)
- [ ] Logto RBAC roles configured for future plan tiers
- [ ] Logto custom JWT claims (`user_id`, `plan` embedded in token)
- [ ] Logto as OIDC provider for MCP server auth

### Out of Scope

- New agent capabilities of any kind
- New tool integrations
- UI changes (except auth flow rewiring)
- Performance optimization beyond parity

---

## Feature Prioritization Matrix

| Migration Feature | User Impact if Missing | Implementation Cost | Priority |
|-------------------|----------------------|---------------------|----------|
| Railway Postgres + pgvector + migrations | Platform cannot start | MEDIUM | P1 |
| BullMQ + Redis (replaces pg_cron + pgmq) | Proactive cadence dead — platform reactive-only | MEDIUM | P1 |
| Logto auth deployed | Login broken | MEDIUM | P1 |
| Express JWT middleware | All routes unprotected or returning 401 | LOW | P1 |
| 13 HTTP Express routes | Core API surface broken | HIGH | P1 |
| 6 BullMQ workers/scheduled jobs | Scheduling broken | MEDIUM | P1 |
| Direct Gemini SDK | All LLM-dependent features broken | LOW | P1 |
| Image model replacement decision + integration | Image generation broken | MEDIUM | P1 |
| LangGraph server DATABASE_URL update | Chat persistence and agent memory broken | LOW | P1 |
| Frontend auth rewire (Logto) | Users cannot log in | MEDIUM | P1 |
| Frontend API base URL update | All API calls fail | LOW | P1 |
| Google OAuth redirect URI update | Gmail/Calendar integration broken | LOW | P1 |
| External API keys in Railway env | Firecrawl, Apify, Resend calls fail | LOW | P1 |
| VAPID keys | Push notifications broken | LOW | P2 |
| Health check endpoints | Zero-downtime deploys degrade | LOW | P2 |
| Custom domains | Platform works on Railway-generated URLs | LOW | P2 |
| Railway private networking | Works on public networking | LOW | P3 |
| Logto RBAC | Not needed for v2.1 single user type | LOW | P3 |
| BullMQ dashboard | Operational visibility only | LOW | P3 |

**Priority key:**
- P1: Platform non-functional without this — must ship before v2.1 is live
- P2: Feature degraded — ship within first week post-launch
- P3: Enhancement — post-launch backlog

---

## Complexity Summary by Migration Area

| Area | Overall Complexity | Key Reason |
|------|--------------------|------------|
| Database (Postgres + extensions) | MEDIUM | pgvector needs custom image; pg_cron/pgmq replacement with BullMQ is one-time rewrite |
| Auth (Logto replacing Supabase Auth) | MEDIUM | One-click Railway deploy; Express middleware pattern is well-documented; Google OAuth redirect update is manual |
| API Layer (21 functions → Express) | HIGH | Volume of work (21 conversions) plus 6 scheduling functions changing architectural type (HTTP → background worker) |
| AI Model (direct Gemini + image swap) | LOW-MEDIUM | Text SDK is straightforward; image model is a forced external decision |
| Frontend (supabase-js removal) | MEDIUM | All data fetching hooks and auth flows must be rewritten; no Supabase realtime subscriptions in this app reduces scope |
| LangGraph server | LOW | Already on Railway; only DATABASE_URL change needed |

---

## Sources

- [Railway PostgreSQL Docs](https://docs.railway.com/databases/postgresql) — confirmed: pgvector not in default template, custom Dockerfile required for pg_cron/pgmq
- [Railway pgvector marketplace template](https://railway.com/deploy/pgvector-latest) — pre-configured pgvector image
- [Railway Blog: Hosting Postgres with pgvector](https://blog.railway.com/p/hosting-postgres-with-pgvector) — extension strategy and tradeoffs
- [pgmq GitHub (Tembo)](https://github.com/pgmq/pgmq) — Tembo Docker image is simplest pgmq installation path
- [PGMQ with Docker setup guide](https://userjot.com/blog/using-postgres-docker-pgmq-message-queue) — confirmed Tembo image approach
- [Railway fastify-bullmq official template](https://github.com/railwayapp-templates/fastify-bullmq) — BullMQ + Redis on Railway
- [BullMQ Job Schedulers docs](https://docs.bullmq.io/guide/job-schedulers) — cron expression support confirmed
- [BullMQ vs node-cron production comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) — persistence critical for production
- [Logto vs Supabase Auth — Logto blog](https://blog.logto.io/supabase-ai-limitation) — Logto provides OIDC provider, RBAC, multi-tenant; Supabase Auth cannot act as OIDC provider
- [Logto Express JWT protection docs](https://docs.logto.io/api-protection/nodejs/express) — `jose` JWKS middleware pattern confirmed
- [Deploy Logto on Railway](https://railway.com/deploy/logto) — one-click Railway template confirmed
- [Railway Express deployment guide](https://docs.railway.com/guides/express) — Express on Railway patterns
- [Railway Node.js + Express with autoscaling + zero-downtime](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) — health check and zero-downtime pattern
- [Supabase vs Railway 2026 comparison](https://www.buildmvpfast.com/compare/supabase-vs-railway) — migration context
- [Gemini API pricing 2026](https://ai.google.dev/gemini-api/docs/pricing) — direct API cost baseline
- [AI Gateway latency overhead 2026](https://dev.to/pranay_batta/top-5-cloudflare-ai-gateway-alternatives-in-2026-521e) — 10–50ms proxy overhead confirmed; direct SDK eliminates this

---

*Feature research for: Worryless AI v2.1 — Railway Deployment Migration*
*Researched: 2026-03-21*
