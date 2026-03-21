# Architecture Research

**Domain:** Multi-agent SaaS platform — Railway deployment migration (Supabase → Railway self-hosted)
**Researched:** 2026-03-21
**Confidence:** HIGH (Railway official docs verified, Logto official docs verified, existing codebase inspected directly)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          PUBLIC INTERNET                                  │
│                                                                           │
│   Browser → frontend.railway.app (static SPA)                            │
│   Browser → api.railway.app      (REST + SSE)                            │
│   Browser → logto.railway.app    (OIDC login page)                       │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │  HTTPS (public Railway domains)
┌──────────────────────────────────────────────────────────────────────────┐
│                   RAILWAY PROJECT — private network                       │
│                                                                           │
│  ┌─────────────┐   ┌──────────────────┐   ┌───────────────────────────┐ │
│  │  Frontend   │   │   API Server     │   │     LangGraph Server      │ │
│  │ (Nginx SPA) │   │ (Express/Node)   │   │   (Express/Node Docker)   │ │
│  │  Port 80    │   │   Port 8080      │   │       Port 3001           │ │
│  └─────────────┘   └────────┬─────────┘   └──────────────┬────────────┘ │
│                             │ private                     │ private       │
│                             │ .railway.internal           │               │
│  ┌─────────────┐   ┌────────▼─────────┐   ┌─────────────▼────────────┐ │
│  │    Logto    │   │   PostgreSQL      │   │          Redis            │ │
│  │ (Docker)    │   │  (Railway PG)     │   │     (Railway Redis)       │ │
│  │  Port 3002  │   │   Port 5432       │   │       Port 6379           │ │
│  └─────────────┘   └──────────────────┘   └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Total services: 6**
1. `frontend` — Nginx serving Vite build (static)
2. `api-server` — Express, replaces all 23 Supabase Edge Functions
3. `langgraph-server` — existing Express server (already on Railway), add cadence scheduler
4. `postgres` — Railway managed PostgreSQL (same DB, migrated data)
5. `redis` — Railway managed Redis (BullMQ queues replace pgmq)
6. `logto` — self-hosted Docker (replaces Supabase Auth)

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **frontend** | Serve Vite SPA, handle browser routing via Nginx try_files | Browser only (static) |
| **api-server** | Auth middleware (Logto JWT verify), all 23 former Edge Function routes, user data CRUD, enqueue BullMQ jobs | postgres (direct), redis (BullMQ), langgraph-server (internal HTTP), external APIs |
| **langgraph-server** | LangGraph graph execution, SSE streaming, PostgresSaver checkpointing, Store memory, cadence dispatcher+worker (BullMQ) | postgres (direct), redis (BullMQ worker), external AI/tool APIs |
| **postgres** | All application data + langgraph schema (checkpoints, store, threads) | api-server, langgraph-server |
| **redis** | BullMQ queue persistence for heartbeat jobs (replaces pgmq) | api-server (enqueue), langgraph-server (consume) |
| **logto** | OIDC/OAuth 2.1 identity provider, JWT issuance, user management UI | api-server (JWKS verification), browser (login flow) |

---

## Service Topology Detail

### Service 1: Frontend (Nginx)

**What it is:** Vite build output served by Nginx Docker container. Railway has a one-click Vite+React template and an NGINX static site template.

**Why Nginx over Railway's static hosting:** Railway's native static hosting works for simple SPAs but Nginx gives full control over cache headers, SPA fallback (`try_files $uri /index.html`), and future reverse proxy if needed.

**Configuration:**
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**Railway env vars required:**
- `VITE_API_URL` — public URL of api-server (injected at build time via `${{api-server.RAILWAY_PUBLIC_DOMAIN}}`)
- `VITE_LOGTO_ENDPOINT` — public Logto URL
- `VITE_LOGTO_APP_ID` — Logto application client ID

**Status:** NEW service (not currently on Railway)

---

### Service 2: API Server (Express/Node.js)

**What it is:** New Express application that replaces all 23 Supabase Edge Functions. NOT merged into the existing LangGraph server — see rationale below.

**Why separate from LangGraph server:**
- LangGraph server runs long-duration streaming connections (SSE, agent graph walks taking 30–120s). CPU-intensive.
- API server runs short CRUD requests (< 500ms). Different scaling profiles.
- Playwright is installed in LangGraph server Docker image. Keeping API server lean avoids a 1GB+ Docker image for simple routes.
- LangGraph server is already deployed and tested. Merging risks regressions.
- Railway can scale each service independently.

**23 Edge Functions → Express route mapping:**

| Edge Function | Express Route | Router File |
|--------------|---------------|-------------|
| `chat-with-agent` | `POST /api/chat` | `routes/chat.ts` |
| `orchestrator` | `POST /api/orchestrate` | `routes/chat.ts` |
| `langgraph-proxy` | `POST /api/langgraph/*` | `routes/langgraph-proxy.ts` |
| `spawn-agent-team` | `POST /api/agents/spawn` | `routes/agents.ts` |
| `crawl-business-website` | `POST /api/business/crawl` | `routes/business.ts` |
| `parse-datasheet` | `POST /api/business/parse-datasheet` | `routes/business.ts` |
| `generate-content` | `POST /api/generate/content` | `routes/generate.ts` |
| `generate-image` | `POST /api/generate/image` | `routes/generate.ts` |
| `generate-invoice-image` | `POST /api/generate/invoice-image` | `routes/generate.ts` |
| `generate-leads` | `POST /api/leads` | `routes/leads.ts` |
| `generate-outreach` | `POST /api/outreach` | `routes/outreach.ts` |
| `heartbeat-dispatcher` | Internal (BullMQ scheduler) | `cadence/dispatcher.ts` |
| `heartbeat-runner` | Internal (BullMQ worker) | `cadence/worker.ts` |
| `proactive-runner` | Internal (BullMQ worker) | `cadence/worker.ts` |
| `run-scheduled-tasks` | `POST /api/tasks/run` | `routes/tasks.ts` |
| `planning-agent` | `POST /api/planning` | `routes/planning.ts` |
| `sync-gmail-calendar` | `POST /api/integrations/google/sync` | `routes/integrations.ts` |
| `send-daily-briefing` | Internal (BullMQ scheduler) | `cadence/briefing.ts` |
| `send-morning-digest` | Internal (BullMQ scheduler) | `cadence/briefing.ts` |
| `send-test-email` | `POST /api/email/test` | `routes/email.ts` |
| `send-validation-email` | `POST /api/email/validation` | `routes/email.ts` |

**Note on heartbeat/proactive runners:** These were HTTP-triggered by pg_cron via `net.http_post`. In Railway, they become BullMQ jobs dispatched internally — no HTTP endpoints needed.

**Auth middleware replaces RLS:**
```typescript
// All /api/* routes gated by this middleware
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.LOGTO_ENDPOINT}/oidc/jwks`)
);

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${process.env.LOGTO_ENDPOINT}/oidc`,
    audience: process.env.LOGTO_API_RESOURCE,
  });
  req.userId = payload.sub;  // replaces auth.uid() from RLS
  next();
}
```

**What replaces RLS:** Every database query in API routes filters by `req.userId` (the `sub` claim from Logto JWT). Pattern: `WHERE user_id = $1` with `req.userId`. No Supabase client — use `pg` (node-postgres) or `postgres.js` directly.

**Railway env vars required:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
LANGGRAPH_SERVER_URL=http://langgraph-server.railway.internal:3001
LOGTO_ENDPOINT=https://logto.railway.app   # or custom domain
LOGTO_APP_ID=...
LOGTO_APP_SECRET=...
LOGTO_API_RESOURCE=https://api.worryless.ai
GEMINI_API_KEY=...
RESEND_API_KEY=...
FIRECRAWL_API_KEY=...
APIFY_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

**Status:** NEW service — does not exist yet

---

### Service 3: LangGraph Server (existing, extended)

**What it already does:** Express server with LangGraph graph execution, SSE streaming, PostgresSaver, Store, thread management. Already deployed on Railway.

**What changes in v2.1:**
1. `DATABASE_URL` points to new Railway PostgreSQL service (same schema, migrated data)
2. Lovable AI Gateway replaced with direct `GEMINI_API_KEY`
3. BullMQ cadence scheduler+worker **added** to this process (not a separate service)
4. No new HTTP endpoints added — cadence runs internally

**Why cadence scheduler lives in LangGraph server (not API server):**
- Cadence workers invoke `graph.invoke()` directly — they need the LangGraph graph in-process
- Avoids HTTP round-trips between API server and LangGraph server for proactive runs
- pgmq queue (currently consumed by `heartbeat-runner` Edge Function) is replaced by BullMQ queue backed by Redis; the LangGraph server is the natural consumer

**Cadence architecture (replaces pg_cron + pgmq):**

```
node-cron (in-process, LangGraph server)
  ├── every 5 min: dispatcher scans user_agents for due heartbeats
  │     └── adds BullMQ jobs to 'heartbeat_jobs' queue (Redis)
  └── every 1 hr: morning digest dispatcher
        └── adds BullMQ jobs to 'digest_jobs' queue (Redis)

BullMQ Worker (in-process, LangGraph server)
  ├── 'heartbeat_jobs' worker → calls graph.invoke() for each due agent
  └── 'digest_jobs' worker → compiles digest, sends via Resend
```

**node-cron vs BullMQ split:**
- `node-cron` handles the scheduling tick (replaces pg_cron) — lightweight, no persistence needed for the tick itself
- `BullMQ` handles job execution with retry, concurrency control, and persistence (replaces pgmq) — jobs survive restarts
- Together they mirror the pg_cron → pgmq pattern exactly

**Playwright volume mount:**
- Railway volume mounted at `/playwright-data` (configurable)
- Chromium user data dir: `/playwright-data/chromium-profiles/{user_id}`
- Set `RAILWAY_RUN_UID=0` on LangGraph server service to avoid permission errors (Railway volume mounts as root)
- Volume size: start at 5GB (Hobby), expand as needed

**Railway env vars added/changed:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_API_KEY=...                          # replaces LOVABLE_API_KEY
PLAYWRIGHT_DATA_DIR=/playwright-data        # volume mount path
RAILWAY_RUN_UID=0                           # volume permission fix
```

**Status:** EXISTING service on Railway — modify env vars, add cadence module, mount volume

---

### Service 4: PostgreSQL (Railway managed)

**What it is:** Railway's managed PostgreSQL. Replaces Supabase PostgreSQL.

**Schema migration path:**
1. Provision Railway Postgres
2. Run all 20+ migrations from `supabase/migrations/` in chronological order
3. Drop/skip Supabase-specific extensions: `auth.*` tables (Logto owns auth now), `vault.*`, `pg_net` (not needed — no outbound HTTP from SQL)
4. Keep: `pgvector` (needed for embeddings — Railway Postgres 15+ supports it natively), all application tables, `langgraph` schema
5. Remove: `pgmq.*` calls (queuing moves to BullMQ), `cron.*` calls (scheduling moves to node-cron), `net.*` calls (no HTTP from SQL needed)

**Connection notes:**
- LangGraph server's `PostgresSaver` requires the **direct** connection string (port 5432), not a pooled connection. PostgresSaver uses prepared statements incompatible with PgBouncer transaction pooling. Railway's `DATABASE_URL` references the direct port — this is fine.
- API server uses connection pooling via `postgres.js` pool (safe for regular queries)

**Reference variable:** `DATABASE_URL=${{Postgres.DATABASE_URL}}` — inject into both api-server and langgraph-server

**Status:** NEW service — provision and migrate

---

### Service 5: Redis (Railway managed)

**What it is:** Railway's managed Redis. Provides BullMQ queue backing.

**Queues:**

| Queue | Producer | Consumer | Replaces |
|-------|----------|----------|---------|
| `heartbeat_jobs` | node-cron dispatcher (LangGraph server) | BullMQ worker (LangGraph server) | pgmq `heartbeat_jobs` |
| `digest_jobs` | node-cron scheduler (LangGraph server) | BullMQ worker (LangGraph server) | pg_cron morning digest |

**Note:** Redis is used for BullMQ only. No session storage (Logto manages JWT sessions statelessly). No caching layer added in v2.1.

**Reference variable:** `REDIS_URL=${{Redis.REDIS_URL}}` — inject into langgraph-server (and api-server if manual job triggers are needed)

**Status:** NEW service — provision

---

### Service 6: Logto (self-hosted Docker)

**What it is:** Open-source OIDC/OAuth 2.1 identity provider. Replaces Supabase Auth. Railway has a one-click Logto deploy template at `railway.com/deploy/logto`.

**Deployment:** Separate Docker service in Railway project. Logto requires its own PostgreSQL database. Use the same Railway Postgres instance with a separate `logto` schema, or provision a second Postgres service (recommended for isolation — avoids schema conflicts).

**Integration pattern:**
- Browser authenticates against Logto directly (OIDC authorization code flow)
- Logto issues JWTs (access tokens + refresh tokens)
- Frontend stores tokens; passes `Authorization: Bearer <token>` to api-server
- api-server verifies JWT signature using Logto's JWKS endpoint (`GET /oidc/jwks`) via `jose` library — **no Logto server call per request**, JWKS is cached locally
- `sub` claim in JWT = user ID (replaces Supabase `auth.uid()`)

**Logto configuration needed:**
1. Create Application: type "SPA" → get `client_id`
2. Create API Resource: indicator `https://api.worryless.ai` → used as JWT `aud` claim
3. Configure redirect URIs: `https://frontend.railway.app/callback`
4. SMTP config for email verification (Resend SMTP or Resend direct integration)

**Logto env vars (on Logto service):**
```
TRUST_PROXY_HEADER=1
DB_URL=${{Postgres.DATABASE_URL}}   # or dedicated second Postgres
PORT=3002
ENDPOINT=https://logto.railway.app
```

**Status:** NEW service — deploy from Railway template, configure

---

## Internal Networking

Railway private networking uses Wireguard-encrypted tunnels. All services within a project communicate via `SERVICE_NAME.railway.internal:PORT`. No port exposure or configuration required for private traffic.

| Connection | Internal Address | Notes |
|-----------|-----------------|-------|
| api-server → langgraph-server | `http://langgraph-server.railway.internal:3001` | SSE streaming: set `proxy_read_timeout` high; `res.flushHeaders()` on LG server |
| api-server → postgres | `${{Postgres.DATABASE_URL}}` resolves internally | Direct port 5432 |
| api-server → redis | `${{Redis.REDIS_URL}}` resolves internally | Port 6379 |
| langgraph-server → postgres | `${{Postgres.DATABASE_URL}}` | Must use direct (non-pooled) connection for PostgresSaver prepared statements |
| langgraph-server → redis | `${{Redis.REDIS_URL}}` | BullMQ worker + scheduler |
| api-server → logto (JWKS) | `http://logto.railway.internal:3002/oidc/jwks` | JWKS is public endpoint; internal hostname avoids external round-trip |
| logto → postgres | `${{Postgres.DATABASE_URL}}` | Logto's own user storage |

**Reference variable syntax (Railway):**
```
# In api-server service variables panel:
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
LANGGRAPH_SERVER_URL=http://langgraph-server.railway.internal:3001
```

**DNS caveat (October 2025 update):** New Railway environments resolve `.railway.internal` hostnames to both IPv4 and IPv6. Legacy environments (pre-October 2025) resolve to IPv6 only. If a Node.js service fails to connect, force IPv4 resolution or verify the project environment was created after October 2025.

---

## Recommended Project Structure

### API Server (new service)

```
api-server/
├── src/
│   ├── index.ts               # Express app bootstrap + middleware stack
│   ├── middleware/
│   │   ├── auth.ts            # Logto JWT verify (jose), req.userId injection
│   │   └── cors.ts            # CORS for frontend domain
│   ├── routes/
│   │   ├── chat.ts            # POST /api/chat, POST /api/orchestrate
│   │   ├── langgraph-proxy.ts # POST /api/langgraph/* → internal forward to LG server
│   │   ├── agents.ts          # POST /api/agents/spawn, GET /api/agents
│   │   ├── business.ts        # POST /api/business/crawl, /parse-datasheet
│   │   ├── generate.ts        # POST /api/generate/content|image|invoice-image
│   │   ├── leads.ts           # POST /api/leads
│   │   ├── outreach.ts        # POST /api/outreach
│   │   ├── tasks.ts           # POST /api/tasks/run
│   │   ├── planning.ts        # POST /api/planning
│   │   ├── integrations.ts    # POST /api/integrations/google/sync
│   │   └── email.ts           # POST /api/email/test|validation
│   ├── db/
│   │   └── client.ts          # postgres.js pool, single instance
│   └── lib/
│       └── buildWorkspacePrompt.ts  # copy from supabase/_shared (identical logic)
├── Dockerfile
└── package.json
```

### LangGraph Server additions (existing service)

```
langgraph-server/src/
├── cadence/                   # (already exists — heartbeat prompts, configs)
│   ├── dispatcher.ts          # NEW: node-cron tick + BullMQ enqueue (replaces heartbeat-dispatcher Edge Fn)
│   └── worker.ts              # NEW: BullMQ worker consuming heartbeat_jobs (replaces heartbeat-runner Edge Fn)
├── persistence/               # (exists — checkpointer.ts, store.ts)
└── index.ts                   # ADD: call startDispatcher() and startWorker() on app start
```

---

## Architectural Patterns

### Pattern 1: JWT-Stateless Auth (Logto + jose)

**What:** Frontend obtains JWT from Logto OIDC flow. Sends as `Authorization: Bearer`. API server verifies signature with cached JWKS — no DB lookup or Logto call per request.

**When to use:** All `/api/*` routes except `/api/health`.

**Trade-offs:** Logout is soft (token still valid until expiry). Mitigation: short access token lifetime (15 min) + refresh token rotation via `@logto/react` SDK.

**Example:**
```typescript
// middleware/auth.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.LOGTO_ENDPOINT}/oidc/jwks`)
);

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${process.env.LOGTO_ENDPOINT}/oidc`,
      audience: process.env.LOGTO_API_RESOURCE,
    });
    req.userId = payload.sub as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

### Pattern 2: Internal SSE Proxy (api-server → langgraph-server)

**What:** The api-server's `/api/langgraph/*` routes forward requests to `langgraph-server.railway.internal:3001` after verifying auth. SSE responses are piped through, not buffered.

**When to use:** All LangGraph invoke/stream/resume calls from the frontend.

**Trade-offs:** Adds one network hop (~0.5ms on Railway private network). Acceptable trade-off: auth stays centralized, LangGraph server stays unexposed to public internet.

**Example:**
```typescript
// routes/langgraph-proxy.ts
import { createProxyMiddleware } from 'http-proxy-middleware';

const lgProxy = createProxyMiddleware({
  target: process.env.LANGGRAPH_SERVER_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/langgraph': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-user-id', (req as any).userId);
    },
  },
});

router.use('/', requireAuth, lgProxy);
```

**Critical:** LangGraph server's `/invoke/stream` already calls `res.setHeader('Content-Type', 'text/event-stream')` and writes chunks directly. `http-proxy-middleware` passes SSE through transparently.

---

### Pattern 3: BullMQ Cadence (replaces pg_cron + pgmq)

**What:** node-cron fires a tick every 5 minutes in-process within the LangGraph server. The tick queries `user_agents` for due agents and adds BullMQ jobs to Redis. BullMQ workers (also in-process) consume and execute `graph.invoke()` for each job.

**When to use:** Heartbeat cadence (daily/weekly/monthly/quarterly per agent), morning digest, scheduled tasks.

**Trade-offs:** Jobs survive LangGraph server restarts (BullMQ persists in Redis). Concurrency controlled by BullMQ worker `concurrency` setting. Missed ticks during downtime are caught on the next tick (same semantics as pg_cron + pgmq). Existing `get_due_cadence_agents()` SQL function is reused unchanged.

**Example:**
```typescript
// cadence/dispatcher.ts
import cron from 'node-cron';
import { Queue } from 'bullmq';
import { pool } from '../db/pool.js';  // direct pg connection

const heartbeatQueue = new Queue('heartbeat_jobs', {
  connection: { url: process.env.REDIS_URL }
});

export function startDispatcher() {
  cron.schedule('*/5 * * * *', async () => {
    const { rows } = await pool.query('SELECT * FROM get_due_cadence_agents()');
    for (const agent of rows) {
      await heartbeatQueue.add('heartbeat', agent, {
        jobId: `${agent.user_id}-${agent.agent_type_id}-${agent.cadence_tier}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
    }
  });
}

// cadence/worker.ts
import { Worker } from 'bullmq';
import { getCheckpointer } from '../persistence/checkpointer.js';
import { createSupervisorGraph } from '../graph/supervisor.js';
import { HumanMessage } from '@langchain/core/messages';
import { getHeartbeatPrompt } from './heartbeat-prompts.js';

export async function startWorker() {
  const checkpointer = await getCheckpointer();
  return new Worker('heartbeat_jobs', async (job) => {
    const { user_id, agent_type_id, cadence_tier } = job.data;
    const prompt = getHeartbeatPrompt(agent_type_id, cadence_tier);
    const graph = createSupervisorGraph(checkpointer);
    await graph.invoke({
      messages: [new HumanMessage(prompt)],
      userId: user_id,
      agentType: agent_type_id,
      isProactive: true,
    }, {
      configurable: { thread_id: `heartbeat-${user_id}-${agent_type_id}-${cadence_tier}` }
    });
  }, {
    connection: { url: process.env.REDIS_URL },
    concurrency: 3,
  });
}
```

---

### Pattern 4: Volume Mount for Playwright Persistent Browser

**What:** Railway volume mounted at `/playwright-data` on the LangGraph server service. Playwright's `userDataDir` set to a per-user subdirectory.

**When to use:** Marketer agent's social media tools (persistent login sessions across heartbeat runs).

**Configuration:**
- Railway Dashboard → LangGraph Server service → Volumes → Mount at `/playwright-data`
- Set service env var: `RAILWAY_RUN_UID=0` (required — Railway volumes mount as root; Node process needs matching UID to write)
- `PLAYWRIGHT_DATA_DIR=/playwright-data` env var read by tool implementations

**Constraint:** Each Railway service supports only one volume. All per-user browser profiles are subdirectories within that one mount — no issue.

**Caveat:** "Data written at Docker build time will not persist on the volume even if it writes to the mount directory." Playwright's browser binary installation happens at build time to a system path (e.g., `/root/.cache/ms-playwright`). Only the user data directories (cookies, sessions) need to live on the volume. These are written at runtime.

---

## Data Flow

### Chat Request Flow (post-migration)

```
Browser
  └── POST /api/langgraph/invoke/stream  (api-server, public domain, HTTPS)
        └── requireAuth middleware
              └── jwtVerify() against Logto JWKS (cached, no network call)
              └── attach req.userId from JWT sub claim
        └── http-proxy-middleware
              └── forward to langgraph-server.railway.internal:3001/invoke/stream
                    └── graph.stream() → SSE chunks
                    └── PostgresSaver checkpoint → postgres.railway.internal:5432
              └── SSE pipe back through proxy to browser
Browser receives SSE stream in real time
```

### Heartbeat Cadence Flow (post-migration)

```
node-cron tick (every 5 min, LangGraph server process)
  └── SELECT get_due_cadence_agents() → postgres
  └── heartbeatQueue.add(job) → Redis BullMQ

BullMQ Worker (concurrent: 3, LangGraph server process)
  └── job.data = { user_id, agent_type_id, cadence_tier }
  └── graph.invoke({ isProactive: true })
        └── agent tool calls write results
        └── writes notification row → postgres (direct pg pool)
        └── PostgresSaver checkpoint → postgres
        └── advance next_*_heartbeat_at column → postgres
```

**Note on notifications from heartbeat workers:** Heartbeat workers run inside LangGraph server. They need to write to the `notifications` table. Use a direct `pg` connection from within the LangGraph server process — same `DATABASE_URL`, simpler than an internal HTTP call to api-server.

### Auth Flow (post-migration)

```
Browser
  └── Clicks login → @logto/react redirects to logto.railway.app/oidc/auth
  Logto
  └── User authenticates (email/password)
  └── Redirect back with authorization code to frontend callback URL
  Browser
  └── @logto/react SDK exchanges code for access_token + refresh_token
  └── Stores tokens in memory (access_token) + secure storage (refresh_token)
  └── All API calls: Authorization: Bearer <access_token>
  └── SDK auto-refreshes tokens before expiry
```

---

## Build Order (dependency-aware)

```
Phase 1: Infrastructure (no service deps)
  ├── Provision Railway PostgreSQL service
  ├── Provision Railway Redis service
  └── Deploy Logto service (needs Postgres DB — share or second Postgres)

Phase 2: Database schema (depends on Postgres)
  └── Apply sanitized migrations
      (remove pg_cron, pgmq, pg_net, auth.*, vault.* references)
      (keep pgvector, application tables, langgraph schema)
      (add Logto user_id foreign key pattern if needed)

Phase 3: API Server (depends on Postgres + Redis + Logto)
  ├── Build new Express app
  ├── Verify auth middleware with Logto JWKS endpoint
  └── Test each route group end-to-end

Phase 4: LangGraph Server (depends on Postgres + Redis)
  ├── Update env vars (DATABASE_URL, REDIS_URL, GEMINI_API_KEY)
  ├── Add cadence/dispatcher.ts + cadence/worker.ts
  ├── Wire startDispatcher() + startWorker() in index.ts
  ├── Mount Playwright volume, set RAILWAY_RUN_UID=0
  └── Verify PostgresSaver + Store still functional

Phase 5: Frontend (depends on API Server + Logto)
  ├── Replace @supabase/supabase-js with direct fetch() wrapper
  ├── Wire @logto/react auth SDK (replaces supabase.auth.*)
  ├── Update all hooks (useTeamData, useAgentWorkspace, etc.) to call /api/*
  └── Build Vite → deploy Nginx Docker container
```

---

## New vs Modified Components

### New (does not exist yet)

| Component | What to Build |
|-----------|--------------|
| `api-server` Railway service | New Express app: 23 routes, auth middleware, postgres.js pool |
| `frontend` Railway service | Nginx Docker container serving Vite dist/ output |
| `postgres` Railway service | Provision + apply sanitized migration set |
| `redis` Railway service | Provision (no configuration needed beyond provisioning) |
| `logto` Railway service | Deploy from Railway template, configure app + API resource |
| `api-server/src/middleware/auth.ts` | Logto JWT verification with `jose` library |
| `api-server/src/db/client.ts` | postgres.js pool singleton |
| `api-server/src/routes/*.ts` | 21 HTTP-routable Edge Functions ported to Express |
| `langgraph-server/src/cadence/dispatcher.ts` | node-cron tick + BullMQ enqueue |
| `langgraph-server/src/cadence/worker.ts` | BullMQ worker invoking graph.invoke() |

### Modified (exists, needs changes)

| Component | What Changes |
|-----------|-------------|
| `langgraph-server/src/index.ts` | Call `startDispatcher()` and `startWorker()` on startup |
| `langgraph-server` Railway service | Add env vars: REDIS_URL, GEMINI_API_KEY; remove LOVABLE_API_KEY; mount volume |
| `frontend/src/integrations/supabase/client.ts` | Replace with `fetch()` wrapper + Logto token injection |
| `frontend/src/pages/Auth.tsx` | Replace Supabase auth UI with `@logto/react` SignIn component |
| `frontend/src/hooks/use*.ts` | Replace `supabase.from()` calls with typed `fetch('/api/...')` |
| `supabase/migrations/*.sql` | Create `RAILWAY_MIGRATION.sql` stripping Supabase-specific calls |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 users | Single instance of each service. BullMQ worker concurrency: 3. |
| 500–5k users | Scale api-server horizontally. LangGraph server remains single instance due to Playwright volume constraint. BullMQ concurrency increase. |
| 5k+ users | Extract Playwright to dedicated browser-automation service with NFS-backed volume. LangGraph server becomes stateless and horizontally scalable. Read replicas on Postgres. |

**First bottleneck:** LangGraph server — long-running SSE connections + graph computation block the event loop under concurrent load. Railway autoscaling adds instances, but the Playwright volume allows only one mounted instance. Extract Playwright first before scaling LangGraph horizontally.

**Second bottleneck:** Postgres under write pressure from heartbeat workers (concurrent checkpoint writes). Mitigation: tune BullMQ worker concurrency, consider Postgres connection pooler (PgBouncer in session mode) at higher loads.

---

## Anti-Patterns

### Anti-Pattern 1: Merging API Server into LangGraph Server

**What people do:** Add the 23 Edge Function routes directly to the existing LangGraph `index.ts` to save one service slot.

**Why it's wrong:** LangGraph server runs Playwright (1GB+ Docker image), long-lived SSE connections, and CPU-intensive graph walks. Adding short CRUD routes creates one deployment unit with conflicting scaling requirements. Any API route change requires redeploying the slow Playwright-installing Docker image. The volume mount prevents horizontal scaling of the merged unit.

**Do this instead:** Keep them separate. Railway's free tier supports up to 5 services per project; all 6 services here fit on Hobby plan.

---

### Anti-Pattern 2: Running BullMQ Workers in API Server

**What people do:** Put the heartbeat BullMQ worker in api-server since it also has Redis access.

**Why it's wrong:** The worker needs to call `graph.invoke()` which requires importing the full LangGraph supervisor graph, all 13 agent implementations, tool definitions, and Playwright. This pulls the entire LangGraph dependency tree into the API server.

**Do this instead:** Workers live in the LangGraph server process alongside the graph. The dispatcher tick can also live there. API server only enqueues jobs if user-triggered runs are ever needed via HTTP.

---

### Anti-Pattern 3: Using @supabase/supabase-js in API Server

**What people do:** Install `@supabase/supabase-js` in the new api-server and point it at Railway Postgres.

**Why it's wrong:** `@supabase/supabase-js` talks to Supabase-specific REST endpoints (PostgREST, Supabase Auth) that do not exist on Railway's vanilla Postgres. It will not establish a database connection.

**Do this instead:** Use `postgres` (postgres.js) or `pg` (node-postgres) directly. Both connect natively to any PostgreSQL via `DATABASE_URL`.

---

### Anti-Pattern 4: Polling Logto on Every API Request

**What people do:** Call `GET /oidc/userinfo` against Logto on every API request to validate the token.

**Why it's wrong:** Adds 50–200ms latency per request, creates a hard dependency on Logto uptime for every API call, and defeats the purpose of stateless JWT.

**Do this instead:** Use `createRemoteJWKSet` from `jose`. It fetches JWKS once per process lifetime and validates tokens locally using the cached public keys. The `sub` claim is the user ID.

---

### Anti-Pattern 5: Running Supabase Migrations Verbatim on Railway Postgres

**What people do:** Copy all `supabase/migrations/*.sql` files and apply them to Railway Postgres unchanged.

**Why it's wrong:** Railway Postgres does not have `pg_cron`, `pg_net`, `pgmq`, `vault`, or the `auth` schema. These SQL statements will fail and block migration.

**Do this instead:** Create a single `RAILWAY_MIGRATION.sql` that strips all `SELECT cron.schedule(...)`, `SELECT net.http_post(...)`, `SELECT pgmq.create(...)`, `vault.*`, and `auth.*` references. Apply pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`) which Railway supports natively.

---

## Integration Points

### External Services

| Service | Integration | Where | Notes |
|---------|------------|-------|-------|
| Gemini API | `@google/generative-ai` npm (direct) | api-server + langgraph-server | Replaces Lovable AI Gateway; same model names work |
| Resend | `resend` npm package | api-server email routes + LangGraph cadence worker | API key moves to env var |
| Firecrawl | HTTP REST | api-server `/api/business/crawl` | API key in env var |
| Apify | HTTP REST | api-server `/api/leads` | API key in env var |
| Google OAuth (Gmail/Calendar) | OAuth 2.0 flows | api-server `/api/integrations/google/*` | Client ID/Secret in api-server env vars |
| Playwright/Chromium | `playwright` npm (in-process) | langgraph-server | Volume at `/playwright-data`, `RAILWAY_RUN_UID=0` |
| Logto | OIDC provider (external flow + JWKS) | browser + api-server | Railway-hosted service |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Browser ↔ api-server | HTTPS REST + SSE (proxied) | All user-facing API calls |
| Browser ↔ logto | HTTPS OIDC flow | Login/logout/token refresh only |
| api-server ↔ langgraph-server | Private HTTP (`langgraph-server.railway.internal:3001`) | LangGraph operations proxied; SSE must flow through |
| api-server ↔ postgres | Private TCP (`${{Postgres.DATABASE_URL}}`) | postgres.js pool for CRUD |
| langgraph-server ↔ postgres | Private TCP (same `DATABASE_URL`) | Direct connection (no pooler) for PostgresSaver prepared statements |
| api-server ↔ redis | Private TCP (`${{Redis.REDIS_URL}}`) | Only if manual job enqueue needed |
| langgraph-server ↔ redis | Private TCP (`${{Redis.REDIS_URL}}`) | BullMQ dispatcher + worker |
| logto ↔ postgres | Private TCP | Logto user storage |

---

## Sources

- [Railway Private Networking](https://docs.railway.com/networking/private-networking) — HIGH confidence, official Railway docs
- [Railway Volumes](https://docs.railway.com/reference/volumes) — HIGH confidence, official Railway docs
- [Railway Reference Variables](https://docs.railway.com/variables/reference) — HIGH confidence, official Railway docs
- [Logto — Validate Access Tokens](https://docs.logto.io/authorization/validate-access-tokens) — HIGH confidence, official Logto docs
- [Logto Express.js API Protection](https://docs.logto.io/api-protection/nodejs/express) — HIGH confidence, official Logto docs
- [Deploy Logto on Railway](https://railway.com/deploy/logto) — HIGH confidence, Railway official template
- [BullMQ — Repeatable Jobs](https://docs.bullmq.io/guide/jobs/repeatable) — HIGH confidence, official BullMQ docs
- Codebase inspection: `worrylesssuperagent/langgraph-server/src/index.ts`, `persistence/checkpointer.ts`, 21 Supabase Edge Functions inspected directly — HIGH confidence, source of truth

---

*Architecture research for: Worryless AI v2.1 — Railway deployment migration*
*Researched: 2026-03-21*
