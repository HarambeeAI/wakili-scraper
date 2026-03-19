# Phase 16: Proactive Cadence Engine - Research

**Researched:** 2026-03-19
**Domain:** Supabase pg_cron + pgmq + LangGraph graph.invoke — scheduled proactive agent execution
**Confidence:** HIGH

## Summary

Phase 16 connects the existing heartbeat scheduling infrastructure (pg_cron dispatcher, pgmq queue, heartbeat-runner Edge Function) to the new LangGraph agent graphs built in Phases 10-15. The core shift: the current `heartbeat-runner` makes a single LLM call against a workspace prompt. Phase 16 replaces that with a full `graph.invoke()` call against the compiled supervisor graph (or a direct agent subgraph), running the role-specific heartbeat checklist toolchain and writing findings as a chat message into the user's Chief of Staff thread.

The infrastructure already exists end-to-end. What Phase 16 builds is: (1) a new `cadence_config` JSONB column on `user_agents` that controls per-agent cadence (daily/weekly/monthly/quarterly), (2) a `proactive-runner` Edge Function that dequeues heartbeat jobs and invokes the LangGraph server at `/invoke` with a synthetic heartbeat prompt, (3) per-agent heartbeat checklist prompts that trigger the right tools deterministically, (4) an event-trigger dispatcher that detects database changes (overdue invoices, viral posts, stale deals) and enqueues immediate jobs, and (5) an updated cadence dispatcher SQL function that respects the new cadence tiers.

The critical insight is that the LangGraph server already has `/invoke` wired with checkpointing, tool nodes, and memory. The proactive runner is just another caller of that endpoint — it passes a synthetic user message ("Run your daily heartbeat checklist") and a persistent thread ID per agent per user, and the graph's existing tool dispatch infrastructure handles the rest. Findings are stored as checkpointed messages in the LangGraph thread, and a separate step writes them to `agent_heartbeat_log` and `notifications` for the morning digest.

**Primary recommendation:** Build a new `proactive-runner` Edge Function that calls the LangGraph `/invoke` endpoint with heartbeat prompts. Extend the existing cadence dispatcher to support multi-tier cadences via `cadence_config` JSONB. Wire event-trigger detection as a separate SQL function + pgmq enqueue path. The morning briefing delivery stays in `send-morning-digest` but is upgraded to pull from LangGraph thread messages rather than plain heartbeat log text.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAD-01 | Cadence dispatcher using pg_cron + pgmq triggering full LangGraph execution | Existing heartbeat-dispatcher enqueues to pgmq; proactive-runner replaces heartbeat-runner with graph.invoke() call to LangGraph server /invoke endpoint |
| CAD-02 | Role-specific heartbeat checklists per agent | Each agent already has a deterministic tool dispatch node (accountantTools, marketerTools, salesTools). Heartbeat prompts activate the right regex branches without new tool code |
| CAD-03 | Daily cadence: morning briefing, inbox triage, cashflow, pipeline, content queue | Triggered by existing heartbeat interval infrastructure; proactive-runner invokes each agent's graph with daily checklist prompt; CoS graph already has compileMorningBriefing |
| CAD-04 | Weekly cadence: cross-team summary, content performance, pipeline progression, expenses | New cadence_config tier; proactive-runner checks cadence tier from job message; different heartbeat prompt per tier |
| CAD-05 | Monthly cadence: P&L, conversion analysis, marketing review, KPI dashboard | Same mechanism as CAD-04; generatePLReport, analyzePipeline, analyzePostPerformance already exist |
| CAD-06 | Quarterly cadence: business review, strategic assessment, financial review, compliance | Same mechanism; CoS compileMorningBriefing + Accountant P&L + Legal regulatory monitoring tools already exist |
| CAD-07 | Event-triggered proactive actions (viral post, stale deal, overdue invoice, etc.) | New event-detector SQL function polls for threshold events; enqueues pgmq jobs with cadence_tier=event; proactive-runner handles immediately |
| CAD-08 | Per-agent cadence config in user_agents.cadence_config JSONB — users can adjust frequency | New DB migration adding cadence_config column with default JSONB; dispatcher reads it to decide cadence tier |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | 1.2.3 (already installed) | Full graph.invoke() for proactive agent runs | Already in use; provides checkpointed execution with memory + tools |
| `@supabase/supabase-js` | 2.86.0 (already installed) | Edge Function Supabase client | Already in use in heartbeat-dispatcher and heartbeat-runner |
| `pg` (pg Pool) | 8.13.0 (already installed) | Direct Postgres queries from LangGraph server | Already in use in tools/shared/db.ts and cos tools |
| Supabase `pg_cron` | via Supabase extension | Cron scheduling | Already provisioned and used by heartbeat-dispatcher (migration 00007) |
| Supabase `pgmq` | via Supabase extension | Reliable message queue | Already provisioned; `pgmq_public.send` and `pgmq_public.read` RPC confirmed working |
| `pg_net` | via Supabase extension | Async HTTP from pg_cron | Already provisioned (used in existing cron migrations) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Vault | built-in | `service_role_key`, `project_url`, `langgraph_server_url` secrets | Proactive-runner needs LANGGRAPH_SERVER_URL same as langgraph-proxy |
| Supabase `pg_cron` event detector | SQL function | Poll for event triggers on a cron schedule | CAD-07 event detection runs every 5 minutes same as dispatcher |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Invoking LangGraph via HTTP from Edge Function | Calling graph.invoke() directly in Edge Function | LangGraph server is on Railway (Node.js), not in Deno Edge Functions. Must use HTTP. |
| New queue for proactive jobs | Reuse `heartbeat_jobs` queue | Can reuse the same queue; add `cadence_tier` field to message payload to distinguish daily/weekly/monthly/event |
| pg_cron per-user schedules | Single dispatcher cron | 1 dispatcher cron per tier (5 crons total) is manageable and proven; per-user crons do not scale |

**Installation:** No new packages needed. All libraries already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
supabase/
  functions/
    proactive-runner/        # Replaces heartbeat-runner for LangGraph path
      index.ts               # Dequeues jobs, calls LangGraph /invoke
  migrations/
    20260320000002_cadence_config.sql   # cadence_config JSONB column + updated dispatcher fn
    20260320000003_event_detector.sql   # event-triggered heartbeat SQL function + cron

langgraph-server/src/
  cadence/
    heartbeat-prompts.ts     # Per-agent, per-tier prompt strings (daily/weekly/monthly/quarterly)
    event-detector.ts        # (optional) server-side helper for event thresholds
```

### Pattern 1: Proactive Runner — Edge Function calling LangGraph /invoke

The `proactive-runner` Edge Function is the heart of Phase 16. It dequeues from `heartbeat_jobs`, constructs a synthetic HumanMessage, and POST-es to the LangGraph server's `/invoke` endpoint. The proactive thread ID is deterministic: `proactive:{agentType}:{userId}` — this ensures continuity across runs so the agent has memory context of prior heartbeat findings.

```typescript
// proactive-runner/index.ts (sketch)
// Source: langgraph-server/src/index.ts /invoke endpoint + heartbeat-runner pattern

const msg = dequeued.message as { user_id: string; agent_type_id: string; cadence_tier: string };

const heartbeatPrompt = HEARTBEAT_PROMPTS[msg.agent_type_id]?.[msg.cadence_tier]
  ?? HEARTBEAT_PROMPTS[msg.agent_type_id]?.['daily']
  ?? `Run your daily heartbeat checklist. Surface only actionable findings.`;

const threadId = `proactive:${msg.agent_type_id}:${msg.user_id}`;

const response = await fetch(`${LANGGRAPH_SERVER_URL}/invoke`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: heartbeatPrompt,
    user_id: msg.user_id,
    thread_id: threadId,
    agent_type: msg.agent_type_id,
  }),
});
```

**Key nuance:** The `/invoke` endpoint in `index.ts` requires `user_id` and `message` — same as a regular chat. The proactive runner is an internal caller (no JWT). Since the LangGraph server trusts `user_id` injected by callers (confirmed from langgraph-proxy: JWT validation happens at proxy boundary, server is auth-free), the proactive runner can call directly with the service-role API key check not required on the LangGraph side.

**Thread ID strategy:** `proactive:{agentType}:{userId}` is a deterministic thread that persists across cron runs. This means the agent accumulates heartbeat context in its LangGraph Store namespace across runs — which is exactly what MEM-01..MEM-06 provide. The agent "remembers" what it found last time and can note trends.

### Pattern 2: Per-Agent Heartbeat Prompts

Each agent's tool dispatch nodes are triggered by regex classification of the incoming message. The heartbeat prompt must use keywords that activate the right branches without requiring user-specific parameters.

```typescript
// cadence/heartbeat-prompts.ts
export const HEARTBEAT_PROMPTS: Record<string, Record<string, string>> = {
  accountant: {
    daily: "Run daily cashflow check: list overdue invoices, check cashflow projection, detect any anomalous transactions since yesterday. Flag anything that requires immediate attention.",
    weekly: "Weekly financial review: generate this week's cashflow summary, check budget vs actual for the month, list all open invoices aged over 30 days, flag any runway concerns.",
    monthly: "Monthly P&L review: generate full P&L report with MoM comparison, calculate tax estimate for the quarter, analyze all transactions for anomalies, provide cashflow projection for next 90 days.",
    quarterly: "Quarterly financial review: complete P&L analysis, tax liability assessment, runway forecast, budget variance analysis. Identify top 3 financial risks and opportunities.",
  },
  marketer: {
    daily: "Daily content check: review scheduled content queue for the next 3 days, fetch latest post analytics, flag any posts performing significantly above or below average.",
    weekly: "Weekly marketing review: analyze post performance for the past 7 days, check content calendar coverage, identify top and bottom performing content, suggest next week's content themes.",
    monthly: "Monthly marketing review: analyze content performance trends over 30 days, review brand mentions from the past month, assess content library for gaps, recommend strategic adjustments.",
    quarterly: "Quarterly marketing review: full performance analysis, competitor landscape check, content strategy assessment, ROI review.",
  },
  sales_rep: {
    daily: "Daily pipeline check: detect stale deals (no activity in 3+ days), review email engagement on recent outreach, flag any deals that need follow-up today.",
    weekly: "Weekly pipeline review: full pipeline analysis with conversion rates, revenue forecast update, list of deals by stage, identify top 3 deals to prioritize this week.",
    monthly: "Monthly sales review: pipeline velocity analysis, revenue forecast vs target, win/loss analysis, lead generation performance, identify pipeline gaps.",
    quarterly: "Quarterly sales review: full pipeline analysis, revenue forecast, conversion rate trends, top deals and at-risk accounts, strategic recommendations.",
  },
  // Chief of Staff daily prompt for morning briefing delivery
  chief_of_staff: {
    daily: "Compile the morning briefing: aggregate all agent heartbeat findings from the past 24 hours, check team health, list action items, correlate any cross-agent findings. Deliver a concise executive summary.",
    weekly: "Weekly team summary: cross-agent performance synthesis, action item status, strategic highlights from the week.",
    monthly: "Monthly business review: compile cross-functional insights, KPI trends, strategic priorities for next month.",
    quarterly: "Quarterly business review: comprehensive cross-agent analysis, strategic assessment, OKR progress.",
  },
  // ... personal_assistant, coo agents with equivalent prompts
};
```

**Why this works:** The accountant daily prompt contains keywords like "cashflow" (triggers `isCashflowQuery`), "overdue invoices" (triggers `isInvoiceQuery` + `isChaseInvoice`), "anomalous transactions" (triggers `isAnomalyQuery`). No new tool code needed — the existing classification regex handles it.

### Pattern 3: cadence_config JSONB Schema

```sql
-- Default cadence config stored in user_agents.cadence_config
-- Users can update per-agent settings via UI (Phase 17+)
{
  "daily_enabled": true,
  "weekly_enabled": true,
  "monthly_enabled": true,
  "quarterly_enabled": false,
  "active_hours_start": "08:00",
  "active_hours_end": "20:00",
  "timezone": "America/New_York"   -- overrides profiles.timezone if set
}
```

The existing `heartbeat_interval_hours`, `heartbeat_active_hours_start`, `heartbeat_active_hours_end` columns handle the daily cadence naturally (dispatcher already respects `next_heartbeat_at`). The `cadence_config` column only needs to add the weekly/monthly/quarterly tier flags plus event-trigger preferences.

### Pattern 4: Multi-Tier Cadence Dispatcher

Rather than a single 5-minute dispatcher cron, Phase 16 uses the SAME dispatcher function but reads `cadence_config` to determine which tier of job to enqueue. The pgmq message gets a `cadence_tier` field:

```sql
-- Updated get_due_heartbeat_agents() — add cadence_tier to output
-- For daily: same logic as today (next_heartbeat_at <= now())
-- For weekly: add column next_weekly_heartbeat_at
-- For monthly: add column next_monthly_heartbeat_at
-- For quarterly: add column next_quarterly_heartbeat_at
```

The simplest approach: add `next_weekly_heartbeat_at`, `next_monthly_heartbeat_at`, `next_quarterly_heartbeat_at` columns to `user_agents`. The dispatcher checks all 4 columns in one query and emits jobs with `cadence_tier` in the pgmq message. This mirrors how `next_heartbeat_at` works for daily.

### Pattern 5: Event-Triggered Detection

Event triggers fire immediately when a threshold is crossed, not on a schedule. The pattern: a SQL function `check_event_triggers()` runs every 5 minutes (same as dispatcher) and enqueues pgmq jobs with `cadence_tier: 'event'` and an `event_type` field.

```sql
-- Event detection queries (examples):
-- Viral post: social_posts WHERE engagement_rate > 3x average AND published_at > NOW() - INTERVAL '1 hour'
-- Overdue invoice: invoices WHERE status = 'sent' AND due_date < NOW() AND last_notified_at < NOW() - INTERVAL '4 hours'
-- Stale deal: leads WHERE status NOT IN ('closed_won','closed_lost') AND updated_at < NOW() - INTERVAL '3 days'
```

The proactive runner checks `cadence_tier === 'event'` and uses the `event_type` to select a targeted prompt rather than the full checklist.

### Anti-Patterns to Avoid

- **Double-enqueuing:** The existing dispatcher advances `next_heartbeat_at` immediately upon successful enqueue. Weekly/monthly columns must be advanced the same way — not after processing.
- **Using the existing heartbeat-runner for LangGraph:** The old heartbeat-runner calls the Lovable AI Gateway directly with a workspace prompt. Keep that function for users without `use_langgraph = true`. The new `proactive-runner` handles the LangGraph path. Gate on the feature flag.
- **Blocking on LangGraph invoke:** LangGraph graph.invoke() can take 10-30 seconds with tool calls. The Edge Function must process one message per invocation (not batch) or use generous timeouts. The existing heartbeat-runner already processes up to 5 messages with 30s visibility timeout — match this pattern.
- **Storing findings only in LangGraph thread:** Write findings back to `agent_heartbeat_log` after the LangGraph call completes. This lets the existing `send-morning-digest` and `compileMorningBriefing` (COS-01) continue to work — they read from `agent_heartbeat_log`.
- **Event triggers firing every 5 minutes on the same event:** Track `last_event_notified_at` per event type per user to enforce cooldowns. Store in `user_agents.cadence_config` or a separate column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduling | Custom timer/setTimeout | pg_cron already provisioned | pg_cron is DST-safe, survives crashes, already proven |
| Message reliability | Raw DB polling | pgmq already provisioned | pgmq visibility timeout prevents double-processing; proven in existing heartbeat-runner |
| Agent tool execution in heartbeat | New tool calling pattern | Existing agentXTools node via /invoke | All 13 agents already have deterministic tool dispatch nodes |
| Morning briefing | New briefing generator | `compileMorningBriefing()` (COS-01) already exists | Already aggregates heartbeat log + tasks + calendar placeholder |
| Timezone-aware scheduling | Manual UTC math | `AT TIME ZONE` in `get_due_heartbeat_agents()` already handles DST | Proven in migration 00008 |
| Thread persistence for proactive runs | New storage | PostgresSaver + LangGraph Store already wired | Proactive thread = deterministic thread_id; same checkpointing as user chats |

**Key insight:** The hardest parts (scheduling, queuing, tool execution, memory, checkpointing) are all already built. Phase 16 is orchestration glue — connecting the scheduler to the graph runner with the right prompts.

---

## Common Pitfalls

### Pitfall 1: Calling /invoke Without LANGGRAPH_SERVER_URL in Edge Function
**What goes wrong:** The proactive-runner calls the LangGraph server but the URL env var is missing — silent failure, no proactive runs happen.
**Why it happens:** LANGGRAPH_SERVER_URL is set in `langgraph-proxy` but must also be set in `proactive-runner`.
**How to avoid:** Read `LANGGRAPH_SERVER_URL` from environment at function startup and throw early if missing. Add to the Supabase secrets alongside the existing secrets.
**Warning signs:** Function returns 200 but `processed=0` with "LANGGRAPH_SERVER_URL not configured" in logs.

### Pitfall 2: Proactive Thread Overwriting User Chat History
**What goes wrong:** The proactive thread ID collides with a user-initiated thread, causing the user's conversation to be interrupted with heartbeat messages.
**Why it happens:** If the proactive thread ID matches a user thread ID, the checkpoint is shared.
**How to avoid:** Prefix with `proactive:` — e.g. `proactive:accountant:user-uuid`. User threads use the format from `createThreadId()` in `threads/manager.ts`. Check that format to ensure no collision.
**Warning signs:** User opens agent chat and sees heartbeat messages in their conversation.

### Pitfall 3: Heartbeat Findings Not Written Back to agent_heartbeat_log
**What goes wrong:** LangGraph graph.invoke() succeeds but findings are not persisted to `agent_heartbeat_log`, breaking `compileMorningBriefing` (COS-01) and `send-morning-digest`.
**Why it happens:** The LangGraph run produces a response in the thread but the proactive-runner must explicitly parse the response and INSERT into `agent_heartbeat_log`.
**How to avoid:** After /invoke returns, the proactive-runner parses the LLM response for severity (reuse `parseSeverity` + `extractJson` from the existing heartbeat shared helpers) and writes to `agent_heartbeat_log`. This mirrors exactly what heartbeat-runner does today.
**Warning signs:** Morning briefing is empty even though agents ran.

### Pitfall 4: Event-Trigger Storms (Same Event Fires Repeatedly)
**What goes wrong:** An overdue invoice triggers an alert every 5 minutes indefinitely.
**Why it happens:** Event detector has no cooldown — it re-enqueues on every run.
**How to avoid:** Track `last_event_notified_at` per (user_id, agent_type_id, event_type). Only enqueue if `last_event_notified_at < NOW() - INTERVAL '4 hours'` (or configurable cooldown in cadence_config).
**Warning signs:** User receives dozens of "overdue invoice" notifications in a single day.

### Pitfall 5: HITL Interrupt Hanging the Proactive Thread
**What goes wrong:** A heartbeat checklist triggers a HITL-required action (e.g. `chaseOverdueInvoice` which calls `interruptForApproval`). The proactive runner hangs waiting for a resume that never comes.
**Why it happens:** The heartbeat prompts must not ask agents to PERFORM actions that require HITL — only to SURFACE findings.
**How to avoid:** Heartbeat prompts explicitly say "surface findings and flag for my review" not "chase the invoice". Verify the accountant daily prompt does NOT include "chase invoice" or "send reminder" language. The tool dispatch regex for `isChaseInvoice` must not fire from the heartbeat prompt.
**Warning signs:** proactive-runner times out on accountant runs; thread stuck in `interrupted` state.

### Pitfall 6: Weekly/Monthly Columns Not Advanced After Enqueue
**What goes wrong:** Weekly heartbeat fires every 5 minutes because `next_weekly_heartbeat_at` is never advanced.
**Why it happens:** The dispatcher advances `next_heartbeat_at` for daily, but if the code for weekly/monthly doesn't advance those columns, they stay in the past.
**How to avoid:** The dispatcher UPDATE must set ALL relevant next-run columns atomically after successful enqueue.
**Warning signs:** Weekly jobs flood the pgmq queue within minutes.

### Pitfall 7: Proactive Run Counts Against Token Budget for User Chats
**What goes wrong:** Scheduled heartbeat runs consume the monthly token budget, blocking the user from chatting with their agents.
**Why it happens:** `checkTokenBudget` and `incrementTokenUsage` run in `createLLMNode` for every invocation including proactive ones.
**How to avoid:** Heartbeat runs should use a separate budget allocation OR the token budget check should distinguish proactive vs. user-initiated calls. Simplest: proactive runs do NOT count against the user's token budget — they use a system allocation. Pass a flag in the agent state or use a separate budget_type. ALTERNATIVELY: proactive prompts are designed to be short responses, keeping token usage minimal.
**Warning signs:** Users report budget paused messages appearing after nightly heartbeat runs.

---

## Code Examples

Verified patterns from existing codebase:

### pgmq Enqueue (from heartbeat-dispatcher/index.ts)
```typescript
// Source: supabase/functions/heartbeat-dispatcher/index.ts
const { error: sendError } = await supabaseAdmin
  .schema("pgmq_public")
  .rpc("send", {
    queue_name: "heartbeat_jobs",
    message: {
      user_agent_id: agent.id,
      user_id: agent.user_id,
      agent_type_id: agent.agent_type_id,
      cadence_tier: "daily",  // NEW: add cadence_tier to existing message shape
    },
    sleep_seconds: 0,
  });
```

### pgmq Dequeue (from heartbeat-runner/index.ts)
```typescript
// Source: supabase/functions/heartbeat-runner/index.ts
const { data: messages, error: dequeueError } = await supabaseAdmin
  .schema("pgmq_public")
  .rpc("read", { queue_name: "heartbeat_jobs", sleep_seconds: 30, n: 5 });
// Delete after successful processing:
await supabaseAdmin.schema("pgmq_public")
  .rpc("delete", { queue_name: "heartbeat_jobs", msg_id: msg.msg_id });
```

### LangGraph /invoke Call (from langgraph-proxy/index.ts pattern)
```typescript
// Source: supabase/functions/langgraph-proxy/index.ts (forwarding pattern)
const response = await fetch(`${LANGGRAPH_SERVER_URL}/invoke`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: heartbeatPrompt,
    user_id: userId,
    thread_id: `proactive:${agentTypeId}:${userId}`,
    agent_type: agentTypeId,
  }),
});
const result = await response.json();
// result.response = last LLM message content
```

### Heartbeat Log Write (from heartbeat-runner/index.ts)
```typescript
// Source: supabase/functions/heartbeat-runner/index.ts (lines 177-194)
await supabaseAdmin.from("agent_heartbeat_log").insert({
  user_id: userId,
  agent_type_id: agentTypeId,
  run_at: new Date().toISOString(),
  outcome: "surfaced",
  summary: finding,
  severity: severity,
  notification_sent: severity === "urgent" || severity === "headsup",
  task_created: false,
});
```

### cadence_config Default JSONB (new migration pattern)
```sql
-- Source: consistent with user_agents schema in 20260312000001_create_agent_tables.sql
ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS cadence_config JSONB NOT NULL DEFAULT '{
    "daily_enabled": true,
    "weekly_enabled": true,
    "monthly_enabled": false,
    "quarterly_enabled": false,
    "event_triggers_enabled": true,
    "event_cooldown_hours": 4
  }'::jsonb;

ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS next_weekly_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_monthly_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_quarterly_heartbeat_at TIMESTAMPTZ;
```

### Deterministic Proactive Thread ID (consistent with threads/manager.ts)
```typescript
// Source: consistent with langgraph-server/src/threads/manager.ts createThreadId pattern
// Proactive threads use "proactive:" prefix to avoid collision with user chat threads
// User chat threads use format: `thread:{userId}:{agentType}:{timestamp}`
// Proactive threads use: `proactive:{agentType}:{userId}` (no timestamp — persistent across runs)
const proactiveThreadId = `proactive:${agentTypeId}:${userId}`;
```

### Feature Flag Gate for LangGraph Path
```typescript
// Source: consistent with profiles.use_langgraph feature flag pattern (Phase 10 decision)
// Only route to proactive-runner if use_langgraph = true for the user
const { data: profile } = await supabaseAdmin
  .from("profiles").select("use_langgraph").eq("user_id", userId).single();

if (!profile?.use_langgraph) {
  // Fall through to existing heartbeat-runner logic (workspace prompt path)
  return;
}
// Proceed with LangGraph /invoke
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single LLM call against workspace HEARTBEAT.md prompt | Full LangGraph graph.invoke() with tool nodes | Phase 16 | Agent runs actual tools (listInvoices, detectStaleDeals, fetchAnalytics) not just text reasoning |
| heartbeat-runner writes plain text summary | proactive-runner writes LangGraph thread message + heartbeat log row | Phase 16 | Findings have tool-backed evidence, stored in checkpointed thread for memory continuity |
| Fixed 4-hour interval for all agents | Multi-tier cadence (daily/weekly/monthly/quarterly/event) controlled per-agent via cadence_config | Phase 16 | Accountant runs monthly P&L monthly, not every 4 hours; Sales Rep runs pipeline daily |
| Morning briefing is a plain text compilation from heartbeat log | Morning briefing delivered as CoS chat message in user's Chief of Staff thread | Phase 16 | User wakes up to a message in their AI chat, not just a notification badge |
| No event-triggered proactive actions | SQL-polled event detector enqueues immediate jobs for threshold events | Phase 16 | Overdue invoice → immediate accountant alert; viral post → marketer notification |

**Deprecated/outdated:**
- Old `heartbeat-runner` workspace prompt approach: Still valid for non-LangGraph users (`use_langgraph = false`) but superceded by `proactive-runner` for LangGraph users
- `send-morning-digest` plain text notification: Still used but upgraded to also insert the CoS morning briefing as a LangGraph thread message for `use_langgraph = true` users

---

## Open Questions

1. **Token budget for proactive runs**
   - What we know: `createLLMNode` always checks `checkTokenBudget` — proactive runs will consume the user's budget
   - What's unclear: Should heartbeat runs use a separate system budget, or count against user budget?
   - Recommendation: For v2.0, proactive prompts are SHORT (designed to produce brief summaries) so consumption is minimal. Add a `isProactiveRun` flag to AgentState and skip budget check for proactive runs, OR add a separate `heartbeat_monthly_budget` column. Simplest path: skip budget increment for proactive runs via a flag in the state.

2. **Morning briefing delivery channel**
   - What we know: `send-morning-digest` currently writes to `notifications` table. The CoS chat thread is the "right" destination per success criteria.
   - What's unclear: Phase 17 builds the generative UI chat interface. In Phase 16, the CoS thread message exists in the PostgresSaver checkpoint but users may not have a UI to see it yet.
   - Recommendation: Write the morning briefing BOTH to `agent_heartbeat_log` (for `compileMorningBriefing`) AND as a LangGraph thread message. The `send-morning-digest` notification (in-app notification badge) continues to work as-is. Phase 17 will surface the CoS thread natively.

3. **pgmq queue reuse vs. new queue**
   - What we know: `heartbeat_jobs` queue exists and is working. Adding `cadence_tier` to the message payload is backward-compatible.
   - What's unclear: Mixing daily/weekly/monthly/event messages in the same queue — a slow monthly job doesn't block daily jobs.
   - Recommendation: Reuse `heartbeat_jobs`. The proactive-runner processes one message at a time; cadence tier is just metadata that selects the prompt. No ordering guarantee is needed across tiers.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/langgraph-server/vitest.config.ts` (for server-side tests) |
| Quick run command | `cd worrylesssuperagent/langgraph-server && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent/langgraph-server && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAD-01 | Dispatcher enqueues correct cadence_tier for daily/weekly/monthly agents | unit | `npx vitest run src/cadence/cadence-dispatcher.test.ts` | ❌ Wave 0 |
| CAD-02 | Heartbeat prompts trigger correct tool classification regex per agent | unit | `npx vitest run src/cadence/heartbeat-prompts.test.ts` | ❌ Wave 0 |
| CAD-03 | Daily heartbeat prompt activates cashflow + invoice + anomaly classification in accountant | unit | `npx vitest run src/cadence/heartbeat-prompts.test.ts` | ❌ Wave 0 |
| CAD-04 | Weekly heartbeat prompt activates PLReport + pipeline analysis classification | unit | `npx vitest run src/cadence/heartbeat-prompts.test.ts` | ❌ Wave 0 |
| CAD-07 | Event-trigger message shape has cadence_tier='event' + event_type field | unit | `npx vitest run src/cadence/event-detector.test.ts` | ❌ Wave 0 |
| CAD-08 | cadence_config default JSONB has correct keys and types | unit | `npx vitest run src/cadence/cadence-config.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/`
- **Per wave merge:** `cd worrylesssuperagent/langgraph-server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `langgraph-server/src/cadence/heartbeat-prompts.test.ts` — covers CAD-02, CAD-03, CAD-04
- [ ] `langgraph-server/src/cadence/cadence-dispatcher.test.ts` — covers CAD-01, cadence tier routing
- [ ] `langgraph-server/src/cadence/event-detector.test.ts` — covers CAD-07 event message shape
- [ ] `langgraph-server/src/cadence/cadence-config.test.ts` — covers CAD-08 JSONB defaults

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `supabase/functions/heartbeat-dispatcher/index.ts` — exact pgmq enqueue pattern, cadence dispatcher loop
- Codebase direct read: `supabase/functions/heartbeat-runner/index.ts` — exact dequeue, LLM call, heartbeat log write pattern
- Codebase direct read: `supabase/functions/send-morning-digest/index.ts` — morning digest per-user scheduling, notifications table insert
- Codebase direct read: `supabase/migrations/20260313000008_heartbeat_dispatcher_fn.sql` — SQL dispatcher function: AT TIME ZONE, daily budget count, LIMIT 50
- Codebase direct read: `supabase/migrations/20260313000007_heartbeat_cron_jobs.sql` — pg_cron schedule patterns used in project
- Codebase direct read: `langgraph-server/src/index.ts` — `/invoke` endpoint shape: message, user_id, thread_id, agent_type params
- Codebase direct read: `langgraph-server/src/agents/accountant.ts` — classifyAccountantRequest regex keywords
- Codebase direct read: `langgraph-server/src/agents/marketer.ts` — classifyMarketerRequest regex keywords
- Codebase direct read: `langgraph-server/src/agents/base-agent.ts` — createLLMNode token budget + audit log pattern
- Codebase direct read: `langgraph-server/src/agents/chief-of-staff.ts` — compileMorningBriefing invocation, briefing → notifications flow
- Codebase direct read: `langgraph-server/src/tools/cos/compile-morning-briefing.ts` — heartbeat_log query: 24h window, outcome enum values
- Codebase direct read: `.planning/STATE.md` — all v2.0 architectural decisions (LangGraph on Railway, use_langgraph flag, heartbeat dispatcher pattern)
- Codebase direct read: `langgraph-server/package.json` — confirmed versions for all dependencies

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` CAD section — exact CAD-01 through CAD-08 requirement text verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies needed
- Architecture: HIGH — proactive-runner pattern derived directly from existing heartbeat-runner + langgraph-proxy code; no speculative API usage
- Pitfalls: HIGH — identified from direct code inspection of existing patterns and stated decisions in STATE.md
- Event trigger thresholds: MEDIUM — engagement rate thresholds (viral post = 3x average) are reasonable defaults; exact values will need tuning

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stable stack)
