# Phase 12: Chief of Staff Tools + Governance - Research

**Researched:** 2026-03-19
**Domain:** LangGraph tool implementation, Supabase schema design, PostgreSQL governance patterns
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COS-01 | `compile_morning_briefing` tool aggregating heartbeat findings, overdue tasks, and calendar events | `agent_heartbeat_log` + `agent_tasks` schemas fully mapped; briefing card structure designed |
| COS-02 | `delegate_to_agent` tool routing work to specialists via LangGraph `Command` with goal ancestry context | `cosRouter` already does bare routing; need to add `goal_chain` to AgentState + Command update |
| COS-03 | `fan_out_to_agents` tool dispatching parallel work via `Send()` | Pattern already in `supervisor.ts`; tool wraps Send for programmatic dispatch from tool call |
| COS-04 | `query_cross_agent_memory` tool reading any agent's Store namespace for synthesis | `searchStore(prefix)` already exists in `store.ts`; tool wraps with wildcard-namespace pattern |
| COS-05 | `correlate_findings` tool detecting connections between concurrent heartbeat flags | LLM structured-output pattern (`callLLMWithStructuredOutput`) already established |
| COS-06 | `track_action_items` tool following up on items from previous briefings | Query `agent_tasks` where `agent_type_id = 'chief_of_staff'`; CoS owns these tasks |
| COS-07 | `assess_agent_health` tool checking heartbeat status and error rates | Query `user_agents` + `agent_heartbeat_log` tables; both fully mapped |
| GOV-01 | Immutable audit log table for all agent actions and tool calls | New Supabase migration: `public.agent_audit_log` with INSERT-only service_role pattern |
| GOV-02 | Monthly token budget per agent with 3-tier enforcement (80%/100%/override) | `user_agents` needs two new columns; enforcement middleware in LangGraph node pipeline |
| GOV-03 | Goal ancestry on tasks: mission to objective to project to task | `agent_tasks` needs `goal_chain JSONB` column; `AgentState` needs optional `goalChain` field |
| GOV-04 | Atomic task checkout preventing double-work | PostgreSQL `UPDATE ... RETURNING` with `claimed_by` + optimistic version; no advisory locks needed |
</phase_requirements>

---

## Summary

Phase 12 turns the Chief of Staff from a bare routing supervisor into a strategic orchestrator with real tools. The supervisor graph skeleton built in Phase 11 handles message routing but executes no domain logic — agents currently respond with placeholder LLM answers only. Phase 12 wires the CoS to real Supabase data (heartbeats, tasks, calendar) and adds the governance layer (audit log, token budgets, goal ancestry, atomic checkout) that all future agent phases depend on.

The codebase is well-prepared. `callLLMWithStructuredOutput`, `searchStore`, `putStore`, `callLLM`, and the `createBaseAgentGraph` factory pattern are all established. The seven CoS tools and four governance requirements are additive — they introduce new modules, new DB columns, and new Supabase migrations without modifying the Phase 11 graph topology.

The key integration challenge is the token budget enforcement placement. Budget checks must happen BEFORE the LLM call in `createLLMNode()` (inside `base-agent.ts`) and AFTER every tool execution, making `base-agent.ts` the single chokepoint for all governance. Goal ancestry (`goal_chain`) needs to be an optional field on `AgentState` so it flows through `Command.update` when the CoS delegates.

**Primary recommendation:** Deliver Phase 12 in two migration waves: (1) DB migrations for new columns + `agent_audit_log` table, then (2) tool implementations + governance middleware wired into the agent pipeline.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | `^1.2.3` | Graph execution, Command, Send | Phase 11 baseline |
| `@langchain/core` | `^1.1.33` | Message types, BaseMessage | Phase 11 baseline |
| `pg` | `^8.13.0` | Direct Supabase PostgreSQL queries for tools | Phase 10 baseline |
| `zod` | `^3.25.32` | Schema validation for tool inputs | Already in package.json |

### No New Dependencies Required

All tools in Phase 12 use existing dependencies. The CoS tools query Supabase via the existing `pg.Pool` pattern (same as `store.ts`). Token budget enforcement is pure in-process TypeScript logic. Audit log writes use the same pool.

Do NOT add: LangChain tool libraries (`@langchain/tools`), ORM libraries, or any new NPM packages. The project intentionally avoids LangChain tool abstractions (decision from Phase 11: direct fetch wrapper, not LangChain ChatModel).

---

## Architecture Patterns

### Recommended Project Structure for Phase 12

```
worrylesssuperagent/langgraph-server/src/
├── tools/
│   ├── rag-retrieval.ts          # EXISTS (Phase 11)
│   ├── cos/                      # NEW — Chief of Staff tools
│   │   ├── compile-morning-briefing.ts
│   │   ├── delegate-to-agent.ts
│   │   ├── fan-out-to-agents.ts
│   │   ├── query-cross-agent-memory.ts
│   │   ├── correlate-findings.ts
│   │   ├── track-action-items.ts
│   │   └── assess-agent-health.ts
│   └── index.ts                  # NEW — barrel export for all tools
├── governance/
│   ├── audit-log.ts              # NEW — write to agent_audit_log
│   ├── token-budget.ts           # NEW — check + enforce budgets
│   └── task-checkout.ts          # NEW — atomic task checkout
├── agents/
│   ├── base-agent.ts             # MODIFY — inject audit + budget middleware
│   └── chief-of-staff.ts        # NEW — CoS-specific agent with tool binding
└── types/
    └── agent-state.ts            # MODIFY — add goalChain field
supabase/migrations/
├── 20260319000001_agent_audit_log.sql      # NEW — GOV-01
└── 20260319000002_governance_columns.sql  # NEW — GOV-02, GOV-03, GOV-04
```

### Pattern 1: CoS Tool as Plain Async Function

CoS tools are NOT LangChain Tool objects. They are typed async functions that accept a `userId` parameter and return structured data. The CoS agent calls them explicitly in its LLM node based on the task. This matches the Phase 11 pattern where tools are called directly inside node functions.

```typescript
// tools/cos/compile-morning-briefing.ts
// Source: project pattern established in store.ts + base-agent.ts

import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 10 });
  return pool;
}

export interface BriefingSection {
  urgent: BriefingItem[];      // severity='error' or high-priority
  priorities: BriefingItem[];  // surfaced heartbeats, today's calendar
  fyi: BriefingItem[];         // informational items
}

export interface BriefingItem {
  source: "heartbeat" | "task" | "calendar";
  agentTypeId?: string;
  summary: string;
  urgency: "high" | "medium" | "low";
  actionable: boolean;
  metadata: Record<string, unknown>;
}

export async function compileMorningBriefing(userId: string): Promise<BriefingSection> {
  const db = getPool();

  // 1. Recent unsurfaced heartbeat findings (last 24h, non-ok outcomes)
  const heartbeats = await db.query(`
    SELECT agent_type_id, run_at, outcome, summary, task_created
    FROM public.agent_heartbeat_log
    WHERE user_id = $1
      AND run_at >= NOW() - INTERVAL '24 hours'
      AND outcome != 'ok'
    ORDER BY run_at DESC
    LIMIT 20
  `, [userId]);

  // 2. Overdue and due-today tasks
  const tasks = await db.query(`
    SELECT id, title, agent_type, status, next_run_at, task_config
    FROM public.agent_tasks
    WHERE user_id = $1
      AND status IN ('pending', 'scheduled')
      AND (next_run_at IS NULL OR next_run_at <= NOW() + INTERVAL '2 hours')
    ORDER BY next_run_at ASC NULLS FIRST
    LIMIT 15
  `, [userId]);

  // Build sections...
  // (full implementation in task)
}
```

**Key insight:** The `agent_tasks` table (not `tasks`) is the correct table. The V2 architecture references "tasks" generically but the actual table is `public.agent_tasks` per the Phase 1 migrations. Calendar events are not yet in DB — use `PA-05`/`list_calendar_events` only when PA agent is available (Phase 15); for Phase 12, calendar is omitted from the briefing or fetched via a placeholder.

### Pattern 2: Goal Ancestry in AgentState

Add `goalChain` as optional field in `AgentState`. Pass it through `Command.update` when CoS delegates.

```typescript
// types/agent-state.ts — ADD to AgentState Annotation.Root:

// Goal ancestry for context propagation (COS-02, GOV-03)
goalChain: Annotation<GoalChainEntry[] | null>({
  reducer: (_prev, next) => next,
  default: () => null,
}),
```

```typescript
// types/agent-state.ts — ADD interface:
export interface GoalChainEntry {
  level: "mission" | "objective" | "project" | "task";
  id?: string;
  description: string;
}
```

The `cosRouter` node already issues `Command({ goto: agentName, update: { agentType } })`. Phase 12 extends this to also `update: { agentType, goalChain }`. Subgraph agents inject `goalChain` into their system prompt via `base-agent.ts`.

### Pattern 3: Governance Middleware in base-agent.ts

The `createLLMNode()` function in `base-agent.ts` is the single insertion point for token budget enforcement and audit logging.

```typescript
// base-agent.ts — modified createLLMNode (illustrative):

async function createLLMNode(config: BaseAgentConfig) {
  return async (state: AgentState.State) => {
    // GOV-02: Check token budget BEFORE LLM call
    const budgetStatus = await checkTokenBudget(state.userId, config.agentType);
    if (budgetStatus.paused) {
      return { messages: [new AIMessage("Agent paused: monthly token budget exhausted. Awaiting override approval.")] };
    }
    if (budgetStatus.warned && !budgetStatus.warningSent) {
      // Surface warning (will be emitted as responseMetadata for UI)
    }

    const result = await callLLM(...);

    // GOV-01: Write audit log entry AFTER LLM call
    await writeAuditLog({
      userId: state.userId,
      agentTypeId: config.agentType,
      action: "llm_response",
      input: { messages: state.messages.length },
      output: { contentLength: result.content.length },
      tokensUsed: result.tokensUsed,
    });

    // GOV-02: Increment token usage counter
    await incrementTokenUsage(state.userId, config.agentType, result.tokensUsed);

    return { messages: [...], responseMetadata: { tokensUsed: result.tokensUsed } };
  };
}
```

### Pattern 4: Atomic Task Checkout (GOV-04)

Use optimistic locking with a `claimed_by` column. No PostgreSQL advisory locks needed — the `UPDATE ... WHERE claimed_by IS NULL RETURNING id` pattern is atomic under READ COMMITTED isolation (Supabase default).

```sql
-- In migration 20260319000002_governance_columns.sql:
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,        -- agent_type_id or 'heartbeat-runner'
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goal_chain JSONB DEFAULT NULL;

CREATE INDEX idx_agent_tasks_claimable
  ON public.agent_tasks (user_id, status, next_run_at)
  WHERE claimed_by IS NULL;
```

```typescript
// governance/task-checkout.ts
export async function atomicCheckoutTask(
  taskId: string,
  claimedBy: string
): Promise<boolean> {
  const db = getPool();
  const result = await db.query(`
    UPDATE public.agent_tasks
    SET claimed_by = $2, claimed_at = NOW(), status = 'running'
    WHERE id = $1
      AND claimed_by IS NULL
      AND status IN ('pending', 'scheduled')
    RETURNING id
  `, [taskId, claimedBy]);
  return result.rowCount === 1;
}
```

### Pattern 5: Immutable Audit Log (GOV-01)

New `public.agent_audit_log` table — INSERT ONLY via service_role, no UPDATE/DELETE RLS policies.

```sql
-- Migration 20260319000001_agent_audit_log.sql
CREATE TABLE public.agent_audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id  TEXT        NOT NULL,
  action         TEXT        NOT NULL,  -- 'llm_response', 'tool_call', 'delegation', 'briefing'
  input          JSONB       NOT NULL DEFAULT '{}',
  output         JSONB       NOT NULL DEFAULT '{}',
  tool_calls     JSONB       NOT NULL DEFAULT '[]',  -- [{name, input, output}]
  tokens_used    INTEGER     NOT NULL DEFAULT 0,
  goal_chain     JSONB,      -- snapshot of goal ancestry at time of action
  thread_id      TEXT,       -- LangGraph thread_id for correlation
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit log (for "explain why" UI feature)
CREATE POLICY "Users can read own audit log"
  ON public.agent_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for authenticated users — service_role only
-- (immutability enforced by absence of mutation policies)

CREATE INDEX idx_audit_log_user_agent
  ON public.agent_audit_log (user_id, agent_type_id, created_at DESC);

CREATE INDEX idx_audit_log_thread
  ON public.agent_audit_log (thread_id) WHERE thread_id IS NOT NULL;
```

### Pattern 6: Token Budget Enforcement (GOV-02)

Two new columns on `user_agents` + enforcement middleware.

```sql
-- Migration 20260319000002_governance_columns.sql (token budget section):
ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS monthly_token_budget   INTEGER DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS tokens_used_this_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_reset_at        TIMESTAMPTZ DEFAULT date_trunc('month', NOW() + INTERVAL '1 month'),
  ADD COLUMN IF NOT EXISTS budget_override_until  TIMESTAMPTZ;
```

```typescript
// governance/token-budget.ts
export type BudgetStatus = {
  paused: boolean;       // 100%+ used, no override
  warned: boolean;       // 80-99% used
  warningSent: boolean;  // prevent duplicate notifications
  usedPct: number;
};

export async function checkTokenBudget(
  userId: string,
  agentTypeId: string
): Promise<BudgetStatus> {
  const db = getPool();
  const { rows } = await db.query(`
    SELECT monthly_token_budget, tokens_used_this_month,
           budget_reset_at, budget_override_until
    FROM public.user_agents
    WHERE user_id = $1 AND agent_type_id = $2
  `, [userId, agentTypeId]);

  if (!rows[0]) return { paused: false, warned: false, warningSent: false, usedPct: 0 };

  const row = rows[0];
  // Auto-reset if past reset date
  if (new Date(row.budget_reset_at) < new Date()) {
    await resetMonthlyBudget(userId, agentTypeId);
    return { paused: false, warned: false, warningSent: false, usedPct: 0 };
  }

  const pct = row.monthly_token_budget > 0
    ? (row.tokens_used_this_month / row.monthly_token_budget) * 100
    : 0;
  const hasOverride = row.budget_override_until && new Date(row.budget_override_until) > new Date();

  return {
    paused: pct >= 100 && !hasOverride,
    warned: pct >= 80,
    warningSent: false,  // Phase 16 adds notification; Phase 12 just returns status
    usedPct: pct,
  };
}
```

### Pattern 7: Cross-Agent Memory Query (COS-04)

The `searchStore` function uses exact prefix matching. To query ALL agents' memory for a user, iterate known agent prefixes or use a SQL `LIKE` query directly on the store table.

```typescript
// tools/cos/query-cross-agent-memory.ts
import { AGENT_TYPES, type AgentTypeId } from "../../types/agent-types.js";
import { searchStore } from "../../persistence/store.js";

export interface CrossAgentMemoryResult {
  agentType: AgentTypeId;
  memories: Record<string, unknown>;
}

export async function queryCrossAgentMemory(
  userId: string,
  agentTypes?: AgentTypeId[]  // omit = all agents
): Promise<CrossAgentMemoryResult[]> {
  const targets = agentTypes ?? (Object.values(AGENT_TYPES).filter(t => t !== "chief_of_staff") as AgentTypeId[]);

  const results = await Promise.all(
    targets.map(async (agentType) => {
      const prefix = `${userId}:agent_memory:${agentType}`;
      const items = await searchStore(prefix);
      const memories: Record<string, unknown> = {};
      for (const item of items) memories[item.key] = item.value;
      return { agentType, memories };
    })
  );

  return results.filter(r => Object.keys(r.memories).length > 0);
}
```

### Pattern 8: Chief of Staff Agent as Extended Base Agent

Phase 11 gives us `createBaseAgentGraph`. The CoS agent needs to be different — it calls tools, not just LLM. For Phase 12, create a `createChiefOfStaffGraph` that replaces the generic `createBaseAgentGraph` factory for the CoS node in `supervisor.ts`. The graph adds a `cosTools` node between `readMemory` and `llmNode` for explicit tool execution.

```
CoS subgraph flow (Phase 12):
__start__ -> readMemory -> cosTools -> llmNode -> writeMemory -> respond

cosTools node:
  - Runs compile_morning_briefing if state signals morning briefing request
  - Runs assess_agent_health always (fast, read-only)
  - Injects tool results into system prompt for llmNode
```

This avoids tool-calling format complexity — the CoS tool execution is deterministic (triggered by request classification), not LLM-driven function calling. This matches the project's direct-fetch LLM pattern.

### Anti-Patterns to Avoid

- **Advisory locks for task checkout:** PostgreSQL advisory locks require session persistence. Supabase uses PgBouncer in transaction mode; sessions are not guaranteed to be the same. Use `UPDATE ... WHERE claimed_by IS NULL RETURNING id` instead.
- **LangChain Tool objects:** The project uses direct function calls, not LangChain `DynamicTool` or `StructuredTool`. Do not introduce `@langchain/tools`.
- **Storing audit log in LangGraph Store:** Audit log is a Supabase table (public schema, RLS), not a Store namespace. Store is for ephemeral cross-thread memory; audit log is a compliance record.
- **Querying `tasks` table:** There is no `public.tasks` table in this project. The correct table is `public.agent_tasks`. V2_ARCHITECTURE.md uses shorthand "tasks" but the migration files are definitive.
- **Calendar events in Phase 12 briefing:** No `calendar_events` table exists yet (PA Google Calendar integration is Phase 15). The briefing tool should gracefully omit calendar data when the PA agent is not integrated, or include a placeholder section.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency-safe task checkout | Custom semaphore/lock | `UPDATE ... WHERE claimed_by IS NULL RETURNING id` | PostgreSQL UPDATE is atomic at READ COMMITTED; no extra infrastructure |
| Token counting | Custom tokenizer | Use `tokensUsed` from `callLLM()` response | Already returned by Lovable AI Gateway's `usage.prompt_tokens + completion_tokens` |
| Audit serialization | Custom binary format | `JSONB` columns in Supabase | Queryable, indexable, zero overhead |
| Goal chain display | Custom tree renderer | JSONB array in DB + TypeScript interface | Keep simple for Phase 12; tree UI is Phase 17 |
| Multi-namespace Store search | Custom Store abstraction | Direct `pg.Pool` query with `LIKE` prefix on `langgraph.store` | `searchStore` already uses exact prefix; for cross-namespace just iterate prefixes |

**Key insight:** Token budgets and audit logs are governance primitives that will be hit on every agent invocation. They must be lightweight (single DB writes), not complex middleware stacks.

---

## Common Pitfalls

### Pitfall 1: Wrong Table Name for Tasks
**What goes wrong:** Code queries `public.tasks` or `tasks` (unqualified), gets "relation does not exist" at runtime.
**Why it happens:** V2_ARCHITECTURE.md and requirements use "tasks" generically; the actual table is `public.agent_tasks`.
**How to avoid:** Always use `public.agent_tasks` in all SQL. Add a comment in tool files referencing the migration source.
**Warning signs:** `Error: relation "tasks" does not exist` in Railway logs.

### Pitfall 2: Calendar Events Not Yet Available
**What goes wrong:** `compile_morning_briefing` tries to query calendar events from DB, finds no table.
**Why it happens:** Calendar is Google Calendar API via PA agent (Phase 15). No `calendar_events` table exists in Phase 12.
**How to avoid:** In the briefing tool, include a `calendar: []` placeholder section with a note. The tool should not fail if calendar data is absent.
**Warning signs:** Migration errors or null reference on calendar query.

### Pitfall 3: Budget Reset Logic Drift
**What goes wrong:** `tokens_used_this_month` counter never resets, eventually blocks all agents.
**Why it happens:** Resets are time-based (monthly) but there's no pg_cron reset job in Phase 12.
**How to avoid:** Check `budget_reset_at` on EVERY budget check and auto-reset if past. Do NOT rely on a separate cron for the reset — make it lazy/on-demand. Phase 16 can add a cleanup cron if needed.
**Warning signs:** All agents showing "paused" with high `tokens_used_this_month` even after a new month.

### Pitfall 4: Audit Log Blocking Agent Response
**What goes wrong:** Synchronous audit log write adds 50-200ms latency to every agent invocation.
**Why it happens:** Awaiting the INSERT in the hot path.
**How to avoid:** Fire audit writes with `.catch(console.error)` — don't await them in the critical path. Audit log is eventually consistent by design; losing an occasional entry on crash is acceptable.
**Warning signs:** Agent response times noticeably slower after audit log integration.

### Pitfall 5: GoalChain Lost at Subgraph Boundary
**What goes wrong:** CoS passes `goalChain` in `Command.update`, but subgraph's `AgentState` doesn't have the field, so it's silently dropped.
**Why it happens:** `AgentState` is shared but if a subgraph uses a different StateGraph annotation, the field may not exist.
**How to avoid:** Add `goalChain` to the shared `AgentState` annotation in `types/agent-state.ts` (single source of truth). All subgraphs inherit the same state shape.
**Warning signs:** `goalChain` is undefined in subgraph system prompt injection despite CoS sending it.

### Pitfall 6: Heartbeat Log Has No 'ok' Outcome
**What goes wrong:** Query for `outcome != 'ok'` returns ALL rows because the enum has no 'ok' value.
**Why it happens:** `heartbeat_outcome` enum is `('surfaced', 'error')` only — no 'ok' value. Suppressed ok runs are NOT written (per Phase 1 decision: HEARTBEAT_OK suppression).
**How to avoid:** Query `agent_heartbeat_log` without filtering by outcome, or query `WHERE outcome IN ('surfaced', 'error')`. Both are equivalent since all rows have one of these values.
**Warning signs:** `compile_morning_briefing` returns empty results because filter eliminated all rows.

---

## Code Examples

### Existing Pattern: Supabase Query via pg.Pool (store.ts)

```typescript
// Source: worrylesssuperagent/langgraph-server/src/persistence/store.ts
import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 10 });
  return pool;
}
// Pattern: module-level pool singleton, parameterized queries, typed rows
```

### Existing Pattern: LLM Structured Output (supervisor.ts)

```typescript
// Source: worrylesssuperagent/langgraph-server/src/graph/supervisor.ts
const { data } = await callLLMWithStructuredOutput<{ route: string; agents: string[]; reasoning: string }>(
  [new HumanMessage(content)],
  ROUTING_SCHEMA,  // JSON schema description string
  { systemPrompt: COS_ROUTER_PROMPT, temperature: 0.1 }
);
// Pattern: schema as string description, low temperature for determinism
```

### Existing Pattern: Agent State Channels (agent-state.ts)

```typescript
// Source: worrylesssuperagent/langgraph-server/src/types/agent-state.ts
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>({ reducer: (_prev, next) => next, default: () => "" }),
  // Accumulator channels use [...prev, ...next]
  uiComponents: Annotation<UIComponent[]>({ reducer: (prev, next) => [...prev, ...next], default: () => [] }),
  // Last-write-wins channels use (_prev, next) => next
  responseMetadata: Annotation<ResponseMetadata | null>({ reducer: (_prev, next) => next, default: () => null }),
});
// Pattern: goalChain should be last-write-wins (not accumulator)
```

### Existing Pattern: Command Routing with State Update (supervisor.ts)

```typescript
// Source: worrylesssuperagent/langgraph-server/src/graph/supervisor.ts
return new Command({
  goto: uniqueAgents[0],
  update: { agentType: uniqueAgents[0] as AgentTypeId },  // state fields to update
});
// Phase 12 extends this to: update: { agentType, goalChain }
```

### New Pattern: Briefing Correlation Tool

```typescript
// tools/cos/correlate-findings.ts
const CORRELATE_SCHEMA = `{
  "correlations": [
    {
      "agents": ["agent_type_id1", "agent_type_id2"],
      "connection": "one-sentence synthesis",
      "urgency": "high|medium|low",
      "recommendation": "one-sentence action"
    }
  ],
  "standalone_findings": ["agent_type_id"]
}`;

export async function correlateFindings(
  userId: string,
  findings: Array<{ agentTypeId: string; summary: string; outcome: string }>
): Promise<CorrelationResult> {
  if (findings.length < 2) {
    return { correlations: [], standalone_findings: findings.map(f => f.agentTypeId) };
  }

  const prompt = `Analyze these concurrent agent findings for the same business and identify any connections or patterns:\n\n${
    findings.map(f => `[${f.agentTypeId}]: ${f.summary}`).join("\n")
  }`;

  const { data } = await callLLMWithStructuredOutput<CorrelationResult>(
    [new HumanMessage(prompt)],
    CORRELATE_SCHEMA,
    { systemPrompt: "You are a strategic business analyst. Identify when agent findings are symptoms of the same root cause.", temperature: 0.3 }
  );

  return data;
}
```

---

## Existing Schema: What Phase 12 Tools Query

### `public.agent_heartbeat_log` — COS-01, COS-05, COS-07
```
id              UUID PK
user_id         UUID FK → auth.users
agent_type_id   TEXT FK → available_agent_types.id
run_at          TIMESTAMPTZ
outcome         heartbeat_outcome  -- ENUM: 'surfaced', 'error' (no 'ok' — suppressed runs not written)
summary         TEXT
task_created    BOOLEAN
notification_sent BOOLEAN
error_message   TEXT
INDEX: (user_id, agent_type_id, run_at DESC)
```

### `public.agent_tasks` — COS-01, COS-06, GOV-03, GOV-04
```
id                UUID PK
user_id           UUID FK → auth.users
agent_type        agent_type ENUM  -- 'accountant', 'marketer', 'sales_rep' (old v1 enum)
message           TEXT             -- task description/prompt
response          TEXT
status            task_status ENUM -- 'pending', 'scheduled', 'running', 'needs_approval', 'completed', 'failed'
title             TEXT
is_recurring      BOOLEAN
schedule_cron     TEXT
next_run_at       TIMESTAMPTZ
last_run_at       TIMESTAMPTZ
task_config       JSONB
validation_token  TEXT
validated_by      TEXT
-- Phase 12 adds:
claimed_by        TEXT             -- GOV-04: atomic checkout
claimed_at        TIMESTAMPTZ
goal_chain        JSONB            -- GOV-03: [{ level, id, description }]
```

**Note:** The `agent_type` column uses the OLD v1 enum (`'accountant', 'marketer', 'sales_rep'`). Phase 12 migration MUST either extend the enum or migrate this column to `TEXT` referencing `available_agent_types.id`. Recommend: `ALTER TABLE public.agent_tasks ALTER COLUMN agent_type TYPE TEXT USING agent_type::text;` to match the v2 pattern.

### `public.user_agents` — COS-07, GOV-02
```
id                           UUID PK
user_id                      UUID FK
agent_type_id                TEXT FK → available_agent_types.id
is_active                    BOOLEAN
heartbeat_interval_hours     INTEGER
heartbeat_active_hours_start TIME
heartbeat_active_hours_end   TIME
heartbeat_enabled            BOOLEAN
last_heartbeat_at            TIMESTAMPTZ
next_heartbeat_at            TIMESTAMPTZ
-- Phase 12 adds:
monthly_token_budget         INTEGER DEFAULT 100000
tokens_used_this_month       INTEGER DEFAULT 0
budget_reset_at              TIMESTAMPTZ
budget_override_until        TIMESTAMPTZ
```

### `langgraph.store` — COS-04
```
prefix   TEXT  -- e.g. "userId:agent_memory:marketer"
key      TEXT  -- memory key within namespace
value    JSONB
created_at / updated_at TIMESTAMPTZ
PK: (prefix, key)
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc --noEmit) — project uses compile-time validation as primary correctness check |
| Config file | `worrylesssuperagent/langgraph-server/tsconfig.json` |
| Quick run command | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| Full suite command | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |

No Jest/Vitest test suite exists in the project (Phase 11 completed with tsc as sole verification). Integration testing is manual via Railway deployment.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COS-01 | `compileMorningBriefing` returns BriefingSection with 3 sections | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-02 | `delegateToAgent` Command includes `goalChain` in update | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-03 | `fanOutToAgents` returns Send array for multiple targets | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-04 | `queryCrossAgentMemory` returns per-agent memory map | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-05 | `correlateFindings` calls LLM with structured output | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-06 | `trackActionItems` queries `agent_tasks` for CoS items | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| COS-07 | `assessAgentHealth` returns health grid from two tables | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| GOV-01 | `agent_audit_log` migration creates table with correct schema | SQL migration | Manual Supabase apply | ❌ Wave 0 |
| GOV-02 | `checkTokenBudget` returns paused=true when tokens_used >= budget | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| GOV-03 | `goal_chain` JSONB column on `agent_tasks` + `AgentState.goalChain` | tsc + migration | `npx tsc --noEmit` | ❌ Wave 0 |
| GOV-04 | `atomicCheckoutTask` UPDATE returns false when claimed_by is set | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **Per wave merge:** `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` (zero errors required)
- **Phase gate:** Zero tsc errors + manual smoke test of `/invoke` with morning briefing request

### Wave 0 Gaps
- [ ] `src/tools/cos/` directory — all 7 CoS tool files
- [ ] `src/governance/` directory — audit-log.ts, token-budget.ts, task-checkout.ts
- [ ] `supabase/migrations/20260319000001_agent_audit_log.sql`
- [ ] `supabase/migrations/20260319000002_governance_columns.sql`
- [ ] `AgentState.goalChain` field in `src/types/agent-state.ts`
- [ ] `src/agents/chief-of-staff.ts` — new CoS agent with tool binding

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic echo graph | Full supervisor with routing | Phase 11 | CoS now routes; Phase 12 adds tools |
| No agent tools | Tool functions as typed async functions | Phase 12 | First real data-reading tools |
| No governance | Audit log + token budgets + atomic checkout | Phase 12 | Governance layer for all future phases |
| agent_type ENUM (3 values) | TEXT FK to available_agent_types | v2.0 migration intent | Phase 12 migration should fix `agent_tasks.agent_type` column |

**Deprecated/outdated:**
- `agent_type ENUM ('accountant', 'marketer', 'sales_rep')`: This 3-value enum is from v1.0. Phase 12 should migrate `agent_tasks.agent_type` to `TEXT` to support all 13 v2 agent types.
- `createEchoGraph`: Removed in Phase 11. Not referenced anywhere.

---

## Open Questions

1. **Calendar events source for morning briefing**
   - What we know: PA agent provides Google Calendar via `list_calendar_events` (PA-05, Phase 15). No DB table for calendar events.
   - What's unclear: Should the CoS briefing include a calendar section that's empty in Phase 12, or skip it entirely?
   - Recommendation: Include an empty/placeholder `calendar` section in the `BriefingSection` type with a comment. The tool gracefully returns `calendar: []` when PA is not integrated. Phase 15 will fill this.

2. **agent_tasks.agent_type column migration**
   - What we know: Current column type is `public.agent_type` ENUM with only 3 values. v2 has 13 agent types.
   - What's unclear: Does the heartbeat system still write to `agent_tasks` using the old ENUM values, and will breaking that cause issues?
   - Recommendation: Migration should `ALTER TABLE public.agent_tasks ALTER COLUMN agent_type TYPE TEXT USING agent_type::text`. Old ENUM values are valid TEXT. Drop the old `public.agent_type` ENUM in a follow-up migration only after verifying no other tables use it.

3. **CoS tools: deterministic trigger vs LLM function calling**
   - What we know: The project does not use LangChain tool calling format. Tools are plain async functions.
   - What's unclear: Should the CoS LLM decide which tools to run (via structured output), or should tools run automatically based on request classification?
   - Recommendation: Use deterministic triggers for Phase 12. Morning briefing requests always run `compileMorningBriefing`. Assessment requests always run `assessAgentHealth`. Correlation runs when 3+ heartbeat items exist. This avoids complex tool-dispatch logic for Phase 12 and is a clean foundation for Phase 16 cadence.

---

## Sources

### Primary (HIGH confidence)
- `worrylesssuperagent/supabase/migrations/20260312000001_create_agent_tables.sql` — exact column names for `agent_heartbeat_log`, `user_agents`, `agent_workspaces`
- `worrylesssuperagent/supabase/migrations/20251204060048_*.sql` + `20251204062328_*.sql` — `agent_tasks` table full schema including `task_status` enum evolution
- `worrylesssuperagent/langgraph-server/src/graph/supervisor.ts` — current routing pattern, Command/Send usage
- `worrylesssuperagent/langgraph-server/src/types/agent-state.ts` — AgentState channels and reducer patterns
- `worrylesssuperagent/langgraph-server/src/persistence/store.ts` — pg.Pool singleton pattern, store query API
- `worrylesssuperagent/langgraph-server/src/agents/base-agent.ts` — governance injection point
- `worrylesssuperagent/langgraph-server/src/llm/client.ts` — `callLLM` + `callLLMWithStructuredOutput` APIs
- `.planning/V2_ARCHITECTURE.md` — Paperclip AI patterns, CoS tool definitions, token budget design

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` decisions section — confirmed `UPDATE...RETURNING` pattern preference, no PgBouncer advisory locks
- Phase 11 SUMMARYs (11-04, 11-05) — verified Command.PARENT constant, thread manager design, invoke-delegate pattern

### Tertiary (LOW confidence — unverified)
- PostgreSQL advisory lock limitations with PgBouncer transaction mode — stated in project decisions but not independently verified. Recommendation to use optimistic locking instead is LOW→HIGH after cross-referencing with the project's confirmed direct-connection (port 5432) pattern for the LangGraph server (which bypasses PgBouncer). Advisory locks would work but the `UPDATE...RETURNING` approach is simpler.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from existing source files
- Architecture: HIGH — tool structure derived from existing codebase patterns
- Database schema: HIGH — verified directly from migration SQL files
- Pitfalls: HIGH — sourced from actual migration files and established project decisions
- Token budget design: MEDIUM — pattern from V2_ARCHITECTURE.md + standard PostgreSQL pattern; exact column names confirmed from user_agents migration

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — Supabase + LangGraph versions locked)
