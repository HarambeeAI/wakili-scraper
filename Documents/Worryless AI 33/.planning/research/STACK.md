# Technology Stack — Milestone Research

**Project:** Worryless AI (multi-agent automation SaaS)
**Milestone scope:** Agent MD workspaces, heartbeat scheduling fan-out, dynamic agent catalog, push notifications, streaming AI responses
**Researched:** 2026-03-12
**Overall confidence:** HIGH (all five questions resolved with official Supabase docs + verified secondary sources)

---

## 1. pg_cron Fan-Out Scheduling

### Problem

Supabase pg_cron has a hard recommendation of no more than 8 concurrent jobs. If you register one cron job per agent per user you hit this limit immediately at meaningful scale (e.g. 10 users × 4 agents = 40 jobs). The constraint is already noted in PROJECT.md: use a single `heartbeat-dispatcher` cron that fans out.

### Recommended Pattern: Dispatcher Cron + pgmq Queue

**Architecture (two-layer):**

```
pg_cron (1 job, every 5 min)
  └── heartbeat-dispatcher edge function
        └── reads agent_heartbeat_schedule table
        └── enqueues due agents → pgmq queue ("heartbeat_jobs")
              └── heartbeat-runner edge function (polled every 1 min via second cron)
                    └── reads N messages from queue, processes, deletes on success
```

**Why this over direct HTTP fan-out:**

Direct fan-out (dispatcher calling N edge functions via `supabase.functions.invoke` in a loop) has two failure modes: (1) dispatcher times out before completing all invocations if N is large; (2) no retry on failure. pgmq solves both — messages persist across failures, visibility timeouts auto-retry, and the dispatcher just enqueues work rather than executing it.

**Supabase Queues (pgmq) key facts:**
- Built on the `pgmq` extension, GA as of late 2024
- Managed through `supabase.schema('pgmq_public').rpc(...)` from edge functions
- Guarantees delivery via visibility timeouts — if a consumer dies mid-processing, the message becomes visible again after the timeout expires
- Messages are durable in PostgreSQL; no external queue service needed
- Managed through the Supabase Dashboard under the Integrations section

**Dispatcher cron SQL (run every 5 minutes):**

```sql
-- Store secrets in Vault first:
-- select vault.create_secret('https://YOUR_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_ANON_KEY', 'anon_key');

select cron.schedule(
  'heartbeat-dispatcher',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'project_url') || '/functions/v1/heartbeat-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret
                                      from vault.decrypted_secrets
                                      where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Runner cron (processes the queue, every 1 minute):**

```sql
select cron.schedule(
  'heartbeat-runner',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'project_url') || '/functions/v1/heartbeat-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret
                                      from vault.decrypted_secrets
                                      where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**heartbeat-runner consumes queue messages:**

```typescript
// Read up to 5 messages per invocation (tune to stay within 150s timeout)
const { data: messages } = await supabase
  .schema('pgmq_public')
  .rpc('read', {
    queue_name: 'heartbeat_jobs',
    sleep_seconds: 0,    // don't block if queue is empty
    n: 5
  })

for (const message of messages ?? []) {
  try {
    await runHeartbeat(message.message)   // { user_id, agent_type, workspace_id }
    await supabase.schema('pgmq_public').rpc('delete', {
      queue_name: 'heartbeat_jobs',
      msg_id: message.msg_id
    })
  } catch (err) {
    // Don't delete — visibility timeout will re-expose message for retry
    console.error('Heartbeat failed, will retry:', err)
  }
}
```

**Dispatcher logic (what it enqueues):**

```typescript
// Query agents due for a heartbeat tick based on interval + last run
const { data: dueAgents } = await supabase
  .from('agent_heartbeat_schedule')
  .select('user_id, agent_type, workspace_id')
  .lte('next_run_at', new Date().toISOString())
  .eq('enabled', true)

for (const agent of dueAgents ?? []) {
  await supabase.schema('pgmq_public').rpc('send', {
    queue_name: 'heartbeat_jobs',
    msg: agent
  })
  // Update next_run_at immediately to prevent double-dispatch
  await supabase
    .from('agent_heartbeat_schedule')
    .update({ next_run_at: computeNextRun(agent) })
    .eq('user_id', agent.user_id)
    .eq('agent_type', agent.agent_type)
}
```

**HEARTBEAT_OK suppression:** Do not insert a row into `agent_heartbeat_log` on OK runs — only write when something surfaces. This is already in PROJECT.md and is essential. At 4h intervals across 12 agents per user, suppression cuts log writes by ~90% on quiet days.

**Background tasks for long heartbeats:** If a heartbeat run involves multiple AI calls (read HEARTBEAT.md → LLM call → conditionally create task), it can approach the 150s edge function limit on the free plan (400s on paid). Use `EdgeRuntime.waitUntil()` (released 2024) to decouple the AI processing from the response acknowledgment, so the runner can return quickly and continue processing in the background.

```typescript
Deno.serve(async (req) => {
  const messages = await readQueueMessages()
  // Acknowledge immediately, process in background
  EdgeRuntime.waitUntil(processMessages(messages))
  return new Response('ok', { status: 200 })
})
```

### What NOT to Do

- **Do not create one cron job per agent per user.** pg_cron limit is 8 concurrent jobs. At 10 users × 4 agents = 40 jobs, the system breaks.
- **Do not use pg_cron `select net.http_post(...)` to fan-out to N edge functions inside a single cron SQL statement.** pg_net calls from cron are fire-and-forget; you lose visibility into which calls succeeded.
- **Do not process more than 5-10 messages per runner invocation** without measuring actual processing time per agent heartbeat. AI calls to Lovable Gateway take 2-8 seconds each; 5 × 8 = 40s, which is comfortably within 150s.

### Schema Additions Required

```sql
-- Tracks when each agent is next due for a heartbeat
create table agent_heartbeat_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  agent_type text not null,
  workspace_id uuid,
  interval_hours int not null default 4,
  active_hours_start int not null default 8,   -- local hour (0-23)
  active_hours_end   int not null default 18,
  enabled bool not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz default now()
);

-- RLS: service role only (cron/edge functions write; users read via separate query)
```

**Confidence: HIGH** — Pattern derived from official Supabase docs on Queues, Cron, and the processing-large-jobs blog post.

---

## 2. Storing Markdown Content in PostgreSQL

### Decision: TEXT column + generated tsvector column

**Recommendation:** Store the raw markdown in a plain `text` column. Add a `GENERATED ALWAYS AS ... STORED` tsvector column for full-text search. Do NOT use JSONB for markdown content.

**Rationale:**

| Approach | Write cost | Read cost | FTS | Suitable for MD workspace |
|----------|-----------|-----------|-----|--------------------------|
| `text` + generated `tsvector` | Low | Low | Excellent (GIN index) | YES |
| `jsonb` with text value | Higher (binary conversion) | Slightly better for key lookups | Possible but awkward | NO — no structured keys to exploit |
| `jsonb` for structured metadata | Higher | Good for key access | Via jsonb operators | PARTIAL — use for metadata only |

Markdown is unstructured prose. JSONB buys nothing unless you're storing key-value pairs with heterogeneous structure. The `agent_workspaces` table stores named text files (IDENTITY.md, SOUL.md, etc.) — these are identified by the `file_name` column, not by parsing JSON structure within the content.

**Schema for agent_workspaces:**

```sql
create table agent_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  agent_type text not null,
  file_name text not null,           -- 'IDENTITY.md', 'SOUL.md', etc.
  content text not null default '',
  -- Generated column: auto-updated tsvector whenever content changes
  content_fts tsvector generated always as (
    to_tsvector('english', content)
  ) stored,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, agent_type, file_name)
);

-- GIN index for fast full-text search
create index agent_workspaces_fts_idx
  on agent_workspaces using gin(content_fts);

-- RLS
alter table agent_workspaces enable row level security;
create policy "Users own their workspaces"
  on agent_workspaces for all
  using (auth.uid() = user_id);
```

**Full-text search query example (from edge function):**

```typescript
// Search across all workspace files for a user
const { data } = await supabase
  .from('agent_workspaces')
  .select('agent_type, file_name, content')
  .eq('user_id', userId)
  .textSearch('content_fts', searchQuery, {
    type: 'websearch',    // supports quotes and AND/OR operators
    config: 'english'
  })
```

**MEMORY.md special handling:**

MEMORY.md is append-only (agent-written). Use PostgreSQL array or simple text append rather than a full JSON structure. The generated tsvector will index new appended content automatically since it's recalculated on every UPDATE.

**When JSONB IS appropriate:**

Use JSONB only for the `metadata` column on `business_artifacts` (already in the schema per INTEGRATIONS.md) or for tool configuration in `available_agent_types`. These have heterogeneous structured data.

### What NOT to Do

- **Do not store markdown in a JSONB column** with a single text key like `{"content": "..."}`. This doubles storage overhead with zero benefit.
- **Do not use `to_tsvector()` in a query WHERE clause without an index.** Always materialize as a generated column with a GIN index; on-the-fly tsvector computation does a full table scan.
- **Do not use GiST instead of GIN** for text search. GiST is better for geometric types; GIN is faster for text on read-heavy workloads. The workspace table is read-heavy (agents read their workspace on every heartbeat tick).

**Confidence: HIGH** — PostgreSQL official documentation + multiple verified sources.

---

## 3. Push/Email Notifications from Edge Functions

### Email: Resend (already integrated)

Resend is already wired in (`resend@2.0.0` via esm.sh, `RESEND_API_KEY` in env). For heartbeat surfacing notifications, add a `send-heartbeat-alert` email template to the existing Resend integration. No new service needed.

**Pattern for heartbeat email:**

```typescript
import { Resend } from 'https://esm.sh/resend@2.0.0'
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

await resend.emails.send({
  from: 'myteam@worryless.ai',
  to: userEmail,
  subject: `[${agentName}] surfaced something worth your attention`,
  html: buildHeartbeatAlertHtml(agentName, finding, taskUrl)
})
```

### Browser Push Notifications: Web Push API + VAPID

**Recommendation:** Implement native Web Push API (VAPID), NOT a third-party service (no Firebase, no OneSignal, no Pusher).

**Rationale for native VAPID over FCM/OneSignal:**
- No dependency on Google's FCM infrastructure
- No additional monthly cost or API keys to manage
- Works in all modern browsers: Chrome, Firefox, Edge, Safari 16.4+
- The Deno runtime in Supabase edge functions supports Web Crypto API natively, which VAPID requires
- `web-push-browser` and `@negrel/webpush` (JSR) are zero-dependency libraries that work in Deno without Node.js crypto shims

**Recommended library: `web-push-browser` (npm) or `@negrel/webpush` (JSR)**

`@negrel/webpush` is importable directly in Deno:

```typescript
// In edge function: send-push-notification/index.ts
import * as webpush from 'jsr:@negrel/webpush'

// VAPID keys stored as Supabase secrets:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
const vapidKeys = await webpush.importVapidKeys({
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
})

const appServer = await webpush.ApplicationServer.new({
  contactInformation: 'mailto:team@worryless.ai',
  vapidKeys,
})

// subscription = stored PushSubscription from browser
const subscriber = appServer.subscribe(subscription)
await subscriber.pushTextMessage(JSON.stringify({
  title: agentName + ' has an update',
  body: finding,
  url: '/dashboard'
}), {})
```

**Frontend service worker (required):**

```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Worryless AI', {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'))
})
```

**Subscription storage schema:**

```sql
create table user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subscription jsonb not null,    -- raw PushSubscription JSON from browser
  user_agent text,
  created_at timestamptz default now()
);
alter table user_push_subscriptions enable row level security;
create policy "Users own their subscriptions"
  on user_push_subscriptions for all
  using (auth.uid() = user_id);
```

**VAPID key generation (one-time, run locally):**

```bash
npx web-push generate-vapid-keys
# Save VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to Supabase secrets
```

**Notification delivery strategy (heartbeat surface event):**

When `heartbeat-runner` determines a surfaced finding:
1. Create a row in a `notifications` table (for in-app notification bell)
2. This INSERT triggers a Supabase Realtime broadcast (see section 5)
3. Separately, if user has `push_enabled = true` in their profile, invoke `send-push-notification` edge function

**Alternative considered: Supabase Realtime Broadcast from Database**

For in-app notification bell (within the open browser tab), use Realtime broadcast from database rather than polling. A trigger on the `notifications` table insertion broadcasts to a channel the frontend subscribes to. This is the appropriate tool for in-tab updates — NOT web push. Web push is for when the tab is closed or user is away.

```typescript
// Frontend: subscribe to user's notification channel
const channel = supabase
  .channel(`notifications:${userId}`)
  .on('broadcast', { event: 'new_notification' }, (payload) => {
    queryClient.invalidateQueries(['notifications'])
    toast(payload.payload.message)
  })
  .subscribe()
```

### What NOT to Do

- **Do not use Firebase Cloud Messaging (FCM) for browser push.** It requires adding Google dependencies, a Firebase project, and SDK to the frontend bundle. Unnecessary for a web-only app.
- **Do not use OneSignal or Pusher.** They add vendor lock-in and monthly costs for functionality the native Web Push API provides for free.
- **Do not attempt web push from the browser client directly.** Web push requires the private VAPID key, which must stay server-side (edge function only).
- **Do not send push notifications on every heartbeat tick.** Only on surfaced findings. HEARTBEAT_OK runs are silent.

**Confidence: MEDIUM-HIGH** — Web Push API is well-documented (MDN); Deno JSR library is verified; Supabase Realtime broadcast from database is confirmed from official blog (2024).

---

## 4. Streaming AI Responses in Edge Functions to React

### Pattern: Server-Sent Events (SSE) via ReadableStream

The Lovable AI Gateway uses OpenAI-compatible format, which means it returns `text/event-stream` when `stream: true` is set in the request body. Edge functions can pipe this stream directly to the frontend.

**Edge function streaming pattern:**

```typescript
Deno.serve(async (req) => {
  const { messages, agentType } = await req.json()

  const aiResponse = await fetch(
    'https://ai.gateway.lovable.dev/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        stream: true
      })
    }
  )

  // Pipe the upstream SSE stream directly to the response
  return new Response(aiResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // CORS headers required — edge functions need explicit CORS config
      'Access-Control-Allow-Origin': '*',
    }
  })
})
```

**Alternatively, transform and re-emit for error handling:**

```typescript
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const stream = new ReadableStream({
  async start(controller) {
    const reader = aiResponse.body!.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) { controller.close(); return }

        const chunk = decoder.decode(value)
        // Forward SSE lines as-is; optionally filter/transform
        controller.enqueue(encoder.encode(chunk))
      }
    } catch (err) {
      controller.error(err)
    }
  }
})

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
})
```

**Frontend consumption (NOT via `supabase.functions.invoke`):**

`supabase.functions.invoke()` buffers the response — it cannot stream. Use `fetch()` directly:

```typescript
// In a React hook or component
const streamChat = async (messages: Message[]) => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-agent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messages, agentType })
    }
  )

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    // Parse SSE lines
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content ?? ''
        accumulated += delta
        setStreamingContent(accumulated)   // update React state each chunk
      } catch { /* incomplete chunk, continue */ }
    }
  }
  setStreamingContent(null)
  setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
}
```

**CORS note:** Edge functions require explicit CORS headers. Handle OPTIONS preflight:

```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  })
}
```

**TanStack Query integration:** Streaming responses do not fit the standard `useQuery` pattern (single-shot promise). Use local `useState` + the raw fetch approach above, or use TanStack Query's `queryFn` that resolves only after the full stream completes if you don't need incremental updates. For the heartbeat workspace viewer (read-only display), non-streaming is fine. For chat with agents, streaming is expected UX.

### What NOT to Do

- **Do not use `supabase.functions.invoke()` for streaming.** It awaits the full response body before resolving. This is documented in GitHub issues (functions-js #67) and confirmed in the Supabase GitHub discussions.
- **Do not forget CORS preflight handling.** The browser will block streaming requests without proper `Access-Control-Allow-Origin` headers on the OPTIONS response.
- **Do not parse partial JSON.** SSE chunks can split across `read()` calls. Buffer incomplete lines and only parse complete `data: ...` lines ending in `\n\n`.

**Confidence: HIGH** — Pattern confirmed from official Supabase examples, GitHub discussions, and verified implementation guides.

---

## 5. Newer Supabase Features Relevant to This Milestone

### Supabase Queues (pgmq) — GA late 2024

The most important new feature for this milestone. Described above in section 1. Key facts:

- Built on `pgmq` extension; managed in Supabase Dashboard under Integrations
- API: `supabase.schema('pgmq_public').rpc('send' | 'read' | 'delete', {...})`
- Durable — messages persist in PostgreSQL; survive edge function crashes
- Exactly-once delivery within visibility windows
- Enables the dispatcher + runner fan-out pattern cleanly

**Enable in Supabase Dashboard:** Database → Extensions → search "pgmq" → enable. Then create queue:

```sql
select pgmq.create('heartbeat_jobs');
```

### Supabase Cron (first-class module) — GA 2024-2025

Previously pg_cron was accessed only via raw SQL. Supabase now wraps it in a first-class Cron module with a Dashboard UI under Integrations → Cron Jobs. No behavior change, but easier management and job monitoring without raw SQL.

- Dashboard shows job run history from `cron.job_run_details`
- Can create/edit jobs in the Dashboard UI or via SQL (both work)
- Still limited to 8 concurrent jobs — the fan-out via queues pattern exists specifically to work around this

### Background Tasks in Edge Functions — Released 2024

`EdgeRuntime.waitUntil(promise)` decouples response from processing. Critical for heartbeat-runner where:
1. Runner acknowledges the cron HTTP call immediately (returns 200)
2. AI calls to Lovable Gateway continue processing in background

Duration limits:
- Free plan: 150 seconds (2 minutes 30 seconds)
- Paid plan: 400 seconds (6 minutes 40 seconds)

This is the mechanism that makes processing multiple heartbeats per runner invocation practical without timing out the cron HTTP call.

### Broadcast from Database — Released 2024

Trigger-based real-time broadcast without writing application code in edge functions. When a row is inserted into `realtime.messages` (via a trigger on your table), Realtime broadcasts to subscribed clients.

**Use case for this milestone:** When a heartbeat surfaces a finding and creates a notification row, a DB trigger broadcasts it immediately to any open browser tabs subscribed to that user's notification channel. No polling, no edge function for the in-app notification bell.

```sql
-- Create notification trigger that broadcasts via Realtime
create or replace function notify_user_on_notification()
returns trigger language plpgsql as $$
begin
  perform realtime.broadcast_changes(
    'notifications:' || new.user_id::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    new,
    old
  );
  return new;
end;
$$;

create trigger on_notification_insert
  after insert on notifications
  for each row execute function notify_user_on_notification();
```

### Supabase AI Inference in Edge Functions — Released 2024

Edge functions now have a built-in `Supabase.ai.runModel()` API for running models like `gte-small` (embeddings) directly without an external API call. Less relevant here since the project routes through Lovable AI Gateway, but worth noting for future embedding-based memory search.

### What NOT to Use

- **Supabase Realtime Postgres Changes** (the old `on('postgres_changes', ...)` pattern) — still works but has known performance limits at scale and requires row-level filter care with RLS. Prefer Broadcast from Database for new notification patterns.
- **pg_net for fan-out within a single cron job** — fire-and-forget HTTP from SQL has no retry, no backpressure, and no visibility. Use pgmq queues instead.

**Confidence: HIGH** — All four features confirmed from official Supabase changelog, blog posts, and documentation (2024-2025).

---

## Summary Table

| Question | Recommendation | Key Library/Feature | Confidence |
|----------|---------------|---------------------|------------|
| pg_cron fan-out | Dispatcher cron → pgmq queue → runner cron | Supabase Queues (pgmq), `EdgeRuntime.waitUntil` | HIGH |
| Markdown storage | `text` column + generated `tsvector` + GIN index | PostgreSQL native FTS | HIGH |
| Email notifications | Resend (already integrated) | `resend@2.0.0` via esm.sh | HIGH |
| Browser push | Native Web Push API + VAPID via `@negrel/webpush` (JSR) | Supabase edge function + service worker | MEDIUM-HIGH |
| In-app realtime | Supabase Broadcast from Database | Realtime channel trigger | HIGH |
| AI streaming | SSE via `ReadableStream`, `fetch()` on frontend (NOT `functions.invoke`) | Deno native + browser Fetch API | HIGH |

---

## Alternatives Considered and Rejected

| Category | Recommended | Rejected | Reason |
|----------|-------------|---------|--------|
| Heartbeat fan-out | pgmq queue | One cron per agent | Hits 8-job concurrent limit immediately |
| Heartbeat fan-out | pgmq queue | pg_net direct invocation per agent | No retry, no backpressure, blind to failures |
| Browser push | Native VAPID | Firebase FCM | External dependency, Google account required, larger bundle |
| Browser push | Native VAPID | OneSignal | Vendor lock-in, monthly cost at scale |
| Markdown storage | text + tsvector | JSONB | No structured keys to exploit; binary conversion overhead for no gain |
| Streaming | `fetch()` direct | `supabase.functions.invoke()` | SDK buffers full response; streaming does not work through it |

---

## Environment Variables to Add

```
# Supabase secrets (edge functions):
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>

# Frontend env (Vite):
VITE_VAPID_PUBLIC_KEY=<same public key — safe to expose>
```

---

## Sources

- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron | Docs](https://supabase.com/docs/guides/cron)
- [Supabase Queues | Docs](https://supabase.com/docs/guides/queues)
- [Consuming Queue Messages with Edge Functions | Supabase Docs](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions)
- [Processing Large Jobs with Edge Functions, Cron, and Queues | Supabase Blog](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- [Background Tasks, Ephemeral Storage, and WebSockets | Supabase Blog](https://supabase.com/blog/edge-functions-background-tasks-websockets)
- [Realtime Broadcast from Database | Supabase Blog](https://supabase.com/blog/realtime-broadcast-from-database)
- [Supabase Cron Module Launch | Supabase Blog](https://supabase.com/blog/supabase-cron)
- [Supabase Queues Launch | Supabase Blog](https://supabase.com/blog/supabase-queues)
- [Push Notifications | Supabase Docs](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Push API | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push npm package](https://www.npmjs.com/package/web-push)
- [Send Web Push messages with Deno | negrel.dev](https://www.negrel.dev/blog/deno-web-push-notifications/)
- [PostgreSQL Full-Text Search | Neon Docs](https://neon.com/postgresql/postgresql-indexes/postgresql-full-text-search)
- [PostgreSQL: Chapter 12. Full Text Search | Official Docs](https://www.postgresql.org/docs/current/textsearch.html)
- [Understanding Postgres GIN Indexes | pganalyze](https://pganalyze.com/blog/gin-index)
- [Client side SSE with Edge Function Streams | Supabase GitHub Discussion #13124](https://github.com/orgs/supabase/discussions/13124)
- [Supabase Functions Invoke streaming issue | functions-js #67](https://github.com/supabase/functions-js/issues/67)

---

*Research complete: 2026-03-12*
