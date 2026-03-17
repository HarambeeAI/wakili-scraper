---
phase: 04-heartbeat-system
verified_by: Claude (Phase 8 automated code review)
verified_at: 2026-03-17
overall_status: passed
requirements_verified: [HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-08, HB-09, SEC-02]
gap_closures_accounted:
  - phase: 06
    fix: dispatcher camelCase→snake_case field names
    requirements_affected: [HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-08, HB-09]
---

# Phase 4 Heartbeat System — Verification Record

## Phase 4 Success Criteria

### SC-1: pg_cron dispatcher queries due agents with active-hours + budget filtering

**Status:** PASS (fixed Phase 6)

**Evidence:**
- Migration `20260313000007_heartbeat_cron_jobs.sql` registers `heartbeat-dispatcher` pg_cron job at `*/5 * * * *` (line 15-31)
- Migration `20260313000008_heartbeat_dispatcher_fn.sql` implements `get_due_heartbeat_agents()` SQL function with explicit AT TIME ZONE active-hours filter (lines 30-33) and COUNT-based daily budget filter (lines 36-44)
- `heartbeat-dispatcher/index.ts` line 18-20: calls `supabaseAdmin.rpc("get_due_heartbeat_agents")` — all filtering in SQL, not in the edge function

**Notes:** Phase 6 fixed the dispatcher pgmq message payload from camelCase to snake_case keys, enabling the dispatcher→runner pipeline to function. The SQL function itself was correct in Phase 4.

---

### SC-2: severity ok → zero DB writes

**Status:** PASS

**Evidence:**
- `heartbeat-runner/index.ts` lines 169-174: explicit early return on `severity === "ok"`:
  ```
  if (severity === "ok") {
    console.log(`[heartbeat-runner] severity=ok ... — suppressed`);
    return;
  }
  ```
- The `agent_heartbeat_log` INSERT at line 177 and `notifications` INSERT at line 197 are both reached only after passing the ok-suppression guard at line 169

**Notes:** HEARTBEAT_OK suppression is unconditional — no DB writes of any kind occur for ok-severity heartbeats.

---

### SC-3: severity urgent → notification + push + email in same invocation

**Status:** PASS

**Evidence:**
- `heartbeat-runner/index.ts` line 197-213: notifications row INSERT for `severity === "urgent" || severity === "headsup"`
- Lines 216-224: `sendUrgentEmail()` called exclusively for `severity === "urgent"` — Resend email delivery
- Lines 227-256: VAPID push block executes for `severity === "urgent"`, dynamically imports `jsr:@negrel/webpush`, queries `push_subscriptions`, delivers push to all subscriber endpoints
- All three delivery channels (in-app notification, email, push) execute within the single `processHeartbeat()` invocation

**Notes:** Push is gated on VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars. If absent, push skips gracefully (non-fatal catch at line 251). Email and in-app notification are unaffected.

---

### SC-4: Agent settings shows heartbeat config section (interval, active hours, toggle)

**Status:** PASS

**Evidence:**
- `src/components/agents/HeartbeatConfigSection.tsx` lines 61-68: enabled toggle (Switch component, `heartbeat_enabled`)
- Lines 78-95: interval selector (Select with 1h/2h/4h/8h options, `heartbeat_interval_hours`)
- Lines 106-115: active hours start input (`type="time"`, `heartbeat_active_hours_start`)
- Lines 121-130: active hours end input (`type="time"`, `heartbeat_active_hours_end`)
- `src/hooks/useHeartbeatConfig.ts` lines 55-59: `updateConfig()` PATCHes `user_agents` table with changed fields

**Notes:** HeartbeatConfigSection is collapsible (Collapsible pattern) — hidden until user opens it. All four fields persist immediately to `user_agents` table on change.

---

### SC-5: Daily call budget (default 6) enforced by dispatcher

**Status:** PASS

**Evidence:**
- Migration `20260313000006_heartbeat_queue.sql` line 10: `heartbeat_daily_budget INTEGER NOT NULL DEFAULT 6`
- Migration `20260313000008_heartbeat_dispatcher_fn.sql` lines 36-44: COUNT subquery excludes agents where today's `agent_heartbeat_log` count >= `heartbeat_daily_budget`:
  ```sql
  AND (
    SELECT COUNT(*) FROM public.agent_heartbeat_log ahl
    WHERE ahl.user_id = ua.user_id
      AND ahl.agent_type_id = ua.agent_type_id
      AND ahl.run_at >= (
        date_trunc('day', now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))
        AT TIME ZONE COALESCE(p.timezone, 'UTC')
      )
  ) < COALESCE(ua.heartbeat_daily_budget, 6)
  ```
- `COALESCE(ua.heartbeat_daily_budget, 6)` on line 44 provides the default-6 fallback even if the column value is null

**Notes:** Budget uses COUNT aggregate from `agent_heartbeat_log` (self-resetting at midnight in user's local timezone, DST-safe). No counter column needed.

---

## Requirements Map

| Requirement | Status | Evidence | Notes |
|-------------|--------|----------|-------|
| HB-01 | PASS (fixed Phase 6) | `heartbeat-dispatcher/index.ts` lines 41-45: payload uses `user_agent_id`, `user_id`, `agent_type_id` (snake_case). Migration 00007 registers single pg_cron `heartbeat-dispatcher` job. | Bug: dispatcher originally used camelCase keys `{userAgentId, userId, agentTypeId}`; runner expected snake_case. Fix confirmed at `heartbeat-dispatcher/index.ts` lines 41-45. Phase 6 Plan 01 closed this. |
| HB-02 | PASS (fixed Phase 6) | `heartbeat-runner/index.ts` line 277: `rpc("read", { queue_name: "heartbeat_jobs", sleep_seconds: 30, n: 5 })` — reads up to 5 messages. Lines 67-79: reads all 6 workspace files (`IDENTITY`, `SOUL`, `SOPs`, `TOOLS`, `MEMORY`, `HEARTBEAT`) from `agent_workspaces`. Lines 109-112: `buildWorkspacePrompt()` called with `isHeartbeat=true`. | After Phase 6 fix, pgmq messages arrive with snake_case keys that runner correctly destructures at line 51 (`user_id`, `agent_type_id`). |
| HB-03 | PASS | `heartbeat-runner/index.ts` lines 169-174: `if (severity === "ok") { ...; return; }` — explicit early return, zero DB writes. | HEARTBEAT_OK suppression: `agent_heartbeat_log` INSERT (line 177) and `notifications` INSERT (line 197) are both unreachable for ok severity. |
| HB-04 | PASS | `heartbeat-runner/index.ts`: urgent path → notifications INSERT (line 197) + `sendUrgentEmail()` (line 218) + VAPID push (line 227-256). headsup path → notifications INSERT only (line 197-213). digest path → `agent_heartbeat_log` INSERT only (line 177-188), no notification row. | digest rows are later consolidated by `send-morning-digest` into a single Chief of Staff notification. |
| HB-05 | PASS | Migration 00008 lines 36-44: COUNT subquery on `agent_heartbeat_log` where `run_at >= date_trunc('day', now() AT TIME ZONE timezone)`. Compared against `COALESCE(ua.heartbeat_daily_budget, 6)`. | Default budget 6 set in migration 00006 column definition AND as COALESCE fallback in SQL function. |
| HB-06 | PASS | Migration 00008 lines 29-33: `EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))) >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start) AND ... < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)`. Uses `profiles.timezone` IANA value via `JOIN public.profiles p ON p.user_id = ua.user_id`. | AT TIME ZONE conversion is DST-safe. Active hours check uses user's local time, not UTC. |
| HB-07 | PASS | `heartbeat-runner/index.ts` lines 177-188: INSERT includes `user_id`, `agent_type_id`, `run_at`, `outcome`, `summary`, `severity`, `notification_sent`, `task_created`. Migration 00009 lines 5-7: `ALTER TABLE agent_heartbeat_log ADD COLUMN IF NOT EXISTS severity TEXT`. | `severity` column added by migration 00009. All required fields present. `run_at` serves as timestamp. |
| HB-08 | PASS | `HeartbeatConfigSection.tsx` lines 61-68 (toggle), 78-95 (interval 1h/2h/4h/8h), 106-115 (active hours start), 121-130 (active hours end). `useHeartbeatConfig.ts` lines 55-59: UPDATE PATCHes `user_agents` table on every change. | UI persists to `user_agents` table immediately on field change via `updateConfig()`. |
| HB-09 | PASS | `send-morning-digest/index.ts` lines 29-33: queries `profiles` for users with `next_digest_run_at <= now()`. Lines 61-67: queries `agent_heartbeat_log` for `severity=digest` rows in past 24h. Lines 83-90: inserts consolidated notification to `notifications` table (agent_type_id=chief_of_staff, severity=digest). Lines 102-106: advances `next_digest_run_at` using `nextDigestRunAt()` function (lines 11-22) to tomorrow 8am in user's timezone. | `next_digest_run_at` column on `profiles` table. Morning digest uses in-app notifications, not Resend email (Resend is `send-daily-briefing`, a separate pre-existing feature). |
| SEC-02 | PASS | `heartbeat-dispatcher/index.ts` lines 6-8: `SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`. Line 10: handler signature `async (_req)` — underscore prefix, request body never read. Line 13: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Lines 18-20: user identity comes exclusively from `user_agents` DB rows via `get_due_heartbeat_agents()`. Lines 43-44: `user_id` and `agent_type_id` sourced from `agent` DB row, not from request. Comment at lines 3-5 explicitly documents: "Request body is entirely ignored. User identity is derived exclusively from user_agents DB rows." | Service role key confirmed in source. No JWT extraction. No `req.headers.get('Authorization')`. No request body reads. Identity source is exclusively the DB. |

---

## Integration Points

### Dispatcher → Runner: pgmq Message Contract

After Phase 6 fix, the authoritative pgmq message contract uses snake_case keys:

```json
{
  "user_agent_id": "<UUID from user_agents.id>",
  "user_id": "<UUID from user_agents.user_id>",
  "agent_type_id": "<TEXT from user_agents.agent_type_id>"
}
```

- Dispatcher sends: `heartbeat-dispatcher/index.ts` lines 41-45
- Runner reads: `heartbeat-runner/index.ts` line 51 — destructures `{ user_id, agent_type_id }` from `message`
- Note: `user_agent_id` is enqueued but not consumed by the current runner version (runner uses `user_id` + `agent_type_id` to look up workspaces)

### Runner → Notifications → Realtime Chain

1. Runner INSERTs to `notifications` table (urgent + headsup only)
2. Supabase Realtime broadcasts INSERT event to subscribed clients
3. Phase 5 `useNotifications` hook receives broadcast, updates bell unread count
4. User sees `NotificationBell` update in DashboardHeader

### Runner → Resend Email (urgent only)

1. Runner calls `sendUrgentEmail()` for `severity === "urgent"`
2. Email fetched from `profiles.email` (not auth.users admin API)
3. Resend delivers via `noreply@worryless.ai`

### Dispatcher → get_due_heartbeat_agents SQL Function

1. pg_cron triggers `heartbeat-dispatcher` every 5 minutes
2. Dispatcher calls `supabaseAdmin.rpc("get_due_heartbeat_agents")`
3. SQL function applies AT TIME ZONE active-hours check + COUNT budget check
4. Returns filtered list of due agents (max 50 per invocation)
5. Dispatcher enqueues one pgmq message per due agent
6. Dispatcher advances `next_heartbeat_at` for successfully enqueued agents only

---

## Manual Verification Required

The following items require a live Supabase database to fully confirm. Code review evidence is sufficient for requirements tracking, but end-to-end confirmation is recommended before v1.0 release.

### MV-1: pg_cron Job Execution (requires live DB)

**What to confirm:** Both `heartbeat-dispatcher` and `heartbeat-runner` cron jobs are registered and executing on schedule.

**Test instructions:**
1. Connect to Supabase SQL Editor
2. Run: `SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('heartbeat-dispatcher', 'heartbeat-runner', 'send-morning-digest');`
3. Expected: 3 rows with `active = true`
4. Run: `SELECT jobname, start_time, status FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
5. Expected: recent execution records showing `succeeded` status

### MV-2: End-to-End Heartbeat Flow with pgmq (requires live DB)

**What to confirm:** Dispatcher enqueues messages that runner successfully processes.

**Test instructions:**
1. Ensure at least one `user_agents` row has `heartbeat_enabled = true` and `next_heartbeat_at <= now()`
2. Manually invoke dispatcher: `curl -X POST <project-url>/functions/v1/heartbeat-dispatcher -H "Authorization: Bearer <service-role-key>"`
3. Confirm response: `{"enqueued": N}` where N > 0
4. Wait 1 minute (runner fires every minute)
5. Check `agent_heartbeat_log` for new rows with recent `run_at` timestamps
6. Verify messages are not stuck: `SELECT * FROM pgmq_public.read('heartbeat_jobs', 0, 10);` should return empty after runner processes

### MV-3: Push Notification Delivery (requires deployed VAPID keys)

**What to confirm:** Urgent heartbeat delivers push notification to subscriber.

**Test instructions:**
1. Configure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Supabase Edge Function secrets
2. Subscribe to push in browser (Dashboard → push opt-in banner)
3. Manually insert an urgent heartbeat row that triggers notification delivery, OR temporarily modify runner to force urgent severity for a test agent
4. Confirm: browser push notification arrives with agent name + finding in title/body
5. Confirm: `push_subscriptions` table has rows for the test user

### MV-4: Morning Digest Delivery (requires next_digest_run_at column)

**What to confirm:** `send-morning-digest` delivers consolidated notification for digest-severity findings.

**Test instructions:**
1. Insert a test `agent_heartbeat_log` row with `severity = 'digest'`, `run_at = now()`
2. Set `profiles.next_digest_run_at = now()` for the test user
3. Manually invoke: `curl -X POST <project-url>/functions/v1/send-morning-digest -H "Authorization: Bearer <service-role-key>"`
4. Confirm response: `{"sent": 1, "due": 1}`
5. Check `notifications` table: new row with `agent_type_id = 'chief_of_staff'`, `severity = 'digest'`
6. Check `profiles.next_digest_run_at`: updated to tomorrow 8am in user's timezone

---

## Sign-Off

| Item | Status | Verifier | Date |
|------|--------|----------|------|
| Code review of all Phase 4 source files | COMPLETE | Claude (Phase 8 automated) | 2026-03-17 |
| Phase 6 gap-closure accounted (camelCase fix) | COMPLETE | Claude (Phase 8 automated) | 2026-03-17 |
| Vitest suite (51 tests, 0 failed) | PASS | Automated (`npx vitest run`) | 2026-03-17 |
| HB-01..09 all marked PASS (fixed Phase 6) | COMPLETE | Claude (Phase 8 automated) | 2026-03-17 |
| SEC-02 confirmed from source (no JWT) | COMPLETE | Claude (Phase 8 automated) | 2026-03-17 |
| Manual verification (MV-1..4) | PENDING | Requires live DB | - |

**Overall verdict:** Phase 4 Heartbeat System passes automated code review. All 10 requirements (HB-01..09, SEC-02) have confirmed source code implementations. HB-01 through HB-09 were functionally blocked by the Phase 6 dispatcher camelCase→snake_case bug; that fix is confirmed in `heartbeat-dispatcher/index.ts` and all requirements are now marked PASS. Manual verification (MV-1..4) is recommended before v1.0 milestone sign-off to confirm live pg_cron execution and end-to-end pgmq message flow.
