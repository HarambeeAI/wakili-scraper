# Pitfalls Research

**Domain:** Supabase → Railway migration — self-hosted PostgreSQL, Logto auth, Express API, direct Gemini API
**Researched:** 2026-03-21
**Confidence:** HIGH (codebase-grounded + official documentation) / MEDIUM (third-party ecosystem patterns)

---

## Critical Pitfalls

Mistakes that cause data loss, broken auth, or a non-functional production app.

---

### Pitfall 1: Auth User UUIDs Become Orphaned Keys in Migrated Data

**What goes wrong:**
Supabase stores users in `auth.users` with UUID primary keys. Every row in `public.profiles`, `user_agents`, `tasks`, `notifications`, `document_embeddings`, `langgraph.store`, and `langgraph.checkpoints` has a `user_id` UUID foreign key that references those Supabase-generated UUIDs. Logto generates its own user IDs (also UUIDs, but different values). If you migrate users into Logto and Logto assigns new IDs, every existing `user_id` foreign key in your 20+ table schema becomes a dangling reference pointing to non-existent users. The entire business context, agent workspaces, task history, and LangGraph checkpoints for every existing user is now orphaned.

**Why it happens:**
Teams assume "UUID is UUID" and migrate users by re-registering them in Logto, getting fresh IDs. They migrate the database separately. The two ID namespaces never align.

**How to avoid:**
Export `auth.users` from Supabase including `id` (the UUID), `email`, and `encrypted_password`. Import into Logto's user store via the Management API with the **explicit `id` field set** to preserve the original UUID. Logto's user import API accepts a custom `id` field. Verify the UUID match before any user-facing traffic is cut over. Script: `SELECT id, email FROM auth.users` → POST to `/api/users` with `{ "id": "<original_uuid>", ... }`.

**Warning signs:**
- Users can log in but see an empty dashboard (new Logto ID, no `profiles` row)
- `profiles` table shows rows but agent queries return empty (UUID mismatch)
- LangGraph threads return no history for authenticated users

**Phase to address:**
Auth migration phase (first phase of v2.1). Must be resolved before any other data migration proceeds.

---

### Pitfall 2: Supabase Password Hashes Not Portable Without Explicit Algorithm Declaration

**What goes wrong:**
Supabase uses bcrypt to hash passwords (stored in `auth.users.encrypted_password`). If you export the hash string and import it into Logto without specifying `passwordAlgorithm: "Bcrypt"`, Logto will treat the raw bcrypt hash string as an Argon2 digest or reject it. Users will be unable to log in and will need to reset their passwords — causing a forced password reset for every existing user in production.

**Why it happens:**
Logto's default hashing algorithm is Argon2. The import API uses Argon2 by default if `passwordAlgorithm` is omitted from the import payload.

**How to avoid:**
When calling Logto's user import API, always include:
```json
{
  "passwordDigest": "<bcrypt_hash_from_supabase>",
  "passwordAlgorithm": "Bcrypt"
}
```
Logto supports bcrypt natively and will automatically re-hash to Argon2 on the user's first successful sign-in. Confirm by logging in as a test user post-migration before cutting over DNS.

**Warning signs:**
- All migrated users get "invalid credentials" on first login attempt
- Password reset flow works (confirming the email/ID mapping is correct, but hash is broken)

**Phase to address:**
Auth migration phase. Run a test migration with a seed user and verify login before bulk import.

---

### Pitfall 3: JWT `sub` Claim Format Differences Break All Downstream Authorization

**What goes wrong:**
Every Supabase Edge Function validates auth by calling `supabase.auth.getUser()` which internally validates the JWT and returns a `user.id` that matches the Supabase `auth.users` UUID. The frontend sends `Authorization: Bearer <supabase_jwt>`. After migrating to Logto, Logto issues its own JWTs signed with a different secret and a different JWKS endpoint. The `sub` claim in a Logto JWT uses the same UUID format (if you preserved IDs), but the JWT is signed with Logto's RSA key, not Supabase's JWT secret. Any code that still tries to validate tokens with the old Supabase JWT secret (`SUPABASE_JWT_SECRET`) will reject every Logto token with a 401.

**Why it happens:**
The Express conversion of `langgraph-proxy` validates JWTs by calling `createClient(supabaseUrl, supabaseAnonKey)` and then `supabase.auth.getUser()`. This approach hard-codes Supabase as the token validator. After cutover, the same middleware pattern must instead verify against Logto's JWKS endpoint using `jose` or `jsonwebtoken`.

**How to avoid:**
Replace Supabase JWT validation in every Express route with:
```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';
const JWKS = createRemoteJWKSet(new URL(`${LOGTO_ENDPOINT}/oidc/jwks`));
const { payload } = await jwtVerify(token, JWKS, { issuer: LOGTO_ISSUER });
const userId = payload.sub; // same UUID as before if IDs were preserved
```
The `sub` claim value in Logto JWTs equals the Logto user ID — which must match the preserved Supabase UUID.

**Warning signs:**
- All API calls return 401 after auth cutover
- `jwtVerify` throws `JWSSignatureVerificationFailed`
- Supabase client SDK throws "JWT expired" on tokens that are still fresh

**Phase to address:**
API layer migration phase. Every Express route that previously called `supabase.auth.getUser()` must be audited (23 functions total).

---

### Pitfall 4: pgmq Extension Not Available on Railway's Default PostgreSQL Image

**What goes wrong:**
The heartbeat scheduler uses `pgmq` for durable job queuing (`pgmq.create('heartbeat_jobs')`, `pgmq_public.rpc('read', ...)`, `pgmq_public.rpc('delete', ...)`). Railway's built-in PostgreSQL template does not include `pgmq` — it is a Supabase-specific bundled extension. Running the current migrations on Railway's default Postgres will fail at `SELECT pgmq.create('heartbeat_jobs')` with `ERROR: schema "pgmq" does not exist`. The entire proactive cadence engine stops working.

**Why it happens:**
Teams assume Railway's PostgreSQL supports all the same extensions as Supabase's PostgreSQL. Supabase bundles 50+ extensions including `pgmq`, `pg_cron`, and `pg_net` that are not in vanilla PostgreSQL images.

**How to avoid:**
Do not attempt to port `pgmq` to Railway. Replace the entire queue pattern with BullMQ + Redis (Railway has a native Redis service and a `fastify-bullmq` template). The architectural change:
- `pgmq.create('heartbeat_jobs')` → BullMQ Queue named `heartbeat_jobs`
- `pgmq_public.rpc('read', { n: 5, sleep_seconds: 30 })` → BullMQ Worker with `concurrency: 5`
- Visibility timeout (30s) → BullMQ `lockDuration: 30000`
- Manual `pgmq_public.rpc('delete', ...)` → BullMQ auto-acks on worker completion
The `heartbeat-dispatcher` function (which enqueues) and `heartbeat-runner` function (which dequeues and processes) both need to be rewritten as Express routes + BullMQ producers/workers.

**Warning signs:**
- Migration fails at any SQL file containing `pgmq.create` or `pgmq_public`
- Heartbeat cadence appears configured but no agents fire
- No errors surface because the dispatcher silently fails to enqueue

**Phase to address:**
Scheduling replacement phase. Must be designed before database migration to avoid running the pgmq migrations at all on Railway.

---

### Pitfall 5: pg_cron Extension Not Available on Railway — Entire Cadence Engine Stops

**What goes wrong:**
The cadence engine depends on `pg_cron` jobs to invoke the heartbeat dispatcher every 5 minutes (`cron.schedule('heartbeat_dispatcher', '*/5 * * * *', ...)`). Railway's PostgreSQL does not include `pg_cron`. The migrations `20260313000007_heartbeat_cron_jobs.sql` and `20260313000009_morning_digest_cron.sql` will fail silently or with errors when applied to Railway's Postgres. With no `pg_cron`, no cron jobs fire, no agents run proactively, and the core platform value (proactive AI team) is entirely absent from production.

**Why it happens:**
Same root cause as pgmq: Supabase bundles `pg_cron` as a managed extension. Railway does not.

**How to avoid:**
Replace `pg_cron` trigger with Railway's built-in cron job service (HTTP cron) or `node-cron` running inside the API server process. Railway supports HTTP cron triggers that call a route at a defined interval. The dispatcher becomes an Express route (`POST /internal/dispatch-heartbeats`) that Railway's cron calls every 5 minutes. This is more observable than a database-internal cron because it produces HTTP logs. The `node-cron` approach (`cron.schedule('*/5 * * * *', dispatcher)`) is simpler but risks cron execution stopping if the process restarts.

**Warning signs:**
- `cron.schedule` migration SQL fails with `ERROR: extension "pg_cron" does not exist`
- No heartbeat logs appear after deployment despite users having active agents
- `get_due_cadence_agents()` function works correctly (it's pure SQL) but is never called

**Phase to address:**
Scheduling replacement phase — same phase as pgmq replacement. Both must be solved together.

---

### Pitfall 6: RLS Removal Creates a Direct Data Exposure Window

**What goes wrong:**
Every `public.*` table in this codebase has RLS enabled with `auth.uid() = user_id` policies. When you remove Supabase and disable RLS (as required when moving to Express middleware auth), any query that reaches PostgreSQL without a `WHERE user_id = $1` clause will return data from all users. The LangGraph server already connects with `service_role` (bypasses RLS) — that is safe because the LangGraph server explicitly scopes queries by `user_id`. But the 23 converted Edge Functions query the database via Express, and any missing `WHERE user_id = $1` in a converted function will silently return cross-user data with no RLS to catch it.

**Why it happens:**
RLS acts as a safety net — it enforces authorization at the database level regardless of application bugs. When you remove it, a single missing WHERE clause in any Express route becomes a data leak. The Supabase pattern `supabase.from('tasks').select()` (no WHERE, but RLS scopes it automatically) becomes `SELECT * FROM tasks` — returning every user's tasks.

**How to avoid:**
1. Enable RLS in PostgreSQL even on Railway Postgres — it is a standard PostgreSQL feature, not Supabase-specific. RLS does not require `auth.uid()`. Replace with a custom function: `CREATE FUNCTION current_user_id() RETURNS UUID AS $$ SELECT current_setting('app.user_id', true)::UUID; $$` and set `SET LOCAL app.user_id = $1` in every DB connection before querying.
2. Alternatively, build an Express middleware layer that injects `user_id` into every query object and audits all queries to verify the filter is present.
3. Do not rely solely on application-level checks without database-level enforcement.

**Warning signs:**
- Converted route returns a list that "seems too large" during testing
- Row counts in responses do not match what a single user should see
- Any route where the original Supabase call had no `.eq('user_id', userId)` but worked (due to RLS)

**Phase to address:**
API layer migration phase. Every converted function must be audited against a checklist: does this query have an explicit `user_id` filter? RLS-on-Railway should be evaluated as the fallback safety net.

---

### Pitfall 7: Lovable AI Gateway Uses OpenAI-Compatible Format — Direct Gemini API Does Not

**What goes wrong:**
All 23 Edge Functions use the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) which exposes an OpenAI-compatible endpoint. The response format is:
```json
{ "choices": [{ "message": { "content": "..." } }] }
```
The current code reads `data.choices?.[0]?.message?.content` throughout. The **direct Gemini API** (`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent`) uses a completely different format:
```json
{ "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }
```
Switching to direct Gemini without updating the response parser will cause every LLM call to return `undefined`, silently producing empty agent responses or crashing with a `TypeError: Cannot read properties of undefined`.

**Why it happens:**
Teams assume "we're already calling Gemini through the gateway, so the format is the same." The gateway is an OpenAI-format adapter layer. The direct API is not.

**How to avoid:**
Use Gemini's OpenAI-compatible endpoint instead of the native endpoint:
```
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```
This endpoint accepts OpenAI-format request bodies and returns OpenAI-format responses. Model name becomes `gemini-2.0-flash` (not `google/gemini-3-flash-preview`). The only code changes needed are: swap the base URL, swap the `Authorization` header from `Bearer LOVABLE_API_KEY` to `Bearer GEMINI_API_KEY`, and update the model name string. Zero changes to response parsing.

**Warning signs:**
- All agent responses return empty strings or `undefined`
- No errors in logs (the `?.` optional chaining silences the undefined access)
- Heartbeat runner logs `severity=ok` for every agent even in clearly non-ok states

**Phase to address:**
API layer migration phase. Create a shared `callGemini(messages, options)` wrapper used by all 23 functions so the endpoint and response parsing are in one place.

---

### Pitfall 8: SSE Streaming Breaks Through Express Without Explicit Buffer Disabling

**What goes wrong:**
The `langgraph-proxy` Supabase function passes SSE streams directly through (`return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream' } })`). This works in Deno's `serve()` because Deno streams responses natively. In Express on Railway, if the response is buffered by Express's default middleware (compression, body-parser) or by Railway's proxy layer (nginx-based), the entire SSE stream is held in memory and delivered as one large chunk when the connection closes. The frontend's `EventSource` never receives incremental events — it either times out or receives everything at once at the end.

**Why it happens:**
Express does not stream by default without explicit `res.flushHeaders()` and proper response header setup. Railway's infrastructure may also add a buffering layer. The Deno `Response(readable_stream)` pattern has no Node.js equivalent — it must be manually reconstructed with `res.write()` in a loop.

**How to avoid:**
In Express, implement SSE proxying as:
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // disables nginx buffering on Railway
res.flushHeaders(); // critical: sends headers immediately
for await (const chunk of upstream.body) {
  res.write(chunk);
}
res.end();
```
The `X-Accel-Buffering: no` header is essential for Railway's nginx proxy layer. Without it, all SSE events are buffered and the frontend experiences complete streaming failure.

**Warning signs:**
- Chat UI shows "thinking..." indefinitely then all text appears at once
- `EventSource` `onmessage` fires only once at connection end
- Network inspector shows response body arriving in one transfer

**Phase to address:**
API layer migration phase. The `langgraph-proxy` route conversion is highest risk for this pattern.

---

### Pitfall 9: Deno-Specific APIs Silently Fail in Node.js Without Errors

**What goes wrong:**
The Edge Functions use multiple Deno-specific globals: `Deno.env.get()`, `jsr:@negrel/webpush` (JSR registry, not npm), URL imports from `https://esm.sh/` and `https://deno.land/std`, and the `serve()` function from `deno.land/std`. These are syntactically valid TypeScript but are runtime errors in Node.js. Specifically: `Deno` is not defined in Node.js (throws `ReferenceError`), `jsr:` imports are not supported by Node.js module resolution (throws `ERR_UNSUPPORTED_ESM_URL_SCHEME`), and URL imports (`https://esm.sh/resend@2.0.0`) fail with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

**Why it happens:**
The migration converts `.ts` files from Deno to Node.js but misses runtime-specific patterns embedded in the logic (not just the imports).

**How to avoid:**
Systematic audit checklist for each function:
1. Replace `Deno.env.get('KEY')` → `process.env.KEY`
2. Replace `https://esm.sh/[package]` imports → `import { X } from '[package]'` (npm)
3. Replace `https://deno.land/std/...` imports → npm equivalents (`npm:@std/...` or Node.js built-ins)
4. Replace `jsr:@negrel/webpush` → `web-push` npm package
5. Replace `serve(handler)` → `app.post('/route', handler)` in Express
6. Replace `new Response(body, { status, headers })` → `res.status(N).json(body)`
7. Replace `req.json()` → `req.body` (with `express.json()` middleware)
8. Replace `req.headers.get('authorization')` → `req.headers['authorization']`

**Warning signs:**
- `ReferenceError: Deno is not defined` at any point during startup
- Import errors: `Cannot find module 'https://esm.sh/...'`
- Function seems to load but env vars always return `undefined`

**Phase to address:**
API layer migration phase. Build a conversion script or checklist that flags each pattern automatically.

---

### Pitfall 10: LangGraph PostgresSaver Tables Need UUID Extension — Not Pre-Installed on Vanilla Postgres

**What goes wrong:**
The LangGraph schema uses `gen_random_uuid()` in several places (via Supabase's bundled `pgcrypto`/`uuid-ossp`). Vanilla Railway PostgreSQL 16+ has `gen_random_uuid()` built-in (it's a core function since PG 13), so this specific function is safe. However, the `document_embeddings` table's FK reference is `REFERENCES auth.users(id)` — the `auth` schema is a Supabase-specific schema that does not exist in vanilla PostgreSQL. Applying migrations with `REFERENCES auth.users(id)` will fail with `ERROR: schema "auth" does not exist`.

**Why it happens:**
Supabase adds a managed `auth` schema not present in standard PostgreSQL. Any table created with FK references to `auth.users` is coupled to Supabase.

**How to avoid:**
Before applying migrations to Railway's PostgreSQL:
1. Audit all migration files for `auth.users` references: `grep -r "auth.users" supabase/migrations/`
2. Replace `REFERENCES auth.users(id)` with `REFERENCES public.users(id)` — create a `public.users` table as the new identity table (populated from Logto user data via webhook or sync)
3. Alternatively, create an empty `auth` schema with an `auth.users` stub table just to satisfy FK constraints, then back-fill from Logto
4. Update all `ON DELETE CASCADE` policies referencing `auth.users`

Current count in this codebase: 15+ tables have `REFERENCES auth.users(id)`.

**Warning signs:**
- `pg_restore` or `psql` migration run fails at first table with `auth.users` FK
- Error: `ERROR: schema "auth" does not exist`
- `pg_dump --schema-only` from Supabase includes the `auth` schema but Railway's target does not have it

**Phase to address:**
Database migration phase. This must be resolved before running any migration on Railway's PostgreSQL.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep Supabase client SDK in frontend, point at Railway API | Zero frontend refactor | Supabase SDK expects Supabase-specific auth flows and Realtime; will break subtly on session refresh | Never — replace the SDK |
| Use pg_dump to copy all schemas including `auth` to Railway | Single command migration | `auth` schema contains Supabase-specific RLS triggers and GoTrue functions that won't work on vanilla Postgres | Never for auth schema, only for public schema |
| Skip RLS on Railway and rely only on Express middleware | Faster conversion, no RLS policy rewrite | One missing WHERE clause = silent data leak across all users | Never for user-scoped data |
| Use `node-cron` inside the API process for heartbeat dispatching | No extra Redis service | Cron stops when API process restarts; no distributed lock; duplicate fires on multi-instance deploy | Only in single-instance MVP with Railway restart policy |
| Hardcode Gemini model name `google/gemini-3-flash-preview` in Express | Zero code change from gateway format | Model name is Lovable-gateway-specific; direct Gemini API uses different model identifiers | Never — use env var `GEMINI_MODEL` |
| Skip data migration for LangGraph Store/checkpoints | Saves migration time | Users lose all agent memory, chat history, and in-flight HITL approvals | Only acceptable if explicitly communicated to users |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Logto user import | Omit `passwordAlgorithm: "Bcrypt"` in import payload | Always set `passwordAlgorithm: "Bcrypt"` when importing Supabase bcrypt hashes |
| Logto JWT validation | Validate with old `SUPABASE_JWT_SECRET` | Validate with Logto's JWKS endpoint using `jose.createRemoteJWKSet` |
| Gemini API direct | Call `generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent` | Use the OpenAI-compatible endpoint `/v1beta/openai/chat/completions` to preserve response format |
| Gemini streaming | Assume SSE format is identical to Lovable gateway | Verify `data:` event format — native Gemini SSE sends `data: {"candidates":[...]}` not `data: {"choices":[...]}` if not using the compat endpoint |
| Railway PostgreSQL | Run `supabase db dump` output directly | Filter out `auth`, `storage`, `pgmq`, `pgcron` schema objects before applying to Railway |
| BullMQ on Railway | Use default Redis connection without TLS | Railway Redis requires `tls: {}` in the IORedis connection options for production |
| Railway SSE proxy | Rely on default nginx buffering | Set `X-Accel-Buffering: no` response header on all SSE routes |
| Resend email (Express) | Import from `https://esm.sh/resend@2.0.0` | `import { Resend } from 'resend'` (npm package, standard Node.js) |
| Web push VAPID (Express) | Import from `jsr:@negrel/webpush` | `import webpush from 'web-push'` (npm) — different API surface, re-implement push logic |

---

## Performance Traps

Patterns that work in Supabase's managed environment but fail on Railway.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No connection pooling on Railway PostgreSQL | Timeouts under modest load, "too many clients" errors | Use `pg-pool` with `max: 10` connections in Express server; LangGraph server already pools | At ~20 concurrent users |
| `pgmq` visibility timeout replaced with BullMQ without tuning `lockDuration` | Same heartbeat job processed by two workers simultaneously | Set BullMQ `lockDuration` to match old `sleep_seconds: 30` (30000ms) | Immediately on concurrent worker deployment |
| Embedding generation with IVFFlat index on small dataset | Cosine similarity queries run full table scan | Only create IVFFlat index once `document_embeddings` has >10,000 rows (it's commented out in migration correctly) | Not a Railway-specific trap — existing code handles correctly |
| Railway container cold starts on free/hobby tier | First request after idle takes 10-30s; SSE client may timeout before connection established | Use Railway's Always On option or implement client-side retry with exponential backoff | Immediately if Railway sleeps the service |
| LangGraph Server + Playwright on same Railway container | Playwright's Chromium uses 300-500MB RAM; combined with LangGraph graph execution memory, container OOMs | Allocate at minimum 2GB RAM to LangGraph Railway service | On first Playwright browser launch under concurrent agent load |

---

## Security Mistakes

Migration-specific security issues.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Expose `SUPABASE_SERVICE_ROLE_KEY` as Railway env var for direct DB access | Service role key bypasses all RLS; if leaked via logs or error messages, full DB read/write | Retire the service role key after migration; use DATABASE_URL (postgres connection string) with a scoped DB user |
| Set `Access-Control-Allow-Origin: *` on all Express routes (copied from Edge Functions) | Any website can make authenticated API calls on behalf of logged-in users | Restrict CORS to your frontend Railway domain in production: `cors({ origin: 'https://app.worryless.ai' })` |
| Store `GEMINI_API_KEY` in frontend env vars (VITE_GEMINI_API_KEY) | API key exposed in browser JavaScript bundle; anyone can call Gemini at your expense | Gemini calls must stay server-side in Express. Frontend calls the Railway API, never Gemini directly |
| Logto Management API token in Railway env as a permanent credential | Management API tokens are powerful admin credentials; leaked token = full user database access | Use short-lived tokens via client credentials grant at migration time; rotate immediately after |
| Skip JWT expiry validation in Express routes | Tokens from years-old sessions remain valid indefinitely | Always verify `exp` claim in `jwtVerify` — `jose` does this by default, but confirm `clockTolerance` is not set too loosely |
| Direct database port exposed publicly on Railway | Anyone who discovers the Railway PostgreSQL host can attempt brute force | Railway databases are private by default; ensure no public networking is enabled on the DB service |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth migration:** Users can log in — but verify `user_id` in Logto matches the UUID in `public.profiles`. Query: `SELECT p.user_id, l.id FROM profiles p LEFT JOIN logto_users l ON p.user_id = l.id WHERE l.id IS NULL` should return zero rows.
- [ ] **pgmq replacement:** BullMQ queue is configured and workers start — but verify the dispatcher actually enqueues jobs. Check BullMQ dashboard shows non-zero job counts within 5 minutes of deployment.
- [ ] **pg_cron replacement:** Cron route exists in Express — but verify Railway's HTTP cron trigger is actually firing. Check Railway's cron execution logs, not just the route handler logs.
- [ ] **Gemini API swap:** LLM calls return text — but verify streaming works end-to-end. Test with a long prompt that forces multi-chunk streaming. Confirm `EventSource` fires multiple `onmessage` events, not one.
- [ ] **RLS removal:** Express routes return correct data for the authenticated user — but test with two different user accounts. Confirm user A cannot see user B's tasks, agents, or heartbeat logs.
- [ ] **SSE streaming:** `/langgraph-proxy` returns streamed responses — but verify `X-Accel-Buffering: no` header is present in the response. Confirm chat UI shows progressive token display, not a single chunk at end.
- [ ] **data_embeddings FK:** Migrations applied without errors — but query `\d document_embeddings` in Railway psql to confirm the FK constraint points to `public.users`, not `auth.users`.
- [ ] **Deno → Node conversion:** All 23 functions deployed — but run each once in staging and confirm no `ReferenceError: Deno is not defined` in Railway logs.
- [ ] **VAPID web push:** Push subscriptions table exists — but verify a test push notification actually reaches a browser. The `web-push` npm package API differs from `jsr:@negrel/webpush`.
- [ ] **LangGraph checkpoints:** Thread IDs in `langgraph.checkpoints` use user UUIDs as namespace — verify a post-migration LangGraph invocation creates a checkpoint row and the `thread_id` prefix matches the new Logto user UUID.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| UUID mismatch (orphaned user data) | HIGH | Export Logto users, identify UUID mismatches, write UPDATE script to re-key all `user_id` FK columns across all tables in a transaction, re-import |
| Password hash import failure (users can't log in) | MEDIUM | Trigger password reset emails via Logto Management API for all affected users; communicate via email |
| JWT validation failure (all 401s) | LOW | Roll back Express JWT middleware to accept both old Supabase tokens and new Logto tokens during transition window using try/catch on both validators |
| pgmq migration fails on Railway | LOW | Skip pgmq migrations entirely; deploy BullMQ + Redis before running DB migrations |
| SSE buffering (no streaming) | LOW | Add `X-Accel-Buffering: no` header and redeploy; no data loss |
| Gemini response format wrong (empty responses) | LOW | Switch to OpenAI-compat endpoint, redeploy; affects UX but no data loss |
| `auth.users` FK failures in migrations | MEDIUM | Create `auth` schema stub with minimal `users` table before running public schema migrations; or sed-replace all `auth.users` references before apply |
| RLS data leak discovered | CRITICAL | Immediately disable affected routes, audit query logs for cross-user data access, notify affected users per GDPR/data protection obligations, add database-level RLS or explicit WHERE filters |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| UUID orphan on auth migration | Auth migration (Phase 1 of v2.1) | Query: zero rows in `profiles LEFT JOIN logto_users ON user_id` where Logto ID is NULL |
| Password hash incompatibility | Auth migration (Phase 1) | Smoke test: migrated user can log in with original password |
| JWT format/secret mismatch | Auth + API layer (Phase 1-2) | All API routes return 200 with Logto JWT; 401 with expired/invalid JWT |
| pgmq unavailable | Scheduling replacement (before DB migration) | BullMQ worker processes first enqueued job within 30s |
| pg_cron unavailable | Scheduling replacement | Railway HTTP cron fires every 5 minutes; Express route logs confirm execution |
| RLS removal data leak | API layer migration (Phase 2) | Two-user cross-access test: user A cannot read user B's rows from any route |
| Lovable gateway → direct Gemini format | API layer migration (Phase 2) | All LLM-calling routes return non-empty text response; streaming returns incremental chunks |
| SSE buffering in Express | API layer migration (Phase 2) | Frontend streaming test confirms multiple `onmessage` events per response |
| Deno → Node.js API differences | API layer migration (Phase 2) | Zero `ReferenceError: Deno is not defined` in production Railway logs |
| `auth.users` FK in migrations | Database migration | `psql` migration run completes with zero errors on Railway PostgreSQL |
| LangGraph UUID namespace alignment | LangGraph + data migration (Phase 3) | Existing checkpoint rows are queryable by authenticated users after UUID preservation |

---

## Sources

- Logto user migration docs — password algorithm support: https://docs.logto.io/user-management/user-migration
- Supabase auth migration between projects: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects
- Railway PostgreSQL extension support: https://docs.railway.com/databases/postgresql
- Railway pgvector blog post (pgvector availability confirmed): https://blog.railway.com/p/hosting-postgres-with-pgvector
- Gemini OpenAI-compatible endpoint (Google official): https://ai.google.dev/gemini-api/docs/openai
- BullMQ on Railway template: https://github.com/railwayapp-templates/fastify-bullmq
- pgmq Railway feature request (not natively supported): https://station.railway.com/feedback/support-postgres-extensions-04b914a7
- Supabase auth schema excluded from default db dump: https://supabase.com/docs/reference/cli/supabase-db-dump
- Supabase JWT secret and session invalidation: https://supabase.com/docs/guides/auth/signing-keys
- Supabase password hashing (bcrypt): https://supabase.com/docs/guides/auth/password-security
- Better Auth Supabase migration guide (reference for bcrypt portability): https://better-auth.com/docs/guides/supabase-migration-guide
- Supabase RLS security pitfalls: https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9
- Gemini multi-part response OpenAI translation loss: https://github.com/router-for-me/CLIProxyAPI/issues/948

---
*Pitfalls research for: Supabase → Railway migration (v2.1 milestone)*
*Researched: 2026-03-21*
