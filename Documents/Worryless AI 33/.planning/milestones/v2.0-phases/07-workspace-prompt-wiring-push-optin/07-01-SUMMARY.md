---
phase: 07-workspace-prompt-wiring-push-optin
plan: 01
subsystem: api
tags: [deno, supabase, edge-functions, vitest, workspace-prompt, heartbeat]

# Dependency graph
requires:
  - phase: 03-md-workspace-editor-agent-marketplace
    provides: src/lib/buildWorkspacePrompt.ts and agent_workspaces table with 6 file types
  - phase: 04-heartbeat-system
    provides: heartbeat-runner edge function and _shared/sanitize.ts
provides:
  - supabase/functions/_shared/buildWorkspacePrompt.ts (Deno mirror, exports WorkspaceFileType and buildWorkspacePrompt)
  - src/__tests__/usePushSubscription.test.ts (Wave 0 it.todo stubs for NOTIF-03 opt-in)
  - heartbeat-runner with full 6-file workspace injection using buildWorkspacePrompt(files, true)
affects:
  - 07-02 (usePushSubscription hook implementation needs test stubs from this plan)
  - 07-03 (PushOptInBanner needs push_subscriptions infrastructure)
  - 07-04 (service worker needs push subscription flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deno mirror pattern: supabase/_shared/ mirrors src/lib/ with comment header, vitest excludes supabase/ dir
    - Wave 0 test stub pattern: it.todo files in src/__tests__/ allow vitest to exit 0 before hooks exist
    - Workspace 6-file injection: SELECT file_type, content (no .eq filter) then map to typed Record

key-files:
  created:
    - worrylesssuperagent/supabase/functions/_shared/buildWorkspacePrompt.ts
    - worrylesssuperagent/src/__tests__/usePushSubscription.test.ts
  modified:
    - worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts

key-decisions:
  - "buildWorkspacePrompt Deno mirror uses verbatim copy with 2-line comment header — diff excluding header is 0 lines"
  - "workspaceFiles initialised with empty strings for all 6 keys — handles missing rows gracefully without null checks downstream"
  - "sanitizeWorkspaceContent applied per-row in loop (not once on combined output) — consistent with prior single-file pattern"

patterns-established:
  - "Deno mirror pattern: copy src/lib/ file verbatim into supabase/_shared/ with comment noting vitest exclusion"
  - "Wave 0 stub pattern: it.todo stubs in src/__tests__/ allow green suite before hook exists"

requirements-completed: [WS-07]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 7 Plan 01: Workspace Prompt Wiring Summary

**Deno mirror of buildWorkspacePrompt.ts wired into heartbeat-runner for IDENTITY->SOUL->SOPs->TOOLS->MEMORY->HEARTBEAT injection, plus Wave 0 push subscription test stubs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T05:22:07Z
- **Completed:** 2026-03-14T05:24:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Created `supabase/functions/_shared/buildWorkspacePrompt.ts` as a verbatim Deno mirror of `src/lib/buildWorkspacePrompt.ts` — diff excluding comment header is 0 lines
- Created `src/__tests__/usePushSubscription.test.ts` with 6 it.todo stubs for the NOTIF-03 push opt-in path — vitest exits 0
- Updated heartbeat-runner to fetch all 6 workspace files in a single SELECT and call `buildWorkspacePrompt(files, true)` — replaces hand-rolled prompt that only injected HEARTBEAT.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 scaffolds — Deno mirror and test stub** - `0793ee8` (feat)
2. **Task 2: Wire buildWorkspacePrompt() into heartbeat-runner** - `b7df9c5` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `worrylesssuperagent/supabase/functions/_shared/buildWorkspacePrompt.ts` - Deno mirror of buildWorkspacePrompt for edge function imports; exports WorkspaceFileType and buildWorkspacePrompt
- `worrylesssuperagent/src/__tests__/usePushSubscription.test.ts` - Wave 0 it.todo stubs for push subscription hook (NOTIF-03); vitest exits 0 with 6 todos
- `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` - Replaced single HEARTBEAT fetch + hand-rolled prompt with 6-file SELECT + buildWorkspacePrompt(files, true)

## Decisions Made

- `workspaceFiles` map initialised with empty strings for all 6 file types — handles agents with incomplete workspace rows gracefully without null-check sprawl downstream
- `sanitizeWorkspaceContent` applied per-row inside the loop rather than once on final output — matches the prior single-file pattern and sanitizes each file's content independently
- Import style in heartbeat-runner uses single-quotes to match Deno convention used by other `_shared/` imports in the file

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 scaffolds (Deno mirror + test stubs) unblock Plans 02-04 which implement the actual push subscription hook, banner component, and service worker
- heartbeat-runner now injects all 6 workspace files — WS-07 requirement fully satisfied for the edge function layer
- All 51 existing vitest tests remain green; 14 todos (including the new 6) exit 0

## Self-Check: PASSED

- FOUND: `supabase/functions/_shared/buildWorkspacePrompt.ts`
- FOUND: `src/__tests__/usePushSubscription.test.ts`
- FOUND: `07-01-SUMMARY.md`
- FOUND: commit `0793ee8` (Task 1)
- FOUND: commit `b7df9c5` (Task 2)

---
*Phase: 07-workspace-prompt-wiring-push-optin*
*Completed: 2026-03-14*
