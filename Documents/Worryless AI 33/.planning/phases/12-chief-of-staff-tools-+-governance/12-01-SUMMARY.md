---
phase: 12
plan: 01
subsystem: governance
tags: [sql-migrations, typescript, langgraph, audit-log, token-budget, task-checkout, goal-chain]
dependency_graph:
  requires: []
  provides:
    - public.agent_audit_log table (immutable audit log, INSERT via service_role)
    - user_agents.monthly_token_budget + tokens_used_this_month + budget_reset_at + budget_override_until columns
    - agent_tasks.claimed_by + claimed_at + goal_chain columns
    - agent_tasks.agent_type migrated from ENUM to TEXT
    - GoalChainEntry interface exported from types/agent-state.ts
    - AgentState.goalChain last-write-wins channel
    - writeAuditLog (fire-and-forget, governance/audit-log.ts)
    - checkTokenBudget, incrementTokenUsage, resetMonthlyBudget (governance/token-budget.ts)
    - atomicCheckoutTask, releaseTask (governance/task-checkout.ts)
  affects:
    - All future agent graphs that import AgentState (goalChain field added)
    - All future plans using governance middleware (base-agent.ts Plan 12-02+)
tech_stack:
  added: []
  patterns:
    - pg.Pool singleton in governance modules (matches store.ts)
    - Fire-and-forget audit log writes (.catch(console.error) pattern)
    - Lazy monthly budget reset via budget_reset_at timestamp check
    - Atomic task checkout via UPDATE...WHERE claimed_by IS NULL RETURNING id
    - Last-write-wins AgentState channel for goal ancestry
key_files:
  created:
    - worrylesssuperagent/supabase/migrations/20260319000001_agent_audit_log.sql
    - worrylesssuperagent/supabase/migrations/20260319000002_governance_columns.sql
    - worrylesssuperagent/langgraph-server/src/governance/audit-log.ts
    - worrylesssuperagent/langgraph-server/src/governance/token-budget.ts
    - worrylesssuperagent/langgraph-server/src/governance/task-checkout.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/types/agent-state.ts
decisions:
  - "Fire-and-forget audit writes via .catch(console.error) — immutability is eventually consistent by design; blocking agent hot path for audit is unacceptable"
  - "Lazy monthly budget reset — checkTokenBudget auto-resets when budget_reset_at has passed; no pg_cron job needed"
  - "UPDATE...WHERE claimed_by IS NULL RETURNING id for atomic checkout — atomic under READ COMMITTED, simpler than advisory locks, works with PgBouncer"
  - "agent_audit_log has no authenticated INSERT/UPDATE/DELETE policies — immutability enforced by policy absence, service_role only writes"
  - "agent_tasks.agent_type migrated from public.agent_type ENUM to TEXT — supports all 13 v2 agent types without dropping old ENUM (deferred cleanup)"
  - "GoalChainEntry[] | null as last-write-wins (not accumulator) — each delegation replaces the full chain; subgraphs receive complete goal context"
metrics:
  duration: "9 minutes"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  completed_date: "2026-03-19"
---

# Phase 12 Plan 01: Governance Infrastructure Layer Summary

**One-liner:** Supabase migrations for immutable audit log + governance columns, plus typed PostgreSQL governance modules (audit log, token budget, atomic checkout) and GoalChainEntry ancestry chain in AgentState.

## What Was Built

### Task 1: Supabase Migrations (2 files)

**`20260319000001_agent_audit_log.sql`** — Creates `public.agent_audit_log` with:
- RLS enabled; authenticated users can SELECT their own rows only (`auth.uid() = user_id`)
- No INSERT/UPDATE/DELETE policies for authenticated role — service_role only writes (immutability by policy absence)
- Indexes: `idx_audit_log_user_agent` (user_id, agent_type_id, created_at DESC) + `idx_audit_log_thread` (partial, thread_id non-null)

**`20260319000002_governance_columns.sql`** — Three sections:
- Section A: Adds `monthly_token_budget`, `tokens_used_this_month`, `budget_reset_at`, `budget_override_until` to `public.user_agents`
- Section B: Adds `claimed_by`, `claimed_at`, `goal_chain` to `public.agent_tasks` + `idx_agent_tasks_claimable` partial index
- Section C: Migrates `agent_tasks.agent_type` from `public.agent_type` ENUM to `TEXT` for v2 13-agent support

### Task 2: TypeScript Governance Modules + AgentState (4 files)

**`src/governance/audit-log.ts`** — `writeAuditLog(entry: AuditLogEntry)`:
- INSERT into `public.agent_audit_log` via pg.Pool singleton
- Parameterized query with 9 params; toolCalls serialized as JSON
- JSDoc explicitly documents fire-and-forget pattern (`.catch(console.error)`)

**`src/governance/token-budget.ts`** — Three exports:
- `checkTokenBudget`: SELECT + lazy reset if past budget_reset_at; returns `BudgetStatus` with `paused`, `warned`, `usedPct`, `remaining`
- `incrementTokenUsage`: UPDATE tokens_used_this_month += tokens
- `resetMonthlyBudget`: Zero-out counter, set next month's reset date

**`src/governance/task-checkout.ts`** — Two exports:
- `atomicCheckoutTask(taskId, claimedBy)`: UPDATE WHERE `claimed_by IS NULL` AND `status IN ('pending', 'scheduled')` RETURNING id — returns true only if rowCount === 1
- `releaseTask(taskId, newStatus)`: Clear claimed_by/claimed_at, set final status, record last_run_at

**`src/types/agent-state.ts`** — Two additions:
- `GoalChainEntry` interface: `{ level: "mission"|"objective"|"project"|"task"; id?: string; description: string }`
- `goalChain: Annotation<GoalChainEntry[] | null>` channel with last-write-wins reducer

## Verification

```
$ cd worrylesssuperagent/langgraph-server && npx tsc --noEmit
(zero output = zero errors)
```

All 10 acceptance criteria passed. TypeScript compiles cleanly.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | ed4826d | feat(12-01): Supabase migrations for audit log table and governance columns |
| Task 2 | d4e0bd5 | feat(12-01): Governance TypeScript modules and AgentState goalChain field |

## Self-Check: PASSED

- [x] `worrylesssuperagent/supabase/migrations/20260319000001_agent_audit_log.sql` — exists
- [x] `worrylesssuperagent/supabase/migrations/20260319000002_governance_columns.sql` — exists
- [x] `worrylesssuperagent/langgraph-server/src/governance/audit-log.ts` — exists
- [x] `worrylesssuperagent/langgraph-server/src/governance/token-budget.ts` — exists
- [x] `worrylesssuperagent/langgraph-server/src/governance/task-checkout.ts` — exists
- [x] `worrylesssuperagent/langgraph-server/src/types/agent-state.ts` — GoalChainEntry + goalChain added
- [x] Commits ed4826d and d4e0bd5 verified in git log
- [x] `tsc --noEmit` — zero errors
