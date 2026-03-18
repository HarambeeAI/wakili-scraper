# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**Supabase Functions:**
- Endpoint: `{VITE_SUPABASE_URL}/functions/v1/orchestrator`
  - Used in: `src/components/chat/ChatInterface.tsx`
  - Auth: Bearer token using `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Handles: Chat orchestration and multi-agent responses
  - Protocol: HTTP POST with SSE streaming response

## Data Storage

**Database:**
- Supabase (PostgreSQL) - Primary data store
  - Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend)
  - Client (frontend): `@supabase/supabase-js` 2.86.0 via `src/integrations/supabase/client.ts`

**Core Database Tables** (inferred from types):
  - `profiles` - User profile data
  - `agent_tasks` - Tasks with status and responses
  - `agent_assets` - Assets linked to agents (documents, images)
  - `agent_validators` - Validators for approval workflows
  - `automation_settings` - Per-user automation toggles
  - `social_posts` - Marketer social content
  - `leads` - Sales lead data
  - `outreach_emails` - Email campaigns
  - `business_artifacts` - Scraped business knowledge
  - `push_subscriptions` - Push notification subscriptions (user_id, endpoint, p256dh, auth)
  - `invoices` - Financial invoices
  - `transactions` - Income/expense transactions

**File Storage:**
- Supabase Storage - Used for file uploads and assets

**Caching:**
- TanStack Query (React Query) 5.83.0 - In-memory client-side cache

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Built-in email/password authentication
  - Implementation: Email/password auth
  - Session persistence: `localStorage` with `autoRefreshToken: true` (configured in `src/integrations/supabase/client.ts`)
  - Client initialization: `createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true } })`
  - User fetching: `supabase.auth.getUser()` pattern used throughout

## Push Notifications

**Web Push API:**
- Implementation: Browser Web Push API
  - Service Worker: `/sw.js` registered from `src/hooks/usePushSubscription.ts`
  - VAPID Public Key: `VITE_VAPID_PUBLIC_KEY` environment variable
  - Subscription storage: `push_subscriptions` table in Supabase
  - Graceful degradation for HTTP/old browsers

**Push Subscription Flow:**
  - `usePushSubscription()` hook in `src/hooks/usePushSubscription.ts`
  - Handles: subscribe(), unsubscribe(), subscription status tracking
  - Stores: p256dh and auth keys in database via upsert

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Datadog, or similar present

**Logs:**
- `console` methods throughout (viewable in browser DevTools)
- No structured logging system

## CI/CD & Deployment

**Hosting:**
- Frontend: Deployed via Lovable platform (inferred from lovable-tagger, README documentation)
- Backend: Supabase hosted project

**CI Pipeline:**
- Not detected - No GitHub Actions or similar CI configuration files

## Environment Configuration

**Required frontend env vars (`.env` file, prefixed `VITE_`):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_VAPID_PUBLIC_KEY` - Web Push API VAPID public key

**Secrets location:**
- Frontend: `.env` file (not committed; accessed via `import.meta.env.*`)

**Configuration pattern:**
```typescript
// From src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

## Webhooks & Callbacks

**Incoming:**
- Supabase orchestrator function accepts POST requests from `ChatInterface.tsx`

**Outgoing:**
- No detected outgoing webhooks from frontend

## Data Flow

**Chat with AI:**
1. User submits message in `src/components/chat/ChatInterface.tsx`
2. Frontend makes POST to `{SUPABASE_URL}/functions/v1/orchestrator` with SSE streaming
3. Response streamed back and rendered with React Markdown
4. Attachments uploaded to Supabase Storage if present

**Real-time Features:**
- Supabase Realtime subscriptions configured (see `useTeamData` hook pattern)
- RLS enabled on all tables for row-level security

**Push Notifications:**
1. User initiates subscription via push notification toggle
2. Browser registers service worker (`/sw.js`)
3. Subscription keys serialized and stored in `push_subscriptions` table
4. Server-side push delivery via Web Push protocol

---

*Integration audit: 2026-03-18*
