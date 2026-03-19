---
phase: 12-chief-of-staff-tools-+-governance
plan: "03"
subsystem: langgraph-server
tags: [chief-of-staff, tools, langraph, postgres, governance, morning-briefing, delegation, fan-out, memory, correlation, action-items, agent-health]
dependency_graph:
  requires: [12-01]
  provides: [cos-tools-layer]
  affects: [chief-of-staff-agent, cos-supervisor-integration]
tech_stack:
  added: []
  patterns:
    - pg.Pool singleton per tool module (same as store.ts)
    - Typed async functions (not LangChain Tool objects)
    - LangGraph Command/Send for delegation and fan-out
    - callLLMWithStructuredOutput for LLM-backed correlation
    - searchStore for cross-namespace agent memory queries
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/cos/compile-morning-briefing.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/track-action-items.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/assess-agent-health.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/delegate-to-agent.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/fan-out-to-agents.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/query-cross-agent-memory.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/correlate-findings.ts
    - worrylesssuperagent/langgraph-server/src/tools/cos/index.ts
  modified: []
decisions:
  - "correlateFindings uses _userId (underscore prefix) since userId is reserved for Plan 04 audit logging — no noUnusedParameters warning needed but convention applied for clarity"
  - "calendar: [] is a typed BriefingItem[] placeholder in BriefingSection — Phase 15 PA Google Calendar integration will populate it without breaking callers"
  - "heartbeat query has no outcome filter — heartbeat_outcome enum only has surfaced/error; all rows are already non-ok outcomes"
metrics:
  duration: "4 min"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 8
  files_modified: 0
---

# Phase 12 Plan 03: Chief of Staff Tools Summary

7 typed CoS tool functions in `src/tools/cos/` — morning briefing from heartbeat + agent_tasks, delegation via LangGraph Command with goalChain, parallel fan-out via Send array, cross-namespace Store memory reads, LLM-backed finding correlation, action item tracking, and per-agent health assessment with token budget percentage.

## What Was Built

### Task 1: Data-Query CoS Tools (commit adbee24)

Three tools that query Supabase via `pg.Pool` singleton:

**`compile-morning-briefing.ts` (COS-01)**
- Queries `public.agent_heartbeat_log` for last 24 hours (no outcome filter — enum has only `surfaced`/`error`)
- Queries `public.agent_tasks` for overdue/pending tasks (within 2 hours)
- Classifies into `urgent` (errors + past-due tasks), `priorities` (surfaced + due-soon), `fyi` (remainder)
- Returns `calendar: []` placeholder — Phase 15 PA Google Calendar will populate
- Uses `AGENT_DISPLAY_NAMES` to populate `agentDisplayName` on each item

**`track-action-items.ts` (COS-06)**
- Queries `public.agent_tasks` for active statuses: `needs_approval`, `running`, `pending`, `scheduled`
- Orders by urgency then `next_run_at`; returns `goal_chain` for goal ancestry context
- Limit 50 items

**`assess-agent-health.ts` (COS-07)**
- Queries `public.user_agents` for all agent enrollments (includes Phase 12 token budget columns)
- Queries `public.agent_heartbeat_log` last 7 days for outcome counts per agent
- Merges into `AgentHealthEntry[]` with health status logic:
  - `inactive`: `is_active = false`
  - `error`: `recentErrorCount > 2`
  - `warning`: `recentErrorCount > 0` or `tokensUsedPct > 80`
  - `healthy`: everything else
- `overallHealth`: worst-case across all agents

### Task 2: Routing/Memory/Correlation Tools + Barrel Index (commit 691c004)

Four tools + barrel index:

**`delegate-to-agent.ts` (COS-02)**
- Synchronous — creates `new Command({ goto: targetAgent, update: { agentType, goalChain } })`
- goalChain flows into delegated agent's state for full goal ancestry context
- Audit logging deferred to Plan 04 supervisor integration

**`fan-out-to-agents.ts` (COS-03)**
- Synchronous — creates `new Command({ goto: targetAgents.map(agent => new Send(agent, {...state, agentType, goalChain})) })`
- Programmatic equivalent of ad-hoc multi-routing in supervisor.ts
- Spreads current state into each Send for full context propagation

**`query-cross-agent-memory.ts` (COS-04)**
- Iterates agent prefixes (`${userId}:agent_memory:${agentType}`) via `searchStore`
- Uses `Promise.all` for parallel namespace queries
- Defaults to all agents except `chief_of_staff`; filters out empty-memory agents

**`correlate-findings.ts` (COS-05)**
- Guards against `< 2 findings` (no correlation possible with single finding)
- Calls `callLLMWithStructuredOutput` with temperature 0.3 for deterministic analysis
- Maps `standalone_findings` (LLM snake_case) to `standaloneFindings` (TypeScript camelCase)

**`index.ts` (barrel)**
- Re-exports all 7 tool functions + all associated TypeScript types

## Deviations from Plan

None — plan executed exactly as written.

Minor note: `correlateFindings` parameter named `_userId` (underscore prefix) since it's reserved for Plan 04 audit logging integration. The tsconfig has no `noUnusedParameters` so this is a style convention, not a requirement.

## Verification

- `tsc --noEmit` passes with zero errors
- All 8 files exist in `src/tools/cos/`
- No references to `public.tasks` (correct: `public.agent_tasks`)
- No `outcome != 'ok'` filter in SQL (heartbeat_outcome enum has no 'ok' value)
- `calendar: []` returned as Phase 15 placeholder
- All 7 tool functions exported from `index.ts`

## Self-Check: PASSED

All 8 created files verified on disk. Both task commits (adbee24, 691c004) confirmed in git log.
