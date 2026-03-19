---
phase: 04-heartbeat-system
plan: "03"
subsystem: ui
tags: [react, supabase, shadcn-ui, vitest, heartbeat, hooks]

# Dependency graph
requires:
  - phase: 04-heartbeat-system/04-01
    provides: user_agents heartbeat columns (heartbeat_enabled, heartbeat_interval_hours, heartbeat_active_hours_start, heartbeat_active_hours_end)
provides:
  - useHeartbeatConfig hook: reads/writes user_agents heartbeat columns for a given agentTypeId
  - HeartbeatConfigSection component: collapsible UI with interval selector, active hours, enable toggle
  - GenericAgentPanel updated: renders HeartbeatConfigSection below chat placeholder
affects:
  - 04-04 (dispatcher reads heartbeat_enabled/interval/active_hours — user can configure before dispatcher ships)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - cast-as-any supabase queries for user_agents (columns not in generated types — same as useAgentWorkspace)
    - supabase.auth.getUser() internally in hook (callers keep existing interface)
    - Collapsible shadcn/ui pattern for agent panel sections

key-files:
  created:
    - worrylesssuperagent/src/hooks/useHeartbeatConfig.ts
    - worrylesssuperagent/src/components/agents/HeartbeatConfigSection.tsx
    - worrylesssuperagent/src/__tests__/useHeartbeatConfig.test.ts
  modified:
    - worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx

key-decisions:
  - "useHeartbeatConfig casts supabase queries as any for user_agents — columns not in generated types (same as useAgentWorkspace pattern)"
  - "HeartbeatConfigSection uses HTML input[type=time] for active hours — no additional date library needed"
  - "GenericAgentPanel CardContent changed to p-0 with inner padding to allow HeartbeatConfigSection border-t to span full width"

patterns-established:
  - "Collapsible agent panel section: border-t wrapper, ChevronDown rotate animation, p-4 content padding"
  - "Heartbeat config hook: updateConfig merges patch into local state immediately after await — optimistic local update"

requirements-completed: [HB-08]

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 4 Plan 03: HeartbeatConfig UI Summary

**useHeartbeatConfig hook with TDD (7 tests) + HeartbeatConfigSection collapsible component wired into GenericAgentPanel**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T09:51:00Z
- **Completed:** 2026-03-13T09:54:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- useHeartbeatConfig hook reads/writes user_agents heartbeat columns with single Supabase update call per change
- HeartbeatConfigSection renders interval selector (1/2/4/8h), active hours time inputs, and enable toggle inside a Collapsible section
- GenericAgentPanel now shows Heartbeat Configuration collapsible below the coming-soon placeholder
- TDD complete: 7 vitest tests covering read, updateConfig (partial patch), and isSaving state toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: useHeartbeatConfig hook** - `3b1c248` (feat — TDD: red stub → green implementation)
2. **Task 2: HeartbeatConfigSection + GenericAgentPanel wiring** - `79c5ced` (feat)

## Files Created/Modified
- `worrylesssuperagent/src/hooks/useHeartbeatConfig.ts` - Hook: reads/writes user_agents heartbeat columns for agentTypeId
- `worrylesssuperagent/src/__tests__/useHeartbeatConfig.test.ts` - 7 vitest tests (real tests, not todos)
- `worrylesssuperagent/src/components/agents/HeartbeatConfigSection.tsx` - Collapsible UI: interval, hours, toggle, skeleton, saving indicator
- `worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx` - Imports and renders HeartbeatConfigSection

## Decisions Made
- useHeartbeatConfig casts supabase queries as `any` for user_agents (same pattern as useAgentWorkspace — columns not in generated types until migrations applied)
- HeartbeatConfigSection uses HTML `<input type="time">` for active hours — no additional date/time library needed
- CardContent switched to `p-0` with inner padding per content block so `HeartbeatConfigSection`'s `border-t` spans full card width

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The isSaving test required care: calling `act()` without await was insufficient to capture the intermediate `isSaving=true` state. Fixed by starting updateConfig outside act, then flushing with `await act(async () => await Promise.resolve())` before asserting isSaving=true. This is a jsdom/React Testing Library timing detail, not a hook bug.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HeartbeatConfigSection is live in GenericAgentPanel; users can configure heartbeat settings for any agent
- Plan 04 (dispatcher) can read these columns — user_agents rows will have user-configured values ready
- TypeScript clean, all 18 tests passing across the suite

---
*Phase: 04-heartbeat-system*
*Completed: 2026-03-13*
