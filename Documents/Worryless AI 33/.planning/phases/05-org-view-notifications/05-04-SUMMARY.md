---
phase: 05-org-view-notifications
plan: "04"
subsystem: notifications
tags: [web-push, vapid, service-worker, push-subscriptions, supabase, react, deno]

requires:
  - phase: 05-02
    provides: notifications table with RLS and useNotifications hook
  - phase: 05-03
    provides: org chart TeamView and useTeamData hook
  - phase: 04-heartbeat-system
    provides: heartbeat-runner edge function with urgent severity branch

provides:
  - push_subscriptions table with RLS (20260313000010)
  - sw.js service worker in public/ handling push events via showNotification
  - usePushSubscription React hook — requestPermission guard, subscribe/unsubscribe, DB upsert/delete
  - SettingsPage Notifications section with "Enable push alerts" Switch
  - heartbeat-runner VAPID push send in urgent severity branch via jsr:@negrel/webpush

affects:
  - 05-05
  - any future feature touching push notifications or the Settings page

tech-stack:
  added:
    - "jsr:@negrel/webpush (Deno JSR, dynamic import in heartbeat-runner)"
    - "Web Push API / Service Worker API (browser native, no npm)"
  patterns:
    - "Dynamic import of jsr:@negrel/webpush inside try/catch so push never blocks email"
    - "urlBase64ToUint8Array converter for applicationServerKey encoding (VAPID Pitfall 4)"
    - "VAPID keys as optional env vars — function deploys before keys are configured"
    - "supabase.from('push_subscriptions').upsert({onConflict:'user_id,endpoint'}) for idempotent registration"

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260313000010_push_subscriptions.sql
    - worrylesssuperagent/public/sw.js
    - worrylesssuperagent/src/hooks/usePushSubscription.ts
  modified:
    - worrylesssuperagent/src/components/settings/SettingsPage.tsx
    - worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts

key-decisions:
  - "Dynamic import of jsr:@negrel/webpush inside the urgent try/catch block — avoids top-level import in heartbeat-runner which is a single-module Deno file"
  - "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are optional at runtime — if not set, push silently skipped; function deploys before VAPID keys are configured"
  - "usePushSubscription fails silently on HTTP dev environments where Push API is unavailable — no throw, just console.warn"
  - "userId fetched internally via fetchProfile + setUserId — no prop drilling, consistent with GenericAgentPanel pattern"
  - "push_subscriptions uses UNIQUE(user_id, endpoint) with ON CONFLICT upsert — idempotent re-registration"

patterns-established:
  - "Pattern: non-fatal push delivery — try/catch wraps VAPID send, email already delivered before push attempt"
  - "Pattern: optional env var guard — check Deno.env.get('KEY') before creating ApplicationServer, skip if absent"

requirements-completed: [NOTIF-03]

duration: 2min
completed: 2026-03-13
---

# Phase 05 Plan 04: Web Push Delivery for Urgent Heartbeat Alerts Summary

**End-to-end VAPID push pipeline: push_subscriptions table + sw.js service worker + usePushSubscription hook with permission guard + Settings toggle + heartbeat-runner urgent-branch VAPID send via jsr:@negrel/webpush**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T13:46:21Z
- **Completed:** 2026-03-13T13:48:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created push_subscriptions migration with RLS — users manage their own subscriptions; service role queries all subs per user for server-side push send
- Built minimal sw.js service worker in public/ that receives push events and calls showNotification with OS notification center
- Implemented usePushSubscription hook with urlBase64ToUint8Array encoding guard (prevents DOMException), graceful permission-denied handling, and DB upsert/delete for subscribe/unsubscribe lifecycle
- Added Notifications section to SettingsPage with "Enable push alerts" Switch wired to hook subscribe/unsubscribe
- Extended heartbeat-runner urgent branch with VAPID push send inside a non-fatal try/catch — push failure never breaks email delivery or heartbeat run; skips gracefully when VAPID env vars absent

## Task Commits

1. **Task 1: push_subscriptions migration + sw.js + usePushSubscription hook + Settings toggle** - `6b1426c` (feat)
2. **Task 2: VAPID push send in heartbeat-runner urgent branch** - `e5afbc5` (feat)

## Files Created/Modified

- `worrylesssuperagent/supabase/migrations/20260313000010_push_subscriptions.sql` - push_subscriptions table with RLS for Web Push subscription storage
- `worrylesssuperagent/public/sw.js` - minimal 8-line service worker handling push events via showNotification
- `worrylesssuperagent/src/hooks/usePushSubscription.ts` - React hook: requestPermission guard, subscribe/unsubscribe, upsert/delete in push_subscriptions, mount-time subscription check
- `worrylesssuperagent/src/components/settings/SettingsPage.tsx` - added userId state, usePushSubscription import, Notifications Card with "Enable push alerts" Switch
- `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` - VAPID push send block in urgent severity branch using jsr:@negrel/webpush with optional env var guard

## Decisions Made

- Dynamic import of `jsr:@negrel/webpush` inside the urgent try/catch rather than at top-level — allows the function to deploy and run before VAPID keys are configured without import errors
- VAPID env vars treated as optional: `if (vapidPublicKey && vapidPrivateKey)` guard means zero push attempts when unconfigured, not a thrown error
- `usePushSubscription` fails silently on HTTP dev environments where the Push API is unavailable — consistent with "expected dev behavior" note in plan spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all four files created cleanly, vitest suite passed at 48/48 tests after both tasks.

## User Setup Required

**VAPID keys require manual configuration before push notifications will be delivered.** The `user_setup` frontmatter in the plan documents the exact steps:

1. Generate VAPID keys: `deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts`
2. Set Supabase secrets: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...` (from worrylesssuperagent/ directory)
3. Add to local .env: `VITE_VAPID_PUBLIC_KEY=<publicKey>`

Until these are set, the push toggle in Settings will silently skip subscription (Push API requires HTTPS + valid VAPID key). Email alerts via Resend continue working regardless.

## Next Phase Readiness

- Phase 5 Plan 05 (if any) can build on the complete push pipeline
- push_subscriptions table is live and RLS-protected — client can subscribe immediately after VAPID keys are configured
- heartbeat-runner will auto-deliver push to all registered devices when severity=urgent fires

---
*Phase: 05-org-view-notifications*
*Completed: 2026-03-13*
