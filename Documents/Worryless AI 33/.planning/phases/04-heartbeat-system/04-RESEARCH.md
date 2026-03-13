# Phase 4: Heartbeat System — Research

**Researched:** 2026-03-13
**Domain:** Supabase pg_cron + pgmq + Deno edge functions + timezone-aware scheduling
**Confidence:** HIGH (core infrastructure verified via official Supabase docs and confirmed against existing project migrations)

---

## Summary

Phase 4 builds a proactive "check-in" engine on top of the schema laid in Phase 1. The architecture has three moving parts: a single `heartbeat-dispatcher` edge function triggered by pg_cron every 5 minutes that finds due agents and enqueues them into pgmq; a `heartbeat-runner` edge function triggered every 1 minute that dequeues up to 5 messages, calls the LLM with the agent's HEARTBEAT.md and recent task context, and either suppresses the run (no DB write) or creates a notification log row; and a React heartbeat configuration section added to `WorkspaceTabs` / `GenericAgentPanel` that lets users set interval, active hours, and the enable toggle.

The critical design decisions from STATE.md are already locked: single dispatcher cron (not per-agent crons), HEARTBEAT_OK suppression with no DB write, and `profiles.timezone` as the business-hours reference column. The remaining open question identified in STATE.md — per-user daily budget enforcement mechanism — resolves cleanly as an aggregate COUNT query on `agent_heartbeat_log` for today's UTC midnight window converted to user timezone, which avoids adding a counter column that would need its own reset job.

**Primary recommendation:** Use pgmq via `pgmq_public` schema (RPC calls from the runner edge function), pg_cron via the `net.http_post` + Vault pattern already established in migration `20260112115051`, and a `COUNT()` aggregate on `agent_heartbeat_log` for budget enforcement — no new tables needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-02 | Heartbeat dispatcher (cron-originated, no user JWT) uses service-role key and fetches user identity from `user_agents` table directly | pg_cron → edge function auth pattern: `verify_jwt = false` in config.toml, service-role key retrieved from Vault or passed as environment variable in edge function; identity always sourced from DB row, never from caller input |
| HB-01 | `heartbeat-dispatcher` edge function triggered by single pg_cron job every 5 minutes; enqueues due agents into pgmq `heartbeat_jobs` queue | pg_cron schedule SQL established in existing migration; pgmq.send() SQL API verified; dispatcher queries `user_agents` for `next_heartbeat_at <= now()` within active hours |
| HB-02 | `heartbeat-runner` edge function triggered every 1 minute; reads up to 5 messages from `heartbeat_jobs`; processes each: reads HEARTBEAT.md + task history, calls LLM, evaluates response | pgmq_public.read() RPC pattern verified; runner calls LLM (same Lovable AI Gateway pattern), evaluates structured `{severity, finding}` response |
| HB-03 | LLM response must include `{severity: "urgent"|"headsup"|"digest"|"ok", finding: string}` — if severity is "ok", run suppressed with no DB write | Same structured-JSON-output pattern as spawn-agent-team; temperature 0.2 for deterministic severity classification; JSON guard with safe fallback to "ok" on parse failure |
| HB-04 | Non-OK runs create notification record; "urgent" → push + email + in-app; "headsup" → in-app only; "digest" → batched into morning briefing | Notification table needs to be defined in this phase (used in Phase 5 for full UI); email via existing Resend integration; push deferred to Phase 5 (NOTIF-03 is Phase 5); this phase creates the DB row and sends email for "urgent" only |
| HB-05 | Per-agent daily call budget (default 6/day) enforced by dispatcher | Aggregate COUNT on `agent_heartbeat_log` for rows since midnight in user's timezone; compare against `heartbeat_daily_budget` column on `user_agents` (or default 6); no separate counter table needed |
| HB-06 | Heartbeats only fire during user's configured active hours (default 08:00–20:00 in their timezone) | `EXTRACT(HOUR FROM now() AT TIME ZONE profiles.timezone)` compared against `heartbeat_active_hours_start` / `heartbeat_active_hours_end` in dispatcher SQL query |
| HB-07 | `agent_heartbeat_log` records agent_type, user_id, severity, finding, timestamp — only for non-OK outcomes | Table already defined in Phase 1 (migration 20260312000001); `outcome` ENUM has 'surfaced' and 'error'; `summary` column maps to `finding`; no schema changes needed |
| HB-08 | Agent settings panel shows heartbeat config: interval (1h/2h/4h/8h), active hours (start/end), enabled toggle | New `HeartbeatConfig` tab or section added to `WorkspaceTabs`; reads/writes `user_agents` columns (`heartbeat_interval_hours`, `heartbeat_active_hours_start`, `heartbeat_active_hours_end`, `heartbeat_enabled`) directly |
| HB-09 | Chief of Staff sends morning daily briefing digest at 8am user timezone consolidating "digest"-severity findings from past 24 hours | Dispatcher stores "digest" rows in `agent_heartbeat_log`; separate `send-morning-digest` edge function (or enhancement to existing `send-daily-briefing`) triggered at correct UTC time via pg_cron; reads digest rows since last 24h |
</phase_requirements>

---

## Standard Stack

### Core
| Library / Technology | Version | Purpose | Why Standard |
|----------------------|---------|---------|--------------|
| pgmq (via Supabase Queues) | bundled in Supabase | Durable message queue for heartbeat jobs | PostgreSQL-native, no external dependency, already available on Supabase platform |
| pg_cron | already enabled (migration 20260112115051) | Schedule dispatcher and runner edge functions | Already provisioned in project; only mechanism for server-side periodic execution |
| pg_net | already enabled (migration 20260112115051) | HTTP calls from pg_cron to edge functions | Already provisioned; required companion to pg_cron for invoking edge functions |
| Supabase Vault | platform feature | Store service-role key for cron-to-function auth | Recommended Supabase pattern for secrets in SQL context |
| Resend (`esm.sh/resend@2.0.0`) | 2.0.0 | Email delivery for "urgent" heartbeat findings | Already used in `send-daily-briefing`; no new dependency |
| Deno.serve / `@supabase/supabase-js@2.86.0` | 2.86.0 | Edge function runtime (matches existing functions) | Consistent with all existing edge functions in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsr:@supabase/supabase-js@2` | 2.x | pgmq_public schema RPC calls from runner | Alternative import style used in newer Deno patterns; team may keep `esm.sh` for consistency |
| `date-fns` (frontend, already in package.json) | 3.6.0 | Time picker formatting in HeartbeatConfig UI | Already in project; use for displaying/formatting active-hours time values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pgmq queue | Direct DB poll in runner (query `user_agents` every minute) | Removes queue complexity but risks double-processing and no visibility timeout; pgmq guarantees at-least-once delivery with visibility timeout |
| pgmq via pgmq_public RPC | Direct SQL via service role client | Both work; pgmq_public RPC is more portable and the documented Supabase pattern |
| COUNT aggregate for budget | Dedicated counter column with daily reset cron | Counter column is faster but requires a separate reset job and introduces drift risk; COUNT aggregate is always accurate, self-resetting |
| Vault for cron auth | Hardcoded anon key in migration SQL | Vault is secure; hardcoded key is a security anti-pattern even for anon key |

**Installation (new Supabase queue):**
```sql
-- Enable in Supabase Dashboard > Integrations > Queues
-- Or via migration:
SELECT pgmq.create('heartbeat_jobs');
```

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── heartbeat-dispatcher/   # pg_cron triggered every 5 min, verify_jwt=false
│   │   └── index.ts
│   └── heartbeat-runner/       # pg_cron triggered every 1 min, verify_jwt=false
│       └── index.ts
├── migrations/
│   ├── 20260313000006_heartbeat_queue.sql      # pgmq queue creation + notifications table + budget column
│   └── 20260313000007_heartbeat_cron_jobs.sql  # pg_cron schedule registrations
src/
├── components/agents/workspace/
│   └── HeartbeatConfigTab.tsx   # Interval selector + active hours + toggle
└── hooks/
    └── useHeartbeatConfig.ts    # Reads/writes user_agents heartbeat columns
```

### Pattern 1: pg_cron → Edge Function (Established Project Pattern)

**What:** pg_cron uses `net.http_post` to invoke an edge function on a schedule. The function has `verify_jwt = false` in config.toml. The service-role key is stored in Vault.

**When to use:** All cron-triggered edge functions. The dispatcher and runner both use this.

```sql
-- Source: Supabase official docs (supabase.com/docs/guides/functions/schedule-functions)
-- Store service key in Vault first:
SELECT vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY',
  'service_role_key'
);
SELECT vault.create_secret(
  'https://ywlhnhrmvwzmpkqzmypg.supabase.co',
  'project_url'
);

-- Register dispatcher job (every 5 minutes):
SELECT cron.schedule(
  'heartbeat-dispatcher',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/heartbeat-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**config.toml additions:**
```toml
[functions.heartbeat-dispatcher]
verify_jwt = false

[functions.heartbeat-runner]
verify_jwt = false
```

### Pattern 2: Dispatcher — Business Hours + Due Check Query

**What:** The dispatcher's core SQL query identifies agents due for a heartbeat, within active hours, not over daily budget.

```sql
-- Source: research synthesis from Phase 1 schema + PostgreSQL AT TIME ZONE docs
SELECT
  ua.id,
  ua.user_id,
  ua.agent_type_id,
  p.timezone
FROM user_agents ua
JOIN profiles p ON p.user_id = ua.user_id
WHERE
  ua.is_active = true
  AND ua.heartbeat_enabled = true
  AND ua.next_heartbeat_at <= now()
  AND EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))
      BETWEEN EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
          AND EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)
  AND (
    SELECT COUNT(*) FROM agent_heartbeat_log ahl
    WHERE ahl.user_id = ua.user_id
      AND ahl.agent_type_id = ua.agent_type_id
      AND ahl.run_at >= date_trunc('day', now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))
                         AT TIME ZONE COALESCE(p.timezone, 'UTC')
  ) < COALESCE(ua.heartbeat_daily_budget, 6)
LIMIT 50;
```

After enqueueing, the dispatcher updates `next_heartbeat_at`:
```sql
UPDATE user_agents
SET next_heartbeat_at = now() + (heartbeat_interval_hours || ' hours')::interval
WHERE id = $1;
```

### Pattern 3: pgmq Enqueue (Dispatcher) and Dequeue (Runner)

**What:** Dispatcher calls `pgmq.send()` (SQL) or `pgmq_public.send` (RPC). Runner calls `pgmq_public.read` RPC.

```typescript
// Source: supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
// --- DISPATCHER (enqueue) ---
const supabaseAdmin = createClient(url, serviceRoleKey);

// Send one message per due agent
await supabaseAdmin.schema('pgmq_public').rpc('send', {
  queue_name: 'heartbeat_jobs',
  message: { agentId: ua.id, userId: ua.user_id, agentTypeId: ua.agent_type_id },
  sleep_seconds: 0,
});

// --- RUNNER (dequeue and process) ---
const { data: messages } = await supabaseAdmin.schema('pgmq_public').rpc('read', {
  queue_name: 'heartbeat_jobs',
  sleep_seconds: 30,  // visibility timeout: 30s — prevents double-processing
  n: 5,
});

for (const msg of messages ?? []) {
  try {
    await processHeartbeat(msg.message, supabaseAdmin);
    await supabaseAdmin.schema('pgmq_public').rpc('delete', {
      queue_name: 'heartbeat_jobs',
      message_id: msg.msg_id,
    });
  } catch (err) {
    console.error('Heartbeat processing failed, message will retry:', err);
    // Do NOT delete — message becomes visible again after visibility timeout
  }
}
```

### Pattern 4: LLM Heartbeat Invocation

**What:** Runner assembles prompt from HEARTBEAT.md + recent tasks, calls LLM with structured JSON output constraint.

```typescript
// Source: consistent with existing spawn-agent-team and orchestrator patterns in project
const systemPrompt = `You are ${agentDisplayName}, performing a scheduled business check-in.

Review the business context and your recent activity below.
Respond ONLY with valid JSON in this exact format:
{"severity": "ok"|"urgent"|"headsup"|"digest", "finding": "one-sentence summary or empty string if ok"}

SEVERITY RULES:
- "ok": nothing requires attention right now
- "urgent": immediate action needed (< 2 hours)
- "headsup": something worth noting for today
- "digest": interesting but can wait for morning briefing

${sanitizeWorkspaceContent(heartbeatMd)}`;

const response = await fetch(LOVABLE_AI_GATEWAY, {
  method: 'POST',
  headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextBlock },
    ],
    temperature: 0.2,  // Low temperature for deterministic severity
  }),
});
```

### Pattern 5: HEARTBEAT_OK Suppression (No DB Write)

**What:** Runner evaluates severity; only writes to `agent_heartbeat_log` for non-"ok" outcomes. This matches DB-05 requirement.

```typescript
// Source: Phase 1 decision (STATE.md) + REQUIREMENTS.md DB-05
const parsed = safeParseJson(llmContent);
const severity = parsed?.severity ?? 'ok';

if (severity === 'ok') {
  // Suppressed — no DB write, no notification
  // Only next_heartbeat_at was already updated by dispatcher
  return;
}

// Write log for non-OK outcomes only
await supabaseAdmin.from('agent_heartbeat_log').insert({
  user_id: payload.userId,
  agent_type_id: payload.agentTypeId,
  run_at: new Date().toISOString(),
  outcome: 'surfaced',
  summary: parsed.finding,
  notification_sent: false,
  task_created: false,
});

// Create notification record (Phase 5 will add real-time delivery)
// For "urgent": also send Resend email immediately
if (severity === 'urgent') {
  await sendUrgentEmail(payload.userId, parsed.finding, agentDisplayName, supabaseAdmin);
}
```

### Pattern 6: HeartbeatConfig UI Component (HB-08)

**What:** A new tab or section added to `WorkspaceTabs` / `GenericAgentPanel` that reads and writes the heartbeat config columns on `user_agents`.

**Placement decision:** Add as a 7th tab in `WorkspaceTabs` alongside the 6 workspace file tabs, OR as a separate "Heartbeat" section in `GenericAgentPanel` below the Workspace button. The 7th-tab approach keeps all agent config in one place but is slightly confusing (heartbeat config is not a workspace file). The separate settings section in `GenericAgentPanel` is cleaner. **Recommended: add a "Heartbeat" collapsible section to `GenericAgentPanel` itself.**

```typescript
// Hook pattern — consistent with useAgentWorkspace in project
// src/hooks/useHeartbeatConfig.ts
export function useHeartbeatConfig(agentTypeId: string) {
  // Reads: user_agents WHERE agent_type_id = agentTypeId AND user_id = currentUser
  // Columns: heartbeat_interval_hours, heartbeat_active_hours_start,
  //          heartbeat_active_hours_end, heartbeat_enabled
  // Writes: UPDATE user_agents SET ... WHERE id = rowId
}
```

### Anti-Patterns to Avoid

- **Per-agent pg_cron jobs:** pg_cron has limited concurrent job slots. STATE.md explicitly decided single-dispatcher approach. Never create one cron job per agent.
- **Writing on HEARTBEAT_OK:** The entire point of suppression is zero DB writes on quiet days. Do not write a log row with outcome = 'ok' or a 'suppressed' enum value.
- **Using user JWT in dispatcher:** The dispatcher is cron-triggered with no user session. Always use service-role key and derive user identity from `user_agents.user_id` (SEC-02).
- **Hardcoding service key in migration SQL:** Use Vault. The existing project already stores secrets in Vault per the `send-daily-briefing` pattern.
- **Calling LLM in dispatcher:** The dispatcher's job is only to find due agents and enqueue them. LLM calls belong exclusively in the runner.
- **Blocking on email in runner:** If Resend call fails, it must not fail the heartbeat log write. Use try/catch with independent error handling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message queue with visibility timeout | Custom DB table with `is_processing` flag | pgmq (already available in Supabase) | pgmq handles visibility timeout, at-least-once delivery, retry logic, and concurrent consumer safety |
| Periodic scheduling | Recursive `setTimeout` in edge function | pg_cron (already enabled in project) | pg_cron persists across function restarts; setTimeout in Deno only works for current invocation lifetime |
| Active hours timezone math | Manual UTC offset arithmetic | PostgreSQL `AT TIME ZONE` with IANA names | Handles DST automatically; profiles.timezone already stores IANA strings |
| Daily budget reset | Separate counter column + nightly reset cron | COUNT aggregate on `agent_heartbeat_log` | Self-resetting (counts today's rows naturally); no additional job; no drift risk |
| Email delivery | Custom SMTP client | Resend via `esm.sh/resend@2.0.0` (already in project) | Already integrated in `send-daily-briefing`; same API key already configured |
| Secrets in SQL | Hardcoded keys in cron migration SQL | Supabase Vault (`vault.decrypted_secrets`) | Vault is already used in project; prevents key exposure in migration history |

**Key insight:** pgmq's visibility timeout is what prevents double-processing when the runner fires while a previous invocation is still working. This is a subtle race condition that a custom `is_processing` flag would not handle correctly across concurrent edge function instances.

---

## Common Pitfalls

### Pitfall 1: pg_cron UTC-Only Clock vs User Timezone
**What goes wrong:** The dispatcher checks `heartbeat_active_hours_start`/`end` against `now()` without timezone conversion. Agent fires at 3am local time because pg_cron runs in UTC.
**Why it happens:** `now()` in PostgreSQL always returns UTC. `TIME` columns store wall-clock values with no timezone context.
**How to avoid:** Always convert `now()` to the user's timezone before comparing with active hours. Use `EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))`.
**Warning signs:** Test by setting `profiles.timezone = 'America/New_York'` and verifying the dispatcher does not enqueue at 2am UTC (= 9pm ET, outside hours).

### Pitfall 2: Double-Processing from Parallel Runner Invocations
**What goes wrong:** Two runner invocations start within 1 minute, both read the same message from pgmq, both process the same agent and create duplicate notification rows.
**Why it happens:** pgmq's visibility timeout (`sleep_seconds` parameter in `read`) is the protection. If set to 0, messages become immediately re-readable.
**How to avoid:** Set `sleep_seconds` (visibility timeout) to at least 30–60 seconds in the `pgmq_public.read` call — longer than the expected processing time per message.
**Warning signs:** Duplicate rows in `agent_heartbeat_log` with the same `run_at` timestamp and `agent_type_id`.

### Pitfall 3: LLM JSON Parse Failure Treated as "urgent"
**What goes wrong:** LLM returns malformed JSON or a text response instead of `{"severity": "ok", ...}`. Parser throws, uncaught error propagates, notification fires with bad data.
**Why it happens:** LLM outputs are non-deterministic. Gemini Flash occasionally wraps JSON in markdown code fences.
**How to avoid:** Use the same `extractJson()` strip-fences pattern from `spawn-agent-team/index.ts`. Always wrap `JSON.parse` in try/catch. Default to `severity: "ok"` on any parse failure (fail-silent, don't spam user).
**Warning signs:** Empty `finding` strings in notification rows, or `outcome = 'error'` rows with `error_message` containing "JSON parse".

### Pitfall 4: Missing `heartbeat_daily_budget` Column
**What goes wrong:** Dispatcher SQL references `ua.heartbeat_daily_budget` but this column does not exist in Phase 1's `user_agents` schema.
**Why it happens:** Phase 1 migration defined the heartbeat config columns but `heartbeat_daily_budget` was not explicitly included (reviewed migration — absent).
**How to avoid:** Phase 4 migration must `ALTER TABLE user_agents ADD COLUMN IF NOT EXISTS heartbeat_daily_budget INTEGER NOT NULL DEFAULT 6`.
**Warning signs:** Migration error on `heartbeat_daily_budget` column in dispatcher SQL; fall back to hardcoded `6` as short-term guard.

### Pitfall 5: Notifications Table Not Yet Defined
**What goes wrong:** Runner tries to insert into a `notifications` table that doesn't exist yet (Phase 5 owns the full notification UI, but Phase 4 must create the data).
**Why it happens:** Notification delivery (Phase 5 NOTIF-01 through NOTIF-06) assumes data exists from Phase 4.
**How to avoid:** Phase 4's migration must create a minimal `notifications` table (`id`, `user_id`, `agent_type_id`, `severity`, `message`, `is_read`, `created_at`). Phase 5 will add the UI layer on top.
**Warning signs:** Foreign key or relation-does-not-exist errors in the runner when attempting notification insert.

### Pitfall 6: Dispatcher Updates `next_heartbeat_at` Even When Agent Is Over Budget
**What goes wrong:** Agent is skipped for budget reasons, but `next_heartbeat_at` is still advanced. The agent now appears "already checked" and won't fire when budget resets tomorrow.
**Why it happens:** Naive implementation updates `next_heartbeat_at` for all queried agents regardless of whether they were enqueued.
**How to avoid:** Only update `next_heartbeat_at` for agents that were successfully enqueued. Budget-skipped agents should retain their existing `next_heartbeat_at` so they are reconsidered on the next dispatcher tick after midnight.

### Pitfall 7: `send-daily-briefing` vs `heartbeat-runner` Concern About HB-09
**What goes wrong:** HB-09 (Chief of Staff morning digest at 8am user timezone) looks like it belongs to Phase 4, but the existing `send-daily-briefing` function runs on a fixed UTC schedule and uses the old `daily_briefings` table, not `agent_heartbeat_log`.
**Why it happens:** There are now two "morning briefing" concepts: the old email briefing and the new heartbeat-digest Chief of Staff briefing.
**How to avoid:** Phase 4 should implement HB-09 as a new `send-morning-digest` edge function that reads "digest"-severity rows from `agent_heartbeat_log`. It triggers at 8am UTC approximation (or the per-user approach is deferred to Phase 5 which owns timezone scheduling). The existing `send-daily-briefing` is a separate legacy feature and must not be broken.

---

## Code Examples

### Business Hours Check in SQL
```sql
-- Source: PostgreSQL AT TIME ZONE docs + Phase 1 schema (user_agents + profiles)
-- Check if current time is within user's active hours (timezone-aware)
SELECT ua.id, ua.user_id, ua.agent_type_id
FROM user_agents ua
JOIN profiles p ON p.user_id = ua.user_id
WHERE ua.is_active = true
  AND ua.heartbeat_enabled = true
  AND ua.next_heartbeat_at <= now()
  AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
      >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
  AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
      < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end);
```

### Daily Budget COUNT
```sql
-- Source: research synthesis — aggregate query avoids counter column
-- Count heartbeat runs today in user's local timezone
SELECT COUNT(*) AS runs_today
FROM agent_heartbeat_log
WHERE user_id = $user_id
  AND agent_type_id = $agent_type_id
  AND run_at >= (
    date_trunc('day', now() AT TIME ZONE $user_timezone)
    AT TIME ZONE $user_timezone
  );
-- Compare: runs_today < COALESCE(heartbeat_daily_budget, 6)
```

### pgmq Send from Dispatcher (Edge Function)
```typescript
// Source: supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

await supabaseAdmin.schema('pgmq_public').rpc('send', {
  queue_name: 'heartbeat_jobs',
  message: {
    userAgentId: ua.id,
    userId: ua.user_id,
    agentTypeId: ua.agent_type_id,
  },
  sleep_seconds: 0,
});
```

### pgmq Read from Runner (Edge Function)
```typescript
// Source: dev.to/suciptoid queue worker pattern (verified against Supabase docs)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const { data: messages } = await supabaseAdmin
  .schema('pgmq_public')
  .rpc('read', {
    queue_name: 'heartbeat_jobs',
    sleep_seconds: 30,   // visibility timeout in seconds
    n: 5,                // max messages per invocation
  });

for (const msg of messages ?? []) {
  try {
    await processHeartbeat(msg.message);
    await supabaseAdmin.schema('pgmq_public').rpc('delete', {
      queue_name: 'heartbeat_jobs',
      message_id: msg.msg_id,
    });
  } catch (err) {
    // message becomes re-visible after 30s — automatic retry
    console.error('Processing failed:', err);
  }
}
```

### Heartbeat Config UI — React Hook Signature
```typescript
// Source: consistent with useAgentWorkspace pattern in project
// src/hooks/useHeartbeatConfig.ts
interface HeartbeatConfig {
  heartbeat_enabled: boolean;
  heartbeat_interval_hours: 1 | 2 | 4 | 8;
  heartbeat_active_hours_start: string; // "HH:MM"
  heartbeat_active_hours_end: string;   // "HH:MM"
}

export function useHeartbeatConfig(agentTypeId: string): {
  config: HeartbeatConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  updateConfig: (patch: Partial<HeartbeatConfig>) => Promise<void>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-agent pg_cron jobs | Single dispatcher + pgmq queue | STATE.md decision | Avoids pg_cron slot exhaustion with many users/agents |
| pgsodium / pgjwt for cron auth | Vault + `verify_jwt = false` | pgsodium deprecated in PG17 | Simpler and future-proof; anon key via Vault is acceptable for internal-only dispatcher |
| Cron triggers calling edge function via `net.http_post` with hardcoded URL | URL from Vault secret | Supabase best practice (current) | Keeps project URL out of migration SQL history |

**Deprecated/outdated:**
- pgjwt and pgsodium for pg_cron → edge function authentication: deprecated in Postgres 17, no longer recommended by Supabase
- Per-agent scheduled tasks pattern (old `automation_settings` + `task_templates` tables): the new `user_agents` heartbeat columns replace this for the proactive-check-in use case

---

## Open Questions

1. **HB-09 Timezone Scheduling for Morning Digest**
   - What we know: pg_cron is UTC-only. `profiles.timezone` exists. Phase 5 STATE.md blocker notes this needs a decision.
   - What's unclear: Phase 4 owns HB-09 in REQUIREMENTS.md, but Phase 5 STATE.md blocker defers timezone-bucket scheduling. Should Phase 4 implement a simplified version (e.g., fire at 8am UTC = acceptable for east-coast users) and Phase 5 refines it?
   - Recommendation: Phase 4 implements HB-09 as a `send-morning-digest` function triggered at a fixed UTC time (e.g., `0 8 * * *` = 8am UTC). The per-user timezone-aware scheduling is explicitly deferred to Phase 5's blocker resolution. Document this as a known limitation.

2. **`heartbeat_daily_budget` Column Missing from Phase 1 Schema**
   - What we know: Phase 1 migration does NOT include a `heartbeat_daily_budget` column on `user_agents`. The dispatcher needs it for HB-05.
   - What's unclear: Whether to add it as part of Phase 4's migration or use a hardcoded constant in the dispatcher.
   - Recommendation: Phase 4 migration adds `ALTER TABLE user_agents ADD COLUMN IF NOT EXISTS heartbeat_daily_budget INTEGER NOT NULL DEFAULT 6`. This is a backward-compatible additive change.

3. **Notifications Table Ownership**
   - What we know: Phase 4 creates notification data (HB-04), Phase 5 builds the UI (NOTIF-01 through NOTIF-06).
   - What's unclear: Whether Phase 4 should define the full `notifications` table schema or a minimal version Phase 5 will `ALTER`.
   - Recommendation: Phase 4 defines the minimal `notifications` table with all columns Phase 5 will need (`id`, `user_id`, `agent_type_id`, `severity`, `message`, `is_read`, `created_at`, `link_type`). Phase 5 adds no new columns — only the UI layer.

4. **pgmq Queue Persistence (Unlogged vs Logged)**
   - What we know: pgmq offers `pgmq.create()` (logged, survives crash) and `pgmq.create_unlogged()` (higher write throughput, does not survive crash).
   - What's unclear: For a heartbeat dispatcher that runs every 5 minutes, a crash-lost queue message just means a slightly delayed heartbeat. Is durability worth the write overhead?
   - Recommendation: Use `pgmq.create()` (logged) for correctness. The heartbeat_jobs queue has low message volume (at most dozens per 5-minute window for a typical user base), so write overhead is negligible.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HB-03 | `severity` field parser returns "ok" on malformed JSON (fail-safe) | unit | `npx vitest run src/__tests__/heartbeatParser.test.ts -t "severity"` | ❌ Wave 0 |
| HB-03 | `extractJson` strips code fences before JSON.parse | unit | `npx vitest run src/__tests__/heartbeatParser.test.ts -t "extractJson"` | ❌ Wave 0 |
| HB-05 | daily budget count query returns correct count for timezone edge cases | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "budget"` | ❌ Wave 0 |
| HB-06 | active hours check returns false for UTC time outside user's local window | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "activeHours"` | ❌ Wave 0 |
| HB-08 | useHeartbeatConfig hook updates `user_agents` columns correctly | unit (mock Supabase) | `npx vitest run src/__tests__/useHeartbeatConfig.test.ts` | ❌ Wave 0 |
| SEC-02 | dispatcher never reads userId from request body — always from DB row | unit | `npx vitest run src/__tests__/heartbeatDispatcher.test.ts -t "SEC-02"` | ❌ Wave 0 |
| HB-01/HB-02 | end-to-end queue enqueue/dequeue cycle | manual-only | N/A — requires live Supabase pgmq | manual |
| HB-09 | morning digest sends email with "digest" rows from past 24h | manual-only | N/A — requires Resend API key + live DB | manual |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/heartbeatParser.test.ts` — covers HB-03 (severity parse, extractJson, fail-safe to "ok")
- [ ] `src/__tests__/heartbeatDispatcher.test.ts` — covers HB-05 (budget count), HB-06 (active hours), SEC-02 (no body userId)
- [ ] `src/__tests__/useHeartbeatConfig.test.ts` — covers HB-08 (hook reads/writes correct columns)

---

## Sources

### Primary (HIGH confidence)
- `supabase.com/docs/guides/queues/consuming-messages-with-edge-functions` — pgmq_public.read/delete RPC pattern
- `supabase.com/docs/guides/queues/pgmq` — pgmq SQL API (send, read, delete, create)
- `supabase.com/docs/guides/queues/api` — pgmq_public vs pgmq schema distinction
- `supabase.com/docs/guides/functions/schedule-functions` — pg_cron + Vault + net.http_post pattern
- Project migration `20260112115051` — confirms pg_cron and pg_net are already enabled
- Project migration `20260312000001` — confirms exact Phase 1 schema for `user_agents`, `agent_heartbeat_log`
- `worrylesssuperagent/supabase/functions/_shared/sanitize.ts` — confirms sanitizeWorkspaceContent is available for runner
- `worrylesssuperagent/supabase/config.toml` — confirms `verify_jwt = false` pattern for cron-triggered functions

### Secondary (MEDIUM confidence)
- `dev.to/suciptoid` queue worker article — pgmq_public RPC pattern with `{ db: { schema: "pgmq_public" } }` client creation; verified against official Supabase docs
- PostgreSQL `AT TIME ZONE` docs (neon.com/postgresql) — IANA timezone handling in `EXTRACT(HOUR FROM ...)` expressions
- Supabase GitHub discussion `#4287` — confirms pgjwt/pgsodium deprecated, Vault approach current recommendation

### Tertiary (LOW confidence)
- STATE.md accumulated decisions — these are project decisions, not external sources; HIGH trust within project but flagging for traceability

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pg_cron and pg_net already confirmed enabled in project; pgmq API verified via official Supabase docs; Resend already in project
- Architecture: HIGH — dispatcher/runner split confirmed against REQUIREMENTS.md; pgmq patterns verified; business hours SQL pattern verified against Postgres AT TIME ZONE docs
- Pitfalls: HIGH — double-processing prevention (visibility timeout), UTC vs timezone bugs, JSON parse failures are well-documented; notifications table absence confirmed by reviewing Phase 1 migration
- Daily budget mechanism: HIGH — COUNT aggregate approach verified as correct Postgres pattern; `heartbeat_daily_budget` column absence confirmed by reading Phase 1 migration

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (Supabase pgmq API is stable; pg_cron patterns are stable)
