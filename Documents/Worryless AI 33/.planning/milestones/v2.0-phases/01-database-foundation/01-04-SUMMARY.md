---
phase: 01-database-foundation
plan: 04
subsystem: database
tags: [postgres, supabase, sql, migrations, backfill]

# Dependency graph
requires:
  - phase: 01-database-foundation plan 01
    provides: user_agents table with UNIQUE(user_id, agent_type_id) constraint
  - phase: 01-database-foundation plan 02
    provides: on_agent_activated trigger that creates 6 agent_workspaces rows per user_agents INSERT
  - phase: 01-database-foundation plan 03
    provides: 13 seed rows in available_agent_types including the 5 default agent types
provides:
  - Backfill migration that creates 5 user_agents rows for every existing onboarded user
  - DB-07 verification artifact (comment confirming profiles.timezone exists from migration 20251216134813)
  - All 4 Phase 1 migration files complete and ready to apply to Supabase
affects:
  - Phase 2 onboarding (can now assume user_agents rows exist for all onboarded users)
  - Phase 3 workspace editor (existing users will have populated agent_workspaces from backfill trigger)
  - Phase 4 heartbeat system (existing users will have valid heartbeat MD files from trigger)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CROSS JOIN with VALUES() list to fan out one row per user into N rows per agent type"
    - "ON CONFLICT DO NOTHING on backfill INSERT — makes migration idempotent, safe to re-run"
    - "WHERE onboarding_completed = true filter — avoids creating agent rows for users mid-onboarding"

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260312000004_backfill_existing_users.sql
  modified: []

key-decisions:
  - "ON CONFLICT DO NOTHING on backfill INSERT — safe to re-run if migration is applied multiple times or on a database that already had partial user_agents rows"
  - "WHERE onboarding_completed = true — prevents backfilling users who started but did not complete onboarding"
  - "DB-07 (profiles.timezone) fulfilled by comment referencing prior migration 20251216134813 — no ALTER TABLE needed"

patterns-established:
  - "Backfill migrations: CROSS JOIN with VALUES() for fan-out inserts, ON CONFLICT DO NOTHING for idempotency"

requirements-completed: [DB-02, DB-03, DB-04, DB-06, DB-07]

# Metrics
duration: 1min
completed: 2026-03-12
---

# Phase 1 Plan 04: Backfill Existing Users Summary

**Idempotent backfill migration that seeds 5 user_agents rows (and 30 agent_workspaces via trigger) for every user whose onboarding_completed = true, completing Phase 1 database foundation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-12T17:42:19Z
- **Completed:** 2026-03-12T17:43:35Z
- **Tasks:** 1 auto + 1 auto-approved checkpoint
- **Files modified:** 1

## Accomplishments
- Created 20260312000004_backfill_existing_users.sql with a CROSS JOIN fan-out INSERT for all 5 default agent types
- Migration is fully idempotent via ON CONFLICT DO NOTHING — safe to re-apply on any database state
- DB-07 requirement satisfied by comment confirming profiles.timezone already exists from migration 20251216134813
- All 4 Phase 1 migration files now exist and are ready to apply to Supabase in sequence
- Human verification checkpoint auto-approved (auto_advance=true); verification queries provided for manual confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backfill migration (Migration D)** - `18d83ab` (feat) — committed in worrylesssuperagent repo

**Plan metadata:** (docs commit below in .planning repo)

## Files Created/Modified
- `worrylesssuperagent/supabase/migrations/20260312000004_backfill_existing_users.sql` — 33-line backfill migration; CROSS JOIN with 5 agent type VALUES; ON CONFLICT DO NOTHING; DB-07 verification comment

## Decisions Made
- ON CONFLICT DO NOTHING on backfill INSERT — idempotency ensures safe re-application without creating duplicate rows
- WHERE onboarding_completed = true filter — users mid-onboarding do not get premature agent rows
- DB-07 (profiles.timezone) is verified by comment artifact — the column was already added in migration 20251216134813, no additional SQL required

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The worrylesssuperagent/ directory is a nested git repository; the migration was committed there (hash `18d83ab`) rather than the outer planning repo, consistent with the pattern established in plans 01-01 through 01-03.

## User Setup Required

**Manual verification required.** Apply all 4 Phase 1 migrations to Supabase and run the verification queries from the checkpoint task:

1. Apply migrations in order via Supabase Dashboard SQL Editor or `supabase db push`
2. Verify 4 tables exist: `available_agent_types`, `user_agents`, `agent_workspaces`, `agent_heartbeat_log`
3. Verify 13 rows in `available_agent_types`; `chief_of_staff` has `depth = 0`
4. Verify `on_agent_activated` trigger exists on `user_agents`
5. Test trigger by inserting a row — check that 6 `agent_workspaces` rows are created
6. Verify `profiles.timezone` column exists: `SELECT timezone FROM public.profiles LIMIT 1;`
7. Verify backfill applied: `SELECT count(*) FROM public.user_agents;` — expect (onboarded users) × 5

## Next Phase Readiness
- All 4 Phase 1 migration files complete — Phase 1 database foundation is done pending Supabase application
- Phase 2 application code can read `user_agents` and `agent_workspaces` for all onboarded users without a separate migration path
- Existing users will have 30 populated workspace MD files (5 agents × 6 files) after backfill runs
- The 5 default agent types in backfill match the Phase 2 onboarding agent team selector catalog

---
*Phase: 01-database-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/migrations/20260312000004_backfill_existing_users.sql
- FOUND: .planning/phases/01-database-foundation/01-04-SUMMARY.md
- FOUND: commit 18d83ab in worrylesssuperagent repo
- FOUND: docs commit 4d5280f in planning repo
