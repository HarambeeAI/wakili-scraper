---
phase: 06-heartbeat-bug-fixes
plan: "01"
subsystem: infra
tags: [pgmq, supabase, edge-functions, heartbeat, bug-fix]

# Dependency graph
requires:
  - phase: 04-heartbeat-system
    provides: heartbeat-dispatcher and heartbeat-runner edge functions
provides:
  - Fixed pgmq enqueue payload using snake_case keys (user_agent_id, user_id, agent_type_id)
  - Dispatcher-to-runner field name contract now consistent — enables HB-01 through HB-09 pipeline to execute
affects:
  - 06-heartbeat-bug-fixes remaining plans (status dot check, other heartbeat fixes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pgmq message keys must match destructuring in consumer: use snake_case throughout"

key-files:
  created: []
  modified:
    - worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts

key-decisions:
  - "snake_case keys (user_agent_id, user_id, agent_type_id) are the authoritative contract between dispatcher and runner — camelCase was the bug, snake_case is the fix"
  - "Purge note added as code comment for operators deploying over live queues with stuck messages"

patterns-established:
  - "pgmq message payload keys must exactly match the destructuring pattern in the consumer (heartbeat-runner)"

requirements-completed: [HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-09]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 06 Plan 01: Fix Dispatcher Payload snake_case Summary

**One-line camelCase-to-snake_case key rename in pgmq enqueue payload unblocks the entire HB-01 through HB-09 heartbeat pipeline that had never processed a single job**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-13T11:36:03Z
- **Completed:** 2026-03-13T11:38:00Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- Fixed the dispatcher pgmq message object: `userAgentId` -> `user_agent_id`, `userId` -> `user_id`, `agentTypeId` -> `agent_type_id`
- Added operator note comment above the `send` call explaining how to purge stuck camelCase messages from live queues
- Full vitest suite: 48 tests pass, 0 failures across all 8 test files
- heartbeat-runner/index.ts left untouched — its destructuring `const { user_id: userId, agent_type_id: agentTypeId } = message;` was already correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix dispatcher enqueue payload to snake_case** - `02a8941` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts` - Changed camelCase message keys to snake_case; added purge note comment

## Decisions Made

- snake_case keys are the authoritative contract. The runner destructuring was always correct — only the dispatcher payload was wrong.
- Purge comment added inline (not in external docs) so any operator deploying against a live queue sees it at the point of change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Self-Check

- [x] `worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts` contains `user_agent_id`, `user_id`, `agent_type_id` — CONFIRMED
- [x] No camelCase keys (`userAgentId`, `userId`, `agentTypeId`) remain in the message object — CONFIRMED
- [x] Commit `02a8941` exists — CONFIRMED
- [x] Full vitest suite: 48 passed, 0 failed — CONFIRMED

## Self-Check: PASSED

## Next Phase Readiness

- heartbeat-dispatcher now enqueues correct snake_case keys that the runner can destructure
- HB-01 through HB-09 pipeline is now reachable (LLM call, severity routing, notification insert, email, push, log write)
- Remaining 06-heartbeat-bug-fixes plans can proceed (status dot check, etc.)

---
*Phase: 06-heartbeat-bug-fixes*
*Completed: 2026-03-13*
