---
phase: 16-proactive-cadence-engine
plan: "02"
subsystem: proactive-cadence-engine
tags: [edge-function, langgraph, heartbeat, cadence, token-budget, tdd]
dependency_graph:
  requires: [16-01]
  provides: [proactive-runner, multi-tier-dispatcher, isProactive-bypass, cadence-tests]
  affects: [heartbeat-runner, base-agent, agent-state, langgraph-server]
tech_stack:
  added: []
  patterns:
    - isProactive flag gates token budget in createLLMNode
    - Deterministic proactive thread IDs (proactive:agentType:userId)
    - Feature flag gate before LangGraph invoke (use_langgraph profile check)
    - tierConfig Record for column/interval mapping per cadence tier
    - Backward compatibility via get_due_cadence_agents -> get_due_heartbeat_agents fallback
key_files:
  created:
    - worrylesssuperagent/supabase/functions/proactive-runner/index.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-dispatcher.test.ts
  modified:
    - worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts
    - worrylesssuperagent/langgraph-server/src/types/agent-state.ts
    - worrylesssuperagent/langgraph-server/src/agents/base-agent.ts
    - worrylesssuperagent/langgraph-server/src/index.ts
decisions:
  - "[Phase 16-02]: proactive-runner does NOT delete non-LangGraph user messages from queue — visibility timeout allows heartbeat-runner to pick them up (coexistence pattern)"
  - "[Phase 16-02]: isProactive guards both checkTokenBudget and incrementTokenUsage — prevents false budget-paused messages AND prevents budget consumption"
  - "[Phase 16-02]: HEARTBEAT_PROMPTS duplicated in Deno Edge Function — cannot cross-import Node.js modules from Deno; pragmatic duplication over complex build pipeline"
  - "[Phase 16-02]: Proactive thread ID is deterministic (proactive:agentType:userId) — persistent across runs for memory continuity and conversation threading"
  - "[Phase 16-02]: Daily timestamp advance remains in dispatcher; weekly/monthly/quarterly advanced by proactive-runner after processing — prevents Pitfall 6 (unadvanced columns)"
metrics:
  duration: ~10 min
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_modified: 6
---

# Phase 16 Plan 02: Proactive Runner + Multi-Tier Dispatcher + isProactive Bypass Summary

**One-liner:** Deno Edge Function calling LangGraph /invoke with tier-specific heartbeat prompts + isProactive flag bypassing token budget in createLLMNode.

## What Was Built

### Task 1: proactive-runner Edge Function

New `supabase/functions/proactive-runner/index.ts` (Deno Edge Function):

- Dequeues up to 5 messages from `heartbeat_jobs` pgmq queue with 30s visibility timeout
- Feature flag gate: checks `profiles.use_langgraph` — non-LangGraph users skipped (message left for heartbeat-runner to process after visibility timeout)
- `HEARTBEAT_PROMPTS` Record with tier-specific prompts for 6 agent types (accountant, marketer, sales_rep, chief_of_staff, personal_assistant, operations_manager) across 4 cadence tiers (daily/weekly/monthly/quarterly)
- Calls LangGraph `/invoke` with `is_proactive: true` and deterministic thread ID (`proactive:agentTypeId:userId`)
- Parses response using `extractJson` + `parseSeverity` from shared helpers
- Writes to `agent_heartbeat_log` and `notifications` for non-ok severities
- Advances `next_weekly/monthly/quarterly_heartbeat_at` after successful processing
- Deletes queue message only after successful processing; errors leave message for retry

### Task 2: heartbeat-dispatcher Multi-Tier Update

Updated `supabase/functions/heartbeat-dispatcher/index.ts`:

- Calls `get_due_cadence_agents` (new SQL function from 16-01 migration)
- Falls back to `get_due_heartbeat_agents` + `cadence_tier: "daily"` wrapper if migration not yet applied
- `tierConfig` Record mapping daily/weekly/monthly/quarterly to correct `next_*_heartbeat_at` columns and interval milliseconds
- Includes `cadence_tier: agent.cadence_tier` in every pgmq message
- Advances correct column per tier after successful enqueue
- Preserves SEC-02 comment and Deno.serve pattern

### Task 3: isProactive Token Budget Bypass + Cadence Dispatcher Tests (TDD)

**agent-state.ts:** Added `isProactive: Annotation<boolean>` with `default: () => false` after `goalChain` annotation.

**base-agent.ts:** Wrapped both governance hooks in `!state.isProactive` guards:
- `checkTokenBudget` guard prevents false "budget exhausted" messages during proactive runs
- `incrementTokenUsage` guard prevents proactive runs from consuming user chat token budgets (CAD-01/Pitfall 7)

**index.ts:** `/invoke` endpoint reads `is_proactive` from request body, passes `isProactive: is_proactive === true` to `graph.invoke` initial state.

**cadence-dispatcher.test.ts:** 20 unit tests covering:
- tierConfig mapping (daily/weekly/monthly/quarterly columns and intervals)
- Fallback behavior (undefined, empty string, unknown tier all resolve to daily)
- pgmq message shape (required fields, cadence_tier, event messages with event_type)
- Weekly agent due-date logic (past vs future timestamps)
- isProactive token budget bypass contract (is_proactive body field -> isProactive AgentState mapping)
- All 20 tests pass

## Deviations from Plan

None - plan executed exactly as written. The files were partially pre-created in a previous session; this execution completed the remaining gaps (isProactive passthrough in index.ts graph.invoke call) and verified all tests pass.

## Self-Check

- [x] proactive-runner/index.ts exists with LANGGRAPH_SERVER_URL check, use_langgraph gate, /invoke call, agent_heartbeat_log insert
- [x] heartbeat-dispatcher/index.ts updated with get_due_cadence_agents, cadence_tier in messages, tierConfig
- [x] agent-state.ts contains isProactive Annotation<boolean> with default false
- [x] base-agent.ts wraps both checkTokenBudget and incrementTokenUsage in !state.isProactive guards
- [x] index.ts reads is_proactive and passes isProactive to graph.invoke
- [x] cadence-dispatcher.test.ts exists with 20 passing tests
- [x] Commits: 016563d (proactive-runner), 071d627 (heartbeat-dispatcher), 4b23b64 (isProactive + tests)
