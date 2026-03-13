---
phase: 05-org-view-notifications
plan: "02"
subsystem: ui
tags: [react, supabase, realtime, notifications, radix-ui, hooks]

requires:
  - phase: 05-01
    provides: TeamView org view, notifications table schema with all columns
  - phase: 04-heartbeat-system
    provides: notifications table (id, user_id, agent_type_id, severity, message, is_read, link_type, created_at)

provides:
  - useNotifications hook with initial count query, postgres_changes realtime subscription, markRead, markAllRead, and resolveView
  - NotificationBell component with Radix Popover, unread badge, severity labels, mark-read controls
  - DashboardHeader wired with NotificationBell and onNavigate prop
  - Dashboard.tsx passes onNavigate={setActiveView} to DashboardHeader

affects: [phase-05, dashboard, heartbeat-notifications]

tech-stack:
  added: [date-fns (formatDistanceToNow already in package.json)]
  patterns:
    - supabase cast-as-any for tables not in generated types (same as useAgentWorkspace, useHeartbeatConfig)
    - optimistic state updates on unreadCount before DB write completes
    - postgres_changes subscription with user_id filter for per-user realtime
    - resolveView LEGACY_VIEW_MAP for agent_type_id -> ActiveView translation

key-files:
  created:
    - worrylesssuperagent/src/hooks/useNotifications.ts
    - worrylesssuperagent/src/components/dashboard/NotificationBell.tsx
    - worrylesssuperagent/src/__tests__/useNotifications.test.ts
  modified:
    - worrylesssuperagent/src/components/dashboard/DashboardHeader.tsx
    - worrylesssuperagent/src/pages/Dashboard.tsx

key-decisions:
  - "useNotifications casts supabase queries as any for notifications table — not in generated types, consistent with useAgentWorkspace/useHeartbeatConfig pattern"
  - "resolveView uses inline LEGACY_VIEW_MAP inside hook — mirrors DashboardSidebar map, avoids cross-component import"
  - "NotificationBell uses BellDot icon (lucide-react) when unreadCount > 0 for visual distinction"
  - "TDD approach used for useNotifications — 13 tests covering resolveView (7), initial load (2), markRead (2), markAllRead (2)"

patterns-established:
  - "Realtime hook pattern: channel factory + postgres_changes subscription + cleanup via removeChannel"
  - "Optimistic update pattern: setState immediately, fire-and-forget DB call after"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06]

duration: 15min
completed: 2026-03-13
---

# Phase 05 Plan 02: Notification Bell Summary

**Notification bell with real-time unread badge, Radix Popover panel, severity labels, mark-read controls, and LEGACY_VIEW_MAP agent navigation wired into DashboardHeader**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T13:34:00Z
- **Completed:** 2026-03-13T13:43:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `useNotifications` hook: initial unread count query, postgres_changes realtime subscription per user, optimistic markRead/markAllRead, and resolveView with LEGACY_VIEW_MAP — all tested with 13 vitest tests
- `NotificationBell` component: ghost button with Bell/BellDot icon, absolute red badge (99+ cap), Radix Popover with notification list, severity badges (destructive/default/secondary), mark-read controls, formatDistanceToNow timestamps
- `DashboardHeader` updated with `onNavigate` prop and `NotificationBell` rendered between SidebarTrigger and LogOut; `Dashboard.tsx` passes `setActiveView`

## Task Commits

Each task was committed atomically:

1. **Task 1: useNotifications hook (TDD)** - `2ac7def` (feat — test + implementation together, GREEN phase)
2. **Task 2: NotificationBell component + DashboardHeader wiring** - `a4c9a1b` (feat)

## Files Created/Modified

- `worrylesssuperagent/src/hooks/useNotifications.ts` — React hook: initial count query, realtime postgres_changes subscription, markRead, markAllRead, resolveView
- `worrylesssuperagent/src/components/dashboard/NotificationBell.tsx` — Bell button with badge, Popover notification panel, severity labels, mark-read controls, navigation on row click
- `worrylesssuperagent/src/__tests__/useNotifications.test.ts` — 13 tests covering resolveView (7 cases), initial load (2), optimistic markRead (2), optimistic markAllRead (2)
- `worrylesssuperagent/src/components/dashboard/DashboardHeader.tsx` — Added `onNavigate` prop, imported and rendered NotificationBell
- `worrylesssuperagent/src/pages/Dashboard.tsx` — Passes `onNavigate={setActiveView}` to DashboardHeader

## Decisions Made

- `useNotifications` casts supabase queries `as any` — notifications table is not in generated types; this is the established pattern from `useAgentWorkspace` and `useHeartbeatConfig`
- `resolveView` uses an inline `LEGACY_VIEW_MAP` inside the hook — mirrors the same map in `DashboardSidebar.tsx`, avoids coupling the hook to the component tree
- `NotificationBell` uses lucide-react `BellDot` icon when `unreadCount > 0` for visual distinction without needing a separate badge library
- TDD approach used for Task 1 — wrote failing tests first (RED: file not found), then implemented hook (GREEN: 13/13 pass)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Notifications table already created in Phase 4 (20260313000006_heartbeat_queue.sql) with all required columns.

## Next Phase Readiness

- Notification bell is fully wired into Dashboard; any notification row inserted into the `notifications` table by heartbeat edge functions will appear in real-time
- Phase 05-03 (or remaining plans) can rely on `useNotifications` hook and `NotificationBell` being production-ready
- Full vitest suite: 48 passed, 8 todo, 0 failed

---
*Phase: 05-org-view-notifications*
*Completed: 2026-03-13*
