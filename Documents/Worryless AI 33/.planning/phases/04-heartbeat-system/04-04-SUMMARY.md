---
phase: 04-heartbeat-system
plan: "04"
subsystem: infra
tags: [pgmq, pg_cron, supabase, deno, edge-function, heartbeat, timezone, active-hours]

# Dependency graph
requires:
  - phase: 04-02
    provides: pgmq heartbeat_jobs queue, heartbeat_daily_budget column, pg_cron jobs registered, verify_jwt=false in config.toml
  - phase: 04-01
    provides: heartbeat config columns on user_agents (heartbeat_enabled, heartbeat_active_hours_start/end, heartbeat_interval_hours, next_heartbeat_at)
provides:
  - heartbeat-dispatcher/index.ts: pg_cron triggered fan-out function enqueuing due agents into pgmq
  - get_due_heartbeat_agents() SQL function: DST-safe active hours + COUNT-based daily budget check
  - src/utils/heartbeatUtils.ts: pure parseActiveHours() function (testable in Node/browser)
  - migration 20260313000008: get_due_heartbeat_agents SQL function definition
affects:
  - 04-05 (heartbeat-runner — queue now has messages to consume)
  - 05-notifications (dispatcher creates work that runner converts to notifications)

# Tech tracking
tech-stack:
  added: [Intl.DateTimeFormat for DST-aware timezone conversion in Node/browser context]
  patterns:
    - SEC-02 pattern: _req parameter with underscore prefix = intentionally unused; userId always from DB row
    - SQL SECURITY DEFINER function for complex AT TIME ZONE + COUNT budget check (keeps edge function thin)
    - Pure utility file (src/utils/) mirrors SQL logic and is vitest-testable without Deno imports
    - next_heartbeat_at advanced only after successful pgmq.send — never for skipped agents (Pitfall 6)

key-files:
  created:
    - worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts
    - worrylesssuperagent/supabase/migrations/20260313000008_heartbeat_dispatcher_fn.sql
    - worrylesssuperagent/src/utils/heartbeatUtils.ts
  modified:
    - worrylesssuperagent/src/__tests__/heartbeatDispatcher.test.ts

key-decisions:
  - "parseActiveHours() placed in src/utils/ (not supabase/_shared/) — vitest excludes supabase/ dir from Node ESM resolution; src/utils/ is accessible via @/ alias"
  - "get_due_heartbeat_agents as SECURITY DEFINER SQL function (not inline TypeScript query) — keeps AT TIME ZONE and COUNT logic in SQL where DST is always correct"
  - "heartbeat-dispatcher uses Deno.serve (not serve from std) — consistent with send-daily-briefing and other recent edge functions"
  - "Budget-skipped agents never reach next_heartbeat_at update path — SQL WHERE clause excludes them before TypeScript loop"

patterns-established:
  - "Pattern: SEC-02 compliance — _req parameter with underscore signals intentional non-use; no req.body, req.json(), or body reads anywhere in dispatcher"
  - "Pattern: Thin dispatcher — all SQL logic in get_due_heartbeat_agents(), TypeScript loop only does pgmq.send + next_heartbeat_at update"
  - "Pattern: Pure utility mirror — complex SQL logic mirrored as pure TS function in src/utils/ for unit testing without live DB"

requirements-completed: [HB-01, HB-05, HB-06, SEC-02]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 4 Plan 04: Heartbeat Dispatcher Summary

**pg_cron-triggered heartbeat-dispatcher edge function with get_due_heartbeat_agents() SQL function (DST-safe AT TIME ZONE active hours + COUNT budget), pgmq enqueue, and next_heartbeat_at advancement only for successfully enqueued agents**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T09:56:55Z
- **Completed:** 2026-03-13T10:02:00Z
- **Tasks:** 1 (TDD)
- **Files modified:** 4

## Accomplishments

- Created `heartbeat-dispatcher/index.ts`: Deno.serve handler that calls `get_due_heartbeat_agents` RPC, enqueues each agent via `pgmq_public.send`, and advances `next_heartbeat_at` only on successful enqueue. Request body is never read (SEC-02).
- Created migration `20260313000008_heartbeat_dispatcher_fn.sql`: `get_due_heartbeat_agents()` SECURITY DEFINER function with AT TIME ZONE business-hours check and COUNT-based daily budget enforcement, LIMIT 50, service_role GRANT.
- Created `src/utils/heartbeatUtils.ts`: Pure `parseActiveHours()` function mirroring the SQL active-hours logic using `Intl.DateTimeFormat` — DST-safe, testable in vitest without Deno imports.
- Updated `heartbeatDispatcher.test.ts`: 6 real `activeHours` tests passing (was all `it.todo`). Budget and SEC-02 remain `it.todo` (SQL logic cannot be unit tested in vitest).

## Task Commits

Each task was committed atomically (in worrylesssuperagent repo):

1. **Task 1: heartbeat-dispatcher edge function (TDD RED+GREEN)** - `6c4c961` (feat)

## Files Created/Modified

- `worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts` - Deno.serve handler: get_due_heartbeat_agents RPC → pgmq enqueue loop → next_heartbeat_at update
- `worrylesssuperagent/supabase/migrations/20260313000008_heartbeat_dispatcher_fn.sql` - get_due_heartbeat_agents() with AT TIME ZONE + COUNT budget check, SECURITY DEFINER, LIMIT 50
- `worrylesssuperagent/src/utils/heartbeatUtils.ts` - pure parseActiveHours(nowUtc, timezone, startTime, endTime): boolean
- `worrylesssuperagent/src/__tests__/heartbeatDispatcher.test.ts` - 6 real activeHours tests (was all todo)

## Decisions Made

- `parseActiveHours()` placed in `src/utils/` rather than `supabase/functions/_shared/` — vitest's `exclude: ["**/supabase/**"]` config prevents importing from the supabase directory in Node ESM context. The `@/utils/heartbeatUtils` alias resolves correctly.
- `get_due_heartbeat_agents` as a SECURITY DEFINER SQL function rather than inline TypeScript query — keeps `AT TIME ZONE` and `COUNT` budget logic in SQL where DST conversions are always correct; edge function remains thin (no AT TIME ZONE in TS).
- `Deno.serve()` used (not `serve` from std) — consistent with newer edge functions in this project that use the native Deno API.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed import path for parseActiveHours from supabase/_shared/ to src/utils/**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** vitest.config.ts has `exclude: ["**/supabase/**"]` which blocks Node ESM resolution of imports from that directory. Import from `../../supabase/functions/_shared/heartbeatUtils` failed with "Failed to resolve import" error.
- **Fix:** Created `src/utils/heartbeatUtils.ts` instead; test imports via `@/utils/heartbeatUtils`. The edge function index.ts itself does not import from src/ (Deno runtime) — the utility is intentionally duplicated in concept but placed in the right location for each runtime.
- **Files modified:** src/__tests__/heartbeatDispatcher.test.ts (import path), src/utils/heartbeatUtils.ts (new file location)
- **Verification:** All 6 active hours tests pass; full suite (31 tests) passes
- **Committed in:** 6c4c961 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking import resolution)
**Impact on plan:** Minimal — pure function is in src/utils/ instead of supabase/_shared/. The dispatcher edge function still fulfills all requirements. No behavior change.

## Issues Encountered

None beyond the import path deviation documented above.

## User Setup Required

None — no new environment variables or dashboard configuration required beyond what Phase 4 Plan 02 already specified (Vault secrets `service_role_key` and `project_url` must exist for pg_cron to invoke the dispatcher).

## Next Phase Readiness

- Dispatcher is complete and ready for pg_cron to trigger
- `get_due_heartbeat_agents()` SQL function must be applied to production DB via migration 20260313000008 before dispatcher can run
- Phase 4 Plan 05 (heartbeat-runner) is now unblocked — dispatcher enqueues messages the runner will consume from `heartbeat_jobs` queue

---
*Phase: 04-heartbeat-system*
*Completed: 2026-03-13*

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts
- FOUND: worrylesssuperagent/supabase/migrations/20260313000008_heartbeat_dispatcher_fn.sql
- FOUND: worrylesssuperagent/src/utils/heartbeatUtils.ts
- FOUND: worrylesssuperagent/src/__tests__/heartbeatDispatcher.test.ts (6 passing tests)
- FOUND: commit 6c4c961 (Task 1 — feat in worrylesssuperagent repo)
- VERIFIED: No req. usage in dispatcher (SEC-02 satisfied)
- VERIFIED: npx vitest run src/__tests__/heartbeatDispatcher.test.ts — 6 passed, 5 todo
