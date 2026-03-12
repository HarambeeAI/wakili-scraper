---
phase: 02-agent-spawner-team-selector
plan: 03
subsystem: ui
tags: [react, typescript, supabase, onboarding, agent-team-selector]

# Dependency graph
requires:
  - phase: 02-agent-spawner-team-selector/02-02
    provides: spawn-agent-team edge function that returns recommendations and allAgents
  - phase: 01-database-foundation
    provides: user_agents table with UNIQUE(user_id, agent_type_id), agent_workspaces with identity/soul rows, profiles table
provides:
  - AgentTeamSelector.tsx React component (Step 12) with three-tier agent list and Accept CTA
  - ConversationalOnboarding.tsx extended with agent_team_selector and briefing steps
  - handleTeamAccept: inserts user_agents rows + sets onboarding_completed = true
  - Fire-and-forget workspace personalization replacing {business_name}/{industry}/{city}/{country}/{description} tokens
affects:
  - phase-03-agent-ui (onboarding flow feeds user_agents which drives sidebar)
  - phase-02-04 (dashboard sidebar shows agents from user_agents populated here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-tier agent selection UI: locked defaults, pre-checked recommended, unchecked catalog rest
    - Fire-and-forget Supabase chain after onComplete() for non-blocking background work
    - Set<string> selectedIds passed from child to parent via onAccept callback

key-files:
  created:
    - worrylesssuperagent/src/components/onboarding/AgentTeamSelector.tsx
  modified:
    - worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx

key-decisions:
  - "validator_sales Continue button now calls nextStep (not handleComplete) — onboarding_completed only set inside handleTeamAccept after user_agents are inserted"
  - "Workspace personalization (SPAWN-07) is a deterministic token replace with no LLM call — fire-and-forget after onComplete() so user is not blocked"
  - "DEFAULT_AGENT_IDS defined in both AgentTeamSelector.tsx and handleTeamAccept — defaults are always activated regardless of what user selects"

patterns-established:
  - "Fire-and-forget pattern: supabase.from(...).then(...).catch(console.warn) after onComplete() — user lands on dashboard while background work completes"
  - "Upsert with ignoreDuplicates: true for user_agents — idempotent, safe to re-run"

requirements-completed: [SPAWN-03, SPAWN-04, SPAWN-05, SPAWN-06, SPAWN-07]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 02 Plan 03: Agent Team Selector Summary

**Step 12 onboarding UI: three-tier AgentTeamSelector component + handleTeamAccept inserts user_agents and fires LLM-less workspace token personalization post-onComplete**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T19:49:06Z
- **Completed:** 2026-03-12T19:52:53Z
- **Tasks:** 3 (Tasks 2 and 3 committed together as both touch ConversationalOnboarding.tsx)
- **Files modified:** 2

## Accomplishments

- Created `AgentTeamSelector.tsx` with loading skeleton, three-tier agent list (locked defaults, recommended with reasoning, catalog rest), and Accept CTA
- Extended `ConversationalOnboarding.tsx`: Step type union now includes `agent_team_selector` and `briefing`; validator_sales button calls `nextStep` not `handleComplete`
- `handleTeamAccept` upserts default 5 agents + selected additional agents into `user_agents`, sets `onboarding_completed = true` only after inserts, shows 2-second briefing animation then calls `onComplete()`
- Fire-and-forget workspace personalization after `onComplete()`: fetches `agent_workspaces` rows with `file_type in ('identity','soul')` for all activated agents, replaces `{business_name}/{industry}/{city}/{country}/{description}` tokens deterministically — SPAWN-07 satisfied with no LLM call

## Task Commits

1. **Task 1: Create AgentTeamSelector.tsx component** - `558a6ce` (feat)
2. **Tasks 2+3: Extend ConversationalOnboarding.tsx with Step 12, briefing, workspace personalization** - `1f2a089` (feat)

## Files Created/Modified

- `worrylesssuperagent/src/components/onboarding/AgentTeamSelector.tsx` - New component: fetches spawn-agent-team, renders three-tier agent list, fires onAccept(Set<string>) callback
- `worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx` - Added agent_team_selector/briefing steps, handleTeamAccept, fire-and-forget workspace personalization

## Decisions Made

- `validator_sales` Continue button now calls `nextStep` not `handleComplete` — `onboarding_completed` is only set inside `handleTeamAccept` after `user_agents` are inserted (prevents premature completion)
- Workspace personalization (SPAWN-07) uses deterministic token replacement with no LLM call — Phase 1 trigger already seeded workspace rows with `{business_name}` placeholder tokens
- Fire-and-forget after `onComplete()` so user lands on dashboard immediately; failure degrades gracefully to generic workspace content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Users who complete onboarding now arrive at the dashboard with their selected AI team already inserted in `user_agents`
- Agent workspaces have business-context-aware content (identity/soul files personalized) within seconds of onboarding completion
- Dashboard sidebar (Phase 02-04) can read `user_agents` to show activated agents — ready to pick up

---
*Phase: 02-agent-spawner-team-selector*
*Completed: 2026-03-12*
