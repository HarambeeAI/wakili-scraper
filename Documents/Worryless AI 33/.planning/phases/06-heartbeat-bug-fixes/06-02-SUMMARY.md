---
phase: 06-heartbeat-bug-fixes
plan: "02"
subsystem: ui
tags: [vitest, heartbeat, agentcard, typescript, tdd]

requires:
  - phase: 05-org-view-notifications
    provides: AgentCard with heartbeat status dot rendering, useTeamData hook passing severity as lastHeartbeatOutcome
  - phase: 04-heartbeat-system
    provides: heartbeat-runner writing severity column (urgent/headsup/digest) to agent_heartbeat_log
provides:
  - Fixed getHeartbeatStatus — amber dot now appears for urgent/headsup/digest severity values
  - Updated useTeamData.test.ts with severity-based assertions (4 new cases replacing 1 legacy case)
  - HB-08 confirmed closed by passing useHeartbeatConfig.test.ts suite (7/7)
affects:
  - AgentCard amber attention dot (ORG-04)
  - heartbeat status display logic anywhere getHeartbeatStatus is called

tech-stack:
  added: []
  patterns:
    - "Severity-based attention check: OR across severity enum values (urgent|headsup|digest) rather than legacy outcome string"
    - "TDD: RED commit before GREEN commit — failing tests committed and pushed before production fix"

key-files:
  created: []
  modified:
    - worrylesssuperagent/src/lib/heartbeatStatus.ts
    - worrylesssuperagent/src/__tests__/useTeamData.test.ts

key-decisions:
  - "Fix the check (not the data source) — Option A: heartbeatStatus.ts checks severity values rather than renaming useTeamData column or AgentCard prop"
  - "lastOutcome parameter name intentionally preserved — semantic imprecision pre-existed; renaming is out of scope for Phase 6"
  - "Severity-based attention: urgent OR headsup OR digest all trigger amber dot — consistent with heartbeat-runner severity enum"

patterns-established:
  - "Severity enum values (urgent/headsup/digest) are the authoritative contract from heartbeat-runner to UI attention state"

requirements-completed: [HB-08, ORG-04]

duration: 1min
completed: 2026-03-13
---

# Phase 6 Plan 02: Heartbeat Status Severity Fix Summary

**Fixed permanent amber-dot blindspot: getHeartbeatStatus now checks severity enum (urgent/headsup/digest) instead of legacy 'surfaced' string that useTeamData never passes**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-13T11:38:04Z
- **Completed:** 2026-03-13T11:39:00Z
- **Tasks:** 3 (2 code tasks + 1 verification)
- **Files modified:** 2

## Accomplishments

- One-line fix to `heartbeatStatus.ts`: `lastOutcome === 'surfaced'` replaced with `lastOutcome === 'urgent' || lastOutcome === 'headsup' || lastOutcome === 'digest'`
- Amber attention dot on AgentCard is now functional — previously always invisible regardless of heartbeat findings
- useTeamData.test.ts expanded from 1 to 4 severity-based test cases with correct RED/GREEN TDD flow
- HB-08 confirmed closed: useHeartbeatConfig.test.ts passes 7/7 with no code changes needed
- Full vitest suite: 8 test files, 51 tests passed, zero failures

## Task Commits

Each task was committed atomically (in nested `worrylesssuperagent/` git repo):

1. **Task 1: Update test assertions to use severity values** - `23ad120` (test — TDD RED)
2. **Task 2: Fix getHeartbeatStatus to check severity values** - `5b0fe21` (fix — TDD GREEN)
3. **Task 3: Confirm HB-08 heartbeat config tests pass** - verification-only, no code changes

**Plan metadata:** (outer repo — see docs commit)

_TDD flow: RED commit (23ad120) then GREEN commit (5b0fe21)_

## Files Created/Modified

- `worrylesssuperagent/src/lib/heartbeatStatus.ts` — Line 8 changed from `surfaced` check to `urgent || headsup || digest` multi-value OR check
- `worrylesssuperagent/src/__tests__/useTeamData.test.ts` — Replaced single 'surfaced' test (lines 14-17) with four cases: urgent (attention), headsup (attention), digest (attention), surfaced (NOT attention)

## Decisions Made

- Fix the check, not the data source (Option A from research) — heartbeatStatus.ts change is isolated and minimal; no useTeamData.ts or AgentCard.tsx changes needed
- `lastOutcome` parameter name preserved — the semantic imprecision (it carries severity, not outcome) is pre-existing and renaming is out of Phase 6 scope
- Negative test for 'surfaced' included — documents explicitly that useTeamData never passes this value, preventing future regression if someone adds surfaced back

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — the fix was exactly as predicted by the plan. RED/GREEN TDD cycle confirmed correct diagnosis.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ORG-04 (AgentCard attention state) and HB-08 (heartbeat config UI) are now both closed
- Phase 6 Plan 03 can proceed — dispatcher/runner field mismatch (snake_case keys) was resolved in Plan 01
- No blockers

---
*Phase: 06-heartbeat-bug-fixes*
*Completed: 2026-03-13*
