---
phase: 16-proactive-cadence-engine
plan: "05"
subsystem: cadence-engine
tags: [edge-function, langgraph, morning-briefing, event-prompts, barrel-index]
dependency_graph:
  requires: [16-01, 16-02, 16-03]
  provides: [cos-thread-briefing, event-prompt-handling, cadence-barrel-index]
  affects: [send-morning-digest, proactive-runner, langgraph-server]
tech_stack:
  - Deno (Edge Functions)
  - TypeScript (barrel index)
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/cadence/index.ts
  modified:
    - worrylesssuperagent/supabase/functions/send-morning-digest/index.ts
    - worrylesssuperagent/supabase/functions/proactive-runner/index.ts
key_decisions:
  - "Fire-and-forget pattern for CoS LangGraph thread write — failure does not block notification/email critical path"
  - "Deno cannot import Node modules, so EVENT_PROMPTS duplicated inline in proactive-runner (same pattern as HEARTBEAT_PROMPTS)"
  - "use_langgraph flag fetched per user in digest loop (not batch) — consistent with existing profile query pattern"
---

# Phase 16 Plan 05: Morning Briefing Wiring & Barrel Index Summary

Morning briefing now writes to CoS LangGraph thread for use_langgraph users, event-triggered proactive messages use targeted prompts, and the cadence module has a clean barrel index.

## What Was Built

### Task 1: send-morning-digest CoS LangGraph thread delivery
- Added `LANGGRAPH_SERVER_URL` env var read at the start of the per-user loop
- Added per-user profile fetch to read `use_langgraph` flag (alongside existing `email` field)
- After inserting the notification, fire-and-forget POST to `${LANGGRAPH_SERVER_URL}/invoke` with a CoS morning briefing prompt
- Thread ID: `proactive:chief_of_staff:${userId}` — deterministic, persistent across runs
- LangGraph call only executes when `LANGGRAPH_SERVER_URL` is set AND `use_langgraph = true`
- Failure is non-fatal — wrapped in try/catch with error logging; notification/email path unaffected
- The briefing prompt includes the full digest text so CoS can organize by urgency and correlate cross-agent findings

### Task 2: proactive-runner event-type handling + cadence barrel index
- Added `EVENT_PROMPTS` record inline in proactive-runner (duplicated from event-detector.ts — Deno cannot import Node modules)
- Events covered: `overdue_invoice` (accountant), `stale_deal` (sales_rep), `expiring_contract` (legal_advisor)
- When `cadence_tier === 'event'` and `event_type` is in EVENT_PROMPTS, uses targeted event prompt instead of cadence tier prompt
- Falls back to generic "An event was triggered" message for unknown event types
- Created `langgraph-server/src/cadence/index.ts` barrel index re-exporting: `HEARTBEAT_PROMPTS`, `getHeartbeatPrompt`, `DEFAULT_CADENCE_CONFIG`, `EVENT_TYPES`, `EVENT_PROMPTS`, `getEventPrompt`, plus type exports
- All import paths use `.js` extensions for Node ESM compatibility

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `/Users/anthonysure/Documents/Worryless AI 33/worrylesssuperagent/supabase/functions/send-morning-digest/index.ts` — contains LANGGRAPH_SERVER_URL, use_langgraph, proactive:chief_of_staff
- `/Users/anthonysure/Documents/Worryless AI 33/worrylesssuperagent/supabase/functions/proactive-runner/index.ts` — contains EVENT_PROMPTS, event_type handling, cadence_tier === 'event' check
- `/Users/anthonysure/Documents/Worryless AI 33/worrylesssuperagent/langgraph-server/src/cadence/index.ts` — exports HEARTBEAT_PROMPTS, getHeartbeatPrompt, EVENT_TYPES, EVENT_PROMPTS, getEventPrompt
