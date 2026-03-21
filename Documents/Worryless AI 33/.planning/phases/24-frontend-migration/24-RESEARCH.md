# Phase 24: Frontend Migration - Research

**Researched:** 2026-03-21
**Domain:** React / Vite SPA migration — Supabase removal, Logto auth activation, Railway Nginx deploy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API Client Strategy**
- D-01: Create centralized `src/lib/api.ts` wrapping `fetch()` with auth token injection, `VITE_API_URL` base URL, JSON parsing, error normalization
- D-02: Simple patterns `api.get("/api/endpoint")`, `api.post("/api/endpoint", body)` — no Supabase-style `.from().select()` replication
- D-03: Token from `useAuth().getAccessToken()` (Logto) — API client accepts token param, hooks pass it in
- D-04: React Query (`@tanstack/react-query` v5, already installed) adopted for hooks replacing Supabase queries

**Database Query Replacement**
- D-05: All 29 files with supabase calls replaced with `fetch()` to Express API routes
- D-06: New Express routes needed for CRUD: profiles, invoices, transactions, leads, social_posts, notifications, user_agents, business_artifacts, tasks, threads, datasheets, outreach_emails, agent_assets, push_subscriptions, heartbeat_configs, agent_memory
- D-07: Routes follow Phase 22 pattern: `req.user.sub` for user_id, direct SQL via `pool.query()`

**Supabase Realtime Replacement**
- D-08: Replace Supabase Realtime with React Query `refetchInterval` polling — 30s for notifications, 60s for team data
- D-09: No SSE/WebSocket replacement for dashboard data
- D-10: `useNotifications` switches from `postgres_changes` to polling on `/api/notifications`

**Supabase Storage Replacement**
- D-11: File uploads converted to multipart form uploads to Express routes writing to Railway volume or returning base64
- D-12: `getPublicUrl()` calls replaced with `/api/files/:id`

**Auth Switchover**
- D-13: Big-bang swap — remove Auth.tsx Supabase auth entirely, replace with Logto sign-in redirect
- D-14: `LogtoProvider` already wraps app; `useAuth()` already provides userId, token, signIn, signOut
- D-15: Dashboard auth guard switches from `supabase.auth.getSession()` to `useLogto().isAuthenticated`
- D-16: Auth.tsx becomes redirect to Logto hosted login via `signIn()` — no custom form
- D-17: Callback.tsx (already exists) handles OIDC callback, redirects to `/dashboard`

**SSE/LangGraph Connection**
- D-18: `useAgentChat` updates base URL from Supabase function URL to `VITE_API_URL/api/langgraph-proxy`... wait — the direct LangGraph server already has `/invoke/stream`. The proxy in the API server should forward to LangGraph. Confirm: frontend calls `VITE_LANGGRAPH_URL/invoke/stream` directly (LangGraph server) OR goes via `VITE_API_URL/api/langgraph-proxy`. Per CONTEXT.md D-18: update to `VITE_API_URL/api/langgraph-proxy` (API server's proxy route from Phase 22).
- D-19: Auth header switches from Supabase session token to Logto access token

**Environment Variables**
- D-20: Remove: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- D-21: Add/configure: `VITE_API_URL`, `VITE_LANGGRAPH_URL`, `VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `VITE_LOGTO_API_RESOURCE`, `VITE_VAPID_PUBLIC_KEY`

**Nginx Dockerfile**
- D-22: Multi-stage Docker build: Node.js stage `npm run build`, Nginx stage serves `/usr/share/nginx/html`
- D-23: Nginx config includes SPA fallback `try_files $uri $uri/ /index.html`, gzip, cache headers for static assets
- D-24: `railway.toml` with `[build]` and `[deploy]` sections, health check on port 80

### Claude's Discretion
- React Query configuration (stale time, retry policies)
- Exact API client error handling structure
- File upload size limits and validation
- Nginx cache header durations
- Whether to create a ProtectedRoute component or keep Dashboard-level redirect

### Deferred Ideas (OUT OF SCOPE)
- ProtectedRoute wrapper component
- React Query adoption for ALL data fetching (progressive migration — only hooks touched)
- WebSocket/SSE realtime replacement (polling sufficient for v2.1)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAIL-06 | Frontend deployed on Railway as static Nginx container serving Vite build | Multi-stage Dockerfile pattern, railway.toml config, Nginx SPA config |
| FE-01 | `@supabase/supabase-js` removed from frontend dependencies | 29 files enumerated with full call-site audit |
| FE-02 | All Supabase client calls replaced with `fetch()` to Railway API Server | api.ts pattern, per-hook migration map |
| FE-03 | `@logto/react` LogtoProvider wrapping app with sign-in/sign-out/callback routes | LogtoProvider already in App.tsx; useAuth.ts already wired |
| FE-04 | `useAgentChat` hook updated to connect SSE to Railway LangGraph Server URL | Exact lines in useAgentChat.ts that need changing identified |
| FE-05 | All environment variables updated (`VITE_API_URL`, `VITE_LANGGRAPH_URL`, `VITE_LOGTO_*`) | Env var inventory complete |
| FE-06 | Vite build outputs static files served by Nginx container on Railway | Dockerfile + nginx.conf + railway.toml |
</phase_requirements>

---

## Summary

Phase 24 is a migration phase — the code already works; the task is replacing one transport layer (Supabase) with another (Express API + Logto). The hard work of the API server (Phase 22) and Logto integration (Phase 21) is already done. What remains is the frontend side of that contract.

The codebase has exactly 29 non-test, non-supabase-integration files that import from `@/integrations/supabase/client`. These fall into three categories: (1) hooks using `supabase.from(table)` for CRUD — these migrate to `api.ts` calls against the Express server's `/api/*` routes; (2) hooks using `supabase.auth.*` — these migrate to `useAuth()`/`useLogto()` equivalents; (3) hooks using Supabase Realtime channels — these migrate to React Query polling.

The three new deliverables are: `src/lib/api.ts` (centralized fetch client), `Dockerfile` (multi-stage Nginx build), and `nginx.conf` (SPA routing). The existing Logto scaffolding (`LogtoProvider` in App.tsx, `useAuth.ts`, `Callback.tsx`) is already production-ready and just needs env vars populated.

**Primary recommendation:** Build `api.ts` first (it unblocks all hook migrations), then migrate hooks in dependency order (independent hooks before hooks that consume data), then replace Dashboard auth guard, then Auth.tsx, then Dockerfile last.

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@logto/react` | 4.0.13 | Logto OIDC auth, `LogtoProvider`, `useLogto()`, `useHandleSignInCallback()` | Already in package.json; Phase 21 integration |
| `@tanstack/react-query` | 5.83.0 | Data fetching, caching, polling via `refetchInterval` | Already in package.json; QueryClientProvider already in App.tsx |
| `react-router-dom` | 6.30.1 | Client-side routing with `/callback` route | Already in use |
| `vite` | 5.4.19 | Build tool producing `dist/` | Already configured |
| `vitest` | 4.1.0 | Unit tests for hook migration | Already configured with jsdom |

### New deliverables (files to create, not install)

| File | Purpose | Pattern Source |
|------|---------|----------------|
| `src/lib/api.ts` | Centralized fetch wrapper with token injection | D-01 to D-03 |
| `Dockerfile` | Multi-stage Node build + Nginx serve | D-22 |
| `nginx.conf` | SPA fallback + gzip + cache headers | D-23 |
| `railway.toml` (frontend) | Railway build/deploy config | D-24 |

**No new npm installs required.** All needed libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
worrylesssuperagent/
├── src/
│   └── lib/
│       └── api.ts           # NEW: centralized fetch client
├── Dockerfile               # NEW: multi-stage Nginx container
├── nginx.conf               # NEW: SPA routing config
└── railway.toml             # NEW: Railway deploy config
```

### Pattern 1: API Client (`src/lib/api.ts`)

**What:** A thin wrapper around `fetch()` that injects the Logto access token and `VITE_API_URL` base URL. Accepts optional `token` parameter so hooks can pass the current Logto token without coupling to the auth hook.

**When to use:** Any hook or component that currently calls `supabase.from()` or `supabase.functions.invoke()`.

```typescript
// src/lib/api.ts
const BASE_URL = import.meta.env.VITE_API_URL as string;

interface ApiOptions {
  token?: string | null;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body: unknown, options?: ApiOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body: unknown, options?: ApiOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: ApiOptions) =>
    request<T>("DELETE", path, undefined, options),
};
```

**Key insight:** The token is passed in, not fetched inside `api.ts`. This keeps `api.ts` testable without auth context and prevents stale token issues.

### Pattern 2: React Query hook migration

**What:** Replace `useState` + `useEffect` + `supabase.from()` with `useQuery` + `api.get()`.

**When to use:** `useNotifications`, `useTeamData` — any hook that just reads data.

```typescript
// Before (supabase pattern)
const [notifications, setNotifications] = useState<Notification[]>([]);
useEffect(() => {
  supabase.from('notifications').select('*').eq('user_id', userId)
    .then(({ data }) => setNotifications(data ?? []));
}, [userId]);

// After (React Query + api.ts)
const { token } = useAuth();
const { data: notifications = [] } = useQuery({
  queryKey: ['notifications', userId],
  queryFn: () => api.get<Notification[]>(`/api/notifications?user_id=${userId}`, { token }),
  enabled: !!userId && !!token,
  refetchInterval: 30_000,  // replaces Supabase Realtime channel
  staleTime: 20_000,
});
```

### Pattern 3: Mutation hooks (write operations)

**What:** Replace direct `supabase.from().update()` calls with `useMutation` + `api.patch()`.

**When to use:** `useHeartbeatConfig.updateConfig()`, `useCadenceConfig.updateConfig()`, `usePushSubscription.subscribe()`.

```typescript
const { token } = useAuth();
const queryClient = useQueryClient();
const { mutateAsync: updateConfig } = useMutation({
  mutationFn: (patch: Partial<HeartbeatConfig>) =>
    api.patch(`/api/user-agents/${agentTypeId}/heartbeat`, patch, { token }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['heartbeat', agentTypeId] });
  },
});
```

### Pattern 4: Auth guard migration (Dashboard.tsx)

**What:** Replace `supabase.auth.onAuthStateChange` subscription with `useLogto().isAuthenticated`.

**Before:**
```typescript
// Dashboard.tsx (current)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    if (!session) navigate("/auth");
  });
  return () => subscription.unsubscribe();
}, [navigate]);
```

**After:**
```typescript
// Dashboard.tsx (migrated)
const { isAuthenticated } = useLogto();
const { userId, token } = useAuth();
useEffect(() => {
  if (!isAuthenticated) navigate("/auth");
}, [isAuthenticated, navigate]);
```

### Pattern 5: Auth.tsx → Logto redirect

**What:** Auth.tsx currently renders a custom sign-in/sign-up form. After migration it just calls `signIn()` and redirects.

```typescript
// Auth.tsx (migrated)
const Auth = () => {
  const { signIn } = useAuth();
  const { isAuthenticated } = useLogto();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      signIn();  // Redirects to Logto hosted UI
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to sign in...</p>
    </div>
  );
};
```

### Pattern 6: useAgentChat SSE migration

**What:** `useAgentChat.ts` currently builds URLs like `${supabaseUrl}/functions/v1/langgraph-proxy/...`. After migration these become `${VITE_API_URL}/api/langgraph-proxy/...` (Phase 22's proxy route).

**Exact changes in `useAgentChat.ts`:**
1. Remove `import { supabase }` and `import { useLangGraphFlag, getChatEndpoint }`
2. Remove `const supabaseUrl = import.meta.env.VITE_SUPABASE_URL`
3. Add `const { token } = useAuth()` and `const LANGGRAPH_BASE = import.meta.env.VITE_API_URL`
4. Replace `supabase.auth.getSession()` token fetches with the `token` from `useAuth()`
5. Replace all URL constructions:
   - `/functions/v1/langgraph-proxy/threads/${userId}` → `/api/langgraph-proxy/threads/${userId}`
   - `/functions/v1/langgraph-proxy/invoke/stream` → `/api/langgraph-proxy/invoke/stream`
   - `/functions/v1/langgraph-proxy/invoke/resume` → `/api/langgraph-proxy/invoke/resume`
6. Replace `supabase.from("profiles").select("business_stage")` with `api.get("/api/profiles/me", { token })` (or inline via useAuth userId)
7. Remove dual-mode `useLangGraph` flag entirely — always use LangGraph path (D-18)

### Pattern 7: Nginx SPA container

**What:** Multi-stage Dockerfile. Stage 1 builds Vite app. Stage 2 serves it with Nginx.

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_ vars must be passed at build time (not runtime)
ARG VITE_API_URL
ARG VITE_LOGTO_ENDPOINT
ARG VITE_LOGTO_APP_ID
ARG VITE_LOGTO_API_RESOURCE
ARG VITE_VAPID_PUBLIC_KEY
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Critical:** `VITE_*` env vars are **baked into the JS bundle at build time** by Vite (they are replaced via `import.meta.env`). They cannot be injected at container runtime. Railway must pass them as **build arguments** (`ARG` in Dockerfile), not just service variables. Use Railway's build arguments configuration or a startup script pattern (see Pitfall 3).

```nginx
# nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json;
  gzip_min_length 1024;

  # SPA fallback — must come before static file serving
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets (hashed filenames are content-addressed)
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Prevent caching the HTML shell (it must always be fresh for SPA routing)
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
```

```toml
# railway.toml (frontend service)
[build]
builder = "DOCKERFILE"
dockerfilePath = "worrylesssuperagent/Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Anti-Patterns to Avoid

- **Removing supabase types before the migration is done:** The `src/integrations/supabase/types.ts` file is imported by AccountantAgent for the `Json` type. Keep the types file until all component imports are updated, then delete it with the client.
- **Calling `useAuth()` inside `api.ts`:** This creates a hook dependency inside a utility function. The API client must be a plain function that receives the token as a parameter.
- **Lazy `VITE_API_URL` defaulting to empty string:** If `VITE_API_URL` is undefined (missing env var), `fetch("")` silently fails with an opaque network error. Add an explicit check on startup.
- **Using `useLangGraph` flag in migrated code:** Per D-18, always use the LangGraph path. Delete `useLangGraphFlag.ts` and `getChatEndpoint` after migrating all callers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state subscription | Custom polling for auth status | `useLogto().isAuthenticated` (reactive boolean) | Already reactive via LogtoProvider context |
| Token refresh | Custom token refresh timer | `useLogto().getAccessToken(resource)` | Logto SDK handles PKCE refresh automatically |
| SSE keepalive | Custom ping/pong | Native browser EventSource or readable stream reader | Already working in useAgentChat |
| React Query retry | Custom exponential backoff | `retry: 3` in QueryClient defaults | Built into TanStack Query |
| Nginx mime types | Custom mime.types | `nginx:1.27-alpine` includes full mime.types | Default Nginx image |

---

## File-by-File Migration Map

### Files with ONLY `supabase.from()` CRUD — Straightforward swap

| File | Supabase Tables Accessed | Express Route Needed |
|------|--------------------------|---------------------|
| `hooks/useNotifications.ts` | notifications (SELECT, UPDATE) | `GET /api/notifications`, `PATCH /api/notifications/:id` |
| `hooks/useTeamData.ts` | user_agents (SELECT), agent_heartbeat_log (SELECT) | `GET /api/team-data` (joined query) |
| `hooks/useHeartbeatConfig.ts` | user_agents (SELECT heartbeat cols, UPDATE) | `GET /api/user-agents/:agentTypeId/heartbeat`, `PATCH /api/user-agents/:agentTypeId/heartbeat` |
| `hooks/useCadenceConfig.ts` | user_agents (SELECT cadence_config, UPDATE) | `GET /api/user-agents/:agentTypeId/cadence`, `PATCH /api/user-agents/:agentTypeId/cadence` |
| `hooks/useAgentWorkspace.ts` | agent_workspaces (SELECT, UPDATE), available_agent_types (SELECT) | `GET /api/workspaces/:agentTypeId/:fileType`, `PATCH /api/workspaces/:agentTypeId/:fileType`, `GET /api/agent-types/:id` |
| `hooks/useAgentMarketplace.ts` | available_agent_types (SELECT), user_agents (SELECT, INSERT, UPDATE) | `GET /api/agent-types`, `GET /api/user-agents`, `POST /api/user-agents`, `PATCH /api/user-agents/:id` |
| `hooks/usePushSubscription.ts` | push_subscriptions (upsert, DELETE) | `POST /api/push-subscriptions`, `DELETE /api/push-subscriptions/:endpoint` |
| `components/dashboard/TaskList.tsx` | tasks (SELECT, INSERT, UPDATE, DELETE) | `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` |
| `components/dashboard/DashboardOverview.tsx` | profiles (SELECT), tasks (SELECT), notifications (SELECT) | Reuse above + `GET /api/profiles/me` |
| `components/dashboard/BusinessArtifacts.tsx` | business_artifacts (SELECT, INSERT, DELETE) | `GET /api/artifacts`, `POST /api/artifacts`, `DELETE /api/artifacts/:id` |
| `components/dashboard/CreateTaskDialog.tsx` | tasks (INSERT) | `POST /api/tasks` |
| `components/dashboard/DashboardHeader.tsx` | profiles (SELECT) | `GET /api/profiles/me` |
| `components/dashboard/AutomationPanel.tsx` | user_agents, available_agent_types | Reuse `/api/user-agents`, `/api/agent-types` |
| `components/onboarding/BusinessOnboarding.tsx` | profiles (UPDATE), supabase.functions.invoke("crawl-business-website") | `PATCH /api/profiles/me`, `POST /api/crawl-business-website` |
| `components/onboarding/AgentTeamSelector.tsx` | user_agents, supabase.functions.invoke("spawn-agent-team") | `POST /api/spawn-agent-team` |
| `components/onboarding/ConversationalOnboarding.tsx` | profiles (UPDATE), supabase.functions.invoke | `PATCH /api/profiles/me`, invoke routes |
| `components/agents/GenericAgentPanel.tsx` | profiles | `GET /api/profiles/me` |
| `components/agents/AccountantAgent.tsx` | invoices, transactions, datasheets, supabase.functions.invoke | Multiple routes + `POST /api/parse-datasheet` |
| `components/agents/MarketerAgent.tsx` | social_posts, agent_assets, supabase.functions.invoke("generate-content") | `GET /api/social-posts`, `POST /api/generate-content`, file upload |
| `components/agents/SalesRepAgent.tsx` | leads, outreach_emails, supabase.functions.invoke("generate-leads") | `GET /api/leads`, `POST /api/generate-leads`, `POST /api/generate-outreach` |
| `components/agents/PersonalAssistantAgent.tsx` | tasks, profiles, supabase.functions.invoke("sync-gmail-calendar") | `GET /api/tasks`, `POST /api/sync-gmail-calendar` |
| `components/settings/SettingsPage.tsx` | profiles (SELECT, UPDATE) | `GET /api/profiles/me`, `PATCH /api/profiles/me` |
| `components/chat/ChatInterface.tsx` | profiles, supabase.functions.invoke("orchestrator") | `GET /api/profiles/me`, `POST /api/orchestrator` |

### Files with ONLY auth concerns

| File | Change |
|------|--------|
| `pages/Auth.tsx` | Delete form, add `signIn()` redirect — 15 lines total |
| `pages/Dashboard.tsx` | Replace `supabase.auth.onAuthStateChange` with `useLogto().isAuthenticated` + `useAuth()` |

### Files with BOTH auth + CRUD (complex)

| File | Auth Changes | Data Changes |
|------|-------------|-------------|
| `hooks/useAgentChat.ts` | Replace `supabase.auth.getSession()` with `useAuth().token` | Replace Supabase URL construction with `VITE_API_URL` |

### Files that are ONLY comments — no code changes needed

| File | Why Listed | Action |
|------|-----------|--------|
| `lib/heartbeatParser.ts` | Has "supabase" in comment text | No change |
| `lib/sanitize.ts` | Has "supabase" in comment text | No change |

---

## Express Routes Needed (D-06 expansion)

The Context.md listed 16 table categories. Based on file audit, these specific routes are needed. Routes already created in Phase 22 (API-01 through API-17) are marked.

| Route | Method | Phase 22? | Notes |
|-------|--------|-----------|-------|
| `/api/profiles/me` | GET, PATCH | No | Returns/updates profile for `req.user.sub` |
| `/api/notifications` | GET | No | Filter by user, is_read=false |
| `/api/notifications/:id` | PATCH | No | Mark read |
| `/api/notifications/mark-all-read` | POST | No | Bulk update |
| `/api/team-data` | GET | No | Joins user_agents + available_agent_types + agent_heartbeat_log |
| `/api/user-agents/:agentTypeId/heartbeat` | GET, PATCH | No | heartbeat config columns |
| `/api/user-agents/:agentTypeId/cadence` | GET, PATCH | No | cadence_config JSONB column |
| `/api/user-agents` | GET, POST, PATCH | No | marketplace listing and activation |
| `/api/agent-types` | GET | No | available_agent_types table |
| `/api/workspaces/:agentTypeId/:fileType` | GET, PATCH | No | agent_workspaces table |
| `/api/tasks` | GET, POST, PATCH, DELETE | No | tasks table |
| `/api/artifacts` | GET, POST, DELETE | No | business_artifacts table |
| `/api/push-subscriptions` | POST, DELETE | No | Already handled by Phase 22's heartbeat-runner route — verify |
| `/api/leads` | GET, POST, DELETE | No | leads table |
| `/api/social-posts` | GET, POST, DELETE | No | social_posts table |
| `/api/invoices` | GET, POST, DELETE | No | invoices table |
| `/api/transactions` | GET, POST | No | transactions table |
| `/api/datasheets` | GET, POST, DELETE | No | datasheets table |
| `/api/outreach-emails` | GET, POST | No | outreach_emails table |
| `/api/files/:id` | GET | No | Serve file from volume (Supabase Storage replacement) |
| `/api/orchestrator` | POST | Yes (API-03) | Already done |
| `/api/spawn-agent-team` | POST | Yes (API-04) | Already done |
| `/api/generate-content` | POST | Yes (API-05) | Already done |
| `/api/generate-leads` | POST | Yes (API-08) | Already done |
| `/api/generate-outreach` | POST | Yes (API-09) | Already done |
| `/api/crawl-business-website` | POST | Yes (API-10) | Already done |
| `/api/parse-datasheet` | POST | Yes (API-11) | Already done |
| `/api/sync-gmail-calendar` | POST | Yes (API-13) | Already done |
| `/api/langgraph-proxy/*` | ALL | Yes (API-16) | SSE proxy — already done |

**New routes count: ~19 CRUD route groups in the API server.** These are the true scope of 24-01/24-02's backend tasks.

---

## Common Pitfalls

### Pitfall 1: VITE_* variables are baked at build time

**What goes wrong:** Developer sets `VITE_API_URL` as a Railway service environment variable, but the Nginx container has an empty string for `import.meta.env.VITE_API_URL`. All API calls silently go to `undefined` or throw.

**Why it happens:** Vite replaces `import.meta.env.VITE_*` at compile time via string substitution into the JS bundle. The final bundle contains the literal value, not a runtime lookup. After `npm run build`, the value is frozen.

**How to avoid:** Configure Railway to pass `VITE_*` as **Docker build arguments** (`--build-arg`). Railway supports this via "Build Arguments" in service settings. Alternatively, use a shell-script entrypoint that rewrites a `config.js` file at container start, but this requires changing all `import.meta.env` references to `window.__ENV__` — do not do this, too invasive.

**Correct Railway config:** In railway.toml, build args are not directly supported. Use Railway's "Build Environment Variables" feature in the UI — Railway passes service variables as build args for Dockerfile builds when they are also listed as build args in the Dockerfile with `ARG VITE_*`.

### Pitfall 2: Logto access token vs ID token

**What goes wrong:** `useLogto().getIdTokenClaims()` returns an ID token (for user profile info). `useLogto().getAccessToken(resource)` returns an API access token (for calling the backend). Sending the ID token to the Express API server fails JWKS validation because the `aud` claim is the app ID, not the API resource.

**Why it happens:** The existing `useAuth.ts` already correctly calls `getAccessToken(VITE_LOGTO_API_RESOURCE)`. The pitfall is in any code that tries to grab the Logto token differently (e.g., reading `localStorage` directly or using `getIdTokenClaims()`).

**How to avoid:** Always use `useAuth().token` (which calls `getAccessToken` with the resource). Never use `getIdTokenClaims()` as a bearer token for API calls. The `useAuth.ts` hook is already correct — just use it.

### Pitfall 3: `@tanstack/react-query` v5 breaking changes from v4

**What goes wrong:** Copy-pasted code from Stack Overflow or old blog posts uses v4 API (`useQuery(['key'], fn)` positional array key instead of `useQuery({ queryKey: [...], queryFn: fn })`). This fails silently or throws at runtime.

**Why it happens:** TanStack Query v5 changed to object-only API for all hooks. The existing project uses v5.83.0.

**How to avoid:** Always use v5 object syntax. Key changes: `queryKey` is a required property in the options object; `onSuccess`/`onError` callbacks moved to `useMutation`; `cacheTime` renamed to `gcTime`.

### Pitfall 4: Supabase types still imported after client removal

**What goes wrong:** `AccountantAgent.tsx` imports `import type { Json } from "@/integrations/supabase/types"`. Removing `@supabase/supabase-js` from package.json breaks this type import even though it has no runtime dependency.

**Why it happens:** The generated types file at `src/integrations/supabase/types.ts` references `@supabase/supabase-js` types at the top level.

**How to avoid:** Before deleting the package, inline the `Json` type locally: `type Json = string | number | boolean | null | { [key: string]: Json } | Json[]`. Then remove the types import. Do this in the same task as removing the package.

### Pitfall 5: Dashboard still imports `User` from `@supabase/supabase-js`

**What goes wrong:** `Dashboard.tsx` has `import { User } from "@supabase/supabase-js"` for the `user` state type. After package removal, TypeScript fails.

**Why it happens:** The Logto equivalent doesn't have a named `User` type in the same way.

**How to avoid:** Replace with a local interface `interface AuthUser { id: string; email?: string }` or use `{ userId: string; }` directly from `useAuth()`. The `user.email` access in Dashboard can come from `useLogto().getIdTokenClaims()` if needed, or from `/api/profiles/me`.

### Pitfall 6: Realtime channel cleanup left in hooks after migration

**What goes wrong:** `useNotifications.ts` has a `return () => { supabase.removeChannel(channel) }` cleanup. If the effect is partially migrated (supabase.from replaced but channel code left), the build may still succeed but the hook leaks.

**Why it happens:** Incremental migration leaves orphan cleanup code.

**How to avoid:** When migrating a hook, remove the entire channel setup/teardown block in the same edit. React Query's `refetchInterval` is the complete replacement — no separate cleanup needed.

### Pitfall 7: `useLangGraphFlag` still consumed after migration

**What goes wrong:** `useAgentChat.ts` imports `useLangGraphFlag` and conditionally branches on it. After migrating the hook, the file still imports from `useLangGraphFlag.ts` which imports `supabase`.

**Why it happens:** The flag was designed for dual-mode (Supabase vs Railway). On Railway, it's always `true`. The flag hook needs to be deleted entirely.

**How to avoid:** In the `useAgentChat` migration task, delete the dual-mode branch, hard-code the LangGraph path, and delete the import. Then `useLangGraphFlag.ts` and `getChatEndpoint` can be deleted.

### Pitfall 8: Missing CORS on new Express routes

**What goes wrong:** Frontend calls `GET /api/notifications` and gets CORS error in browser even though POST routes work.

**Why it happens:** Phase 22 Express server has `app.use(cors())` globally, but if new routes are added in a separate file with their own Express router, they need to be mounted before the global middleware — or the global middleware needs to apply correctly.

**How to avoid:** All new routes go into the existing Express app (or a router that is mounted via the existing `app.use('/api', router)`). Do not create new Express instances. Verify CORS headers appear on `OPTIONS` preflight for new endpoints.

---

## Code Examples

### React Query with polling (replaces Supabase Realtime)

```typescript
// hooks/useNotifications.ts (migrated)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function useNotifications(userId: string | undefined) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", userId],
    queryFn: () =>
      api.get<Notification[]>("/api/notifications", { token }),
    enabled: !!userId && !!token,
    refetchInterval: 30_000,  // 30s polling — replaces postgres_changes channel
    staleTime: 20_000,
    retry: 2,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/notifications/${id}`, { is_read: true }, { token }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  // ...
}
```

### useAgentChat token swap

```typescript
// Before
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
const streamUrl = `${supabaseUrl}/functions/v1/langgraph-proxy/invoke/stream`;

// After
const API_URL = import.meta.env.VITE_API_URL as string;
// token comes from useAuth() at hook initialization level:
// const { token } = useAuth();  ← add at top of hook
const streamUrl = `${API_URL}/api/langgraph-proxy/invoke/stream`;
// Use the token variable already available via useAuth()
```

### Nginx SPA health check compatible config

```nginx
# /healthz endpoint for Railway health check (returns 200 without hitting disk)
location /healthz {
  return 200 'ok';
  add_header Content-Type text/plain;
}
```

Note: Railway health check for static Nginx uses `GET /` which returns `index.html` (200). This is sufficient — no special `/healthz` needed unless you prefer it explicit.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Realtime WebSocket channels | React Query `refetchInterval` polling | Phase 24 | Simpler, no WebSocket connection overhead for dashboard data |
| `supabase.auth.getSession()` token | `useLogto().getAccessToken(resource)` | Phase 24 | OIDC-standard, validates at API server via JWKS |
| Dual-mode LangGraph flag in profile | Always LangGraph (delete flag) | Phase 24 | Removes dead code path, simplifies useAgentChat |
| Supabase Edge Functions via `supabase.functions.invoke()` | `api.post("/api/route-name", body)` | Phase 24 | Same request shape, different base URL |

**Deprecated after this phase:**
- `src/integrations/supabase/client.ts` — deleted
- `src/integrations/supabase/types.ts` — deleted (inline Json type locally)
- `src/hooks/useLangGraphFlag.ts` — deleted
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — removed from `.env` and Railway variables

---

## Open Questions

1. **File upload endpoint for MarketerAgent agent_assets**
   - What we know: D-11 says "multipart form uploads to Express routes that write to Railway volume or return base64"
   - What's unclear: The Railway volume is mounted at `/playwright-data` on the LangGraph server, not the API server. The API server does not have a persistent volume.
   - Recommendation: For Phase 24, convert file uploads to base64 (inline in the database column) — same as image generation already does (images returned as base64 data URIs from Imagen 3). This avoids adding a volume mount to the API server in v2.1. Flag as a v2.2 concern.

2. **ProfilesMe endpoint and user record creation**
   - What we know: On Railway, Logto manages user creation. The `profiles` table has a trigger or application-level creation step.
   - What's unclear: When a new Logto user hits `/api/profiles/me` for the first time, does the profiles row exist? Phase 20 created a `backfill_existing_users` migration — but new users won't have a profile row until the API server creates one.
   - Recommendation: `GET /api/profiles/me` should upsert (INSERT ON CONFLICT DO NOTHING) a default profile row on first access. Confirm this is in the Phase 22 API server or add it in Phase 24.

3. **push_subscriptions endpoint overlap with Phase 23**
   - What we know: Phase 22 implemented push subscription routes. Phase 23 uses those via the heartbeat worker.
   - What's unclear: Whether `POST /api/push-subscriptions` is already implemented in Phase 22's API server or needs to be added.
   - Recommendation: Check the Phase 22 API server routes before creating a duplicate. The CONTEXT.md specifics note this endpoint as needing creation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FE-01 | `@supabase/supabase-js` absent from bundle | build check | `cd worrylesssuperagent && npm run build && ! grep -r "supabase-js" dist/` | ❌ Wave 0 |
| FE-02 | useNotifications polls `/api/notifications` with Bearer token | unit | `npx vitest run src/__tests__/useNotifications.test.ts` | ✅ (needs update) |
| FE-02 | useTeamData polls `/api/team-data` | unit | `npx vitest run src/__tests__/useTeamData.test.ts` | ✅ (needs update) |
| FE-03 | Auth.tsx calls signIn() and redirects | unit | `npx vitest run src/__tests__/Auth.test.ts` | ❌ Wave 0 |
| FE-04 | useAgentChat sends SSE to VITE_API_URL/api/langgraph-proxy | unit | `npx vitest run src/__tests__/useAgentChat.test.ts` | ✅ (needs update) |
| FE-05 | Env vars wired (checked via build output) | manual | inspect `dist/assets/*.js` for Railway URLs | manual |
| RAIL-06 | Nginx container builds and serves index.html | smoke | `docker build -t fe-test . && docker run -p 8080:80 fe-test &` then `curl http://localhost:8080/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd worrylesssuperagent && npx vitest run --reporter=dot`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/Auth.test.tsx` — covers FE-03 auth redirect behavior
- [ ] `src/__tests__/api.test.ts` — covers api.ts token injection, error normalization, base URL construction
- [ ] `src/__tests__/useAgentChat.test.ts` — update existing mock from supabase to useAuth + api.ts
- [ ] `src/__tests__/useNotifications.test.ts` — update existing mock from supabase realtime to React Query polling
- [ ] `src/__tests__/useTeamData.test.ts` — update existing mock
- [ ] Dockerfile build check: not automated in vitest — manual smoke test

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/hooks/useAgentChat.ts`, `useNotifications.ts`, `useTeamData.ts`, `useHeartbeatConfig.ts`, `usePushSubscription.ts`, `useAgentWorkspace.ts`, `useLangGraphFlag.ts`, `useCadenceConfig.ts` — confirmed supabase call patterns
- Direct codebase inspection — `src/pages/Auth.tsx`, `src/pages/Dashboard.tsx` — confirmed auth patterns
- Direct codebase inspection — `src/App.tsx` — confirmed LogtoProvider already outermost, QueryClientProvider inside
- Direct codebase inspection — `src/hooks/useAuth.ts` — confirmed Logto hook returns userId, token, signIn, signOut
- Direct codebase inspection — `src/pages/Callback.tsx` — confirmed useHandleSignInCallback ready
- Direct codebase inspection — `src/integrations/logto/client.ts` — confirmed logtoConfig ready
- Direct codebase inspection — `package.json` — confirmed @supabase/supabase-js@2.86.0 is current dep; @tanstack/react-query@5.83.0 installed; @logto/react@4.0.13 installed
- Direct codebase inspection — `langgraph-server/src/index.ts` — confirmed /invoke/stream, /invoke/resume, /threads/:userId routes with Logto JWT middleware
- Direct codebase inspection — `.planning/phases/24-frontend-migration/24-CONTEXT.md` — all decisions are locked inputs

### Secondary (MEDIUM confidence)

- Vite documentation pattern: `import.meta.env.VITE_*` is build-time substitution — well-established behavior, confirmed by Vite source behavior
- TanStack Query v5 object-only API — confirmed by package version (5.x) and known breaking change from v4
- Nginx SPA `try_files` pattern — standard for all SPA deployments, HIGH confidence

### Tertiary (LOW confidence)

- Railway build arguments for VITE_ variables — behavior based on known Docker ARG + Railway ENV var interaction. LOW confidence on exact Railway UI step; needs validation against Railway docs during implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and confirmed in package.json
- Architecture: HIGH — all patterns derived from direct code inspection + locked decisions
- Pitfalls: HIGH — derived from reading actual code (Auth.tsx Supabase imports, Dashboard User type, etc.)
- Railway VITE_ build args: LOW — needs empirical validation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable tech stack — 30 days)
