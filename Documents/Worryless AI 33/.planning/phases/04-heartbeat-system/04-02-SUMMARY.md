---
phase: 04-heartbeat-system
plan: "02"
subsystem: database
tags: [pgmq, pg_cron, pg_net, vault, notifications, supabase, migrations]

# Dependency graph
requires:
  - phase: 04-01
    provides: heartbeat config columns on user_agents, agent_heartbeat_log table, heartbeat_outcome ENUM, useHeartbeatConfig test stubs
  - phase: 01-database-foundation
    provides: user_agents table, agent_heartbeat_log table, auth.users references
provides:
  - pgmq heartbeat_jobs queue (logged, crash-safe)
  - notifications table with 8 columns (Phase 5 ready — no ALTER needed)
  - heartbeat_daily_budget column on user_agents (default 6)
  - pg_cron heartbeat-dispatcher job (every 5 minutes)
  - pg_cron heartbeat-runner job (every 1 minute)
  - verify_jwt = false config entries for both heartbeat edge functions
  - Vault-pattern cron auth (service_role_key + project_url)
affects:
  - 04-03 (heartbeat-dispatcher edge function — queue + cron must exist)
  - 04-04 (heartbeat-runner edge function — queue + cron must exist)
  - 05-notifications (notifications table schema — no ALTER needed)

# Tech tracking
tech-stack:
  added: [pgmq, vault.decrypted_secrets pattern for cron auth]
  patterns:
    - pg_cron jobs use net.http_post with Vault secrets for service-role auth
    - cron.unschedule wrapped in WHERE EXISTS for idempotent migration re-runs
    - notifications INSERT intentionally absent from RLS (service role only — matches agent_heartbeat_log pattern)

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260313000006_heartbeat_queue.sql
    - worrylesssuperagent/supabase/migrations/20260313000007_heartbeat_cron_jobs.sql
  modified:
    - worrylesssuperagent/supabase/config.toml

key-decisions:
  - "Vault secret names 'service_role_key' and 'project_url' used for pg_cron-to-edge-function auth — consistent with send-daily-briefing pattern"
  - "pgmq.create() (logged) not pgmq.create_unlogged() — low volume heartbeat queue, correctness over speed"
  - "notifications table has all 8 Phase 5 columns at creation — no ALTER TABLE needed in Phase 5"
  - "No INSERT RLS policy on notifications — service role only, matching agent_heartbeat_log precedent from Phase 1"
  - "verify_jwt = false for both heartbeat functions — they receive Bearer token from pg_cron (service role), not user JWTs"

patterns-established:
  - "Pattern 1: pg_cron Vault auth — SELECT net.http_post with Authorization header built from vault.decrypted_secrets WHERE name = 'service_role_key'"
  - "Pattern 2: Idempotent cron registration — cron.unschedule in WHERE EXISTS guard before cron.schedule"
  - "Pattern 3: Service-role-only INSERT tables — no INSERT RLS policy, only SELECT and UPDATE for users"

requirements-completed: [SEC-02, HB-01, HB-05]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 4 Plan 02: Heartbeat Queue Infrastructure Summary

**pgmq heartbeat_jobs queue, pg_cron dispatcher (5min) and runner (1min) jobs wired via Vault secrets, notifications table with full Phase 5 schema, and heartbeat_daily_budget column — two migrations enabling Plans 04-03 and 04-04**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T09:50:28Z
- **Completed:** 2026-03-13T09:52:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `20260313000006_heartbeat_queue.sql`: pgmq queue, heartbeat_daily_budget column, notifications table with RLS, two performance indexes
- Created `20260313000007_heartbeat_cron_jobs.sql`: idempotent pg_cron registrations for dispatcher (*/5) and runner (*) using Vault-pattern auth
- Extended `config.toml` with `verify_jwt = false` for both heartbeat edge functions, preserving all existing entries

## Task Commits

Each task was committed atomically (in worrylesssuperagent repo):

1. **Task 1: Migration 00006 — pgmq queue + notifications table + budget column** - `165e1d2` (feat)
2. **Task 2: Migration 00007 — pg_cron job registrations + config.toml entries** - `8f07ec5` (feat)

## Files Created/Modified

- `worrylesssuperagent/supabase/migrations/20260313000006_heartbeat_queue.sql` - pgmq queue creation, notifications table, heartbeat_daily_budget column, RLS policies, two indexes
- `worrylesssuperagent/supabase/migrations/20260313000007_heartbeat_cron_jobs.sql` - pg_cron heartbeat-dispatcher (*/5 min) and heartbeat-runner (every min) with Vault-based auth
- `worrylesssuperagent/supabase/config.toml` - added heartbeat-dispatcher and heartbeat-runner with verify_jwt = false

## Decisions Made

- Used `vault.decrypted_secrets` for cron-to-function auth with secret names `service_role_key` and `project_url` — consistent with the existing send-daily-briefing pattern, no new Vault setup required
- Used logged `pgmq.create()` (not unlogged) — correctness over speed for low-volume heartbeat queue
- notifications table designed with all 8 columns Phase 5 needs at creation time — avoids any ALTER TABLE in Phase 5
- No INSERT RLS policy on notifications — service role only, matching the agent_heartbeat_log precedent from Phase 1 for audit integrity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `worrylesssuperagent/` is a separate git repository (not tracked by the parent `.planning` repo). Commits were made inside the `worrylesssuperagent` repo as expected. The parent repo will track the subdirectory's overall state separately.

## User Setup Required

**Vault secrets must exist before running Migration 00007.** The cron jobs at runtime call `vault.decrypted_secrets` for `service_role_key` and `project_url`. If these Vault secrets don't exist yet, insert them via Supabase Dashboard > Vault before applying Migration 00007. (This is the same setup required by send-daily-briefing — if that function is already working, the secrets are already present.)

## Next Phase Readiness

- Plans 04-03 (heartbeat-dispatcher) and 04-04 (heartbeat-runner) are now unblocked — queue exists, cron jobs are registered, config.toml entries are in place
- Phase 5 notifications UI is fully unblocked — notifications table has all required columns

---
*Phase: 04-heartbeat-system*
*Completed: 2026-03-13*
