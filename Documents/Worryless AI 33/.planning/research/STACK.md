# Stack Research

**Domain:** Self-hosted Railway deployment migration — Worryless AI v2.1
**Researched:** 2026-03-21
**Confidence:** HIGH (all versions verified against GitHub releases and official npm/docs sources)

---

> **NOTE:** This file was updated for v2.1 (Railway Migration milestone). The original v2.0 Supabase stack research is preserved below the v2.1 section for reference during migration.

---

## v2.1 — Railway Migration: New Stack Additions

### What Already Exists (Do Not Re-add)

The LangGraph server (`worrylesssuperagent/langgraph-server/`) has these installed — verified from `package.json`:

| Package | Installed Version | Status |
|---------|------------------|--------|
| `express` | `^4.21.0` | API server foundation — extend this for all Edge Function conversions |
| `@google/genai` | `^1.46.0` | Gemini integration is already present — configuration change only |
| `pg` | `^8.13.0` | PostgreSQL client — use for all direct DB queries replacing Supabase client |
| `@langchain/langgraph` | `^1.2.3` | Already deployed on Railway |
| `zod` | `^3.25.32` | Already installed |

The frontend has this to replace:

| Package | Status | Action |
|---------|--------|--------|
| `@supabase/supabase-js ^2.86.0` | Remove | Replace with `@logto/react` + direct `fetch()` calls to Express API |

---

### New Packages Required

#### Authentication: Logto (Replaces Supabase Auth)

Logto is an OIDC/OAuth 2.1 compliant identity server with a self-hosted Docker image. It is purpose-built for production self-hosting, ships its own Admin Console on port 3002, and uses PostgreSQL as its only external dependency — which means it can share the same Railway PostgreSQL instance using a dedicated `logto` database schema, avoiding a second database service.

| Package | Version | Where | Purpose |
|---------|---------|-------|---------|
| `@logto/react` | `^4.0.13` | Frontend (`worrylesssuperagent/`) | `LogtoProvider`, `useLogto()`, `useHandleSignInCallback()` hooks for React SPA auth flow |
| `jose` | `^6.2.2` | Express API server | JWKS-based JWT verification middleware — fetch the JWKS from Logto once, verify each request locally with zero roundtrips |

**Why `jose` not `@logto/node` or `@logto/express`:** The `@logto/node` SDK (v3.1.9) and `@logto/express` SDK (v3.0.11) are designed for server-side session-based auth flows (Next.js App Router, Express SSR with cookie sessions). The Express API server is a stateless JWT-validating service — `jose` is the correct tool and what Logto's own official documentation recommends for Express API protection.

**Install — Frontend:**
```bash
npm install @logto/react
npm uninstall @supabase/supabase-js   # remove when migration complete
```

**Install — Express API server:**
```bash
npm install jose
```

**Logto deployment on Railway (Docker service, no npm):**
```
Image: logto/logto:latest
Ports: 3001 (auth service public), 3002 (admin console — internal only)
Required env: DB_URL (Railway PostgreSQL), ENDPOINT (https://auth.yourdomain.com)
Optional env: ADMIN_ENDPOINT (https://logto-admin.yourdomain.com)
One-time init: npx @logto/cli db seed (runs against DB_URL to create Logto schema)
```

**JWT middleware pattern (Express API server):**
```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.LOGTO_ENDPOINT}/oidc/jwks`)
);

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.LOGTO_ENDPOINT + "/oidc",
      audience: process.env.LOGTO_API_RESOURCE,
    });
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
```

---

#### Web Push Notifications: web-push (VAPID)

`web-push` is the standard Node.js library for the Web Push Protocol (RFC 8030 + RFC 8292 VAPID). It handles key generation and sending push messages to browser endpoints. It lives in the Express API server alongside existing push subscription routes.

| Package | Version | Where | Purpose |
|---------|---------|-------|---------|
| `web-push` | `^3.6.5` | Express API server | VAPID key generation, sending push notifications to stored browser `PushSubscription` objects |

**Install — Express API server:**
```bash
npm install web-push
npm install -D @types/web-push
```

**VAPID key generation (run once, store as Railway env vars):**
```typescript
import webpush from "web-push";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
// Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Railway environment
```

**Sending a push notification:**
```typescript
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_SUBJECT}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

await webpush.sendNotification(
  subscription,   // stored PushSubscription from browser
  JSON.stringify({ title: agentName, body: finding, url: "/dashboard" })
);
```

**Why `web-push` not a custom implementation:** RFC 8292 VAPID requires ECDH + AES-128-GCM encryption that is error-prone to implement manually. `web-push` is the de-facto standard with 10M+ weekly downloads and the same library used in the existing Supabase Edge Functions research (v2.0).

---

#### Gemini API: @google/genai (Already Installed — Config Only)

The LangGraph server already has `@google/genai ^1.46.0` installed (verified from `langgraph-server/package.json`). No new npm install is needed.

**The only migration work is configuration:**
1. Remove `LOVABLE_AI_GATEWAY_URL` + gateway auth header pattern
2. Set `GEMINI_API_KEY` environment variable (Google AI Studio)
3. Update model string to `"gemini-2.5-flash"` (confirmed supported by `@google/genai ^1.46.0`)
4. Image generation: Replace "Nano Banana 2" gateway with Gemini Imagen via same SDK — model string `"imagen-3.0-generate-002"`

**Do NOT install `@google/generative-ai`** — that package was deprecated August 2025 and Google ended all support. `@google/genai` is the correct replacement and is already installed.

---

#### Scheduled Tasks: pg_cron (Keep Existing — No New Packages)

Railway PostgreSQL supports `pg_cron` natively via its pre-built Docker images, confirmed by Railway's own "pgcron-railway" deployment template. The existing heartbeat dispatcher architecture (`pg_cron` → `pgmq` → LangGraph execution) can be carried over unchanged.

**Decision: Do NOT add BullMQ or node-cron for v2.1.**

Adding BullMQ requires a Redis service (additional Railway cost and complexity) and a complete rewrite of the SQL-based heartbeat dispatcher into Node.js worker code. This is unnecessary scope — the migration goal is platform move, not architecture redesign.

**If pg_cron is unavailable** on the chosen Railway PostgreSQL configuration (unlikely but possible): use `node-cron ^4.2.1` inside the Express API server as fallback. It is TypeScript-native (migrated in v4), requires no Redis, and uses the same cron syntax. No install until/unless this fallback is confirmed needed.

**BullMQ reference (do not add for v2.1):**

| Package | Version | Notes |
|---------|---------|-------|
| `bullmq` | `^5.71.0` | Defer — only if horizontal API server scaling becomes a requirement |
| `ioredis` | `^5.10.1` | Required peer dependency for BullMQ — would require Railway Redis service |
| `node-cron` | `^4.2.1` | Fallback only if Railway pg_cron unavailable |

---

#### Database: Railway PostgreSQL (No New npm Packages)

Railway's PostgreSQL service supports both `pgvector` and `pg_cron` natively via their pre-built Docker images. The existing `pg ^8.13.0` in the LangGraph server handles all direct database access.

**Recommended Railway setup:**
1. Deploy using the "pgvector 18 trixie" Railway template — PostgreSQL 18 with pgvector pre-installed
2. Enable pg_cron: `CREATE EXTENSION IF NOT EXISTS pg_cron;`
3. Apply all 20+ existing Supabase migrations via `psql $DATABASE_URL -f migration.sql` in order
4. RLS is removed — replace with Express middleware `user_id` extraction from JWT

---

#### Edge Functions to Express Routes: No New Packages

All 21 Supabase Edge Functions (Deno) convert to Express routes using packages already in the LangGraph server. The key transformation patterns:

| Deno / Supabase Pattern | Express Equivalent |
|------------------------|-------------------|
| `Deno.serve(req => ...)` | `app.post('/route', handler)` |
| `Deno.env.get('KEY')` | `process.env.KEY` |
| `supabaseClient.auth.getUser(jwt)` | `jose` JWKS middleware (see above) |
| Supabase RLS (row-level security) | `WHERE user_id = $1` with `req.user.id` from JWT |
| `supabaseClient.from('table').select()` | `pg.query('SELECT ... WHERE user_id = $1', [req.user.id])` |
| `EdgeRuntime.waitUntil()` | Node.js async — no equivalent needed; process runs until response |
| CORS preflight (`OPTIONS`) | `cors()` middleware or manual handler |

No additional packages needed beyond `express ^4.21.0`, `pg ^8.13.0`, and `jose`.

---

### Complete New Package Summary

**Express API server (new packages only):**
```bash
npm install jose web-push
npm install -D @types/web-push
```

**Frontend (new + remove):**
```bash
npm install @logto/react
# After migration is verified complete:
npm uninstall @supabase/supabase-js
```

**Logto service:** Docker only — `logto/logto:latest` — no npm.

---

### Railway Service Architecture (v2.1 Target)

```
Railway Project
├── postgres (Railway managed — "pgvector 18 trixie" template)
│   ├── Extensions: pgvector, pg_cron, pgmq
│   ├── Schema: public (app data — existing migrations)
│   ├── Schema: langgraph (checkpoints, store — existing)
│   └── Schema: logto (Logto identity — seeded by Logto CLI)
│
├── logto (Docker: logto/logto:latest)
│   ├── Port 3001 → auth.yourdomain.com (public)
│   └── Port 3002 → admin console (internal only, not public)
│
├── api-server (Node.js/Express — new Railway service)
│   ├── Replaces: 21 Supabase Edge Functions
│   ├── Auth middleware: jose JWKS → Logto
│   ├── Push: web-push VAPID
│   ├── DB: pg direct queries (user_id from JWT)
│   └── Key env vars: LOGTO_ENDPOINT, LOGTO_API_RESOURCE, GEMINI_API_KEY,
│                     DATABASE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
│                     FIRECRAWL_API_KEY, APIFY_API_KEY, RESEND_API_KEY
│
├── langgraph-server (existing Railway service — minor config change)
│   ├── No new packages needed
│   └── Config change: remove LOVABLE_AI_GATEWAY_URL, add GEMINI_API_KEY
│
└── frontend (Railway static deploy via Nixpacks or Vite build)
    ├── Replace: @supabase/supabase-js → @logto/react + direct fetch()
    └── Key env vars: VITE_API_URL, VITE_LOGTO_ENDPOINT, VITE_LOGTO_APP_ID,
                      VITE_VAPID_PUBLIC_KEY
```

---

### New Environment Variables

| Variable | Service | Notes |
|----------|---------|-------|
| `LOGTO_ENDPOINT` | API server, Frontend | `https://auth.yourdomain.com` |
| `LOGTO_APP_ID` | Frontend | Created in Logto Admin Console |
| `LOGTO_APP_SECRET` | API server | Created in Logto Admin Console |
| `LOGTO_API_RESOURCE` | API server | The API resource identifier registered in Logto |
| `VAPID_PUBLIC_KEY` | API server, Frontend | Generated once via `webpush.generateVAPIDKeys()` |
| `VAPID_PRIVATE_KEY` | API server | Keep secret — never expose to frontend |
| `VAPID_SUBJECT` | API server | `mailto:you@yourdomain.com` |
| `GEMINI_API_KEY` | LangGraph server, API server | Google AI Studio key |
| `DB_URL` | Logto service | Railway PostgreSQL connection string (Logto's expected var name) |

Variables already in LangGraph server (carry forward unchanged): `DATABASE_URL`, `FIRECRAWL_API_KEY`, `APIFY_API_KEY`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

---

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `jose` for JWT verification | `@logto/node` (v3.1.9) | `@logto/node` is session-based (SSR). Stateless JWT API should verify tokens directly via JWKS — `jose` is what Logto's own Express docs use |
| `jose` for JWT verification | `@logto/express` (v3.0.11) | Same problem — session middleware, not for stateless APIs |
| pg_cron (keep existing) | BullMQ + Redis | pg_cron is available natively on Railway. Adding Redis is a new service cost with zero benefit for v2.1 |
| pg_cron (keep existing) | `node-cron` | Both are fine. pg_cron keeps scheduling in SQL where it currently lives; node-cron is the fallback if pg_cron is unavailable on the chosen plan |
| `@google/genai` (already installed) | `@google/generative-ai` | Officially deprecated August 2025 — do not use |
| Logto OSS (self-hosted) | Auth0, Clerk, Supabase Cloud Auth | Cloud-managed auth providers defeat the purpose of the Railway self-hosting migration |
| Logto OSS (self-hosted) | Keycloak | Java-based, significantly heavier, steeper config curve for a small deployment |
| `web-push` | Firebase FCM | Adds Google dependency, Firebase project, SDK overhead. Native VAPID works in all modern browsers |

---

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| BullMQ + ioredis (v2.1) | Adds Redis as new Railway service when pg_cron already handles scheduling natively | pg_cron (existing), or node-cron v4 as fallback |
| `@logto/node` or `@logto/express` | Session-based SDK; wrong abstraction for stateless JWT API | `jose` with JWKS verification (20 lines, no strategy objects) |
| `@supabase/supabase-js` on API server | This is being removed from the platform — don't bring it onto the Express server | Direct `pg` queries (already installed) |
| `passport` or `passport-jwt` | Over-engineered for single-IdP JWT validation | `jose` middleware |
| `prisma` or `typeorm` | ORM adds a migration toolchain on top of 20+ raw SQL migrations already written | Direct `pg` queries (existing pattern in LangGraph server) |
| `@google/generative-ai` | Deprecated August 2025, Google ended all support | `@google/genai` (already installed at ^1.46.0) |
| `cors` npm package | express built-in `res.setHeader` is sufficient for single-origin use; full `cors` package is optional | Manual CORS headers or add `cors` if multi-origin needed |

---

### Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@logto/react` | `^4.0.13` | React `^18.3.1` | Works with React 18; also compatible with React 19 |
| `jose` | `^6.2.2` | Node.js `>=18`, `"type": "module"` | ESM-first; fully compatible with `"type": "module"` already set in langgraph-server |
| `web-push` | `^3.6.5` | Node.js `>=14` | CommonJS module; works with `esModuleInterop: true` already configured |
| `@google/genai` | `^1.46.0` | Node.js `>=18`, Gemini 2.5 Flash, Imagen 3 | Already installed; current latest is 1.46.0 (verified March 18, 2026) |
| `bullmq` | `^5.71.0` | `ioredis ^5.10.1`, Node.js `>=18` | Do not add for v2.1 — listed for reference only |
| `node-cron` | `^4.2.1` | Node.js `>=18` | TypeScript-native since v4 — fallback only |

---

## Sources (v2.1 Research)

- [Logto React quickstart](https://docs.logto.io/quick-starts/react) — `@logto/react` package, hooks API; version 4.0.13 confirmed via npm search
- [Logto Express API protection](https://docs.logto.io/api-protection/nodejs/express) — `jose` recommended by Logto for stateless Express JWT validation
- [Logto deployment and configuration](https://docs.logto.io/logto-oss/deployment-and-configuration) — environment variables, port architecture (3001/3002), DB_URL requirement
- [Railway PostgreSQL docs](https://docs.railway.com/databases/postgresql) — extension support confirmed
- [Railway pgvector blog post](https://blog.railway.com/p/hosting-postgres-with-pgvector) — pgvector template details, container-based extension control
- [Railway pgcron template](https://railway.com/deploy/pgcron-railway) — pg_cron native availability on Railway confirmed
- [Railway Redis docs](https://docs.railway.com/databases/redis) — `REDIS_URL`, `REDISHOST`, `REDISPORT`, `REDISPASSWORD` env vars
- [Google Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries) — `@google/genai` is current recommended SDK (GA May 2025)
- [googleapis/js-genai releases](https://github.com/googleapis/js-genai/releases) — v1.46.0 latest (March 18, 2026) — VERIFIED
- [google-gemini/deprecated-generative-ai-js](https://github.com/google-gemini/deprecated-generative-ai-js) — `@google/generative-ai` deprecated August 2025 — VERIFIED
- [BullMQ GitHub releases](https://github.com/taskforcesh/bullmq/releases) — v5.71.0 latest (March 11, 2026) — VERIFIED
- [web-push GitHub releases](https://github.com/web-push-libs/web-push/releases) — v3.6.5 latest — VERIFIED
- [panva/jose GitHub releases](https://github.com/panva/jose/releases) — v6.2.2 latest — VERIFIED
- [@logto/react, @logto/node npm search](https://www.npmjs.com/package/@logto/react) — v4.0.13 and v3.1.9 confirmed via npm search results
- [node-cron GitHub releases](https://github.com/node-cron/node-cron/releases) — v4.2.1 latest, TypeScript-native since v4 — VERIFIED
- [ioredis npm](https://www.npmjs.com/package/ioredis) — v5.10.1 latest — reference only

---

---

## v2.0 — Original Supabase Stack Research (Preserved for Migration Reference)

> The following sections document the Supabase-based stack from v2.0. Preserved to assist the v2.1 migration — understanding what each Edge Function did helps with the Express conversion.

**Project:** Worryless AI (multi-agent automation SaaS)
**Original milestone:** Agent MD workspaces, heartbeat scheduling fan-out, dynamic agent catalog, push notifications, streaming AI responses
**Researched:** 2026-03-12
**Overall confidence:** HIGH

---

### 1. pg_cron Fan-Out Scheduling (Supabase — Being Replaced)

> **v2.1 note:** The pg_cron + pgmq pattern is being migrated to Railway PostgreSQL (pg_cron available natively). The dispatcher SQL and queue patterns transfer with minimal changes — replace Supabase Vault secret lookups with direct env vars in the Express heartbeat endpoint.

**Architecture:**
```
pg_cron (1 job, every 5 min)
  └── heartbeat-dispatcher edge function → heartbeat-runner edge function
        └── reads agent_heartbeat_schedule table
        └── enqueues due agents → pgmq queue ("heartbeat_jobs")
              └── heartbeat-runner polls every 1 min via second cron
```

Key pattern: Single dispatcher cron + pgmq queue prevents hitting the 8-job concurrent limit. HEARTBEAT_OK suppression cuts DB writes ~90%.

---

### 2. Markdown Storage in PostgreSQL

**Decision:** `text` column + `GENERATED ALWAYS AS tsvector` + GIN index. This pattern transfers unchanged to Railway PostgreSQL.

```sql
create table agent_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,   -- v2.1: no auth.users reference; validate via JWT
  agent_type text not null,
  file_name text not null,
  content text not null default '',
  content_fts tsvector generated always as (
    to_tsvector('english', content)
  ) stored,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, agent_type, file_name)
);
create index agent_workspaces_fts_idx on agent_workspaces using gin(content_fts);
```

---

### 3. Push/Email Notifications (Supabase — Being Replaced)

**Email:** Resend (already integrated, carries forward unchanged via Express route).

**Browser Push:** Native Web Push API + VAPID. The `web-push ^3.6.5` npm package (see v2.1 section above) replaces the Deno JSR `@negrel/webpush` that was used in Edge Functions.

---

### 4. Streaming AI Responses

**Pattern:** SSE via Express `res.write()`. The frontend already uses raw `fetch()` (not `supabase.functions.invoke()`) for streaming — no frontend change needed for the streaming mechanism. Only the URL changes (`VITE_SUPABASE_URL/functions/v1/...` → `VITE_API_URL/...`).

---

### 5. Supabase-Specific Features (Being Removed)

| Feature | Supabase Implementation | Railway Replacement |
|---------|------------------------|---------------------|
| Auth | Supabase Auth (JWTs via `auth.users`) | Logto (OIDC, JWTs via `jose`) |
| RLS | `auth.uid()` in SQL policies | `WHERE user_id = $1` with JWT `sub` in Express |
| Realtime broadcast | `supabase.channel().on('broadcast', ...)` | Direct SSE or polling from Express |
| Edge Functions | Deno runtime, Supabase secrets | Express routes, Railway env vars |
| pg_cron | Managed by Supabase Dashboard | `CREATE EXTENSION pg_cron` on Railway PostgreSQL |
| pgmq | Via `pgmq_public` schema | Same extension on Railway PostgreSQL |
| Vault (secrets) | `vault.decrypted_secrets` | Railway environment variables |

---

*Stack research updated: 2026-03-21 — v2.1 Railway migration additions*
*Original v2.0 research: 2026-03-12*
