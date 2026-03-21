---
phase: 23-scheduling-migration
plan: "03"
subsystem: langgraph-server
tags: [bullmq, repeatable-jobs, daily-briefing, morning-digest, scheduling, push-notifications]
dependency_graph:
  requires: [23-01, 23-02]
  provides: [bullmq-repeatable-jobs, daily-briefing-worker, morning-digest-worker, cadence-sql-migration]
  affects: [langgraph-server-deployment]
tech-stack:
  added: []
  patterns:
    - "getBullMQConnectionOptions() for BullMQ Queue/Worker constructors (avoids ioredis type collision)"
    - "stable jobId singleton pattern: BullMQ deduplicates repeatable jobs by jobId across restarts"
    - "registerRepeatableJobs() async with .catch() at startup (non-fatal if Redis unavailable)"
    - "briefing thread_id: briefing-{user_id}-{timestamp} prefix isolates from heartbeat and user chat threads"
key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/cadence/repeatable-jobs.ts
    - worrylesssuperagent/langgraph-server/src/cadence/repeatable-jobs.test.ts
    - worrylesssuperagent/supabase/migrations/20260321000001_ensure_cadence_function.sql
  modified:
    - worrylesssuperagent/langgraph-server/src/cadence/index.ts
    - worrylesssuperagent/langgraph-server/src/index.ts
decisions:
  - "SCHED-03: get_due_cadence_agents() found in 20260320000002_cadence_dispatcher_v2.sql but NOT in PRODUCTION_MIGRATION.sql — standalone idempotent migration created at 20260321000001_ensure_cadence_function.sql"
  - "getBullMQConnectionOptions() used instead of createRedisConnection() for BullMQ constructors — same pattern as cadence-dispatcher.ts and cadence-worker.ts from 23-02"
  - "registerRepeatableJobs() is async (awaits queue.add calls) — called with .catch() at startup to prevent uncaught rejection"
  - "startRepeatableWorker() is sync (returns void) — workers run in background event loop"
metrics:
  duration: ~12 minutes
  completed: "2026-03-21"
  tasks_completed: 2
  files_modified: 5
---

# Phase 23 Plan 03: BullMQ Repeatable Jobs for Daily Briefing and Morning Digest Summary

**BullMQ repeatable jobs at 7am UTC (daily-briefing) and 6am UTC (morning-digest) registered with stable singleton jobIds, workers wired into server startup, get_due_cadence_agents() SQL function verified and standalone migration created.**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Verify get_due_cadence_agents() and create repeatable-jobs.ts | 1fc2f16 | repeatable-jobs.ts, 20260321000001_ensure_cadence_function.sql |
| 2 | Wire repeatable jobs into server startup and write tests | db3d032 | index.ts, cadence/index.ts, repeatable-jobs.test.ts |

## What Was Built

### SCHED-03 Verification

`get_due_cadence_agents()` SQL function was found in:
- `20260320000002_cadence_dispatcher_v2.sql` — present (full multi-tier function)
- `PRODUCTION_MIGRATION.sql` — NOT present (confirmed via grep)

Created standalone migration `20260321000001_ensure_cadence_function.sql` with `CREATE OR REPLACE` (idempotent). This migration must be applied to Railway Postgres to ensure the function exists for the cadence dispatcher.

### Task 1: repeatable-jobs.ts

Created `src/cadence/repeatable-jobs.ts` with:

**`registerRepeatableJobs()` (async)**
- Creates BullMQ Queue for `daily-briefing` and `morning-digest`
- Registers repeatable job for daily briefing at `pattern: '0 7 * * *'` with `jobId: 'daily-briefing-singleton'`
- Registers repeatable job for morning digest at `pattern: '0 6 * * *'` with `jobId: 'morning-digest-singleton'`
- BullMQ deduplicates by jobId — safe to call on every server boot

**`processDailyBriefing()` (private processor)**
- Queries `user_agents JOIN agent_types WHERE slug = 'personal_assistant' AND is_active = true`
- For each user: calls `graph.invoke({ isProactive: true, agentType: 'personal_assistant' })` with unique `briefing-{user_id}-{timestamp}` thread
- Error per user is non-fatal — continues to next user

**`processMorningDigest()` (private processor)**
- Queries `heartbeat_log WHERE created_at > NOW() - INTERVAL '24 hours'` grouped by user_id
- For each user: sends push notification via `sendPushNotification()` with count of agent updates
- Error per user is non-fatal — continues to next user

**`startRepeatableWorker()` (sync)**
- Creates BullMQ Worker for `daily-briefing` queue (concurrency=1) connected to `processDailyBriefing`
- Creates BullMQ Worker for `morning-digest` queue (concurrency=1) connected to `processMorningDigest`
- Attaches `failed` event handlers for logging

### Task 2: Server Wiring + Tests

**`src/index.ts`** — added inside `NODE_ENV !== "test"` guard:
```typescript
registerRepeatableJobs().catch(err => {
  console.error('[startup] Failed to register repeatable jobs:', err);
});
startRepeatableWorker();
```

**`cadence/index.ts`** — added barrel exports:
```typescript
export { registerRepeatableJobs, startRepeatableWorker, BRIEFING_QUEUE, DIGEST_QUEUE } from "./repeatable-jobs.js";
```

**`repeatable-jobs.test.ts`** — 13 tests across 5 describe blocks:
- Module exports (4 tests)
- Cron schedule contract SCHED-04 (2 tests — 7am UTC briefing, 6am UTC digest)
- Idempotent registration contract (2 tests — singleton jobIds)
- Daily briefing processor contract (3 tests — PA query, isProactive, thread prefix)
- Morning digest processor contract (2 tests — 24h window, push body format)

## Verification Results

- `npx vitest run src/cadence/repeatable-jobs.test.ts` — 13/13 tests PASS
- `npx vitest run src/cadence/` — 167/167 tests PASS (154 prior + 13 new)
- `npx tsc --noEmit` — 0 new errors introduced; pre-existing `heartbeat-prompts.test.ts` errors (17 TS2345) remain out of scope (documented in 23-01-SUMMARY.md)
- `grep 'registerRepeatableJobs' src/index.ts` — PASS
- `grep 'get_due_cadence_agents' src/cadence/cadence-dispatcher.ts` — PASS (SCHED-03 dependency confirmed)

## Decisions Made

1. **Standalone SQL migration over no-op** — `get_due_cadence_agents()` was not in `PRODUCTION_MIGRATION.sql`. Created `20260321000001_ensure_cadence_function.sql` with `CREATE OR REPLACE` (idempotent) instead of a no-op comment. This migration must be applied to Railway Postgres before the dispatcher will work.

2. **getBullMQConnectionOptions() over createRedisConnection()** — Consistent with the pattern established in 23-02. BullMQ Queue/Worker constructors require plain options objects to avoid the bundled ioredis type collision.

3. **registerRepeatableJobs().catch() pattern** — Redis connection may not be available immediately at startup. Using `.catch()` instead of `await` prevents a failed Redis connection from blocking server startup.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan implements the full repeatable job pipeline. No data flows to UI. Workers are wired to real graph.invoke() and push notification calls.

## Phase 23 Complete

All 3 plans of Phase 23 (scheduling-migration) are complete:
- **23-01**: BullMQ/ioredis/node-cron dependencies installed; Redis connection factory created; Playwright volume configured
- **23-02**: node-cron dispatcher + BullMQ heartbeat worker pipeline; push notification helper; 154 tests passing
- **23-03**: BullMQ repeatable jobs for daily briefing and morning digest; get_due_cadence_agents() SQL migration; 167 tests passing

The full scheduling stack is now in place. Next deployment milestone: apply `20260321000001_ensure_cadence_function.sql` to Railway Postgres and configure `REDIS_URL` environment variable.

## Self-Check: PASSED

- `worrylesssuperagent/langgraph-server/src/cadence/repeatable-jobs.ts` — FOUND, exports registerRepeatableJobs, startRepeatableWorker, BRIEFING_QUEUE, DIGEST_QUEUE
- `worrylesssuperagent/langgraph-server/src/cadence/repeatable-jobs.test.ts` — FOUND, 13 tests
- `worrylesssuperagent/supabase/migrations/20260321000001_ensure_cadence_function.sql` — FOUND, CREATE OR REPLACE function
- `worrylesssuperagent/langgraph-server/src/cadence/index.ts` — FOUND, exports registerRepeatableJobs et al
- `worrylesssuperagent/langgraph-server/src/index.ts` — FOUND, calls registerRepeatableJobs().catch() and startRepeatableWorker()
- Commit 1fc2f16 — Task 1: repeatable-jobs.ts + SQL migration
- Commit db3d032 — Task 2: server wiring + tests
