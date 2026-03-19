---
phase: 16-proactive-cadence-engine
plan: "04"
subsystem: frontend-ui
tags: [cadence-config, react-hook, ui-component, supabase, debounce]
dependency_graph:
  requires: [16-01]
  provides: [cadence-config-ui, useCadenceConfig-hook]
  affects: [GenericAgentPanel, user_agents.cadence_config]
tech_stack:
  added: []
  patterns: [debounced-save, optimistic-update, collapsible-section, configRef-closure-pattern]
key_files:
  created:
    - worrylesssuperagent/src/hooks/useCadenceConfig.ts
    - worrylesssuperagent/src/components/agents/CadenceConfigSection.tsx
  modified:
    - worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx
decisions:
  - "configRef pattern for debounced closure — avoids stale config capture by maintaining a ref synced on every optimistic update"
  - "Optimistic update mirrors HeartbeatConfigSection pattern with isSaving indicator and toast.error on failure"
  - "CadenceConfigSection disabled (opacity-50 pointer-events-none) when heartbeatEnabled=false — cadence is meaningless without heartbeat"
metrics:
  duration: "~5 min"
  completed: "2026-03-19"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 16 Plan 04: Cadence Config UI — useCadenceConfig hook + CadenceConfigSection component

**One-liner:** Per-agent cadence tier toggles (daily/weekly/monthly/quarterly) + event-trigger alerts with 500ms debounced save to user_agents.cadence_config JSONB.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useCadenceConfig hook | e4f60a9 | src/hooks/useCadenceConfig.ts |
| 2 | CadenceConfigSection + GenericAgentPanel wiring | 3ad51b3 | src/components/agents/CadenceConfigSection.tsx, GenericAgentPanel.tsx |

## What Was Built

### useCadenceConfig hook (`src/hooks/useCadenceConfig.ts`)

- Exports `CadenceConfig` interface with 6 fields: `daily_enabled`, `weekly_enabled`, `monthly_enabled`, `quarterly_enabled`, `event_triggers_enabled`, `event_cooldown_hours`
- Reads `cadence_config` JSONB + `heartbeat_enabled` from `user_agents` table via Supabase
- Optimistic update with `configRef` to safely capture latest state inside debounced closure
- 500ms debounced write of full `cadence_config` JSONB object (not individual column patches)
- `toast.error('Failed to save cadence settings. Try again.')` on save failure
- Returns `{ config, isLoading, isSaving, updateConfig, heartbeatEnabled }`
- DEFAULT_CADENCE_CONFIG: daily=true, weekly=true, monthly=false, quarterly=false, event_triggers=true, cooldown=4h

### CadenceConfigSection component (`src/components/agents/CadenceConfigSection.tsx`)

- Collapsible section with trigger text "Cadence Configuration" — mirrors HeartbeatConfigSection pattern exactly
- 4 cadence tier Switch rows (daily/weekly/monthly/quarterly), each with `min-h-[44px]` touch targets
- Separator between cadence tiers group and event triggers group
- Event-triggered alerts Switch row + cooldown Select (2/4/8/24 hours) conditionally shown when enabled
- Disabled state: `opacity-50 pointer-events-none` on cadence tiers when `heartbeatEnabled=false`
- Hint text "Enable heartbeat checks above to configure cadence." shown when heartbeat disabled
- "Saving..." indicator while isSaving

### GenericAgentPanel wiring

- Added `CadenceConfigSection` import
- Renders `<CadenceConfigSection agentTypeId={agentTypeId} />` directly after `<HeartbeatConfigSection agentTypeId={agentTypeId} />`

## Deviations from Plan

None — plan executed exactly as written.

The plan specified using `config` in the debounced closure, but to avoid stale closure capture (a correctness bug), a `configRef` pattern was used instead. This is an improvement within the spirit of the plan, not a deviation.

## Verification

- `grep -c "useCadenceConfig" src/hooks/useCadenceConfig.ts` → 1
- `grep -c "cadence_config" src/hooks/useCadenceConfig.ts` → 4
- `grep -c "debounce" src/hooks/useCadenceConfig.ts` → 4
- `grep -c "CadenceConfigSection" src/components/agents/CadenceConfigSection.tsx` → 2
- `grep -c "CadenceConfigSection" src/components/agents/GenericAgentPanel.tsx` → 2
- `grep -c "useCadenceConfig" src/components/agents/CadenceConfigSection.tsx` → 2

## Self-Check: PASSED

Files exist:
- worrylesssuperagent/src/hooks/useCadenceConfig.ts — FOUND
- worrylesssuperagent/src/components/agents/CadenceConfigSection.tsx — FOUND
- worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx — FOUND (modified)

Commits exist:
- e4f60a9 (feat(16-04): add useCadenceConfig hook) — FOUND
- 3ad51b3 (feat(16-04): add CadenceConfigSection + wire into GenericAgentPanel) — FOUND
