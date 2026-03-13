---
phase: 04-heartbeat-system
plan: "06"
subsystem: infra
tags: [supabase, deno, edge-functions, pg-cron, notifications, heartbeat]

# Dependency graph
requires:
  - phase: 04-heartbeat-system/04-05
    provides: heartbeat-runner edge function and agent_heartbeat_log inserts
  - phase: 04-heartbeat-system/04-02
    provides: notifications table with digest severity support
provides:
  - send-morning-digest edge function consolidating daily digest findings into Chief of Staff notification
  - Migration 00009: severity column on agent_heartbeat_log + morning digest pg_cron schedule
  - heartbeat-runner corrected to include severity field in log inserts
affects:
  - phase-05-notifications-ui (reads notifications table including digest severity)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Consolidated digest notification per user inserted into notifications table via Chief of Staff agent_type_id
    - pg_cron cron.schedule() pattern reused from heartbeat-dispatcher/heartbeat-runner for morning digest

key-files:
  created:
    - worrylesssuperagent/supabase/functions/send-morning-digest/index.ts
    - worrylesssuperagent/supabase/migrations/20260313000009_morning_digest_cron.sql
  modified:
    - worrylesssuperagent/supabase/config.toml
    - worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts

key-decisions:
  - "Morning digest delivered via notifications table (severity=digest, agent_type_id=chief_of_staff) — not a messages table (which does not exist in codebase); send-daily-briefing uses Resend email which is a separate pre-existing feature"
  - "heartbeat-runner notification_sent field corrected to true for urgent/headsup (was hardcoded false), consistent with actual behavior"

patterns-established:
  - "Pattern: send-morning-digest groups digestRows by user_id then inserts one consolidated notification per user rather than N individual notifications"

requirements-completed: [HB-09]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 4 Plan 06: Send Morning Digest Summary

**Morning digest edge function groups 24h digest-severity heartbeat findings per user and inserts a consolidated Chief of Staff notification, scheduled daily at 8am UTC via pg_cron (Phase 5 refines per-user timezone)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T10:03:48Z
- **Completed:** 2026-03-13T10:05:32Z
- **Tasks:** 1 auto + 1 checkpoint (auto-approved)
- **Files modified:** 4

## Accomplishments

- Migration 00009: added `severity TEXT CHECK (severity IN ('urgent','headsup','digest'))` to `agent_heartbeat_log` so digest rows are queryable by send-morning-digest
- Migration 00009: registered `send-morning-digest` pg_cron job at `0 8 * * *` using the vault-secret HTTP POST pattern established by heartbeat-dispatcher and heartbeat-runner
- New edge function `send-morning-digest/index.ts`: reads all digest-severity rows from past 24h, groups by user_id, builds markdown Morning Briefing, inserts single consolidated notification per user via `chief_of_staff` agent_type_id into notifications table
- `heartbeat-runner/index.ts` corrected: `severity` field now included in agent_heartbeat_log insert (required for send-morning-digest query to work); `notification_sent` field corrected to reflect actual behavior (true for urgent/headsup)
- `config.toml`: `verify_jwt = false` for `send-morning-digest` (consistent with other cron-invoked functions)
- All 31 vitest tests remain green post-change

## Task Commits

1. **Task 1: Add severity column + send-morning-digest function** - `eacfe6d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `worrylesssuperagent/supabase/migrations/20260313000009_morning_digest_cron.sql` - ALTER TABLE adds severity column; pg_cron schedule for daily 8am UTC digest
- `worrylesssuperagent/supabase/functions/send-morning-digest/index.ts` - Edge function: queries digest rows, groups by user, inserts Chief of Staff notification per user
- `worrylesssuperagent/supabase/config.toml` - Added `[functions.send-morning-digest] verify_jwt = false`
- `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` - Added `severity` field to agent_heartbeat_log insert; corrected `notification_sent` to reflect actual urgent/headsup behavior

## Decisions Made

- Morning digest uses `notifications` table (not a `messages` table — no such table exists in codebase). `send-daily-briefing` sends via Resend email; that is a separate pre-existing feature unrelated to the heartbeat Chief of Staff delivery. The `notifications` table with `severity='digest'` and `agent_type_id='chief_of_staff'` is the correct in-app delivery channel.
- One consolidated notification per user per morning run (N digest rows collapsed into one briefing) — reduces notification noise vs inserting one notification per finding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected notification_sent field in heartbeat-runner**
- **Found during:** Task 1 (reviewing heartbeat-runner for severity field addition)
- **Issue:** heartbeat-runner was inserting `notification_sent: false` for all rows even though urgent/headsup rows do have notifications sent
- **Fix:** Changed to `notification_sent: severity === "urgent" || severity === "headsup"` — consistent with the code's actual behavior
- **Files modified:** worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts
- **Verification:** vitest suite remains 31/31 green
- **Committed in:** eacfe6d (Task 1 commit)

**2. [Rule 1 - Schema mismatch] Used notifications table instead of non-existent messages table**
- **Found during:** Task 1 (checking send-daily-briefing insert pattern per plan instruction)
- **Issue:** Plan specified inserting into a `messages` table "as a Chief of Staff chat message", checking how send-daily-briefing inserts. send-daily-briefing does NOT insert into any chat table — it sends email via Resend. No `messages` table exists in any migration.
- **Fix:** Inserted consolidated digest briefing into `notifications` table with `severity='digest'`, `agent_type_id='chief_of_staff'`. This IS the correct Chief of Staff delivery channel for the heartbeat system (established in Phase 4 Plan 02).
- **Files modified:** worrylesssuperagent/supabase/functions/send-morning-digest/index.ts
- **Verification:** notifications table schema confirmed (00006 migration); digest severity already in CHECK constraint
- **Committed in:** eacfe6d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for correctness. No scope creep. Phase 4 heartbeat system closes correctly.

## Issues Encountered

None - both schema mismatches were caught and resolved during Task 1 implementation.

## User Setup Required

None - no external service configuration required beyond what previous Phase 4 plans established.

## Next Phase Readiness

- Phase 4 heartbeat system is complete: all 10 requirements (SEC-02, HB-01 through HB-09) have implementation artifacts
- Phase 5 (per-user timezone scheduling for morning digest) is unblocked — `send-morning-digest` currently fires at 8am UTC with a TODO(Phase 5) comment in code
- Phase 5 notifications UI is unblocked — notifications table has digest-severity rows queryable for notification bell / morning briefing UI

## Self-Check: PASSED

All created files verified on disk. Task commit eacfe6d found in inner repo. STATE.md updated. ROADMAP.md Phase 4 marked Complete (6/6 plans). HB-09 requirement marked complete.

---
*Phase: 04-heartbeat-system*
*Completed: 2026-03-13*
