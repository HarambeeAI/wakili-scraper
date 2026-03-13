---
phase: 05-org-view-notifications
plan: "03"
subsystem: ui
tags: [react, typescript, supabase, date-fns, vitest, tailwind]

# Dependency graph
requires:
  - phase: 05-01
    provides: agent_heartbeat_log table + user_agents table
  - phase: 02-agent-spawner-team-selector
    provides: LEGACY_VIEW_MAP, DashboardSidebar, Dashboard ActiveView pattern
provides:
  - Team org chart view accessible from sidebar
  - getHeartbeatStatus pure function (active/attention/sleeping)
  - useTeamData hook fetching agents + heartbeat stats
  - HeartbeatStatusDot component with live status colors
  - AgentCard component with LEGACY_VIEW_MAP navigation
  - TeamView two-tier layout (Chief of Staff + responsive grid)
affects: [05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure function for heartbeat status classification (getHeartbeatStatus)
    - TDD: test file written before implementation, all 4 tests pass green
    - Component tree: TeamView → AgentCard + HeartbeatStatusDot + useTeamData
    - LEGACY_VIEW_MAP inline in AgentCard (same as DashboardSidebar pattern)

key-files:
  created:
    - worrylesssuperagent/src/lib/heartbeatStatus.ts
    - worrylesssuperagent/src/hooks/useTeamData.ts
    - worrylesssuperagent/src/__tests__/useTeamData.test.ts
    - worrylesssuperagent/src/components/team/HeartbeatStatusDot.tsx
    - worrylesssuperagent/src/components/team/AgentCard.tsx
    - worrylesssuperagent/src/components/team/TeamView.tsx
  modified:
    - worrylesssuperagent/src/components/dashboard/DashboardSidebar.tsx
    - worrylesssuperagent/src/pages/Dashboard.tsx

key-decisions:
  - "HeartbeatStatus outcome 'surfaced' beats recency — attention status regardless of how recent the heartbeat is"
  - "LEGACY_VIEW_MAP duplicated inline in AgentCard — decouples team component tree from DashboardSidebar internals"
  - "useTeamData casts supabase queries as any — user_agents and agent_heartbeat_log not in generated types (same pattern as useAgentWorkspace)"
  - "Skeleton components used for loading state in TeamView — avoids layout shift during data fetch"

patterns-established:
  - "Pure function + unit tests before React hook — getHeartbeatStatus tested independently of hook"
  - "Team component tree in src/components/team/ — isolated directory for org view components"

requirements-completed: [ORG-01, ORG-02, ORG-03, ORG-04, ORG-05]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 5 Plan 03: Team Org Chart View Summary

**Two-tier org chart view with live heartbeat status dots — Chief of Staff centered above responsive agent grid, wired into sidebar and dashboard routing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T10:32:55Z
- **Completed:** 2026-03-13T10:35:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- getHeartbeatStatus pure function with 4 passing TDD tests (null/active/attention/sleeping cases)
- Full component tree: TeamView renders Chief of Staff card centered above responsive 2-4 column grid
- Live status dots: green pulsing (active ≤1h), amber static (surfaced outcome), muted (sleeping)
- AgentCard click navigation via LEGACY_VIEW_MAP with agent:{id} fallback
- Sidebar Team entry and Dashboard routing complete — accessible at view='team'

## Task Commits

Each task was committed atomically:

1. **Task 1: heartbeatStatus.ts pure function + useTeamData hook** - `2c66839` (feat)
2. **Task 2: TeamView component tree + Dashboard + Sidebar wiring** - `bc463ca` (feat)

## Files Created/Modified
- `worrylesssuperagent/src/lib/heartbeatStatus.ts` - Pure function: getHeartbeatStatus returning active/attention/sleeping
- `worrylesssuperagent/src/hooks/useTeamData.ts` - Hook fetching user_agents + heartbeat log, returning chiefOfStaff/otherAgents/loading
- `worrylesssuperagent/src/__tests__/useTeamData.test.ts` - 4 real tests for getHeartbeatStatus + 3 todo stubs for hook
- `worrylesssuperagent/src/components/team/HeartbeatStatusDot.tsx` - Colored dot: green pulse, amber, muted
- `worrylesssuperagent/src/components/team/AgentCard.tsx` - Card with LEGACY_VIEW_MAP navigation, last-active timestamp, task count
- `worrylesssuperagent/src/components/team/TeamView.tsx` - Two-tier layout with Skeleton loading, Chief of Staff tier, agent grid, Add Agent button
- `worrylesssuperagent/src/components/dashboard/DashboardSidebar.tsx` - Added Team entry (Users icon) in Main group
- `worrylesssuperagent/src/pages/Dashboard.tsx` - Added "team" to ActiveView union, imported TeamView, added team case

## Decisions Made
- getHeartbeatStatus: 'surfaced' outcome takes precedence over recency for attention status
- LEGACY_VIEW_MAP duplicated inline in AgentCard to decouple team components from sidebar internals
- useTeamData casts supabase queries as any — consistent with useAgentWorkspace pattern established in Phase 3
- Skeleton loading state in TeamView using existing @/components/ui/skeleton component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Team view fully functional: sidebar entry, routing, cards with live status
- useTeamData hook ready for real-time updates (Phase 5 plan 04 notifications can build on heartbeat query patterns)
- HeartbeatStatusDot reusable in other notification contexts

---
*Phase: 05-org-view-notifications*
*Completed: 2026-03-13*
