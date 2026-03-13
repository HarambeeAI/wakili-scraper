---
phase: 04-heartbeat-system
plan: "05"
subsystem: api
tags: [deno, edge-functions, pgmq, resend, llm, lovable-ai-gateway, tdd, vitest]

# Dependency graph
requires:
  - phase: 04-02
    provides: pgmq heartbeat_jobs queue, notifications table, agent_heartbeat_log table, pg_cron runner job
  - phase: 04-01
    provides: heartbeat config columns on user_agents, agent_heartbeat_log table schema
  - phase: 01-database-foundation
    provides: agent_workspaces table, available_agent_types, profiles table
provides:
  - heartbeat-runner Deno edge function: dequeue -> LLM -> severity routing -> suppress/log/notify/email
  - supabase/functions/_shared/heartbeatParser.ts: extractJson + parseSeverity (Deno-compatible)
  - src/lib/heartbeatParser.ts: Node-compatible mirror for vitest tests
  - 7 passing heartbeatParser.test.ts tests (replaced all it.todo stubs)
affects:
  - 04-06 (end-to-end integration test — runner is now callable)
  - 05-notifications (runner creates notifications rows — Phase 5 UI can now display them)

# Tech tracking
tech-stack:
  added: [resend@2.0.0 (urgent email), heartbeatParser utility (pure, no Deno APIs)]
  patterns:
    - Independent email try/catch: sendUrgentEmail wrapped in try/catch so email failure never rolls back log insert
    - HEARTBEAT_OK suppression: severity=ok returns immediately with zero DB writes (~90% of runs)
    - Fail-safe LLM parse: any extractJson+parseSeverity failure defaults to severity=ok — no spurious notifications
    - pgmq delete-after-success: message only deleted after processHeartbeat resolves — failures stay in queue for retry
    - 30s visibility timeout: prevents double-processing of the same message
    - Deno mirror pattern: pure parser logic in src/lib/ (vitest) mirrored verbatim to supabase/functions/_shared/ (Deno)

key-files:
  created:
    - worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts
    - worrylesssuperagent/supabase/functions/_shared/heartbeatParser.ts
    - worrylesssuperagent/src/lib/heartbeatParser.ts
  modified:
    - worrylesssuperagent/src/__tests__/heartbeatParser.test.ts

key-decisions:
  - "src/lib/heartbeatParser.ts is the source of truth (vitest imports); supabase/functions/_shared/heartbeatParser.ts is a verbatim Deno mirror — vitest.config.ts excludes supabase/ dir so both files are needed"
  - "sendUrgentEmail fetches user email from profiles table (not auth.users admin API) — simpler, profiles.email already populated during onboarding"
  - "Temperature 0.2 for heartbeat LLM call — low randomness matches deterministic severity classification task"

patterns-established:
  - "Pattern 4: Heartbeat severity routing — ok suppresses, digest logs only, headsup logs+notifies, urgent logs+notifies+emails"
  - "Pattern 5: Independent email try/catch — never propagate email failure to caller; log error only"

requirements-completed: [HB-02, HB-03, HB-04, HB-07]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 4 Plan 05: Heartbeat Runner Summary

**pg_cron-triggered Deno edge function that dequeues pgmq heartbeat jobs, calls Lovable AI LLM at temperature 0.2, and routes by severity: ok suppresses (zero DB writes), digest logs only, headsup logs + app notification, urgent logs + notification + Resend email in independent try/catch**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-13T12:57:27Z
- **Completed:** 2026-03-13T13:05:00Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 4

## Accomplishments

- Created `heartbeat-runner/index.ts`: full dequeue -> LLM -> severity routing cycle with pgmq, Lovable AI Gateway, Resend, and Supabase writes following exact severity matrix from the plan
- Created `_shared/heartbeatParser.ts`: pure extractJson + parseSeverity utilities, Deno-importable, no browser/Node dependencies
- Created `src/lib/heartbeatParser.ts`: Node-compatible mirror for vitest (needed because vitest.config.ts excludes `supabase/` directory)
- Replaced all 5 `it.todo` stubs in `heartbeatParser.test.ts` with 7 real passing tests covering all behavior cases including fail-safe fallback

## Task Commits

Each task was committed atomically (in worrylesssuperagent repo):

1. **Task 1: heartbeat-runner edge function (TDD)** - `f34df28` (feat)

## Files Created/Modified

- `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` - Edge function: pgmq dequeue (n=5, sleep_seconds=30), LLM call, severity routing, independent email try/catch, delete-after-success
- `worrylesssuperagent/supabase/functions/_shared/heartbeatParser.ts` - extractJson + parseSeverity for Deno imports
- `worrylesssuperagent/src/lib/heartbeatParser.ts` - Identical pure parser for vitest imports
- `worrylesssuperagent/src/__tests__/heartbeatParser.test.ts` - 7 real tests (was 5 it.todo stubs)

## Decisions Made

- `src/lib/heartbeatParser.ts` is needed as a vitest-importable mirror because `vitest.config.ts` excludes `**/supabase/**` to avoid Deno `https:` import errors. Both files contain identical pure logic — no Deno APIs.
- `sendUrgentEmail` fetches user email from `profiles` table rather than `auth.users` admin API — simpler pattern, email already available from onboarding flow.
- Temperature 0.2 for LLM call — minimal randomness appropriate for severity classification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created src/lib/heartbeatParser.ts as vitest-importable mirror**
- **Found during:** Task 1 (RED phase — test import failed)
- **Issue:** Plan specified `supabase/functions/_shared/heartbeatParser.ts` as the import target for tests, but `vitest.config.ts` has `exclude: ["**/supabase/**"]` preventing any supabase/ imports in vitest
- **Fix:** Created `src/lib/heartbeatParser.ts` (identical pure logic) as the test import path; kept `_shared/heartbeatParser.ts` for Deno edge function imports — both files are needed
- **Files modified:** src/lib/heartbeatParser.ts (created), src/__tests__/heartbeatParser.test.ts (import path)
- **Verification:** `npx vitest run src/__tests__/heartbeatParser.test.ts` exits 0, all 7 tests pass
- **Committed in:** f34df28

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Required to make tests importable. Both files ship — no scope creep.

## Issues Encountered

None beyond the vitest exclusion deviation documented above.

## User Setup Required

None beyond what was documented in Plan 02 (Vault secrets for pg_cron auth, RESEND_API_KEY, LOVABLE_API_KEY). The runner reads the same env vars already in use.

## Next Phase Readiness

- heartbeat-runner is now fully implemented — pg_cron will call it every minute in production
- Phase 4 Plan 06 (end-to-end integration) is unblocked
- Phase 5 notifications UI can now display rows created by the runner

---
*Phase: 04-heartbeat-system*
*Completed: 2026-03-13*

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts
- FOUND: worrylesssuperagent/supabase/functions/_shared/heartbeatParser.ts
- FOUND: worrylesssuperagent/src/lib/heartbeatParser.ts
- FOUND: worrylesssuperagent/src/__tests__/heartbeatParser.test.ts (7 passing tests)
- FOUND: commit f34df28 (Task 1)
- VERIFIED: severity=ok path has no agent_heartbeat_log or notifications calls (returns early at line 145)
- VERIFIED: Resend call wrapped in independent try/catch (line 188)
- VERIFIED: pgmq delete only called after successful processHeartbeat (line 228)
- VERIFIED: sleep_seconds: 30 in pgmq read (line 209)
