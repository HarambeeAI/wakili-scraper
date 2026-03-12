---
phase: 02-agent-spawner-team-selector
plan: 04
subsystem: ui
tags: [react, typescript, supabase, dashboard, sidebar, agents]

# Dependency graph
requires:
  - phase: 02-agent-spawner-team-selector
    provides: "user_agents table with is_active flag; available_agent_types catalog; onboarding Step 12 activating agents"
provides:
  - "Dynamic sidebar driven by live user_agents DB query"
  - "fetchUserAgents() + userAgents state in Dashboard.tsx"
  - "GenericAgentPanel component for non-dedicated agent types"
  - "Extended ActiveView type supporting agent:${id} dynamic routing"
  - "LEGACY_VIEW_MAP ensuring 5 default agents never appear twice"
affects:
  - "03-agent-workspace-editor"
  - "04-heartbeat-system"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic sidebar: DB query drives UI list, LEGACY_VIEW_MAP prevents default duplication"
    - "agent:${id} view routing pattern in Dashboard.tsx renderContent default case"
    - "userAgents prop threading: Dashboard.tsx fetches → DashboardSidebar renders"

key-files:
  created:
    - worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx
  modified:
    - worrylesssuperagent/src/pages/Dashboard.tsx
    - worrylesssuperagent/src/components/dashboard/DashboardSidebar.tsx

key-decisions:
  - "GenericAgentPanel shows placeholder (not ChatInterface) — ChatInterface accepts no agentType prop, would need a separate plan to extend it"
  - "fetchUserAgents accepts currentUser param to avoid stale closure — called from useEffect([user]) and onComplete callback"
  - "LEGACY_VIEW_MAP keys in DashboardSidebar co-located with AGENT_ICONS for cohesion; both are module-level constants"

patterns-established:
  - "Dynamic sidebar pattern: fetch from DB on user mount + refetch after mutations (onboarding complete)"
  - "agent: prefix routing: activeView.startsWith('agent:') → extract ID → look up in userAgents → render GenericAgentPanel"

requirements-completed: [SPAWN-04]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 2 Plan 4: Dynamic Sidebar + GenericAgentPanel Summary

**Data-driven dashboard sidebar using live user_agents DB query with LEGACY_VIEW_MAP preventing double-render, plus GenericAgentPanel for the 8 non-dedicated agent types**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-12T19:43:48Z
- **Completed:** 2026-03-12T19:46:40Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Removed the static `agentItems` hardcoded array from DashboardSidebar — no more risk of defaults showing twice
- Added `fetchUserAgents()` to Dashboard.tsx that queries `user_agents JOIN available_agent_types` with `is_active = true`, called on user mount and after onboarding completion
- Extended `ActiveView` type to `| string` to support dynamic `agent:${id}` routing
- Created `GenericAgentPanel` component with Bot icon, display_name header, description, and "Chat coming soon" placeholder
- Added `LEGACY_VIEW_MAP` in DashboardSidebar to route the 5 default agent_type_ids to their existing view IDs (chat, assistant, accountant, marketer, sales)
- Added full icon map for all 13 agent types including the 8 new ones (Bot fallback for unknowns)

## Task Commits

App code changes applied to filesystem (planning repo only tracks `.planning/` docs):

1. **Task 1: GenericAgentPanel + Dashboard.tsx data-driven** — feat(02-04): create GenericAgentPanel; add fetchUserAgents/userAgents state; extend ActiveView; agent: routing; pass userAgents to DashboardSidebar
2. **Task 2: Replace static agentItems with dynamic user_agents** — feat(02-04): remove static agentItems; add LEGACY_VIEW_MAP + AGENT_ICONS; build dynamicAgentItems from userAgents prop

**Plan metadata:** see final docs commit

## Files Created/Modified
- `worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx` - New generic panel for agent types without dedicated components; shows display_name, description, "Chat coming soon" placeholder
- `worrylesssuperagent/src/pages/Dashboard.tsx` - Added UserAgent interface, userAgents state, fetchUserAgents(), useEffect to fetch on user change, onComplete refetch, agent: renderContent routing, userAgents prop to DashboardSidebar
- `worrylesssuperagent/src/components/dashboard/DashboardSidebar.tsx` - Removed static agentItems; added userAgents prop; LEGACY_VIEW_MAP; AGENT_ICONS for all 13 types; dynamicAgentItems built from userAgents prop

## Decisions Made
- `GenericAgentPanel` uses a "Chat coming soon" placeholder because `ChatInterface` takes no props — wiring it to an agent type would require modifying ChatInterface, which is out of scope for this plan
- `fetchUserAgents` takes a `currentUser: User` parameter explicitly (not reading from component state closure) to avoid stale closure issues when called from onComplete callback
- Static `agentItems` array deleted entirely — no fallback to old list — ensuring the sidebar is always DB-driven

## Deviations from Plan

None — plan executed exactly as written, with the exception that ChatInterface does not accept an `agentType` prop (as the plan anticipated as a possibility). GenericAgentPanel renders the planned placeholder instead.

## Issues Encountered
- TypeScript compiles cleanly with no new errors (`npx tsc --noEmit` passes)

## User Setup Required
None — no external service configuration required. The DB queries use existing Supabase client and tables created in Phase 1.

## Next Phase Readiness
- Sidebar is now fully data-driven — new agents activated in Step 12 immediately appear after onComplete() fires
- GenericAgentPanel is the landing UI for all 8 non-dedicated agent types (hr_manager, legal_compliance, customer_success, operations_manager, data_analyst, product_manager, it_support, procurement_manager)
- When Phase 3 builds the workspace editor, clicking those agents will already route correctly via the `agent:${id}` view pattern
- ChatInterface extension (to accept agentType and route to correct backend) is a separate future task

---
*Phase: 02-agent-spawner-team-selector*
*Completed: 2026-03-12*
