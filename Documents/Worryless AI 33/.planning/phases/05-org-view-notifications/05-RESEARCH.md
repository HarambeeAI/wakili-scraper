# Phase 5: Org View + Notifications — Research

**Researched:** 2026-03-13
**Domain:** Supabase Realtime (Postgres Changes), Web Push API + VAPID, React notification bell, org chart layout, push_subscriptions table
**Confidence:** HIGH (core Supabase patterns verified against official docs; Web Push VAPID patterns verified across MDN + Deno library docs)

---

## Summary

Phase 5 is the delivery and visibility layer on top of everything Phases 1–4 built. Three capabilities ship in this phase: (1) the Team org chart view — a React component that queries `user_agents` joined to `available_agent_types` and `agent_heartbeat_log` and renders a two-tier card grid (Chief of Staff pinned at top, all other active agents below); (2) the notification bell — a React hook that does an initial COUNT of unread `notifications` rows, then keeps the count live via a Supabase Realtime `postgres_changes` subscription scoped to `user_id=eq.<userId>` and `event: INSERT`; and (3) Web Push delivery for "urgent" heartbeat findings — a service worker registered client-side, a `push_subscriptions` table to store `PushSubscription` objects, and a Deno-compatible VAPID library (`jsr:@negrel/webpush`) called from inside `heartbeat-runner` when severity is "urgent".

The critical design context from Phase 4: the `notifications` table already exists with all needed columns (`id`, `user_id`, `agent_type_id`, `severity`, `message`, `is_read`, `link_type`, `created_at`). No schema migration is needed for notifications. The morning digest is already delivered as a `notifications` row (severity=digest, agent_type_id=chief_of_staff) by `send-morning-digest`. Phase 5's job is to surface all this in the UI with live updates.

The two open questions from STATE.md that this phase must address: (a) per-user timezone scheduling for the morning digest — Phase 4 ships it at 8am UTC as a placeholder, and the TODO comment in `send-morning-digest` explicitly defers this to Phase 5; (b) the org chart "Team" view referenced in ORG-01 through ORG-05 does not yet have any component or route in `Dashboard.tsx`.

**Primary recommendation:** Use `postgres_changes` (not `realtime.broadcast_changes`) for the notification bell — simpler setup, no extra SQL trigger needed, RLS automatically scopes events to the current user. Use `jsr:@negrel/webpush` in the Deno heartbeat-runner for VAPID push delivery. Build the org chart as a pure React/Tailwind layout with two tiers of cards — no external org chart library needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIF-01 | Notification bell in dashboard header showing unread count; clicking opens notification panel | `useNotifications` hook queries `notifications` table for `is_read=false` count on mount; bell renders in `DashboardHeader` alongside existing LogOut button |
| NOTIF-02 | In-app notifications use Supabase Realtime (postgres_changes) so alerts appear without page refresh | `supabase.channel().on('postgres_changes', {event:'INSERT', table:'notifications', filter:'user_id=eq.'+userId})` increments count in real time; cleanup via `supabase.removeChannel()` on unmount |
| NOTIF-03 | "Urgent" heartbeat findings trigger a push notification via native Web Push API + VAPID (no third-party service) | Requires: `push_subscriptions` table, service worker (`/sw.js`) in `public/`, client-side subscription registration, `jsr:@negrel/webpush` in heartbeat-runner for server-side send; VAPID keys stored as Supabase secrets |
| NOTIF-04 | "Urgent" heartbeat findings also trigger an email via the existing Resend integration | Already implemented in Phase 4 `heartbeat-runner` — no new work needed; verify is_read behavior only |
| NOTIF-05 | Users can mark notifications as read individually or "Mark all read" | UPDATE on `notifications` sets `is_read=true`; RLS UPDATE policy already exists; hook exposes `markRead(id)` and `markAllRead()` that PATCH the table; unread count state decrements immediately (optimistic) |
| NOTIF-06 | Notification entries link to the relevant agent view | Each notification row has `link_type='agent_panel'` and `agent_type_id`; clicking notification calls `onNavigate('agent:'+agentTypeId)` from the panel |
| ORG-01 | "Team" view in sidebar showing org chart: Chief of Staff at top, all activated agents below | `ActiveView` union gains `'team'` member; `DashboardSidebar` gains a Team entry in Main group; `TeamView` component renders the two-tier layout |
| ORG-02 | Each agent card shows: name, role, avatar/icon, heartbeat status indicator, last active timestamp, task count last 7 days | `useTeamData` hook fetches `user_agents` + `available_agent_types` + `agent_heartbeat_log` (last row per agent, COUNT last 7 days) |
| ORG-03 | Live pulsing green indicator when heartbeat fired in last hour; grey=sleeping; amber=findings surfaced | CSS `animate-pulse` on a colored dot; computed from `agent_heartbeat_log` latest row `run_at` and `outcome` |
| ORG-04 | Clicking agent card navigates to that agent's panel | Card `onClick` calls `onNavigate(LEGACY_VIEW_MAP[agentTypeId] \|\| 'agent:'+agentTypeId)` — same resolution logic as DashboardSidebar |
| ORG-05 | "Add Agent" button in Team view opens Agent Marketplace | Button calls `onNavigate('marketplace')` — consistent with sidebar Add Agent entry |
</phase_requirements>

---

## Standard Stack

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.86.0 (already in project) | Realtime `postgres_changes` subscription for notification bell | Already the project client; `postgres_changes` is the simpler Realtime mode requiring no extra SQL trigger |
| `jsr:@negrel/webpush` | latest (JSR package) | VAPID key generation + push notification send from Deno (edge function) | Only Deno-native VAPID library with active maintenance; no NPM shim needed; JSR import works in Supabase Edge Functions |
| Service Worker API (browser native) | Web standard | Receive push events when app is not in focus | No library needed; registered from `public/sw.js` in Vite project; `navigator.serviceWorker.register('/sw.js')` |
| Tailwind CSS + Lucide React (already in project) | already in project | Org chart card layout, status indicators, notification bell badge | No additional libraries; `animate-pulse` Tailwind class gives the live heartbeat pulse; Lucide `Bell`, `BellRing`, `Users` icons available |
| `lucide-react` | 0.462.0 (already in project) | Bell icon, status dots, agent icons | Already in DashboardSidebar icon map; Bell + BellDot available |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 3.6.0 (already in project) | Format `last active` timestamps on org chart cards ("2 hours ago") | Use `formatDistanceToNow()` for human-readable last-active display |
| `@radix-ui/react-popover` | already in project | Notification panel dropdown anchored to bell button | Already installed; use instead of building custom dropdown |
| `@radix-ui/react-scroll-area` | already in project | Scrollable notification list inside popover panel | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `postgres_changes` subscription | `realtime.broadcast_changes` SQL trigger | Broadcast from DB requires a Postgres trigger + RLS policy on `realtime.messages`; more setup for same result; postgres_changes RLS scoping is automatic |
| `jsr:@negrel/webpush` | `web-push` npm via `esm.sh` | `web-push` npm requires Node.js crypto APIs not available in Deno; `jsr:@negrel/webpush` uses Web Crypto API natively; no polyfill needed |
| Custom CSS org chart with connectors | React Flow or similar | React Flow adds ~200KB to bundle for a static org chart with ~12 nodes; pure Tailwind flexbox layout is sufficient for the fixed 2-tier hierarchy |
| Popover for notification panel | Sheet (drawer) | Sheet slides in from right edge and suits mobile; Popover is consistent with notification bell UX convention; project already uses both — Popover preferred here since it anchors to bell |

**Installation (new dependency):**
```bash
# No new npm packages needed — all browser and server dependencies are either:
# - already in package.json (supabase-js, radix, lucide, date-fns, tailwind)
# - Deno JSR imports in edge functions (jsr:@negrel/webpush)
# - Web platform APIs (Service Worker, Push API, Notification API)
```

The only new Supabase migration needed is the `push_subscriptions` table for NOTIF-03.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx       # Add NotificationBell here (already exists)
│   │   ├── DashboardSidebar.tsx      # Add 'team' entry in Main group (already exists)
│   │   └── NotificationBell.tsx      # New: bell + popover panel (NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06)
│   └── team/
│       ├── TeamView.tsx              # New: two-tier org chart (ORG-01 through ORG-05)
│       ├── AgentCard.tsx             # New: individual agent card with status indicator
│       └── HeartbeatStatusDot.tsx    # New: green pulse / grey / amber indicator (ORG-02, ORG-03)
├── hooks/
│   ├── useNotifications.ts           # New: initial count + realtime subscription (NOTIF-01, NOTIF-02)
│   └── useTeamData.ts                # New: user_agents + last heartbeat + 7-day task count (ORG-02)
└── __tests__/
    ├── useNotifications.test.ts      # Wave 0 stubs (NOTIF-01, NOTIF-02, NOTIF-05)
    └── useTeamData.test.ts           # Wave 0 stubs (ORG-02, ORG-03)

public/
└── sw.js                             # New: service worker for push events (NOTIF-03)

supabase/
├── functions/
│   └── heartbeat-runner/
│       └── index.ts                  # Modify: add VAPID push send for severity=urgent (NOTIF-03)
└── migrations/
    └── 20260313000010_push_subscriptions.sql  # New: push_subscriptions table
```

### Pattern 1: Realtime Notification Count (NOTIF-01, NOTIF-02)
**What:** On mount, query unread count from `notifications` table. Then subscribe to `postgres_changes` INSERT events on the `notifications` table filtered to the current user. Each INSERT increments the count without re-querying.
**When to use:** Any time the bell badge needs to update without polling.
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
useEffect(() => {
  if (!userId) return;

  // Initial count from DB
  supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .then(({ count }) => setUnreadCount(count ?? 0));

  // Live subscription — only INSERT triggers increment
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => setUnreadCount((prev) => prev + 1)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

### Pattern 2: Mark Read (NOTIF-05)
**What:** UPDATE `notifications` to set `is_read=true`. RLS UPDATE policy already exists (Phase 4 migration). Optimistic UI: decrement count before awaiting the DB call.
```typescript
// Source: RLS UPDATE policy in 20260313000006_heartbeat_queue.sql
const markRead = async (notificationId: string) => {
  setUnreadCount((prev) => Math.max(0, prev - 1)); // optimistic
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
};

const markAllRead = async () => {
  setUnreadCount(0); // optimistic
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
};
```

### Pattern 3: Heartbeat Status Indicator (ORG-03)
**What:** Compute status from latest `agent_heartbeat_log` row for each agent.
**When to use:** Every agent card in TeamView.
```typescript
// Source: project STATE.md decisions — status derived from agent_heartbeat_log
type HeartbeatStatus = 'active' | 'attention' | 'sleeping';

function getHeartbeatStatus(
  lastRunAt: string | null,
  lastOutcome: string | null
): HeartbeatStatus {
  if (!lastRunAt) return 'sleeping';
  const hoursSince = (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000;
  if (lastOutcome === 'surfaced') return 'attention';  // amber
  if (hoursSince <= 1) return 'active';               // green pulse
  return 'sleeping';                                   // grey
}

// CSS:
// active:    className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
// attention: className="w-2.5 h-2.5 rounded-full bg-amber-500"
// sleeping:  className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40"
```

### Pattern 4: Web Push VAPID Flow (NOTIF-03)
**What:** Three-part system — client subscription registration, DB storage, server-side send.
**When to use:** Only for severity=urgent heartbeat findings.

**Part A: VAPID key generation (one-time, run locally):**
```bash
# Using the negrel/webpush Deno script
deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts
# Output: { publicKey: "...", privateKey: "..." }
# Store: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
# Client: VITE_VAPID_PUBLIC_KEY=... in .env (safe to expose — it's the public key)
```

**Part B: Client-side subscription registration (in React):**
```typescript
// Source: MDN Push API docs + negrel/webpush README
// public/sw.js — minimal service worker
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Worryless AI', {
      body: data.body ?? '',
      icon: '/favicon.png',
    })
  );
});

// src/hooks/usePushSubscription.ts
const subscribe = async () => {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  });
  // Store subscription object in push_subscriptions table via supabase client
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
    auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
  }, { onConflict: 'user_id,endpoint' });
};
```

**Part C: Server-side send in heartbeat-runner (Deno):**
```typescript
// Source: https://github.com/negrel/webpush
import * as webpush from "jsr:@negrel/webpush";

const appServer = await webpush.ApplicationServer.new({
  contactInformation: "mailto:noreply@worryless.ai",
  vapidKeys: {
    publicKey: Deno.env.get("VAPID_PUBLIC_KEY"),
    privateKey: Deno.env.get("VAPID_PRIVATE_KEY"),
  },
});

const { data: subs } = await supabaseAdmin
  .from('push_subscriptions')
  .select('endpoint, p256dh, auth')
  .eq('user_id', userId);

for (const sub of subs ?? []) {
  const subscriber = appServer.subscribe({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  });
  await subscriber.pushTextMessage(JSON.stringify({ title: agentName, body: finding }), {});
}
```

### Pattern 5: Org Chart Two-Tier Layout (ORG-01)
**What:** CSS flexbox — Chief of Staff card centered in top row, remaining active agents in a responsive grid below. No third-party org chart library.
```tsx
// Source: Tailwind CSS docs — flex + grid
<div className="flex flex-col items-center gap-6 p-6">
  {/* Top tier — Chief of Staff */}
  <AgentCard agent={chiefOfStaff} onNavigate={onNavigate} className="w-72" />

  {/* Connector line — decorative */}
  <div className="w-px h-6 bg-border" />

  {/* Bottom tier — direct reports */}
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
    {otherAgents.map((agent) => (
      <AgentCard key={agent.agentTypeId} agent={agent} onNavigate={onNavigate} />
    ))}
    <AddAgentCard onNavigate={onNavigate} />
  </div>
</div>
```

### Pattern 6: useTeamData Hook (ORG-02)
**What:** Single query joining `user_agents`, `available_agent_types`, and two `agent_heartbeat_log` subqueries — latest run per agent and count for past 7 days.
```typescript
// Fetches agent list with heartbeat data in one shot using Supabase select
const { data } = await supabase
  .from('user_agents')
  .select(`
    agent_type_id,
    is_active,
    available_agent_types (
      display_name,
      description
    )
  `)
  .eq('user_id', userId)
  .eq('is_active', true);

// Separate query for heartbeat stats (agent_heartbeat_log not in foreign key chain)
// For each agent: latest row and 7-day count — use Promise.all for parallel fetch
```

### Anti-Patterns to Avoid
- **Polling for notification count:** Never `setInterval` query the DB for unread count — use `postgres_changes` subscription. Polling creates unnecessary DB load and battery drain.
- **Sending push from client side:** The VAPID private key must never leave the server. Push is sent only from `heartbeat-runner` edge function.
- **Complex org chart library for 12 agents:** React Flow, D3, or similar adds significant bundle weight for a static two-tier hierarchy. Tailwind grid is sufficient and renders faster.
- **Re-querying full notification list on every INSERT:** The `postgres_changes` callback should only increment the counter, not re-fetch the entire list. Full list fetch happens lazily when the panel opens.
- **Using `realtime.broadcast_changes` for notifications:** This requires a Postgres function + trigger on `notifications` table + RLS policy on `realtime.messages`. `postgres_changes` achieves the same result with zero SQL additions because RLS on `notifications` already scopes events.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAPID key crypto + HTTP Encrypted Content-Encoding | Custom VAPID signer in Deno | `jsr:@negrel/webpush` | RFC 8291/8292 encryption (aesgcm + HKDF key derivation) is cryptographically complex; one wrong byte breaks all push endpoints |
| Push subscription serialization | Manual Base64 encode/decode of ArrayBuffers | `btoa(String.fromCharCode(...new Uint8Array(key)))` (platform API) | Browser Push API returns ArrayBuffers for keys; this two-liner is the standard serialization |
| Unread badge count with polling | `setInterval(() => queryDB(), 5000)` | `postgres_changes` subscription | Polling creates constant DB connections; Realtime uses a single WebSocket shared across all channels |
| "Time ago" formatting | Custom date diff function | `date-fns formatDistanceToNow()` | DST edge cases, pluralization, locale differences — already handled; `date-fns` already in `package.json` |
| Service worker push handler | Push notification UI framework | 8-line `sw.js` (native API) | Browser Push API is well-standardized; the handler is trivial; no framework needed |

**Key insight:** The Web Push delivery chain (VAPID auth → HTTP Encrypted Content-Encoding → push service routing) has many crypto correctness requirements. Use the established library; the notification UI layer (badge, panel, cards) is plain React/Tailwind and requires no libraries beyond what's already installed.

---

## Common Pitfalls

### Pitfall 1: Realtime Channel Leak
**What goes wrong:** Calling `supabase.channel()` in a `useEffect` without cleanup causes duplicate subscriptions when the component re-mounts (e.g., hot reload in dev, React StrictMode double-invoke).
**Why it happens:** Each `channel()` call opens a new WebSocket subscription; without `supabase.removeChannel(channel)` in the cleanup function, old subscriptions accumulate.
**How to avoid:** Always return `() => { supabase.removeChannel(channel); }` from the `useEffect`.
**Warning signs:** Unread count increments by 2 on each new notification instead of 1.

### Pitfall 2: Push Permission Not Requested Before Subscribe
**What goes wrong:** `pushManager.subscribe()` throws if `Notification.permission !== 'granted'`.
**Why it happens:** The browser blocks the subscribe call if notification permission has not been granted.
**How to avoid:** `await Notification.requestPermission()` before calling `pushManager.subscribe()`. Gracefully handle `'denied'` state — do not throw.
**Warning signs:** `DOMException: Registration failed - permission denied` in console.

### Pitfall 3: Service Worker Not Served from Root
**What goes wrong:** Push events are never received; service worker scope is `/assets/` instead of `/`.
**Why it happens:** Vite copies files from `public/` to `dist/` at the root. If `sw.js` is placed anywhere else (e.g. `src/`), it gets served from the wrong path.
**How to avoid:** Place `sw.js` in `worrylesssuperagent/public/sw.js`. Register with `navigator.serviceWorker.register('/sw.js')` (absolute path from origin).
**Warning signs:** `pushManager.subscribe()` succeeds but no `push` event fires in the service worker.

### Pitfall 4: VAPID Public Key Encoding Mismatch
**What goes wrong:** `pushManager.subscribe({ applicationServerKey: ... })` throws `DOMException: Invalid applicationServerKey`.
**Why it happens:** The VAPID public key must be passed as a `Uint8Array` (not a base64 string). Applications that pass the raw base64 string fail silently in some browsers and throw in others.
**How to avoid:** Use the `urlBase64ToUint8Array` converter:
```typescript
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
```
**Warning signs:** `Invalid applicationServerKey` DOMException during subscription.

### Pitfall 5: Notification Panel Navigation with Legacy View IDs
**What goes wrong:** Clicking a notification for `accountant` agent navigates to `agent:accountant` instead of `accountant` (the legacy view ID), opening a blank GenericAgentPanel instead of the existing AccountantAgent component.
**Why it happens:** The `LEGACY_VIEW_MAP` in `DashboardSidebar` maps `accountant` → `"accountant"` etc. Notification click must apply the same resolution.
**How to avoid:** Export `LEGACY_VIEW_MAP` from `DashboardSidebar` (or a shared constants file) and import it in `NotificationBell`. Apply the same `LEGACY_VIEW_MAP[agentTypeId] || 'agent:' + agentTypeId` resolution.
**Warning signs:** Clicking accountant/marketer/sales/assistant notifications opens the generic panel instead of the dedicated agent component.

### Pitfall 6: `postgres_changes` Filter Requires RLS on Table
**What goes wrong:** Subscriptions with `filter: 'user_id=eq.X'` return no events even when rows are inserted.
**Why it happens:** Supabase `postgres_changes` events respect RLS — if the authenticated user's SELECT policy on `notifications` would return no rows, the realtime event is also withheld.
**How to avoid:** Confirm RLS is enabled and the `Users can view own notifications` SELECT policy exists on the `notifications` table (already created in Phase 4 migration `20260313000006`). No additional config needed.
**Warning signs:** No `INSERT` events received in the subscription callback despite rows being written by the service role.

---

## Code Examples

### Notification Bell Component Shell
```typescript
// Source: Supabase postgres_changes docs + Radix Popover pattern
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell({ userId, onNavigate }: Props) {
  const { unreadCount, notifications, markRead, markAllRead } = useNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center
                             rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* notification list + mark all read button */}
      </PopoverContent>
    </Popover>
  );
}
```

### Push Subscriptions Migration
```sql
-- Source: project migration pattern (Phase 4 migrations as reference)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- No INSERT service-role-only constraint here: client inserts its own subscription
```

### ActiveView Union Extension
```typescript
// Source: Dashboard.tsx — add 'team' to existing union
export type ActiveView =
  | "overview"
  | "team"          // <-- add this
  | "accountant"
  | "marketer"
  | "sales"
  | "assistant"
  | "chat"
  | "settings"
  | "artifacts"
  | "marketplace"
  | string;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase Cloud Messaging for web push | Native Web Push API + VAPID (no FCM) | 2018 (Safari 16.4 added push support in 2023) | FCM dependency removed; push works in all modern browsers including Safari 16.4+ on iOS |
| `realtime.broadcast_changes` (DB trigger) for live notifications | `postgres_changes` with RLS filtering | Always available; broadcast from DB is newer Supabase feature | `postgres_changes` is simpler: no SQL trigger needed; RLS scoping is automatic |
| `web-push` npm library | `jsr:@negrel/webpush` (Deno-native) | JSR ecosystem matured 2024 | `web-push` requires Node.js `crypto` module unavailable in Deno Edge Functions; `jsr:@negrel/webpush` uses Web Crypto API available in Deno natively |

**Deprecated/outdated:**
- GCM (Google Cloud Messaging): Shut down 2019; FCM (Firebase Cloud Messaging) replaced it; but native VAPID removes the need for FCM entirely in web apps
- `supabase.removeAllChannels()`: Deprecated in newer supabase-js; use `supabase.removeChannel(channel)` with the specific channel reference

---

## Open Questions

1. **Per-user timezone morning digest scheduling (HB-09 TODO)**
   - What we know: `send-morning-digest` currently fires at 8am UTC for all users. `profiles.timezone` column exists. Phase 4 left a `TODO(Phase 5)` comment in both `send-morning-digest/index.ts` and `20260313000009_morning_digest_cron.sql`.
   - What's unclear: Whether Phase 5 should implement per-user timezone bucketing (create multiple pg_cron jobs for major timezone offsets), a `next_digest_run_at` column approach (dispatcher-style), or leave UTC-only for v1.
   - Recommendation: For v1, implement a `next_digest_run_at` column on `profiles` that the `send-morning-digest` function computes and persists per user. The cron job runs every hour; the function checks which users have `next_digest_run_at <= now()`, sends their digest, then sets `next_digest_run_at` to tomorrow 8am in their timezone. This is the same pattern as `next_heartbeat_at` already used by the dispatcher — no new mental model.

2. **Push subscription opt-in UX**
   - What we know: `Notification.requestPermission()` must be called before `pushManager.subscribe()`. Permission is sticky per origin.
   - What's unclear: Where in the UI to request permission — on first visit to dashboard, or inside a settings toggle.
   - Recommendation: Add a "Enable push alerts" toggle in the Settings page (SettingsPage component already exists). Only request permission when the user explicitly enables it. Store `push_enabled: boolean` in `profiles` to remember the preference.

3. **Digest severity notifications in panel**
   - What we know: `send-morning-digest` inserts digest rows as notifications with `severity='digest'`. The notification panel will query all `is_read=false` notifications.
   - What's unclear: Should digest-severity notifications render differently in the panel (e.g., no individual "mark read", only "mark all")?
   - Recommendation: Render digest notifications with a distinct "Morning Briefing" label and a "View" link that navigates to chief_of_staff panel. Allow individual mark-read like other notifications.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | `useNotifications` returns initial unread count from DB | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "initial count"` | ❌ Wave 0 |
| NOTIF-02 | Realtime INSERT subscription increments count | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "realtime"` | ❌ Wave 0 |
| NOTIF-05 | `markRead` decrements unread count optimistically | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "markRead"` | ❌ Wave 0 |
| NOTIF-05 | `markAllRead` sets count to 0 optimistically | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "markAllRead"` | ❌ Wave 0 |
| NOTIF-03 | Push subscription stored in `push_subscriptions` table | manual | N/A — requires HTTPS + service worker registration | manual only |
| NOTIF-04 | Urgent email sent via Resend | manual | N/A — already tested in Phase 4 heartbeat-runner | manual only |
| NOTIF-06 | Notification click resolves correct view ID via LEGACY_VIEW_MAP | unit | `npx vitest run src/__tests__/useNotifications.test.ts -t "navigation"` | ❌ Wave 0 |
| ORG-01 | 'team' view renders org chart structure | manual | N/A — visual component | manual only |
| ORG-02 | `useTeamData` returns agents with last active + task count | unit | `npx vitest run src/__tests__/useTeamData.test.ts -t "team data"` | ❌ Wave 0 |
| ORG-03 | `getHeartbeatStatus` returns 'active' for run < 1 hour ago | unit | `npx vitest run src/__tests__/useTeamData.test.ts -t "status"` | ❌ Wave 0 |
| ORG-04 | AgentCard click calls onNavigate with correct view ID | manual | N/A — React Testing Library setup needed | manual only |
| ORG-05 | Add Agent button calls onNavigate('marketplace') | manual | N/A — visual component | manual only |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worrylesssuperagent/src/__tests__/useNotifications.test.ts` — covers NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06
- [ ] `worrylesssuperagent/src/__tests__/useTeamData.test.ts` — covers ORG-02, ORG-03 (includes `getHeartbeatStatus` pure function test)

---

## Sources

### Primary (HIGH confidence)
- [Supabase Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription filter syntax, useEffect cleanup pattern, RLS behavior
- [Supabase Realtime Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database) — comparison of Postgres Changes vs Broadcast; confirmed postgres_changes is simpler for this use case
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — pushManager.subscribe() signature, applicationServerKey encoding, browser support
- [negrel/webpush GitHub](https://github.com/negrel/webpush) — JSR import path `jsr:@negrel/webpush`, VAPID key generation script, ApplicationServer.subscribe() API
- Project codebase: `20260313000006_heartbeat_queue.sql` — confirmed notifications table schema, RLS policies (SELECT + UPDATE), index on `(user_id, is_read, created_at DESC)` already created

### Secondary (MEDIUM confidence)
- [Supabase Realtime Getting Started](https://supabase.com/docs/guides/realtime/getting_started) — channel cleanup pattern, channel naming conventions
- [negrel.dev Deno web push blog](https://www.negrel.dev/blog/deno-web-push-notifications/) — verified `jsr:@negrel/webpush` import and ApplicationServer API shape
- [MDN Progressive Web Apps — Push tutorial](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push) — service worker `push` event handler pattern

### Tertiary (LOW confidence — flag for validation)
- MakerKit blog on real-time notifications with Supabase (linked in WebSearch) — general pattern alignment but not authoritative; prefer official docs above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — supabase-js already in project; `jsr:@negrel/webpush` verified as Deno-native; all UI dependencies already installed
- Architecture: HIGH — notifications table schema fully confirmed in Phase 4 migrations; `postgres_changes` pattern directly from official docs; org chart layout is pure Tailwind
- Pitfalls: HIGH — channel leak, VAPID encoding, service worker scope, and LEGACY_VIEW_MAP pitfalls are all project-specific and verified against actual code
- Web Push (NOTIF-03): MEDIUM — VAPID library verified; service worker API is web standard; push service delivery (browser side) requires live browser testing

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — supabase-js and JSR packages are stable; Web Push API is a finalized standard)
