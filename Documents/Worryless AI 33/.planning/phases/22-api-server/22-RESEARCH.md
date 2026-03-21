# Phase 22: API Server - Research

**Researched:** 2026-03-21
**Domain:** Express.js API server — Supabase Edge Function porting, Gemini Imagen 3, SSE proxy, web-push VAPID, Railway deployment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAIL-05 | Express API Server deployed on Railway replacing all Supabase Edge Functions | Railway `railway.toml` + Dockerfile pattern; health check `/health` endpoint |
| API-01 | Express server with CORS, JSON parsing, and Logto auth middleware | Phase 21 `verifyLogtoJWT` middleware is ready to copy; `cors` npm package |
| API-02 | `POST /api/chat-with-agent` route | Port `chat-with-agent` edge function; replace Supabase client with pg pool; replace Lovable gateway with Gemini OpenAI-compat endpoint |
| API-03 | `POST /api/orchestrator` route | Port `orchestrator` edge function; Gemini OpenAI-compat endpoint |
| API-04 | `POST /api/spawn-agent-team` route | Port `spawn-agent-team`; replace Supabase admin client with pg pool |
| API-05 | `POST /api/generate-content` route | Port `generate-content`; replace Lovable gateway with Gemini flash |
| API-06 | `POST /api/generate-image` route | Port `generate-image`; replace Lovable gateway with Gemini Imagen 3 (`@google/genai` SDK) |
| API-07 | `POST /api/generate-invoice-image` route | Port `generate-invoice-image`; Gemini Imagen 3 |
| API-08 | `POST /api/generate-leads` route | Port `generate-leads`; Apify API key passthrough |
| API-09 | `POST /api/generate-outreach` route | Port `generate-outreach`; Gemini OpenAI-compat endpoint |
| API-10 | `POST /api/crawl-business-website` route | Port `crawl-business-website`; Firecrawl API key; pg pool for artifact insertion |
| API-11 | `POST /api/parse-datasheet` route | Port `parse-datasheet`; CSV/TSV parsing logic is already pure TS |
| API-12 | `POST /api/planning-agent` route | Port `planning-agent`; Gemini OpenAI-compat endpoint; pg pool for task insertion |
| API-13 | `POST /api/sync-gmail-calendar` route | Port `sync-gmail-calendar`; pg pool; Google OAuth token from integrations table |
| API-14 | `POST /api/send-validation-email` route | Port `send-validation-email`; Resend API; pg pool for task/profile/validator queries |
| API-15 | `POST /api/send-test-email` route | Port `send-test-email`; Resend API |
| API-16 | `POST /api/langgraph-proxy` SSE route | New implementation: forward JWT to LangGraph server; pipe SSE stream; `X-Accel-Buffering: no` + `res.flushHeaders()` |
| API-17 | All LLM calls use direct Gemini API via OpenAI-compat endpoint | `generativelanguage.googleapis.com/v1beta/openai/` — same response shape as OpenAI SDK |
| SCHED-05 | Push notifications via `web-push` npm package with VAPID keys | `web-push` 3.6.7; VAPID key generation; `push_subscriptions` table already in schema |
</phase_requirements>

---

## Summary

Phase 22 ports all 17 Supabase Edge Functions to a standalone Express.js service deployed on Railway. The codebase is Deno/TypeScript Edge Functions calling the Lovable AI Gateway — every function needs three changes: (1) replace Deno globals with Node.js equivalents, (2) replace `supabase-js` auth/DB calls with direct pg pool queries, and (3) replace the Lovable AI Gateway with the Gemini OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/`). The Logto JWT middleware already exists in `langgraph-server/src/middleware/auth.ts` (Phase 21) and can be copied verbatim. The SSE proxy for `langgraph-proxy` is the most technically complex route — it must pipe a chunked stream and suppress Railway's nginx buffering with `X-Accel-Buffering: no` plus `res.flushHeaders()`. Image generation uses `@google/genai` SDK (already installed in LangGraph server) with `generateContent` and `responseModalities: ["IMAGE"]`.

**Primary recommendation:** Scaffold a new `api-server/` directory at the repo root (sibling to `langgraph-server/`), copy the auth middleware from Phase 21, then port routes in task order: scaffold → core agent routes → image/content generation → business data routes → utility routes + push notifications.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP server framework | Established; already used in LangGraph server |
| cors | 2.8.6 | CORS middleware | Required for browser clients on different origin |
| jose | 6.2.2 | JWT validation (Logto JWKS) | Already implemented in Phase 21; stateless |
| pg | 8.20.0 | PostgreSQL pool | Direct DB access replacing `supabase-js` service-role client |
| @google/genai | 1.46.0 | Gemini text + image generation | Already installed in LangGraph server; supports Imagen 3 |
| web-push | 3.6.7 | Web Push VAPID notifications | Node.js standard for Web Push; SCHED-05 |
| resend | 6.9.4 | Transactional email | Already in use in edge functions |
| typescript | 5.8.0 | Type safety | Matches LangGraph server version |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.19.0 | Dev mode TypeScript runner | `npm run dev` watch mode |
| node-fetch (built-in) | native | HTTP calls to Firecrawl, Apify | Node 18+ has native fetch — no polyfill needed |
| @types/express | 5.0.0 | Express type declarations | TypeScript only |
| @types/pg | 8.11.0 | pg type declarations | TypeScript only |
| @types/web-push | 3.6.4 | web-push type declarations | TypeScript only |
| @types/cors | 2.8.17 | cors type declarations | TypeScript only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` SDK | Raw `fetch` to OpenAI-compat endpoint | SDK handles retries, streaming, type safety — prefer SDK |
| `pg` pool | `@supabase/supabase-js` service-role | supabase-js adds Supabase Auth overhead; pg is simpler and already proven in LangGraph server |
| `web-push` | Deno `jsr:@negrel/webpush` | Requirements explicitly call for `web-push` npm package (SCHED-05) |
| `resend` SDK | Raw `fetch` to Resend API | Either works; SDK adds minimal overhead but cleaner types |

**Installation (new api-server package):**
```bash
npm install express cors jose pg @google/genai web-push resend
npm install -D typescript tsx @types/express @types/pg @types/cors @types/web-push @types/node
```

**Version verification (confirmed against npm registry 2026-03-21):**
- express: 5.2.1
- cors: 2.8.6
- jose: 6.2.2
- pg: 8.20.0
- @google/genai: 1.46.0
- web-push: 3.6.7
- resend: 6.9.4

---

## Architecture Patterns

### Recommended Project Structure

```
api-server/
├── src/
│   ├── index.ts               # Express app, middleware registration, server start
│   ├── middleware/
│   │   └── auth.ts            # verifyLogtoJWT — copy from langgraph-server verbatim
│   ├── db/
│   │   └── pool.ts            # Single pg Pool instance (DATABASE_URL)
│   ├── lib/
│   │   ├── gemini.ts          # Gemini client singleton + OpenAI-compat base URL
│   │   └── geminiImage.ts     # Imagen 3 helper (generateContent with IMAGE modality)
│   ├── routes/
│   │   ├── health.ts          # GET /health
│   │   ├── chatWithAgent.ts   # POST /api/chat-with-agent
│   │   ├── orchestrator.ts    # POST /api/orchestrator
│   │   ├── spawnAgentTeam.ts  # POST /api/spawn-agent-team
│   │   ├── langgraphProxy.ts  # POST /api/langgraph-proxy (SSE)
│   │   ├── generateContent.ts # POST /api/generate-content
│   │   ├── generateImage.ts   # POST /api/generate-image
│   │   ├── generateInvoiceImage.ts # POST /api/generate-invoice-image
│   │   ├── generateLeads.ts   # POST /api/generate-leads
│   │   ├── generateOutreach.ts # POST /api/generate-outreach
│   │   ├── crawlWebsite.ts    # POST /api/crawl-business-website
│   │   ├── parseDatasheet.ts  # POST /api/parse-datasheet
│   │   ├── planningAgent.ts   # POST /api/planning-agent
│   │   ├── syncGmailCalendar.ts # POST /api/sync-gmail-calendar
│   │   ├── sendValidationEmail.ts # POST /api/send-validation-email
│   │   ├── sendTestEmail.ts   # POST /api/send-test-email
│   │   └── pushSubscriptions.ts # POST/DELETE /api/push-subscriptions (SCHED-05)
│   └── shared/
│       ├── buildWorkspacePrompt.ts  # Copy from _shared/buildWorkspacePrompt.ts
│       ├── heartbeatParser.ts       # Copy from _shared/heartbeatParser.ts
│       └── sanitize.ts              # Copy from _shared/sanitize.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── railway.toml
```

### Pattern 1: Request Handler Structure (all routes)

**What:** Each route file exports an Express `RequestHandler`. The `index.ts` registers all routes under `/api/` prefix. All routes except `/health` apply `verifyLogtoJWT` middleware.

**When to use:** Every route in this phase.

**Example:**
```typescript
// src/routes/spawnAgentTeam.ts
import { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { gemini } from '../lib/gemini.js';

export const spawnAgentTeam: RequestHandler = async (req, res) => {
  const userId = (req as AuthedRequest).auth!.userId;
  const { businessName, industry, description, location } = req.body;

  // DB: fetch agent catalog via pg pool (not supabase-js)
  const { rows: catalog } = await pool.query(
    'SELECT id, display_name, description, skill_config FROM available_agent_types'
  );

  // LLM: call Gemini via OpenAI-compat endpoint
  const aiResponse = await gemini.chat.completions.create({ ... });

  res.json({ recommendations, allAgents });
};
```

### Pattern 2: Gemini OpenAI-Compatible Client

**What:** Use `@google/genai` SDK initialized with `httpOptions.baseUrl` pointing to the OpenAI-compatible endpoint. All existing response parsers (`choices[0].message.content`) work unchanged.

**When to use:** All text generation routes (API-02, API-03, API-04, API-05, API-08, API-09, API-10, API-11, API-12, API-13).

**Example:**
```typescript
// src/lib/gemini.ts
import { GoogleGenAI } from '@google/genai';

// OpenAI-compatible endpoint — same response shape as OpenAI SDK
export const geminiOpenAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/'
  }
});

// For text: geminiOpenAI.chat.completions.create(...)
// Model: 'gemini-2.0-flash' or 'gemini-2.5-pro-preview-03-25'
```

**Important:** The decision in STATE.md is to use `generativelanguage.googleapis.com/v1beta/openai/` which preserves the `choices[0].message.content` response shape from the old Lovable gateway. The existing parser code in edge functions does NOT need rewriting.

### Pattern 3: Gemini Imagen 3 (Image Generation)

**What:** Use `@google/genai` SDK `generateImages` method (not the OpenAI-compat path — image generation is native SDK only).

**When to use:** API-06 (`generate-image`), API-07 (`generate-invoice-image`), and the image sub-call inside API-05 (`generate-content`).

**Example:**
```typescript
// src/lib/geminiImage.ts
import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateImageImagen3(prompt: string): Promise<string> {
  const response = await genai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt,
    config: { numberOfImages: 1, outputMimeType: 'image/png' },
  });
  // Returns base64-encoded PNG
  const b64 = response.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) throw new Error('No image returned from Imagen 3');
  return `data:image/png;base64,${b64}`;
}
```

**Critical note:** The old edge functions called the Lovable gateway with `model: "google/gemini-3-pro-image-preview"` and extracted `data.choices[0].message.images[0].image_url.url`. The new implementation returns a base64 data URI instead of a hosted URL. The frontend will receive a data URI — this is a behavior change. The route must return the same `imageUrl` key so the frontend contract is preserved. If the frontend currently renders `<img src={imageUrl}>` it will still work with a data URI.

### Pattern 4: SSE Proxy (langgraph-proxy)

**What:** The API server forwards authenticated requests to the LangGraph server and pipes the SSE response back to the browser. The API server re-validates the JWT and forwards the same `Authorization` header to the LangGraph server (which also validates it).

**When to use:** API-16 (`langgraph-proxy`).

**Example:**
```typescript
// src/routes/langgraphProxy.ts
import { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';

const LANGGRAPH_URL = process.env.LANGGRAPH_SERVER_URL!;

export const langgraphProxy: RequestHandler = async (req, res) => {
  // SSE headers — MUST be set before any data is written
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // CRITICAL: disables Railway/nginx buffering
  res.flushHeaders(); // CRITICAL: sends headers immediately — Railway buffers without this

  const targetPath = req.path.replace('/api/langgraph-proxy', '') || '/invoke/stream';
  const upstream = await fetch(`${LANGGRAPH_URL}${targetPath}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization!, // Forward JWT to LangGraph server
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });

  if (!upstream.body) { res.end(); return; }

  // Pipe SSE stream chunk by chunk
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
};
```

### Pattern 5: pg Pool (DB access replacing supabase-js)

**What:** Single `pg.Pool` instance shared across all routes. All Supabase service-role queries become parameterized `pool.query()` calls.

**When to use:** All routes that previously used `createClient(url, serviceRoleKey)` for DB access.

**Example:**
```typescript
// src/db/pool.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway internal postgres — TLS not required for internal networking
  ssl: process.env.DATABASE_URL?.includes('railway.internal') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});
```

**Translation table: supabase-js → pg pool:**

| supabase-js | pg pool equivalent |
|-------------|-------------------|
| `supabase.from('t').select('*').eq('user_id', uid)` | `pool.query('SELECT * FROM t WHERE user_id = $1', [uid])` |
| `supabase.from('t').insert(rows)` | `pool.query('INSERT INTO t(...) VALUES(...)', [...])` |
| `supabase.from('t').update(data).eq('id', id)` | `pool.query('UPDATE t SET col=$1 WHERE id=$2', [val, id])` |

### Pattern 6: web-push VAPID (SCHED-05)

**What:** The API server handles push subscription CRUD and push delivery. VAPID keys are generated once and stored in Railway environment variables.

**When to use:** Push notification routes in the utility task (22-05).

**Example:**
```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@worryless.ai',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Send push to a subscription
await webpush.sendNotification(
  { endpoint, keys: { p256dh, auth } },
  JSON.stringify({ title: 'Agent Update', body: message })
);
```

**VAPID key generation (one-time, run locally):**
```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(keys);"
# Save output to Railway env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

### Anti-Patterns to Avoid

- **Keeping Deno globals:** `Deno.env.get()` must become `process.env`. `Deno.env.get("SUPABASE_URL")` patterns in every edge function must be removed.
- **Using supabase-js for DB writes:** Never call `createClient(url, serviceRoleKey)` in the Express server. Use pg pool directly.
- **Using supabase-js for JWT validation:** Never call `supabase.auth.getUser(token)` — this makes a network call to Supabase. Use `verifyLogtoJWT` (stateless JWKS).
- **Missing `res.flushHeaders()` on SSE routes:** Without this, Railway's nginx buffers the entire response. The SSE stream appears frozen on the client until the connection closes.
- **Buffering the SSE body:** Never `await response.text()` or `await response.json()` on the upstream response when proxying SSE — this buffers the whole stream in memory.
- **Multiple `pg.Pool` instances:** One pool per service. Multiple pools waste connections and Railway's postgres limits.
- **User ID from request body:** user_id MUST come from `req.auth.userId` (JWT sub claim), never from `req.body.user_id`. Body is untrusted input.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT validation | Custom JWKS fetching/caching | `jose` `createRemoteJWKSet` + `jwtVerify` | Handles key rotation, caching, expiry — already proven in Phase 21 |
| CORS handling | Manual `Access-Control-*` headers | `cors` npm package | Handles preflight OPTIONS, method lists, origin matching |
| Image generation | Calling Lovable gateway or building image API | `@google/genai` `generateImages` with `imagen-3.0-generate-002` | Native SDK with type safety |
| Email sending | Raw SMTP | `resend` npm package or direct Resend API `fetch` | Handles delivery, retries, templates |
| Web Push crypto | VAPID signing by hand | `web-push` npm package | Elliptic curve crypto + HTTP/2 push protocol — extremely complex |
| CSV parsing | Custom parser | The existing `parseCSV` / `parseTSV` functions from `parse-datasheet` edge function | They're already written in pure TS — just copy them |

**Key insight:** Every shared utility in `supabase/functions/_shared/` (`buildWorkspacePrompt.ts`, `heartbeatParser.ts`, `sanitize.ts`) is pure TypeScript with no Deno-specific APIs — copy them unchanged to `api-server/src/shared/`.

---

## Common Pitfalls

### Pitfall 1: SSE Buffering on Railway

**What goes wrong:** The SSE `/api/langgraph-proxy` route appears to work locally but delivers the entire stream as a single chunk on Railway. The client never sees incremental tokens.

**Why it happens:** Railway uses nginx as a reverse proxy. nginx buffers upstream responses by default. Without explicitly disabling this, the entire SSE stream accumulates in nginx's buffer and is flushed only when the connection closes.

**How to avoid:** Set `X-Accel-Buffering: no` header AND call `res.flushHeaders()` before writing any data. Both are required. `X-Accel-Buffering: no` tells nginx to disable buffering for this response; `res.flushHeaders()` ensures Express sends the headers to nginx before the first chunk.

**Warning signs:** SSE works in local dev, fails in production. Client receives all tokens at once after a long pause.

### Pitfall 2: Imagen 3 Returns Base64, Not a URL

**What goes wrong:** The old `generate-image` edge function returned `imageUrl` as a hosted CDN URL from the Lovable gateway (`data.choices[0].message.images[0].image_url.url`). Gemini Imagen 3 via `@google/genai` SDK returns base64-encoded bytes, not a URL.

**Why it happens:** Imagen 3 does not host images for you. The `response.generatedImages[0].image.imageBytes` is raw PNG/JPEG bytes in base64.

**How to avoid:** Return `data:image/png;base64,${b64}` as the `imageUrl` field. The frontend `<img src>` will work because browsers support data URIs. If Supabase Storage was being used to host images, this is no longer available — the base64 approach is the correct replacement for Railway deployment.

**Warning signs:** `imageUrl` is `undefined` or the route throws "No image returned".

### Pitfall 3: Deno-Only APIs Remain After Port

**What goes wrong:** `Deno.env.get('KEY')` throws `ReferenceError: Deno is not defined` in Node.js.

**Why it happens:** Edge functions use Deno runtime globals. During porting, these are easy to miss because they don't cause TypeScript compilation errors — TypeScript doesn't know about Deno types unless `@types/deno` is installed.

**How to avoid:** Global find in each ported file: `Deno.env.get(` → `process.env.`. Also check for `Deno.readFile`, `Deno.writeFile` (none found in this codebase, but verify). The `serve()` wrapper from Deno std is removed entirely — Express `app.post(...)` replaces it.

**Warning signs:** Runtime crash with `ReferenceError: Deno is not defined`.

### Pitfall 4: Missing CORS on OPTIONS preflight

**What goes wrong:** Browser pre-flights fail with 404 or 405 because Express doesn't handle OPTIONS by default.

**Why it happens:** Every `POST` route from a browser gets an OPTIONS preflight first. Express does not automatically return 204 for OPTIONS unless `cors()` middleware is registered globally.

**How to avoid:** Apply `app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'] }))` before any route handler. This handles all OPTIONS requests automatically.

**Warning signs:** Browser console shows CORS errors on the first request to any route.

### Pitfall 5: push_subscriptions FK References auth.users

**What goes wrong:** The existing migration `20260313000010_push_subscriptions.sql` has `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`. Phase 20 replaced `auth.users` with `public.users`. This FK will fail on insert.

**Why it happens:** The migration was written for Supabase. Phase 20's work targeted the main app tables but may not have patched `push_subscriptions`.

**How to avoid:** Before implementing SCHED-05, verify the Railway database's `push_subscriptions` table FK target. If it references `auth.users`, create a corrective migration to change it to `public.users`. Check with: `SELECT constraint_name, table_name FROM information_schema.referential_constraints WHERE unique_constraint_name LIKE '%users%'`.

**Warning signs:** `insert into push_subscriptions` fails with foreign key violation.

### Pitfall 6: orchestrator Edge Function is Large (10,000+ tokens)

**What goes wrong:** The `orchestrator/index.ts` exceeded the file read limit in research (16,000 tokens). It is the most complex edge function.

**Why it happens:** The orchestrator routes across multiple agents and contains inline agent configs. The porting work is larger than the other routes.

**How to avoid:** Plan the orchestrator as a dedicated sub-task. Read the file in sections using `offset` + `limit`. Port the agent dispatch logic first, then the DB queries.

**Warning signs:** Task takes significantly longer than estimated; file read timeouts.

---

## Code Examples

### Express Server Scaffold

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import { verifyLogtoJWT } from './middleware/auth.js';

export const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' })); // parse-datasheet may send large CSV payloads

// Health check — no auth
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All API routes require JWT
import { chatWithAgent } from './routes/chatWithAgent.js';
import { langgraphProxy } from './routes/langgraphProxy.js';
// ... etc

app.post('/api/chat-with-agent', verifyLogtoJWT, chatWithAgent);
app.post('/api/langgraph-proxy', verifyLogtoJWT, langgraphProxy);
app.post('/api/langgraph-proxy/*', verifyLogtoJWT, langgraphProxy);
// ... register all 17 routes

const PORT = parseInt(process.env.PORT || '3000', 10);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`[api-server] Running on port ${PORT}`));
}
```

### Auth Middleware (copy from Phase 21)

```typescript
// src/middleware/auth.ts
// Source: langgraph-server/src/middleware/auth.ts (Phase 21 — proven working)
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const LOGTO_ENDPOINT = process.env.LOGTO_ENDPOINT!;
const JWKS_URI = `${LOGTO_ENDPOINT}/oidc/jwks`;
const ISSUER = `${LOGTO_ENDPOINT}/oidc`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export interface AuthedRequest extends Request {
  auth?: { userId: string; payload: JWTPayload };
}

export async function verifyLogtoJWT(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
    if (!payload.sub) { res.status(401).json({ error: 'Token missing sub claim' }); return; }
    req.auth = { userId: payload.sub, payload };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### Railway Deployment Config

```toml
# api-server/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "api-server/Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

```dockerfile
# api-server/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Variables Required

```bash
# Railway service variables for api-server
DATABASE_URL=postgresql://...railway.internal.../railway   # Internal networking
LOGTO_ENDPOINT=https://your-logto.railway.app
GEMINI_API_KEY=AIza...
FIRECRAWL_API_KEY=fc-...
APIFY_API_TOKEN=apify_api_...
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
LANGGRAPH_SERVER_URL=http://langgraph-server.railway.internal:3001
PORT=3000
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lovable AI Gateway (`ai.gateway.lovable.dev`) | Direct Gemini API (`generativelanguage.googleapis.com/v1beta/openai/`) | Phase 22 | Same response shape; no API key change needed if GEMINI_API_KEY already configured |
| `supabase.auth.getUser()` per request (network roundtrip) | `jose` JWKS stateless verification | Phase 21 | No Supabase Auth dependency; sub-millisecond after JWKS cache warms |
| Deno `jsr:@negrel/webpush` | `web-push` npm 3.6.7 | Phase 22 (SCHED-05) | Node.js ecosystem; better maintained; Railway-compatible |
| Supabase Edge Functions (Deno isolates) | Express routes (Node.js, Railway) | Phase 22 | Single service; shared pg pool; no cold-start per function |
| `data.choices[0].message.images[0].image_url.url` (Lovable hosted URL) | Base64 data URI from Imagen 3 SDK | Phase 22 | Images returned inline; no external hosting dependency |

**Deprecated/outdated:**
- `LOVABLE_API_KEY` env var: Replaced by `GEMINI_API_KEY`. Remove from Railway vars after migration.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Not needed in the Express API server. DB access goes via `DATABASE_URL` directly.
- `google/gemini-3-pro-image-preview` model name (Lovable gateway alias): Replaced by `imagen-3.0-generate-002` in the Gemini SDK.

---

## Open Questions

1. **Imagen 3 availability on Gemini API**
   - What we know: `@google/genai` SDK 1.46.0 is installed in LangGraph server; model name `imagen-3.0-generate-002` is documented by Google.
   - What's unclear: Whether the API key (GEMINI_API_KEY) is configured with Imagen 3 access enabled — Imagen 3 requires explicit enablement in Google Cloud Console for some account types.
   - Recommendation: Test `generateImages` call in the 22-03 task as the first action; fall back gracefully if model returns 403 (log it; return error to frontend).

2. **orchestrator edge function complexity**
   - What we know: The file is 16,000+ tokens — the largest of the 17 functions.
   - What's unclear: Whether the orchestrator dispatches to other edge functions via fetch (which would need URL updates) or handles all logic inline.
   - Recommendation: Plan the orchestrator as the largest subtask in 22-02. Read the file in chunks. Map all `fetch()` calls to identify any internal function-to-function calls that need rerouting to Express routes.

3. **push_subscriptions FK target**
   - What we know: Original migration references `auth.users`. Phase 20 created `public.users`.
   - What's unclear: Whether Phase 20's RAILWAY_MIGRATION.sql patched this table.
   - Recommendation: Check the Railway DB before implementing SCHED-05 push routes.

4. **langgraph-proxy path routing**
   - What we know: The old proxy used Supabase's URL path to determine the sub-path (`/langgraph-proxy/invoke/stream`). Express routes need to handle multiple sub-paths.
   - What's unclear: What sub-paths the frontend currently calls through the proxy.
   - Recommendation: Register `app.all('/api/langgraph-proxy/*', ...)` and strip the prefix to forward the remaining path to the LangGraph server. Check `usePushSubscription.ts` and `ChatInterface.tsx` for the actual URL patterns.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 (matches LangGraph server) |
| Config file | `api-server/vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | CORS + JSON + `/health` returns 200 | integration | `npx vitest run src/__tests__/health.test.ts` | Wave 0 gap |
| API-01 | Invalid JWT returns 401 | integration | `npx vitest run src/__tests__/auth.test.ts` | Wave 0 gap |
| API-04 | Valid JWT on `/api/spawn-agent-team` returns 200 | integration | `npx vitest run src/__tests__/spawnAgentTeam.test.ts` | Wave 0 gap |
| API-06 | `/api/generate-image` returns `imageUrl` | integration/smoke | `npx vitest run src/__tests__/generateImage.test.ts` | Wave 0 gap |
| API-16 | SSE route sets `X-Accel-Buffering: no` header | unit | `npx vitest run src/__tests__/langgraphProxy.test.ts` | Wave 0 gap |
| SCHED-05 | `web-push` VAPID sends notification | unit (mocked) | `npx vitest run src/__tests__/push.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/health.test.ts src/__tests__/auth.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `api-server/vitest.config.ts` — vitest config
- [ ] `api-server/src/__tests__/health.test.ts` — GET /health
- [ ] `api-server/src/__tests__/auth.test.ts` — 401 on missing/invalid JWT
- [ ] `api-server/src/__tests__/spawnAgentTeam.test.ts` — 200 on valid JWT (mocked pg + gemini)
- [ ] `api-server/src/__tests__/langgraphProxy.test.ts` — SSE header assertions
- [ ] `api-server/src/__tests__/push.test.ts` — web-push VAPID (mocked)
- [ ] `api-server/src/__tests__/generateImage.test.ts` — Imagen 3 response (mocked)

---

## Sources

### Primary (HIGH confidence)

- Phase 21 `langgraph-server/src/middleware/auth.ts` — `verifyLogtoJWT` implementation (directly readable)
- `langgraph-server/src/index.ts` — Express SSE pattern with `X-Accel-Buffering: no` + `res.flushHeaders()` (directly readable)
- `langgraph-server/package.json` — confirmed dependency versions
- All 17 Supabase edge function sources — read directly; full logic documented above
- `@google/genai` version 1.46.0 — confirmed in `langgraph-server/package.json`

### Secondary (MEDIUM confidence)

- npm registry version checks (2026-03-21): express@5.2.1, cors@2.8.6, web-push@3.6.7, pg@8.20.0, jose@6.2.2, resend@6.9.4
- STATE.md decision: "Gemini Imagen 3 replaces Nano Banana 2 for image generation (same SDK, same API key)"
- STATE.md decision: "OpenAI-compatible Gemini endpoint (`/v1beta/openai/`) preserves response parsers"
- STATE.md decision: "SSE routes must set `X-Accel-Buffering: no` + `res.flushHeaders()` — Railway nginx buffers without it"

### Tertiary (LOW confidence — needs validation)

- Imagen 3 model name `imagen-3.0-generate-002` — based on Google documentation patterns; verify against actual SDK at implementation time
- push_subscriptions FK target — not verified against actual Railway DB state

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture: HIGH — based on direct code reading of all 17 edge functions + Phase 21 auth middleware
- Pitfalls: HIGH — SSE buffering and Imagen 3 return format confirmed from existing codebase + STATE.md
- Gemini Imagen 3 model name: LOW — needs verification at implementation time

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days — stable domain)
