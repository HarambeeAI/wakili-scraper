---
phase: 23-scheduling-migration
plan: "02"
subsystem: langgraph-server
tags: [bullmq, node-cron, web-push, ioredis, scheduling, heartbeat]

requires:
  - phase: 23-01
    provides: getBullMQConnectionOptions factory + ioredis installed + BullMQ deps

provides:
  - node-cron dispatcher that queries get_due_cadence_agents() and enqueues BullMQ jobs every 5 minutes
  - BullMQ worker that dequeues heartbeat jobs and calls graph.invoke() with isProactive=true
  - web-push notification helper for non-empty heartbeat results
  - cadence/index.ts barrel re-exports for all new functions
  - src/index.ts wired to start scheduler + worker on production boot

affects: [23-03, langgraph-server-deployment]

tech-stack:
  added: []
  patterns:
    - "getBullMQConnectionOptions(): return plain config object (not IORedis instance) to avoid type collision with BullMQ's bundled ioredis"
    - "heartbeat-{user_id}-{agent_type_id} thread_id prefix prevents proactive heartbeats contaminating user chat history"
    - "Worker concurrency=3: allows parallel heartbeat processing across users"
    - "Non-fatal error handling for heartbeat_log insert and push notifications (continue on failure)"

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-worker.ts
    - worrylesssuperagent/langgraph-server/src/cadence/push-helper.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-worker.test.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/cadence/redis.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.test.ts
    - worrylesssuperagent/langgraph-server/src/cadence/index.ts
    - worrylesssuperagent/langgraph-server/src/index.ts

key-decisions:
  - "getBullMQConnectionOptions() returns plain options object (not IORedis instance): BullMQ bundles its own ioredis, passing top-level IORedis causes TS2322 type collision; plain options let BullMQ construct its own connection"
  - "heartbeat thread_id uses heartbeat-{user_id}-{agent_type_id} prefix (not proactive: Supabase-era prefix): avoids contaminating user chat history, each agent type gets a persistent heartbeat thread"
  - "VAPID config via ensureVapid() lazy init: graceful no-op when VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set (allows development without push keys)"
  - "heartbeat_log INSERT is non-fatal: logging failure never blocks the heartbeat job completion"

requirements-completed: [SCHED-01, SCHED-02, SCHED-05]

duration: ~8min
completed: 2026-03-21
---

# Phase 23 Plan 02: Core Scheduling Engine Summary

**node-cron dispatcher + BullMQ worker pipeline: every 5 minutes queries get_due_cadence_agents(), enqueues per-agent heartbeat jobs, worker calls graph.invoke(isProactive=true) and sends VAPID push notifications for non-empty results**

## Performance

- **Duration:** ~8 minutes
- **Started:** 2026-03-21T10:37:54Z
- **Completed:** 2026-03-21T10:46:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- node-cron dispatcher fires every 5 minutes, queries `get_due_cadence_agents()`, enqueues one BullMQ job per due agent with retry (3 attempts, exponential backoff)
- BullMQ worker dequeues heartbeat jobs, calls `graph.invoke()` with `isProactive: true` and a dedicated `heartbeat-{user_id}-{agent_type_id}` thread, logs to `heartbeat_log`, sends VAPID push notification for non-empty results
- web-push helper sends notifications to all user subscriptions in `push_subscriptions` table; no-ops gracefully when VAPID keys not configured
- Scheduler and worker guarded by `NODE_ENV !== "test"` — never start during vitest runs
- 154 cadence unit tests pass (33 new, 121 existing)

## Task Commits

1. **Task 1: Create cadence-dispatcher.ts and push-helper.ts** - `834fae9` (feat)
2. **Task 2: Create cadence-worker.ts, update barrel, wire into index.ts** - `881c356` (feat)
3. **Task 3: Create unit tests for dispatcher and worker** - `b68dad1` (test)
4. **Auto-fix: Resolve ioredis type collision** - `2197a02` (fix) [Rule 1 - Bug]

## Files Created/Modified

- `src/cadence/cadence-dispatcher.ts` — node-cron scheduler, enqueues BullMQ heartbeat jobs every 5 minutes
- `src/cadence/cadence-worker.ts` — BullMQ worker that processes jobs via graph.invoke(), logs, sends push
- `src/cadence/push-helper.ts` — VAPID web-push wrapper with lazy init and non-fatal error handling
- `src/cadence/cadence-dispatcher.test.ts` — Added module export and BullMQ job options tests (appended)
- `src/cadence/cadence-worker.test.ts` — New: thread_id pattern, agent display names, push contract, isProactive
- `src/cadence/redis.ts` — Added getBullMQConnectionOptions() to avoid BullMQ bundled-ioredis type collision
- `src/cadence/index.ts` — Re-exports dispatcher, worker, push-helper, both redis functions
- `src/index.ts` — Imports and starts cadence scheduler + worker inside NODE_ENV !== test guard

## Decisions Made

1. **getBullMQConnectionOptions() over IORedis instance** — BullMQ bundles its own ioredis internally. Passing the top-level `ioredis` package's Redis instance to `Queue({ connection })` causes TS2322 structural mismatch. Returning plain `{ url, maxRetriesPerRequest: null, enableReadyCheck: false, tls? }` options lets BullMQ construct its own connection internally with no type conflict.

2. **heartbeat- thread prefix** — Uses `heartbeat-${user_id}-${agent_type_id}` instead of the old Supabase-era `proactive:` prefix. This creates a dedicated persistent thread per agent per user for heartbeat runs, completely separate from the user's chat thread. Prevents heartbeat messages appearing in the user's chat history.

3. **VAPID lazy init with graceful degradation** — `ensureVapid()` checks for env vars on first call only. Returns `false` (no-op) when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are absent. This allows the server to run without push notification capability during development and Railway deployment stages before VAPID keys are generated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ioredis version type collision with BullMQ's bundled ioredis**
- **Found during:** Overall verification (`npx tsc --noEmit`)
- **Issue:** `cadence-dispatcher.ts` and `cadence-worker.ts` passed top-level `IORedis` instances to BullMQ `Queue`/`Worker` `connection` option. TypeScript reported TS2322 because BullMQ bundles its own ioredis v5 copy in `node_modules/bullmq/node_modules/ioredis/` with incompatible type definitions (same package, two instances).
- **Fix:** Added `getBullMQConnectionOptions()` to `redis.ts` returning a plain options object (`{ url, maxRetriesPerRequest: null, enableReadyCheck: false, tls? }`). Updated both dispatcher and worker to use this function. BullMQ constructs its own IORedis connection internally from the plain options.
- **Files modified:** `src/cadence/redis.ts`, `src/cadence/cadence-dispatcher.ts`, `src/cadence/cadence-worker.ts`, `src/cadence/index.ts`
- **Verification:** `npx tsc --noEmit` — no new TS errors; 154 tests still pass
- **Committed in:** `2197a02`

**2. [Rule 1 - Bug] Fixed JSDoc backtick-enclosed cron expression causing oxc parse error**
- **Found during:** Task 3 (running tests for module export verification)
- **Issue:** JSDoc comment in `cadence-dispatcher.ts` used `` `*/5 * * * *` `` (backtick). The oxc parser used by Vitest treated it as an unterminated template literal with `*/` as a block comment end token — PARSE_ERROR at line 7.
- **Fix:** Replaced backtick-enclosed cron string with plain text: "pg_cron (every 5 minutes)". Also removed backtick from an inline `//` comment as defensive measure.
- **Files modified:** `src/cadence/cadence-dispatcher.ts`
- **Verification:** Tests re-run — all 33 new tests pass
- **Committed in:** `b68dad1` (included in test commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — this plan implements the full scheduling pipeline. Data flows from DB query → BullMQ queue → graph.invoke() → push notification. No stubs or placeholders remain.

## Next Phase Readiness

- Cadence dispatcher and worker are production-ready pending Redis URL in environment
- VAPID keys need generation before push notifications work (tracked in PROJECT.md blockers)
- Ready for Plan 23-03: final verification and integration testing

---
*Phase: 23-scheduling-migration*
*Completed: 2026-03-21*

## Self-Check: PASSED

- `worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.ts` — FOUND, exports `startCadenceScheduler` and `QUEUE_NAME`
- `worrylesssuperagent/langgraph-server/src/cadence/cadence-worker.ts` — FOUND, exports `startHeartbeatWorker`
- `worrylesssuperagent/langgraph-server/src/cadence/push-helper.ts` — FOUND, exports `sendPushNotification`
- `worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.test.ts` — FOUND, contains new describe blocks
- `worrylesssuperagent/langgraph-server/src/cadence/cadence-worker.test.ts` — FOUND, 5 describe blocks
- `worrylesssuperagent/langgraph-server/src/index.ts` — FOUND, calls `startCadenceScheduler()` and `startHeartbeatWorker()` inside `NODE_ENV !== "test"` guard
- Commit `834fae9` — Task 1
- Commit `881c356` — Task 2
- Commit `b68dad1` — Task 3
- Commit `2197a02` — Type fix (deviation)
