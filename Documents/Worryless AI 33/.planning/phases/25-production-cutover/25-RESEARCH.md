# Phase 25: Production Cutover — Research

**Researched:** 2026-03-21
**Domain:** Railway platform domain assignment, CORS configuration, end-to-end smoke testing of a multi-service deployment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAIL-08 | Railway-generated domains assigned to Frontend, API Server, and LangGraph Server | Domain assignment via Railway dashboard "Settings > Networking", or `railway domain` CLI. Domains follow `*.up.railway.app` pattern. Each service gets one domain by default. |

</phase_requirements>

---

## Summary

Phase 25 is a deployment and validation phase, not a code phase. All three Railway services (Frontend Nginx, API Server Express, LangGraph Server) have Dockerfiles and `railway.toml` files already authored in previous phases. The single remaining work is to: (1) assign Railway-generated public domains to each service, (2) update the API Server CORS `origin` from the current wildcard `"*"` to the specific production frontend domain, (3) rebuild/redeploy the Frontend Docker image with the now-known production `VITE_*` environment variable values baked in, and (4) run a structured smoke test confirming every critical user flow.

**A critical code fix is required before cutover can succeed:** `api-server/src/index.ts` currently sets `cors({ origin: "*" })`. This must be narrowed to the Railway-generated frontend domain. Without this change the backend is correctly functional but not production-hardened.

**A second critical finding:** `worrylesssuperagent/langgraph-server/src/llm/client.ts` still calls the **Lovable AI Gateway** (`ai.gateway.lovable.dev`) using `LOVABLE_API_KEY`. The STATE.md says the direct Gemini API was adopted in Phase 22 for API Server routes, but the LangGraph Server's internal `callLLM` helper was not updated. This will silently fail in production if `LOVABLE_API_KEY` is not set, or will route through a third-party gateway that may not be available. This must be resolved before the smoke test can pass.

**Primary recommendation:** Treat this phase as three ordered steps — (A) fix code gaps, (B) configure Railway and assign domains, (C) run the smoke test checklist top-to-bottom.

---

## Standard Stack

### Core (already in project — no new installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Railway CLI | latest | `railway up`, `railway domain`, `railway variables set` | Official Railway deploy/config tool |
| cors (npm) | ^2.8.5 | Express CORS middleware | Already a dependency in api-server |
| nginx 1.27-alpine | 1.27 | Serves Vite SPA static bundle | Already in Frontend Dockerfile |
| node 22-slim / node 22-alpine | 22 | Runs API Server and LangGraph Server | Already in Dockerfiles |

### No new dependencies required for this phase.

---

## Architecture Patterns

### Service Layout (already built — confirming expected structure)
```
Railway Project
├── Frontend (Nginx container)           — port 80, HTTPS via Railway domain
│   ├── Dockerfile: multi-stage Node→Nginx
│   ├── railway.toml: healthcheckPath = "/"
│   └── VITE_ vars baked at build time (ARG in Dockerfile)
│
├── API Server (Express)                 — port 3000, HTTPS via Railway domain
│   ├── Dockerfile: node:22-alpine
│   ├── railway.toml: healthcheckPath = "/health"
│   └── Runtime env vars: DATABASE_URL, LOGTO_ENDPOINT, GEMINI_API_KEY, RESEND_API_KEY, etc.
│
└── LangGraph Server (Node + Playwright) — port 3001, HTTPS via Railway domain
    ├── Dockerfile: node:22-slim + Playwright Chromium
    ├── railway.toml: healthcheckPath = "/health", volume /playwright-data
    └── Runtime env vars: DATABASE_URL, REDIS_URL, LOGTO_ENDPOINT, GEMINI_API_KEY, etc.
```

### Pattern: Domain Assignment Order
Railway domain assignment must happen in a specific order because VITE_ vars are baked into the Frontend Docker image at build time:
1. Assign domains to API Server and LangGraph Server first (so their URLs are known)
2. Set VITE_* build args on the Frontend service with the real URLs
3. Trigger a fresh Frontend build/deploy (rebuilds Docker image with correct env baked in)
4. Assign domain to Frontend
5. Update API Server CORS to use the Frontend domain
6. Redeploy API Server (config-only change, no rebuild needed)

### Pattern: Railway Reference Variables
Railway supports `${{SERVICE_NAME.RAILWAY_PUBLIC_DOMAIN}}` as a reference variable that auto-resolves at deploy time. This is the recommended approach for `VITE_API_URL` and `VITE_LANGGRAPH_URL` in the Frontend service — Railway substitutes the value before the Docker build ARG is passed.

**Confirmed in REQUIREMENTS.md:** ENV-04 explicitly calls this pattern out: `${{API_SERVER.RAILWAY_PUBLIC_DOMAIN}}`.

---

## Critical Code Gaps Found in Audit

### Gap 1: API Server CORS Wildcard (SECURITY + CORS FIX REQUIRED)
**File:** `api-server/src/index.ts` line 7
**Current code:**
```typescript
cors({ origin: "*", methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] })
```
**Required for production:**
```typescript
cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
})
```
Then set `CORS_ORIGIN=https://<frontend-domain>.up.railway.app` as a Railway service variable on the API Server. The fallback `"*"` keeps local dev working without an env var.

### Gap 2: LangGraph Server LLM Client uses Lovable AI Gateway (FUNCTIONAL FAILURE RISK)
**File:** `worrylesssuperagent/langgraph-server/src/llm/client.ts`
**Current code:** Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`.
**Contradiction with STATE.md:** Phase 22 decision states "Direct Gemini API calls replacing Lovable AI Gateway" — but this was applied to the API Server routes only. The LangGraph Server's internal `callLLM` helper was never updated.

This affects: heartbeat agent runs (cadence engine calls `callLLM`), any direct LLM invocations from tool files in `src/tools/`.

**Remediation:** Update `llm/client.ts` to use the OpenAI-compatible Gemini endpoint pattern already established in the API Server:
```typescript
// Consistent with API Server: uses generativelanguage.googleapis.com/v1beta/openai/
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const API_KEY = process.env.GEMINI_API_KEY;
```
Then set `GEMINI_API_KEY` on the LangGraph Server service in Railway.

### Gap 3: accountant parse-receipt tool still uses LOVABLE_API_KEY
**File:** `worrylesssuperagent/langgraph-server/src/tools/accountant/parse-receipt.ts`
**Issue:** Uses `process.env.LOVABLE_API_KEY` directly. Same pattern as Gap 2 — must be updated alongside `llm/client.ts`.

### Gap 4: Frontend VITE_ vars baked at Docker build time
**Impact on deployment sequence:** The Frontend Docker image must be **rebuilt** (not just redeployed) after the API Server and LangGraph Server domains are known. Railway's reference variables (`${{SERVICE_NAME.RAILWAY_PUBLIC_DOMAIN}}`) handle this automatically if the Frontend service is configured to use them as build args. If not configured, the Nginx container will serve a bundle with empty `VITE_API_URL` and all API calls will fail silently (`console.error('[api] VITE_API_URL is not set')` but no thrown error).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTPS/TLS for Railway services | Custom cert provisioning | Railway auto-provisions TLS for `*.up.railway.app` domains | Free, automatic, zero config |
| CORS preflight handling | Manual OPTIONS handler | `cors` npm package already in dependencies | Handles preflight correctly including complex headers |
| Health check endpoint | Custom monitoring | Railway uses the `healthcheckPath` in `railway.toml` | Already configured for all 3 services |
| Domain DNS propagation wait | Polling scripts | Railway dashboard shows propagation status | Domains are active within ~30 seconds of assignment |
| Service-to-service auth in Railway | VPN or mTLS | Railway private networking (`*.railway.internal`) already handles internal trust | ENV-03 decision already made |

---

## Common Pitfalls

### Pitfall 1: VITE_ vars not baked into Frontend build
**What goes wrong:** App loads, Logto auth redirect works, but every API call fails with `net::ERR_FAILED` or a CORS error to `undefined`.
**Why it happens:** `VITE_API_URL` is empty string at runtime because Docker ARG was not passed during build. The frontend's `api.ts` calls `fetch("undefined/api/...")` which silently 404s.
**How to avoid:** Confirm Railway Frontend service has `VITE_API_URL`, `VITE_LANGGRAPH_URL`, `VITE_LOGTO_*`, and `VITE_VAPID_PUBLIC_KEY` as service variables with values before triggering a deploy. Check with `railway variables --service <frontend>`.
**Warning signs:** `console.error('[api] VITE_API_URL is not set')` in browser devtools.

### Pitfall 2: CORS error on production API calls
**What goes wrong:** Frontend loads, but every authenticated API call returns a CORS preflight error in the browser console: `Access-Control-Allow-Origin` header missing or does not match.
**Why it happens:** `CORS_ORIGIN` env var on API Server is set to the wrong domain, or the API Server was not redeployed after setting `CORS_ORIGIN`.
**How to avoid:** After setting `CORS_ORIGIN`, trigger a Railway redeploy of the API Server. Verify with `curl -I -H "Origin: https://<frontend-domain>.up.railway.app" https://<api-domain>.up.railway.app/health`.
**Warning signs:** Browser Network tab shows preflight OPTIONS returning 204 but with no `access-control-allow-origin` header.

### Pitfall 3: SSE streaming buffered by Railway proxy
**What goes wrong:** Chat messages appear all at once after a long pause instead of streaming token-by-token.
**Why it happens:** Railway's load balancer buffers SSE unless `X-Accel-Buffering: no` is set. The LangGraph Server's `/invoke/stream` already sets this header (confirmed in `src/index.ts` line 166) and the API Server's `langgraphProxy` route was flagged in Phase 22 as needing it. Verify it is present.
**How to avoid:** Confirm `X-Accel-Buffering: no` is set in `langgraphProxy.ts` route. Test streaming in production by observing delta events appearing incrementally.
**Warning signs:** No visible stream tokens; full response appears after 10-30 second delay.

### Pitfall 4: LangGraph Server LOVABLE_API_KEY missing causes silent tool failure
**What goes wrong:** Agent chat returns "I encountered an error" or heartbeat jobs silently fail without surfacing insights. No obvious error in logs.
**Why it happens:** `callLLM` in `langgraph-server/src/llm/client.ts` throws `"LOVABLE_API_KEY environment variable is required"` if the key is absent, which propagates as an unhandled agent error.
**How to avoid:** Complete Gap 2 fix (migrate `callLLM` to Gemini endpoint + `GEMINI_API_KEY`) before deploying. Alternatively, set `LOVABLE_API_KEY` as a temporary workaround — but this requires an active Lovable account.
**Warning signs:** `POST /invoke/stream` returns `{"type":"error","message":"LOVABLE_API_KEY environment variable is required"}`.

### Pitfall 5: Logto redirect URI not registered for production domain
**What goes wrong:** After clicking "Sign In", Logto redirects back with `redirect_uri_mismatch` error.
**Why it happens:** Logto's application configuration only has localhost or old URLs registered. The new `https://<frontend-domain>.up.railway.app/callback` URI must be added.
**How to avoid:** In Logto admin console, update the application's "Redirect URIs" to include the production callback URL before smoke testing auth.
**Warning signs:** Logto error page after sign-in redirect with error code `redirect_uri_mismatch`.

### Pitfall 6: Redis TLS silent failure on fresh deploy
**What goes wrong:** LangGraph Server starts without error but BullMQ heartbeat jobs never fire. No error logs.
**Why it happens:** `REDIS_URL` starts with `rediss://` (TLS) but the `tls: {}` option is not being applied. Already documented in STATE.md (Phase 23), and handled in `cadence/redis.ts` — but verify `REDIS_URL` in production actually uses `rediss://`.
**How to avoid:** Check `REDIS_URL` Railway variable — if Railway provisioned Redis, it will be `rediss://`. The `createRedisConnection()` function already handles this correctly by detecting the prefix.
**Warning signs:** No `[cadence-dispatcher]` or `[heartbeat-worker]` log lines after 2 minutes of uptime.

### Pitfall 7: Missing PostgreSQL migration for get_due_cadence_agents()
**What goes wrong:** Cadence dispatcher tick runs but no agents are ever dispatched.
**Why it happens:** STATE.md Phase 23 note: `get_due_cadence_agents()` is NOT in the main `PRODUCTION_MIGRATION.sql` — it was in a standalone migration `20260321000001`. Must be applied to Railway PostgreSQL before the dispatcher runs.
**How to avoid:** Verify the function exists: `SELECT proname FROM pg_proc WHERE proname = 'get_due_cadence_agents';`. If missing, apply the standalone migration.
**Warning signs:** `[cadence-dispatcher] No due agents found` on every tick even after activating an agent team.

---

## Environment Variable Master List

### API Server (`api-server/`)
| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Railway PostgreSQL | Internal: `postgresql://postgres:xxx@postgres.railway.internal:5432/railway` |
| `LOGTO_ENDPOINT` | Logto Railway service | e.g. `https://logto.up.railway.app` |
| `GEMINI_API_KEY` | Developer | Required for generate-content, generate-image, generate-invoice-image |
| `RESEND_API_KEY` | Resend | Required for send-validation-email, send-test-email, invoice chasing |
| `FIRECRAWL_API_KEY` | Firecrawl | Required for crawl-business-website |
| `APIFY_API_TOKEN` | Apify | Required for generate-leads |
| `VAPID_PUBLIC_KEY` | Generated | `web-push generate-vapid-keys` output |
| `VAPID_PRIVATE_KEY` | Generated | `web-push generate-vapid-keys` output |
| `CORS_ORIGIN` | Runtime | Set to `https://<frontend-domain>.up.railway.app` after domain is known |

### LangGraph Server (`worrylesssuperagent/langgraph-server/`)
| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Railway PostgreSQL | Same internal URL as API Server |
| `REDIS_URL` | Railway Redis | Should start with `rediss://` for TLS |
| `LOGTO_ENDPOINT` | Logto Railway service | Same as API Server |
| `GEMINI_API_KEY` | Developer | After Gap 2 fix — replaces LOVABLE_API_KEY |
| `RESEND_API_KEY` | Resend | For `chase-invoice` and `send-outreach` tools |
| `FIRECRAWL_API_KEY` | Firecrawl | For Marketer research + Sales prospect tools |
| `APIFY_API_TOKEN` | Apify | For Sales lead generation tool |
| `GOOGLE_CLIENT_ID` | Google OAuth | For Personal Assistant Gmail/Calendar |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | For Personal Assistant Gmail/Calendar |
| `VAPID_PUBLIC_KEY` | Generated | Same key pair as API Server |
| `VAPID_PRIVATE_KEY` | Generated | Same key pair as API Server |
| `PORT` | Hardcoded | 3001 (set in Dockerfile ENV) |

### Frontend (`worrylesssuperagent/` — build-time ARGs)
| Variable | Source | Notes |
|----------|--------|-------|
| `VITE_API_URL` | Railway reference var | `https://${{API_SERVER.RAILWAY_PUBLIC_DOMAIN}}` |
| `VITE_LANGGRAPH_URL` | Railway reference var | `https://${{LANGGRAPH_SERVER.RAILWAY_PUBLIC_DOMAIN}}` |
| `VITE_LOGTO_ENDPOINT` | Logto Railway service | Full Logto public URL |
| `VITE_LOGTO_APP_ID` | Logto admin | App ID from Logto SPA application |
| `VITE_LOGTO_API_RESOURCE` | Logto admin | API resource identifier |
| `VITE_VAPID_PUBLIC_KEY` | Generated | Same as server VAPID_PUBLIC_KEY (public half only) |

---

## Smoke Test Checklist

The plan must codify these as sequential verification steps. All must pass before phase is complete.

### Tier 1: Service Availability
- [ ] `GET https://<frontend-domain>.up.railway.app/` returns 200 (HTML shell)
- [ ] `GET https://<api-domain>.up.railway.app/health` returns `{"status":"ok"}`
- [ ] `GET https://<langgraph-domain>.up.railway.app/health` returns `{"status":"ok","checkpointer":"connected","store":"connected"}`

### Tier 2: Auth Flow
- [ ] Navigate to frontend URL → redirected to Logto sign-in page (not a blank page, not 404)
- [ ] Create new account via email/password → lands on onboarding flow
- [ ] Complete 11-step onboarding → Dashboard rendered with CoS agent visible

### Tier 3: Core Agent Interaction
- [ ] Open Chief of Staff chat → type a message → streaming response appears (token-by-token, not all-at-once)
- [ ] Agent team activation → at least one specialist agent visible in team view

### Tier 4: Background Systems
- [ ] Scheduled heartbeat fires (wait up to 10 minutes after enabling cadence on an agent) → insight appears in dashboard without user prompt
- [ ] VAPID push subscription: browser prompts for push permission after opt-in toggle

### Tier 5: External Integrations
- [ ] Image generation: request Marketer to create a brand image → image renders in chat (base64 data URI, not broken img tag)
- [ ] Email sending: trigger a test email via Settings or Agent tool → email arrives in inbox (Resend delivery)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (api-server: vitest ^4.1.0, frontend: vitest via vite config) |
| Config file | `api-server/vitest.config.ts`, `worrylesssuperagent/vitest.config.ts` |
| Quick run command (api-server) | `cd api-server && npm test` |
| Quick run command (frontend) | `cd worrylesssuperagent && npm test` |
| Full suite command | `cd api-server && npm test && cd ../worrylesssuperagent && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Note |
|--------|----------|-----------|-------------------|------|
| RAIL-08 | Domains assigned, services reachable | smoke / manual | `curl https://<domain>/health` | Infrastructure test — manual verification, no unit test possible |
| RAIL-08 | First-time user flow end-to-end | e2e / manual | Manual browser walkthrough | Requires live Railway environment |
| RAIL-08 | Heartbeat fires and surfaces insight | integration / manual | Observe Railway logs after cadence tick | Requires active agent + Redis |
| RAIL-08 | Image generation succeeds | integration / manual | Send chat message requesting image | Requires GEMINI_API_KEY |
| RAIL-08 | Email sending succeeds | integration / manual | Trigger test email from Settings | Requires RESEND_API_KEY |

**Note:** RAIL-08 is entirely an infrastructure/deployment requirement. No automated unit tests can validate that Railway domains are assigned or that production environment variables are correct. The validation gate is the smoke test checklist above.

### Wave 0 Gaps
- No test infrastructure gaps. Existing Vitest suites cover unit behavior. Smoke tests are manual by nature.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Edge Functions | Express routes on Railway API Server | Phase 22 | All API calls now go to Railway domain |
| Supabase Auth | Logto on Railway | Phase 21 | Frontend callback URL must be registered in Logto |
| pg_cron + pgmq | BullMQ + node-cron + Redis | Phase 23 | Redis URL required; TLS detection already implemented |
| Lovable AI Gateway (LangGraph tools) | Direct Gemini API (INCOMPLETE — Gap 2) | Phase 22 API Server only | Requires code fix in LangGraph Server llm/client.ts |
| CORS wildcard `"*"` | Domain-locked CORS_ORIGIN env var | This phase | Prevents cross-origin requests from non-frontend origins |

---

## Open Questions

1. **Is Logto deployed and its domain known?**
   - What we know: Logto is configured and working (Phases 21, 24 complete). Its public Railway URL must be known before `LOGTO_ENDPOINT` can be set on API Server and LangGraph Server.
   - What's unclear: Current deployed state of the Logto Railway service — phase 19 (Logto service provisioning) was marked Pending in REQUIREMENTS.md traceability but Phase 21 and 24 are marked Complete, implying Logto is running.
   - Recommendation: Verify `LOGTO_ENDPOINT` is already set as a service variable or document it as a manual prerequisite.

2. **Are RAIL-01 (PostgreSQL) and RAIL-02 (Redis) actually deployed?**
   - What we know: DB-01 through DB-05 are marked Complete (migrations applied), SCHED requirements are Complete — implying PostgreSQL and Redis are running on Railway.
   - What's unclear: REQUIREMENTS.md still shows RAIL-01 and RAIL-02 as unchecked `[ ]`. This may be a documentation lag or a genuine blocker.
   - Recommendation: Treat as already provisioned based on downstream completions, but verify by checking Railway dashboard before assigning domains.

3. **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET OAuth redirect URIs**
   - What we know: Google OAuth is configured for Personal Assistant (AUTH-06 Complete). The authorized redirect URI in Google Cloud Console must include the production Logto callback URL.
   - What's unclear: Whether the Google OAuth app's authorized redirect URIs have been updated for the Railway-hosted Logto instance.
   - Recommendation: Add `https://<logto-domain>.up.railway.app/callback/google-universal` to Google Cloud Console OAuth authorized redirect URIs as part of cutover.

---

## Sources

### Primary (HIGH confidence)
- Codebase audit (direct file reads) — api-server/src/index.ts, langgraph-server/src/index.ts, langgraph-server/src/llm/client.ts, all railway.toml files, all Dockerfiles
- `.planning/REQUIREMENTS.md` — authoritative list of env vars, service requirements
- `.planning/STATE.md` — phase decisions, known pitfalls

### Secondary (MEDIUM confidence)
- Railway documentation pattern for `railway.toml` + `RAILWAY_PUBLIC_DOMAIN` reference variables — consistent with Railway's published docs on service networking

### Tertiary (LOW confidence — no external verification performed)
- Railway domain propagation timing (~30 seconds) — based on general Railway knowledge, not verified against current docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, no new installs
- Architecture: HIGH — all Dockerfiles and railway.toml files already authored and read
- Code gaps: HIGH — found by direct file audit (not inferred)
- Pitfalls: HIGH for known codebase issues (Gaps 1-4), MEDIUM for Railway-specific platform behavior
- Smoke test checklist: HIGH — derived directly from phase success criteria in REQUIREMENTS.md

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable infrastructure — no fast-moving dependencies)
