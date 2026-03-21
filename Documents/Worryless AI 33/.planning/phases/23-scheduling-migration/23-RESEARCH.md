# Phase 23: Scheduling Migration - Research

**Researched:** 2026-03-21
**Domain:** BullMQ + node-cron scheduling, Playwright Docker, Railway volumes, web-push VAPID, SQL function migration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RAIL-04 | LangGraph Server deployed on Railway via Docker with Playwright Chromium and persistent volume at `/playwright-data` | Dockerfile already installs Playwright — only volume mount path and env vars need adding |
| SCHED-01 | node-cron dispatcher tick running inside LangGraph Server process (replaces pg_cron) | `node-cron` 4.2.1; `*/5 * * * *` schedule; enqueues to BullMQ via IORedis |
| SCHED-02 | BullMQ worker processing heartbeat/cadence jobs from Redis queue (replaces pgmq) | BullMQ 5.71.0; `Worker` class with `graph.invoke()` as processor function; IORedis with `tls: {}` for Railway |
| SCHED-03 | `get_due_cadence_agents()` SQL function adapted for Railway (remove pg_cron dependencies) | Function already exists and has NO pg_cron dependencies — it is a pure SQL SELECT; verify it is in the Railway migration |
| SCHED-04 | Daily briefing, morning digest, and scheduled task runners converted to BullMQ repeatable jobs | BullMQ `repeat: { pattern: '0 7 * * *' }` for daily; worker processors call graph.invoke() or pg queries directly |
| SCHED-05 | Push notifications via `web-push` npm package with VAPID keys (replaces Deno `jsr:@negrel/webpush`) | `web-push` 3.6.7 already implemented in api-server; LangGraph worker must call the same pattern |
</phase_requirements>

---

## Summary

Phase 23 replaces the Supabase pg_cron + pgmq scheduling stack with a self-contained BullMQ + node-cron scheduler that runs entirely inside the LangGraph server process. The existing Supabase Edge Functions (`heartbeat-runner`, `run-scheduled-tasks`, `send-daily-briefing`) are ported into two new TypeScript modules: `cadence/dispatcher.ts` (node-cron tick that queries `get_due_cadence_agents()` and enqueues BullMQ jobs) and `cadence/worker.ts` (BullMQ worker that dequeues jobs and calls `graph.invoke()`). SCHED-05 (push notifications via `web-push`) was listed as Phase 22 work in the requirements traceability table — it is already implemented in the api-server. The LangGraph worker must reference that same `web-push` package and VAPID env vars rather than re-implementing.

The `get_due_cadence_agents()` SQL function (migration `20260320000002_cadence_dispatcher_v2.sql`) contains no pg_cron or pgmq dependencies — it is a pure SQL SELECT against `public.user_agents` and `public.profiles`. The only verification needed is confirming it is included in the Railway production migration. The Dockerfile already installs Playwright Chromium; only the volume mount path (currently commented as `/data`) needs updating to `/playwright-data` per the RAIL-04 requirement.

**Primary recommendation:** Add `bullmq`, `ioredis`, and `node-cron` to the LangGraph server's `package.json`, implement the dispatcher and worker in `src/cadence/`, mount `/playwright-data` in `railway.toml`, and confirm `get_due_cadence_agents()` is present in the Railway Postgres instance.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | 5.71.0 | Job queue backed by Redis | Official BullMQ is the project's chosen replacement for pgmq (see STATE.md decisions) |
| ioredis | 5.10.1 | Redis client for BullMQ | BullMQ's required Redis client; supports TLS via `tls: {}` option required for Railway Redis |
| node-cron | 4.2.1 | In-process cron scheduler | Replaces pg_cron; fires every 5 minutes; pure Node.js, no external dependency |
| web-push | 3.6.7 | VAPID push notifications | Already implemented in api-server (Phase 22 / SCHED-05); same package needed in LangGraph worker |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | 8.13.0 (already installed) | PostgreSQL pool for `get_due_cadence_agents()` RPC | Dispatcher needs to call `SELECT * FROM get_due_cadence_agents()` — reuse existing pool |
| resend | 4.0.0 (api-server has 4.x) | Daily briefing email sending | Worker calls Resend for daily briefing — check version alignment with api-server |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | node-cron alone (no queue) | No persistence across restarts; job loss on crash — BullMQ required per SCHED-02 |
| BullMQ | Temporal / Inngest | Over-engineered for this use case; adds external service dependency |
| node-cron | @breejs/later | Richer cron syntax but heavier; node-cron is sufficient for 5-minute ticks |

**Installation (in `worrylesssuperagent/langgraph-server/`):**
```bash
npm install bullmq ioredis node-cron
npm install --save-dev @types/node-cron
```

**Version verification (confirmed 2026-03-21):**
- `bullmq`: 5.71.0
- `ioredis`: 5.10.1
- `node-cron`: 4.2.1
- `web-push`: 3.6.7 (already in api-server)

---

## Architecture Patterns

### Recommended Project Structure

New files in `worrylesssuperagent/langgraph-server/src/cadence/`:
```
src/cadence/
├── index.ts                 # existing barrel (keep; add new exports)
├── cadence-config.ts        # existing (no changes)
├── cadence-dispatcher.ts    # NEW: node-cron tick → BullMQ enqueue
├── cadence-worker.ts        # NEW: BullMQ Worker → graph.invoke()
├── heartbeat-prompts.ts     # existing (no changes)
├── event-detector.ts        # existing (no changes)
└── push-helper.ts           # NEW: web-push sendNotification wrapper
```

`src/index.ts` gets a new startup call:
```typescript
import { startCadenceScheduler } from './cadence/cadence-dispatcher.js';
// After server.listen():
if (process.env.NODE_ENV !== 'test') {
  startCadenceScheduler();
}
```

### Pattern 1: IORedis Connection with Railway TLS

**What:** Railway Redis requires TLS. IORedis accepts `tls: {}` in options.
**When to use:** Any time `REDIS_URL` begins with `rediss://` (note double-s).

```typescript
// Source: STATE.md decision "[Phase 22]: BullMQ TLS required for Railway Redis"
import IORedis from 'ioredis';

function getRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is required');
  // rediss:// signals TLS; tls:{} enables it without cert pinning
  return new IORedis(url, { tls: url.startsWith('rediss://') ? {} : undefined, maxRetriesPerRequest: null });
}
```

`maxRetriesPerRequest: null` is required by BullMQ — it disables per-request retry limits so BullMQ can manage its own retry logic.

### Pattern 2: BullMQ Queue + node-cron Dispatcher

**What:** node-cron fires every 5 minutes, calls `get_due_cadence_agents()` via pg pool, and adds one BullMQ job per agent row.
**When to use:** SCHED-01 + SCHED-02 implementation.

```typescript
// Source: BullMQ docs (bullmq.io) + node-cron README
import cron from 'node-cron';
import { Queue } from 'bullmq';
import { pool } from '../persistence/pool.js'; // pg Pool

const heartbeatQueue = new Queue('heartbeat', { connection: getRedisConnection() });

export function startCadenceScheduler(): void {
  cron.schedule('*/5 * * * *', async () => {
    const { rows } = await pool.query('SELECT * FROM get_due_cadence_agents()');
    for (const agent of rows) {
      await heartbeatQueue.add('heartbeat', {
        user_id: agent.user_id,
        agent_type_id: agent.agent_type_id,
        cadence_tier: agent.cadence_tier,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,  // keep last 100 completed jobs for debugging
        removeOnFail: 200,
      });
    }
    console.log(`[cadence-dispatcher] Enqueued ${rows.length} agents`);
  });

  console.log('[cadence-dispatcher] node-cron started (every 5 minutes)');
}
```

### Pattern 3: BullMQ Worker → graph.invoke()

**What:** BullMQ Worker dequeues heartbeat jobs and runs the agent graph.
**When to use:** SCHED-02 implementation.

```typescript
// Source: BullMQ docs — Worker class
import { Worker } from 'bullmq';
import { getCheckpointer } from '../persistence/checkpointer.js';
import { createSupervisorGraph } from '../graph/supervisor.js';

export function startHeartbeatWorker(): Worker {
  const worker = new Worker('heartbeat', async (job) => {
    const { user_id, agent_type_id, cadence_tier } = job.data;
    const checkpointer = await getCheckpointer();
    const graph = createSupervisorGraph(checkpointer);

    const result = await graph.invoke({
      messages: [{ role: 'user', content: `Heartbeat check. Cadence: ${cadence_tier}` }],
      userId: user_id,
      agentType: agent_type_id,
      isProactive: true,  // bypasses token budget per existing isProactive flag
    }, {
      configurable: { thread_id: `heartbeat-${user_id}-${agent_type_id}` },
    });

    console.log(`[heartbeat-worker] Completed user=${user_id} agent=${agent_type_id} tier=${cadence_tier}`);
    return result;
  }, { connection: getRedisConnection(), concurrency: 5 });

  worker.on('failed', (job, err) => {
    console.error(`[heartbeat-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
```

### Pattern 4: BullMQ Repeatable Jobs for Daily Briefing + Morning Digest

**What:** BullMQ `repeat` option creates persistent recurring jobs without node-cron.
**When to use:** SCHED-04 — daily briefing at 7am UTC, morning digest.

```typescript
// Source: BullMQ docs — Repeatable jobs
await briefingQueue.add('daily-briefing', {}, {
  repeat: { pattern: '0 7 * * *' },  // 7am UTC daily
  jobId: 'daily-briefing-singleton',  // prevents duplicate registrations on restart
});

// Morning digest (collect digest-severity heartbeat_log rows and email)
await digestQueue.add('morning-digest', {}, {
  repeat: { pattern: '0 6 * * *' },  // 6am UTC daily
  jobId: 'morning-digest-singleton',
});
```

**Critical:** Use a stable `jobId` for repeatable jobs. BullMQ deduplicates by jobId — calling `queue.add()` with the same `jobId` on every server restart is safe and idempotent.

### Pattern 5: web-push VAPID in the Heartbeat Worker

**What:** After `graph.invoke()` surfaces an urgent finding, the worker sends a push notification via `web-push` (same package used in api-server).
**When to use:** When the heartbeat result severity is `urgent` or `headsup`.

```typescript
// Source: api-server/src/routes/pushSubscriptions.ts (Phase 22 implementation)
import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@worryless.ai',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// In worker, after DB insert:
const { rows: subs } = await pool.query(
  'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
  [user_id],
);
for (const sub of subs) {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify({ title: agentDisplayName, body: finding }),
  ).catch(err => console.error('[heartbeat-worker] Push failed (non-fatal):', err));
}
```

### Pattern 6: Railway Volume Mount in railway.toml

**What:** Declare a persistent volume for Playwright browser data.
**When to use:** RAIL-04 — `/playwright-data` must survive container restarts.

```toml
# Source: Railway docs — Volume mounts in railway.toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[volumes]]
mountPath = "/playwright-data"
```

The Dockerfile already runs `npx playwright@1.58.2 install chromium --with-deps` in the final stage. The `PLAYWRIGHT_BROWSERS_PATH` env var may need to be set to `/playwright-data` so Playwright looks for Chromium there rather than the ephemeral container filesystem.

### Anti-Patterns to Avoid

- **Do not create a new IORedis connection per BullMQ Queue/Worker**: Create one connection per Queue and one per Worker (BullMQ internally requires separate connections for Queue and Worker). Do NOT share a single IORedis instance between Queue and Worker.
- **Do not skip `maxRetriesPerRequest: null`**: BullMQ will throw `"BLMOVE" not allowed` or hang without this IORedis option.
- **Do not call `startHeartbeatWorker()` and `startCadenceScheduler()` in test env**: Guard with `process.env.NODE_ENV !== 'test'` to prevent Redis connection errors in vitest runs.
- **Do not use `repeat: { every: N }` millisecond repeats for daily jobs**: Use cron pattern strings (`pattern: '0 7 * * *'`). Millisecond repeats restart from boot time and drift.
- **Do not rely on pg_cron or pgmq in the Railway DB**: Migration 20260313000006 and 20260313000007 use `pgmq.create()` and `cron.schedule()` — these must NOT be applied to Railway Postgres. The Railway migration strips these (Phase 20 decision: "replaced pgmq with RAISE NOTICE stubs for BullMQ").

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retry/backoff | Custom Redis list + retry counter | BullMQ `Queue` + `Worker` | BullMQ handles visibility timeout, exponential backoff, job deduplication, and concurrency — all edge cases that are non-trivial |
| Cron scheduling | `setInterval()` + timestamp math | `node-cron` | setInterval drifts; doesn't survive timezone DST changes; no cron syntax validation |
| Push notification encryption | Custom VAPID/ECDH key negotiation | `web-push` npm package | Web Push encryption requires RFC 8291/8292 implementation — 200+ lines of cryptography |
| Dead letter queue | Custom failed-job table | BullMQ `removeOnFail: N` + `getFailedJobs()` | Built into BullMQ; queryable via Redis |

**Key insight:** The existing Deno Edge Functions handle pgmq dequeue with custom visibility timeout logic — BullMQ provides this out of the box with `lockDuration` and automatic re-queue on worker failure.

---

## SCHED-03: SQL Function Status

The `get_due_cadence_agents()` function (from `20260320000002_cadence_dispatcher_v2.sql`) has NO pg_cron or pgmq dependencies. It is a pure `SELECT ... UNION ALL` across `public.user_agents` and `public.profiles`. The SCHED-03 task is therefore:

1. Confirm `get_due_cadence_agents()` exists on Railway Postgres (run `\df get_due_cadence_agents` in psql).
2. If missing: apply the SQL from `20260320000002_cadence_dispatcher_v2.sql` as a Railway migration.
3. If present: no changes needed.

The old `get_due_heartbeat_agents()` function (migration `20260313000008`) is referenced nowhere in the LangGraph server codebase — only in the old Deno Edge Function dispatcher. The new dispatcher calls `get_due_cadence_agents()` exclusively.

**SCHED-03 scope is verification + potential migration, not SQL rewriting.**

---

## RAIL-04: Dockerfile and railway.toml Changes

### Dockerfile (current state)
```dockerfile
# Final stage already has:
RUN npx -y playwright@1.58.2 install chromium --with-deps
# Volume comment is present but not wired to railway.toml
```

### Required Changes

**railway.toml** — add `[[volumes]]` block:
```toml
[[volumes]]
mountPath = "/playwright-data"
```

**Dockerfile** — add `PLAYWRIGHT_BROWSERS_PATH` env var so Playwright looks in the persistent volume:
```dockerfile
ENV PLAYWRIGHT_BROWSERS_PATH=/playwright-data
```

**Note:** If `PLAYWRIGHT_BROWSERS_PATH` is set, `npx playwright install chromium` in the Dockerfile will install into `/playwright-data` at build time. On subsequent restarts, the volume already has Chromium — no re-install needed. This is the standard pattern for Playwright on Railway.

### New env vars for LangGraph server (DATABASE_URL + GEMINI_API_KEY)

Per the phase plan task 23-01:
- `DATABASE_URL` — Railway PostgreSQL internal URL (`postgres://...@postgres.railway.internal:5432/railway`)
- `GEMINI_API_KEY` — for LLM calls in heartbeat worker (graph.invoke() uses Gemini)
- `REDIS_URL` — Railway Redis internal URL (`rediss://...@redis.railway.internal:6379`)
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — for push notifications in worker
- `RESEND_API_KEY` — for daily briefing email sending
- `LANGGRAPH_SERVER_PORT` — Railway sets `PORT` automatically; use `process.env.PORT`

---

## Common Pitfalls

### Pitfall 1: BullMQ Requires `maxRetriesPerRequest: null` on IORedis
**What goes wrong:** BullMQ Worker throws `"Command not allowed in MULTI/EXEC"` or `"BLMOVE"` errors at startup.
**Why it happens:** IORedis defaults to 20 retries per request. BullMQ's blocking commands (BLMOVE for job dequeue) need unlimited retries.
**How to avoid:** Always pass `maxRetriesPerRequest: null` to the IORedis constructor.
**Warning signs:** Worker starts but immediately logs connection errors and stops processing.

### Pitfall 2: Separate IORedis Instances for Queue and Worker
**What goes wrong:** BullMQ throws `"Cannot use same connection for both Queue and Worker"`.
**Why it happens:** BullMQ internally uses blocking Redis commands in the Worker that cannot share a connection used by a Queue.
**How to avoid:** Create a factory function `getRedisConnection()` and call it separately for each Queue and Worker instantiation.
**Warning signs:** Error message contains "Cannot use same connection" at startup.

### Pitfall 3: Silent TLS Failure on Railway Redis
**What goes wrong:** BullMQ connects but jobs are never dequeued; Redis connection drops after 30s.
**Why it happens:** Railway Redis uses `rediss://` (TLS); without `tls: {}` in IORedis options the connection fails silently.
**How to avoid:** Check `REDIS_URL` prefix — if `rediss://`, pass `tls: {}`. See STATE.md decision.
**Warning signs:** Queue depth grows but Worker metrics show 0 processed; IORedis logs `ECONNRESET`.

### Pitfall 4: Repeatable Job Registration Race on Startup
**What goes wrong:** Multiple daily-briefing jobs accumulate in Redis over time.
**Why it happens:** Each server restart calls `queue.add()` for repeatable jobs without a stable `jobId`.
**How to avoid:** Always use `jobId: 'job-name-singleton'` for repeatable jobs. BullMQ deduplicates by jobId.
**Warning signs:** Redis `ZRANGEBYSCORE` on `bull:briefing:delayed` shows multiple entries with the same name.

### Pitfall 5: `get_due_cadence_agents()` Not Present on Railway Postgres
**What goes wrong:** Dispatcher cron tick throws `function get_due_cadence_agents() does not exist`.
**Why it happens:** The Railway PRODUCTION_MIGRATION.sql may not include the Phase 20 cadence migrations.
**How to avoid:** 23-03 plan task must verify the function exists via `SELECT proname FROM pg_proc WHERE proname = 'get_due_cadence_agents'` before implementing the dispatcher.
**Warning signs:** First dispatcher tick logs a pg error; no jobs appear in BullMQ queue.

### Pitfall 6: `graph.invoke()` in Worker Uses Wrong Thread ID
**What goes wrong:** Heartbeat runs contaminate user conversation history.
**Why it happens:** If the worker uses the same `thread_id` as a user's chat thread, the heartbeat messages appear in the conversation checkpoint.
**How to avoid:** Use a dedicated heartbeat thread prefix: `heartbeat-${user_id}-${agent_type_id}`. This matches the existing `isProactive: true` flag in index.ts.
**Warning signs:** User sees "Heartbeat check" messages in their chat history.

### Pitfall 7: Playwright Chromium Not Found After Volume Mount
**What goes wrong:** Marketer agent fails with `browserType.launch: Executable doesn't exist`.
**Why it happens:** `PLAYWRIGHT_BROWSERS_PATH=/playwright-data` but the Dockerfile installs Chromium before the volume is mounted, so the volume is empty on first launch.
**How to avoid:** Set `PLAYWRIGHT_BROWSERS_PATH=/playwright-data` and run `npx playwright install chromium --with-deps` in the Dockerfile final stage. The install destination is `/playwright-data` at build time and the Railway volume is initialized from the image layer on first deploy.
**Warning signs:** First deploy works; subsequent deploys fail if volume was not initialized.

---

## Code Examples

### IORedis Connection Factory

```typescript
// src/cadence/redis.ts
import IORedis from 'ioredis';

let _redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (_redisConnection) return _redisConnection;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is required');
  _redisConnection = new IORedis(url, {
    tls: url.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: null,  // Required by BullMQ
    enableReadyCheck: false,     // Prevents startup delay
  });
  return _redisConnection;
}
```

### Checking Queue Depth (verification)

```typescript
// After enqueueing in dispatcher:
const waiting = await heartbeatQueue.getWaitingCount();
console.log(`[cadence-dispatcher] Queue depth after tick: ${waiting}`);
```

### Calling get_due_cadence_agents() via pg Pool

```typescript
// Reuse the existing pg pool from persistence layer
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query<{
  id: string;
  user_id: string;
  agent_type_id: string;
  heartbeat_interval_hours: number;
  cadence_tier: string;
}>('SELECT * FROM get_due_cadence_agents()');
```

### Daily Briefing Worker Processor (skeleton)

```typescript
// SCHED-04: Daily briefing processor replaces send-daily-briefing edge function
async function processDailyBriefing(_job: Job): Promise<void> {
  // 1. Query all users with automation_settings.personal_assistant.is_enabled = true
  const { rows: users } = await pool.query(`
    SELECT DISTINCT user_id FROM automation_settings
    WHERE agent_type = 'personal_assistant' AND is_enabled = true
  `);

  for (const { user_id } of users) {
    // 2. Invoke personal_assistant graph with briefing prompt
    const graph = createSupervisorGraph(await getCheckpointer());
    await graph.invoke({
      messages: [{ role: 'user', content: 'Generate morning briefing.' }],
      userId: user_id,
      agentType: 'personal_assistant',
      isProactive: true,
    }, { configurable: { thread_id: `briefing-${user_id}-${Date.now()}` } });
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg_cron HTTP POST to Edge Function | node-cron in-process enqueue to BullMQ | Phase 23 | No network hop for dispatch; survives pg_cron removal |
| pgmq visibility-timeout dequeue | BullMQ job lock + auto-requeue | Phase 23 | BullMQ handles retry semantics; no manual ack/nack |
| Deno `jsr:@negrel/webpush` | `web-push` npm 3.6.7 | Phase 22 (SCHED-05) | Already done in api-server; LangGraph worker references same env vars |
| pg_net HTTP to heartbeat-runner | BullMQ Worker calling graph.invoke() | Phase 23 | In-process; no HTTP serialization; persistent job state |

**Deprecated/outdated:**
- `pgmq.create('heartbeat_jobs')` (migration 20260313000006): NOT applied to Railway Postgres (Phase 20 strips pgmq).
- `cron.schedule()` (migration 20260313000007): NOT applied to Railway Postgres (pg_cron extension unavailable on Railway).
- `jsr:@negrel/webpush`: Deno-only package; replaced by `web-push` npm package (already done in api-server Phase 22).

---

## Open Questions

1. **Does `get_due_cadence_agents()` already exist on Railway Postgres?**
   - What we know: The function was defined in migration `20260320000002_cadence_dispatcher_v2.sql` which is a Phase 20 migration.
   - What's unclear: Whether Phase 20's Railway migration script included this file (the PRODUCTION_MIGRATION.sql is from Phase 1-5 vintage; Phase 20 added new migrations separately).
   - Recommendation: 23-03 plan task starts with a verification query before writing any dispatcher code. If absent, include the SQL as a Railway migration step.

2. **Should the LangGraph worker call `graph.invoke()` directly for daily briefing, or POST to `/api/send-daily-briefing` on the API server?**
   - What we know: The existing `send-daily-briefing` edge function does its own LLM call (not via graph). The LangGraph server already has a `personal_assistant` agent.
   - What's unclear: Whether the daily briefing quality is better routed through the full supervisor graph or via a direct Gemini call (as the old edge function did).
   - Recommendation: Route through `graph.invoke()` for consistency with heartbeat architecture. Use `isProactive: true` to bypass token budgets.

3. **How many BullMQ concurrency slots for heartbeat worker?**
   - What we know: The old pgmq runner dequeued 5 messages at a time with 30s visibility.
   - What's unclear: Railway container memory limits — each `graph.invoke()` may use 50-100MB.
   - Recommendation: Start with `concurrency: 3` and tune based on Railway memory metrics.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/langgraph-server/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/` |
| Full suite command | `cd worrylesssuperagent/langgraph-server && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAIL-04 | Dockerfile builds + Playwright installs | manual smoke | `docker build -f worrylesssuperagent/langgraph-server/Dockerfile .` | N/A |
| SCHED-01 | node-cron tick fires and calls `get_due_cadence_agents()` | unit (mock pg) | `npx vitest run src/cadence/cadence-dispatcher.test.ts` | ❌ Wave 0 |
| SCHED-02 | BullMQ worker processes job and returns without error | unit (mock graph.invoke) | `npx vitest run src/cadence/cadence-worker.test.ts` | ❌ Wave 0 |
| SCHED-03 | `get_due_cadence_agents()` function exists on Railway Postgres | manual/integration | `psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname = 'get_due_cadence_agents'"` | N/A |
| SCHED-04 | Repeatable jobs registered and appear in queue | unit (mock BullMQ Queue) | `npx vitest run src/cadence/cadence-dispatcher.test.ts` | ❌ Wave 0 |
| SCHED-05 | Push notification sent when severity is urgent | unit (mock web-push) | `npx vitest run src/cadence/cadence-worker.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd worrylesssuperagent/langgraph-server && npx vitest run src/cadence/`
- **Per wave merge:** `cd worrylesssuperagent/langgraph-server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/cadence/cadence-dispatcher.test.ts` — covers SCHED-01 + SCHED-04
- [ ] `src/cadence/cadence-worker.test.ts` — covers SCHED-02 + SCHED-05

*(Existing test infrastructure: vitest.config.ts already present; no framework install needed)*

---

## Sources

### Primary (HIGH confidence)

- BullMQ official docs (bullmq.io) — Queue, Worker, repeatable jobs, IORedis connection requirements
- node-cron GitHub README (kelektiv/node-cron) — cron syntax, `schedule()` API, v4 ESM support
- `worrylesssuperagent/supabase/migrations/20260320000002_cadence_dispatcher_v2.sql` — get_due_cadence_agents() full SQL (no pg_cron deps confirmed by code review)
- `worrylesssuperagent/langgraph-server/Dockerfile` — existing Playwright install; volume comment
- `api-server/src/routes/pushSubscriptions.ts` — web-push integration pattern (Phase 22 / SCHED-05)
- `.planning/STATE.md` decisions — BullMQ TLS requirement; BullMQ workers in LangGraph server
- `worrylesssuperagent/langgraph-server/src/index.ts` — `isProactive` flag usage; graph.invoke() pattern

### Secondary (MEDIUM confidence)

- npm registry (2026-03-21): bullmq@5.71.0, ioredis@5.10.1, node-cron@4.2.1, web-push@3.6.7

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry 2026-03-21
- Architecture: HIGH — patterns derived from existing codebase (api-server pushSubscriptions, langgraph-server index.ts) and STATE.md decisions
- SQL function: HIGH — source-reviewed; confirmed no pg_cron/pgmq in get_due_cadence_agents()
- Pitfalls: HIGH — TLS pitfall documented in STATE.md; others from BullMQ official docs
- Dockerfile/volume: HIGH — existing file reviewed; railway.toml pattern from Railway docs

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (BullMQ 5.x API is stable; node-cron 4.x is stable)
