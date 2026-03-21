# Phase 21: Auth Wiring - Research

**Researched:** 2026-03-21
**Domain:** Logto JWT authentication, @logto/react, jose JWKS middleware, Google OAuth
**Confidence:** HIGH

## Summary

Phase 21 wires Logto as the authoritative identity provider for the entire Worryless AI platform. The database layer is done (Phase 20) — `public.users` table exists, all RLS is dropped, and `user_id` columns are already plain text foreign keys. This phase has two clean tasks: (1) configure Logto in the admin console and integrate `@logto/react` in the frontend; (2) add `jose` JWKS middleware to both the LangGraph server and (when built in Phase 22) the API server.

The current frontend uses `supabase.auth.getUser()` / `supabase.auth.getSession()` in 28+ call sites across 11 files. Phase 21 replaces the auth layer only — NOT the Supabase data client (that is Phase 24's work). The strategy is: install `@logto/react`, wrap `App.tsx` with `LogtoProvider`, add a `/callback` route, and create a thin `useAuth` hook that the existing components can call instead of `supabase.auth.*`. The LangGraph server already accepts `user_id` as a body parameter — adding a JWKS middleware that extracts `sub` and rejects missing/invalid tokens is self-contained.

**Primary recommendation:** Install `@logto/react@4.0.13` and `jose@6.2.2`. Configure Logto admin console first (sign-in experience + API resource + Google connector) before writing any code — the Logto endpoint URL drives every other value in this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Logto configured with email/password sign-in method | Logto Console: Sign-in experience → Sign-up and sign-in → add Email address identifier + Password factor |
| AUTH-02 | `@logto/react` integrated into frontend replacing `@supabase/supabase-js` auth | `LogtoProvider` wraps App.tsx; `useHandleSignInCallback` on `/callback` route; `useLogto` replaces 28+ `supabase.auth.*` call sites |
| AUTH-03 | Logto JWT validation middleware on API Server using `jose` JWKS | `createRemoteJWKSet` pointing to `https://<logto-endpoint>/oidc/jwks`; `jwtVerify` with issuer validation; added to LangGraph server now, API server in Phase 22 |
| AUTH-04 | Logto JWT validation on LangGraph Server for direct SSE connections | Same `jose` middleware applied to `/invoke/stream` and `/invoke` and `/invoke/resume` routes in `langgraph-server/src/index.ts` |
| AUTH-05 | User ID (`sub` claim) extracted from JWT and passed as `user_id` to all database queries | `payload.sub` from `jwtVerify` result replaces `user_id` from request body; `req.auth = { userId: payload.sub }` pattern |
| AUTH-06 | Google OAuth configured in Logto for Personal Assistant Gmail/Calendar integration | Logto Console: Connectors → Social connector → Add Google; register callback URI in Google Cloud Console |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @logto/react | 4.0.13 | React auth context, hooks, callback handler | Official Logto React SDK; built on @logto/browser; provides LogtoProvider + useLogto + useHandleSignInCallback |
| jose | 6.2.2 | JWKS-based JWT verification on Node.js servers | Panva's official JOSE implementation; zero-dependency; works in Node.js + Bun + edge runtimes; `createRemoteJWKSet` caches keys intelligently |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @logto/browser | (transitive) | Core browser OIDC client | Installed automatically by @logto/react; do not import directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jose is ESM-native, works in edge runtimes, supports JWKS natively; jsonwebtoken requires manual JWKS fetch |
| jose | jwks-rsa | jose is simpler; jwks-rsa is express-jwt specific and adds a dependency chain |

**Installation (frontend):**
```bash
cd worrylesssuperagent
npm install @logto/react
```

**Installation (LangGraph server):**
```bash
cd worrylesssuperagent/langgraph-server
npm install jose
```

**Version verification (confirmed 2026-03-21):**
- `@logto/react`: 4.0.13
- `jose`: 6.2.2

## Architecture Patterns

### Recommended Project Structure

```
worrylesssuperagent/src/
├── integrations/
│   └── logto/
│       └── client.ts        # LogtoConfig export (endpoint, appId, resources)
├── hooks/
│   └── useAuth.ts           # Thin wrapper: useLogto → { userId, token, signIn, signOut }
├── pages/
│   └── Callback.tsx         # NEW: handles /callback route via useHandleSignInCallback
└── App.tsx                  # Wrap with LogtoProvider

worrylesssuperagent/langgraph-server/src/
└── middleware/
    └── auth.ts              # verifyLogtoJWT Express middleware
```

### Pattern 1: LogtoProvider App Wrapper

**What:** Wrap `App.tsx` root with `LogtoProvider`, providing endpoint and appId. Add a `/callback` route.
**When to use:** Required — every component using `useLogto` needs this ancestor.
**Example:**
```typescript
// src/integrations/logto/client.ts
// Source: https://docs.logto.io/quick-starts/react
import { LogtoConfig } from '@logto/react';

export const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,         // e.g. https://auth.worryless.railway.app
  appId: import.meta.env.VITE_LOGTO_APP_ID,
  resources: [import.meta.env.VITE_LOGTO_API_RESOURCE],  // e.g. https://api.worryless.railway.app
};
```

```typescript
// src/App.tsx (updated)
import { LogtoProvider } from '@logto/react';
import { logtoConfig } from '@/integrations/logto/client';
// ... existing imports

const App = () => (
  <LogtoProvider config={logtoConfig}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </LogtoProvider>
);
```

### Pattern 2: Callback Route

**What:** A dedicated `/callback` page that finishes the OIDC redirect and sends the user to the dashboard.
**When to use:** Required — Logto redirects back to this URL after sign-in.
**Example:**
```typescript
// src/pages/Callback.tsx
// Source: https://docs.logto.io/quick-starts/react
import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const navigate = useNavigate();
  const { isLoading } = useHandleSignInCallback(() => {
    navigate('/dashboard');
  });
  if (isLoading) return <div>Signing in...</div>;
  return null;
};

export default Callback;
```

### Pattern 3: useAuth Hook (Thin Wrapper)

**What:** A single hook that the 28+ existing `supabase.auth.*` call sites can adopt with minimal diffs.
**When to use:** Everywhere `supabase.auth.getUser()` or `supabase.auth.getSession()` is called today.
**Example:**
```typescript
// src/hooks/useAuth.ts
import { useLogto } from '@logto/react';
import { useState, useEffect } from 'react';

export function useAuth() {
  const { isAuthenticated, getIdTokenClaims, getAccessToken, signOut } = useLogto();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    getIdTokenClaims().then((claims) => setUserId(claims?.sub ?? null));
    getAccessToken(import.meta.env.VITE_LOGTO_API_RESOURCE).then(setToken);
  }, [isAuthenticated]);

  return { userId, token, isAuthenticated, signOut };
}
```

Migration pattern for existing code:
```typescript
// BEFORE:
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;

// AFTER (inside component using useAuth hook):
const { userId } = useAuth();
```

### Pattern 4: jose JWKS Middleware on LangGraph Server

**What:** Express middleware that validates the `Authorization: Bearer <token>` header on every protected route, extracts `sub` as `userId`, rejects invalid/missing tokens with 401.
**When to use:** Applied to all `/invoke/*` and `/threads/*` routes.
**Example:**
```typescript
// langgraph-server/src/middleware/auth.ts
// Source: https://docs.logto.io/api-protection/nodejs/express + panva/jose docs
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const LOGTO_ENDPOINT = process.env.LOGTO_ENDPOINT!; // e.g. https://auth.worryless.railway.app
const JWKS_URI = `${LOGTO_ENDPOINT}/oidc/jwks`;
const ISSUER = `${LOGTO_ENDPOINT}/oidc`;
const API_RESOURCE = process.env.LOGTO_API_RESOURCE; // optional audience validation

const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export interface AuthedRequest extends Request {
  auth?: { userId: string; payload: JWTPayload };
}

export async function verifyLogtoJWT(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      // audience: API_RESOURCE, // enable once API resource registered in Logto console
    });
    req.auth = { userId: payload.sub!, payload };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

Apply to protected routes in `src/index.ts`:
```typescript
import { verifyLogtoJWT } from './middleware/auth.js';

// Apply globally (after health check):
app.use('/invoke', verifyLogtoJWT);
app.use('/threads', verifyLogtoJWT);
app.use('/store', verifyLogtoJWT);

// Then extract userId from req.auth instead of req.body:
app.post('/invoke', verifyLogtoJWT, async (req, res) => {
  const { message, thread_id, agent_type } = req.body;
  const user_id = (req as AuthedRequest).auth!.userId;  // from JWT sub claim
  // ... rest of handler
});
```

### Pattern 5: Logto Admin Console Configuration Order

**What:** The sequence of admin console steps that must complete before any code runs.
**When to use:** Start of implementation — these are prerequisites.

Steps (in order):
1. Open admin console at `https://<logto-endpoint>:3002` (or Railway-assigned domain for admin port)
2. Console > Sign-in experience > Sign-up and sign-in:
   - Sign-up: Email address + Password required
   - Sign-in identifiers: Email address, verification: Password
3. Console > Applications > Create application: Type = Traditional web (SPA), name = "Worryless Frontend"
   - Add redirect URI: `https://<frontend-domain>/callback`
   - Add post sign-out redirect: `https://<frontend-domain>/`
   - Copy App ID → `VITE_LOGTO_APP_ID`
4. Console > API resources > Create API resource:
   - Name = "Worryless API"
   - API Identifier (resource indicator) = `https://api.worryless.railway.app` (or Railway API server URL)
   - Copy identifier → `VITE_LOGTO_API_RESOURCE` and `LOGTO_API_RESOURCE`
5. Console > Connectors > Social connectors > Add Google:
   - Client ID from Google Cloud Console OAuth 2.0 credentials
   - Client Secret from Google Cloud Console
   - Register Logto callback URI in Google Cloud Console: `https://<logto-endpoint>/callback/<connector_id>`
6. Set Logto env vars in Railway services: `LOGTO_ENDPOINT`, `LOGTO_API_RESOURCE`

### Anti-Patterns to Avoid

- **Skipping API resource registration:** Without registering an API resource, `getAccessToken(resource)` returns a token without an `aud` claim. The middleware will fail audience validation. Register the resource before writing middleware.
- **Putting user_id in request body:** After this phase, `user_id` MUST come from the verified JWT `sub` claim only. Never trust a client-supplied `user_id` body field on protected routes.
- **Audience validation with wrong format:** Logto audience is the full resource indicator URI (e.g. `https://api.worryless.railway.app`), NOT a short slug.
- **Missing `flushHeaders()` on SSE routes:** The `/invoke/stream` route needs `res.setHeader('X-Accel-Buffering', 'no')` + `res.flushHeaders()` — already noted in STATE.md, this phase must not regress this.
- **Applying JWKS middleware to /health:** Health check must remain unprotected for Railway healthcheck to pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signature verification | Custom HMAC/RSA verification | jose `jwtVerify` | Key rotation, algorithm agility, RS256 edge cases are subtle |
| JWKS key caching | Manual HTTP fetch + cache | jose `createRemoteJWKSet` | Handles cooldown, key rollover, multiple matching keys automatically |
| Token refresh | Manual timer + re-fetch | @logto/react `getAccessToken` | SDK handles expiry + refresh transparently |
| OIDC callback handling | Manual code exchange | `useHandleSignInCallback` | Handles state, nonce, PKCE verification, CSRF protection |

**Key insight:** The OIDC authorization code flow with PKCE has 7+ security properties that must all be validated. `@logto/react` and `jose` handle all of them — hand-rolling any piece creates a vulnerability.

## Common Pitfalls

### Pitfall 1: Logto endpoint URL format in JWKS derivation
**What goes wrong:** JWKS URL set to `https://<logto>/jwks` (missing `/oidc/` prefix) — verification fails with "Unable to resolve a signing key" even with valid tokens.
**Why it happens:** Logto's OIDC endpoints live under the `/oidc` path segment. The discovery document at `https://<logto>/oidc/.well-known/openid-configuration` reveals the correct JWKS URI.
**How to avoid:** Always derive `JWKS_URI = LOGTO_ENDPOINT + '/oidc/jwks'` and `ISSUER = LOGTO_ENDPOINT + '/oidc'`. Verify by fetching `.well-known/openid-configuration` and checking the values match.
**Warning signs:** `JWKSNoMatchingKey` or `JWTClaimValidationFailed: iss` errors in server logs.

### Pitfall 2: Missing redirect URI registration causes infinite redirect loop
**What goes wrong:** User clicks sign-in, gets redirected to Logto, Logto refuses the callback because the redirect URI isn't whitelisted — "Redirect URI not allowed" error.
**Why it happens:** Logto validates that the `redirect_uri` in the OIDC request exactly matches a registered URI (case-sensitive, including trailing slash).
**How to avoid:** Register `https://<frontend-domain>/callback` exactly as it appears in the browser URL bar. Test both prod and dev (localhost:5173/callback) by adding both.
**Warning signs:** Logto consent screen shows error, never redirects back to frontend.

### Pitfall 3: getAccessToken without resource returns opaque token
**What goes wrong:** Frontend calls `getAccessToken()` without the resource argument — Logto returns a short-lived opaque token (not a JWT). The jose middleware cannot decode it.
**Why it happens:** Logto issues JWTs only when a specific API resource is requested. Without a resource, it issues an opaque reference token.
**How to avoid:** Always call `getAccessToken(import.meta.env.VITE_LOGTO_API_RESOURCE)`. The resource must match the identifier registered in the Logto console exactly.
**Warning signs:** `jwtVerify` throws "Invalid Compact JWS" because the token is not in JWT format.

### Pitfall 4: Railway Logto admin port not exposed
**What goes wrong:** Admin console at port 3002 is unreachable — can't configure sign-in experience or apps.
**Why it happens:** Railway requires explicit port exposure. Logto runs auth on 3001 and admin on 3002. If only 3001 is exposed (for user auth), the admin console is inaccessible.
**How to avoid:** Railway Logto service must expose both ports, or use `ADMIN_ENDPOINT` env var with a separate Railway service domain mapped to port 3002.
**Warning signs:** Admin console URL times out or returns 502.

### Pitfall 5: SSE headers not set before auth middleware short-circuits
**What goes wrong:** The `/invoke/stream` SSE response sends a 401 JSON response after headers were already partially written — client gets a malformed SSE stream.
**Why it happens:** Auth middleware runs before SSE headers are set. If 401 is returned as JSON on a route that should be SSE, some clients fail to parse the error.
**How to avoid:** Auth middleware should always respond before any SSE headers are set. Apply `verifyLogtoJWT` as the first middleware on the route. If auth fails, respond immediately with JSON 401 before SSE setup code runs (this is the natural behavior since SSE headers are set inside the handler body).
**Warning signs:** Browser EventSource shows `onerror` immediately on connection.

### Pitfall 6: Google OAuth redirect URI for connector vs. for Gmail API
**What goes wrong:** Developer confuses the Logto connector callback URI (registered in Google Cloud Console for Logto's own Google sign-in) with the Personal Assistant's Gmail/Calendar OAuth redirect URI (for user-specific Google API access).
**Why it happens:** There are two separate Google OAuth flows: (1) Logto social connector — Logto acts as the OAuth client, redirecting users through Google to log in; (2) Personal Assistant Gmail access — the app itself requests Gmail/Calendar scopes for a signed-in user.
**How to avoid:** For AUTH-06 (this phase), focus only on (1) — register `https://<logto-endpoint>/callback/<connector_id>` in Google Cloud Console. The Personal Assistant's Gmail access via `sync-gmail-calendar` is handled separately at the API layer with its own client ID.
**Warning signs:** Google OAuth error "redirect_uri_mismatch" — the URI in the request doesn't match the registered ones.

## Code Examples

Verified patterns from official sources:

### LogtoConfig with API resource
```typescript
// Source: https://docs.logto.io/quick-starts/react
import { LogtoConfig } from '@logto/react';

const config: LogtoConfig = {
  endpoint: 'https://your-logto-endpoint.com',
  appId: 'your-app-id',
  resources: ['https://api.worryless.railway.app'],
};
```

### jose JWKS middleware (verified pattern)
```typescript
// Source: https://docs.logto.io/api-protection/nodejs/express
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://<logto>/oidc/jwks'));

const { payload } = await jwtVerify(token, JWKS, {
  issuer: 'https://<logto>/oidc',
});
const userId = payload.sub; // Logto user ID
```

### Environment variables required for this phase
```bash
# Frontend (.env or Railway variables)
VITE_LOGTO_ENDPOINT=https://auth.worryless.railway.app
VITE_LOGTO_APP_ID=<from Logto console Applications>
VITE_LOGTO_API_RESOURCE=https://api.worryless.railway.app

# LangGraph server (Railway service variables)
LOGTO_ENDPOINT=https://auth.worryless.railway.app
LOGTO_API_RESOURCE=https://api.worryless.railway.app
```

### OIDC discovery for verification
```bash
# Verify JWKS and issuer values before hardcoding:
curl https://<logto-endpoint>/oidc/.well-known/openid-configuration | jq '{issuer, jwks_uri}'
# Expected:
# { "issuer": "https://<logto-endpoint>/oidc", "jwks_uri": "https://<logto-endpoint>/oidc/jwks" }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase `supabase.auth.getUser()` | `useLogto().getIdTokenClaims()` | Phase 21 | userId comes from `claims.sub` |
| Supabase `supabase.auth.getSession()` for token | `useLogto().getAccessToken(resource)` | Phase 21 | Must pass resource URL for JWT (not opaque) |
| RLS `auth.uid()` auto-injected | `payload.sub` from middleware, passed as param | Phase 20+21 | All DB queries need explicit `WHERE user_id = $1` |
| Supabase Edge Function JWT validation via `createClient` | `jose` JWKS middleware on Express | Phase 21 | Stateless, no per-request roundtrip, Railway-compatible |
| Google OAuth via Personal Assistant edge function | Google social connector in Logto + direct Gmail API | Phase 21 | Logto handles the OAuth consent flow |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Logto console configured with email/password | manual | N/A — admin console config | manual-only |
| AUTH-02 | LogtoProvider renders without error, useAuth hook returns userId | unit | `npx vitest run src/__tests__/useAuth.test.ts` | ❌ Wave 0 |
| AUTH-03 | `verifyLogtoJWT` rejects missing token with 401 | unit | `cd langgraph-server && npx vitest run src/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-03 | `verifyLogtoJWT` rejects malformed token with 401 | unit | `cd langgraph-server && npx vitest run src/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-04 | LangGraph `/invoke/stream` returns 401 without token | integration/smoke | manual curl test | manual smoke |
| AUTH-05 | `req.auth.userId` equals `sub` claim from mock JWT | unit | `cd langgraph-server && npx vitest run src/__tests__/auth.test.ts` | ❌ Wave 0 |
| AUTH-06 | Google connector redirect URI format is correct | manual | N/A — Google Cloud Console config | manual-only |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/useAuth.test.ts`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worrylesssuperagent/src/__tests__/useAuth.test.ts` — covers AUTH-02 (hook returns userId from mock claims)
- [ ] `worrylesssuperagent/langgraph-server/src/__tests__/auth.test.ts` — covers AUTH-03, AUTH-05 (middleware rejects invalid tokens, extracts sub)
- [ ] `worrylesssuperagent/langgraph-server/vitest.config.ts` — check if langgraph server has its own vitest config

## Open Questions

1. **Logto Railway service URL is not known at research time**
   - What we know: Logto was planned for Phase 19 (provisioning). Phase 19 completion status is Pending per STATE.md.
   - What's unclear: Whether Phase 19 has been partially executed and a Railway Logto URL already exists.
   - Recommendation: Check Phase 19 outputs before starting Phase 21. If Logto isn't deployed yet, Phase 21 cannot proceed past console configuration steps. The planner should note Phase 19 (Logto deployed) as a hard prerequisite.

2. **Google Cloud Console project for Gmail/Calendar API vs. OAuth social login**
   - What we know: The Personal Assistant uses Gmail API + Calendar API (established in v2.0). AUTH-06 requires Google OAuth configured in Logto.
   - What's unclear: Whether the same Google Cloud project / client credentials should be reused for the Logto connector, or a separate one created.
   - Recommendation: Use the same Google Cloud project but create a separate OAuth 2.0 client ID specifically for Logto's social connector. Register the Logto callback URI (`https://<logto>/callback/<connector_id>`) as an authorized redirect URI. Keep the existing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET for the Personal Assistant Gmail API operations.

3. **Audience validation: enforce or skip for now**
   - What we know: `jwtVerify` can validate `aud` claim against the registered API resource. This requires the frontend to call `getAccessToken(resource)` consistently.
   - What's unclear: Whether the existing frontend hooks all pass the resource correctly, or whether some will get opaque tokens.
   - Recommendation: Implement middleware without audience validation first (`// audience: API_RESOURCE` commented out). Enable it once confirmed that frontend always passes resource. Document the `TODO: enable audience validation` comment in code.

## Sources

### Primary (HIGH confidence)
- `https://docs.logto.io/quick-starts/react` — @logto/react installation, LogtoProvider, useLogto, useHandleSignInCallback
- `https://docs.logto.io/api-protection/nodejs/express` — Express.js jose middleware pattern
- `https://docs.logto.io/authorization/validate-access-tokens` — JWKS URI format, issuer format, sub claim extraction
- `https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md` — createRemoteJWKSet API reference
- `https://docs.logto.io/logto-oss/deployment-and-configuration` — Railway env vars (ENDPOINT, ADMIN_ENDPOINT, PORT, ADMIN_PORT)
- `npm view @logto/react version` → 4.0.13 (verified 2026-03-21)
- `npm view jose version` → 6.2.2 (verified 2026-03-21)

### Secondary (MEDIUM confidence)
- `https://docs.logto.io/authorization/global-api-resources` — API resource registration, audience claim format
- `https://docs.logto.io/integrations/google` — Google social connector setup, callback URI format
- WebSearch: Logto JWKS endpoint `https://<endpoint>/oidc/jwks` and issuer `https://<endpoint>/oidc` — confirmed by multiple Logto doc pages

### Tertiary (LOW confidence)
- STATE.md note: "UUID preservation: Logto user import must use `passwordAlgorithm: 'Bcrypt'` and explicit `id` field" — relevant if migrating existing Supabase users, but this phase is fresh deployment only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified, official docs confirm @logto/react + jose
- Architecture patterns: HIGH — code examples drawn directly from Logto official docs
- Pitfalls: HIGH for Logto-specific (Pitfalls 1-4); MEDIUM for SSE interaction (Pitfall 5, based on STATE.md warning)
- Open Questions: MEDIUM — Logto Railway URL dependency is a real blocker

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (Logto SDK is actively maintained; jose is stable)
