---
phase: 05-org-view-notifications
plan: "05"
subsystem: database
tags: [supabase, postgres, cron, timezone, edge-functions, deno]

# Dependency graph
requires:
  - phase: 04-heartbeat-system
    provides: notifications table, agent_heartbeat_log severity column, morning digest cron (daily 8am UTC placeholder)
  - phase: 05-02
    provides: useNotifications hook, NotificationBell component
  - phase: 05-03
    provides: TeamView, useTeamData, heartbeat status indicators
provides:
  - profiles.next_digest_run_at TIMESTAMPTZ column with backfill
  - Hourly cron schedule for send-morning-digest (replaces daily 8am UTC)
  - Per-user timezone morning digest: queries WHERE next_digest_run_at <= now(), delivers, advances next run
affects: [phase-06, any future digest scheduling, profiles schema consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - next_digest_run_at dispatcher pattern — same as heartbeat_at; cron runs hourly, function queries due users, updates next run per user
    - nextDigestRunAt() JS helper for timezone-safe tomorrow-8am computation using toLocaleString offset trick

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260313000011_next_digest_run_at.sql
  modified:
    - worrylesssuperagent/supabase/functions/send-morning-digest/index.ts

key-decisions:
  - "next_digest_run_at dispatcher pattern (same as heartbeat_at) chosen over timezone-bucket crons — one hourly cron, per-user next-run column, O(due_users) work per hour"
  - "Always advance next_digest_run_at even when no digest rows found — prevents re-running same user on next hourly tick when they had no findings"
  - "nextDigestRunAt() uses toLocaleString offset trick (no external library) — Deno edge function environment, no date-fns or luxon available without import"
  - "supabase query for due users casts as any — next_digest_run_at not in generated types, consistent with useAgentWorkspace/useHeartbeatConfig pattern"

patterns-established:
  - "dispatcher column pattern: add TIMESTAMPTZ column, backfill to next occurrence, hourly cron queries <= now(), advances column after delivery"

requirements-completed: [NOTIF-04]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 5 Plan 05: Per-User Timezone Morning Digest Summary

**Hourly cron + next_digest_run_at column delivers morning briefings at 8am local time per user, replacing the 8am UTC placeholder from Phase 4**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T10:46:48Z
- **Completed:** 2026-03-13T10:52:00Z
- **Tasks:** 1 (+ human-verify checkpoint auto-approved)
- **Files modified:** 2

## Accomplishments
- Migration 00011 adds `profiles.next_digest_run_at TIMESTAMPTZ` with backfill (existing onboarded users seeded to next 8am in their timezone)
- Morning digest cron rescheduled from `0 8 * * *` (daily 8am UTC) to `0 * * * *` (hourly)
- `send-morning-digest` rewritten to query `WHERE next_digest_run_at <= now()`, deliver per-user briefing from past 24h digest rows, advance `next_digest_run_at` to tomorrow 8am in user's timezone
- `TODO(Phase 5)` comment removed — timezone scheduling fully implemented
- All 48 vitest tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: next_digest_run_at migration + send-morning-digest per-user timezone refactor** - `a619037` (feat)

**Checkpoint:** human-verify auto-approved (auto_advance: true)

## Files Created/Modified
- `worrylesssuperagent/supabase/migrations/20260313000011_next_digest_run_at.sql` - Adds next_digest_run_at column, backfills, reschedules cron to hourly
- `worrylesssuperagent/supabase/functions/send-morning-digest/index.ts` - Per-user timezone digest: queries due users, delivers, advances next run

## Decisions Made
- Always advance `next_digest_run_at` even when a user has no digest findings — prevents the hourly cron from re-evaluating the same user every tick after their 8am window opens
- `nextDigestRunAt()` uses `toLocaleString('en-US', { timeZone })` offset trick to avoid importing a date library in Deno edge function
- Queries cast `as any` for `next_digest_run_at` and `onboarding_completed` filter — consistent with established pattern for columns not in generated types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Tests passed on first run.

## User Setup Required

None — no external service configuration required for this plan. The VAPID keys were documented in Plan 04.

## Next Phase Readiness

Phase 5 is complete. All 5 plans executed:
- 05-01: Wave 0 test scaffold
- 05-02: Notification bell + useNotifications hook + panel
- 05-03: Team org chart view with heartbeat status
- 05-04: Web push infrastructure (sw.js, push_subscriptions, Settings toggle, VAPID in heartbeat-runner)
- 05-05: Per-user timezone morning digest (next_digest_run_at dispatcher pattern)

NOTIF-01 through NOTIF-06 and ORG-01 through ORG-05 all addressed across Phase 5.

---
*Phase: 05-org-view-notifications*
*Completed: 2026-03-13*
