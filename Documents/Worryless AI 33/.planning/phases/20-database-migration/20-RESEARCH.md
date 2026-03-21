# Phase 20: Database Migration - Research

**Researched:** 2026-03-21
**Domain:** PostgreSQL schema migration — Supabase-to-Railway sanitization
**Confidence:** HIGH (all source migration files audited directly)

---

## Summary

Phase 20 converts 35 Supabase migration files into a single `RAILWAY_MIGRATION.sql` that applies cleanly to a vanilla Railway PostgreSQL instance (postgres:18-trixie, pgvector pre-installed). The core work is surgical removal of six categories of Supabase-specific SQL: `auth.users` FK references, `auth.uid()` RLS policies, `pgmq` queue calls, `pg_cron`/`cron.*` registrations, `pg_net`/`vault.*` HTTP-and-secret machinery, and `storage.*`/`supabase_realtime` publication references.

Replacing `auth.users` is the most structurally significant change: every table that references `auth.users(id) ON DELETE CASCADE` must instead reference a new `public.users` table that Logto will populate at sign-in (via Phase 21 API middleware). The `on_auth_user_created` trigger on `auth.users` must be replaced by an application-level insert in the API server's sign-in handler. Row Level Security policies and `auth.uid()` calls are dropped entirely; user isolation is enforced in application code by binding `user_id = $jwt_sub` in every SQL query.

The two plans map cleanly: Plan 20-01 is the authoring of `RAILWAY_MIGRATION.sql` (a local file operation), and Plan 20-02 is applying and verifying it against the live Railway Postgres instance provisioned in Phase 19.

**Primary recommendation:** Author RAILWAY_MIGRATION.sql as a single ordered flat file (not a migration runner) by concatenating all 35 migrations chronologically, then applying the six sanitization passes in one editing session. Apply with `psql $DATABASE_URL -f RAILWAY_MIGRATION.sql` and verify with a checklist query script.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | All 20+ Supabase migrations sanitized into RAILWAY_MIGRATION.sql (strip pg_cron, pgmq, pg_net, auth.users FK references, RLS policies, Supabase vault references) | Full migration audit below identifies every instance per category |
| DB-02 | Sanitized migrations applied to Railway PostgreSQL with all tables, indexes, and seed data created | Plan 20-02 apply + verify pattern documented in Architecture Patterns |
| DB-03 | `langgraph` schema created with checkpoints, checkpoint_writes, store tables | 20260318000001 already correct — no Supabase dependencies; keep verbatim |
| DB-04 | pgvector extension enabled with document_embeddings table | Extension install method changes; `extensions` schema reference changes to `public` |
| DB-05 | `profiles` table references `public.users` (not `auth.users`) and no `auth.*`, `pgmq.*`, `cron.*`, or `vault.*` references remain | auth.users FK pattern documented; `public.users` DDL specified below |
</phase_requirements>

---

## Complete Migration Audit

### All 35 Source Files (chronological order)

| # | File | Tables Created | Supabase-Specific Items |
|---|------|----------------|------------------------|
| 1 | `20251204060048_4cba7ad2` | profiles, agent_tasks, invoices, transactions, social_posts, leads, outreach_emails, integrations | `auth.users` FK x8, `auth.uid()` RLS x22, `on_auth_user_created` trigger on `auth.users`, `handle_new_user()` fn |
| 2 | `20251204060101_f2d5594d` | — | None (function fix only) |
| 3 | `20251204062328_1535d79f` | — | None (enum + column adds) |
| 4 | `20251204063320_ddc6ce15` | business_artifacts | `auth.uid()` RLS x4, `supabase_realtime` publication |
| 5 | `20251204071006_400d6fd7` | agent_assets | `auth.uid()` RLS x3 |
| 6 | `20251204115055_eb6608f5` | — | None (profile column add) |
| 7 | `20251204115350_1ca332e1` | — | None (profile column add) |
| 8 | `20251208095810_ce80ce71` | — | None (invoice column add) |
| 9 | `20251208123605_68c1946d` | automation_settings, task_templates | `auth.uid()` RLS x8 |
| 10 | `20251216113439_ff8a2405` | agent_validators | `auth.uid()` RLS x4 |
| 11 | `20251216134813_748bb5e8` | email_summaries, calendar_events, daily_briefings, email_drafts | `auth.uid()` RLS x16 |
| 12 | `20251216145906_04fefdf8` | — | `storage.*` bucket + policies x3 |
| 13 | `20260112115051_f7c4d2f1` | — | `pg_cron` + `pg_net` extension CREATE x2, `cron.*` grants |
| 14 | `20260113084121_e2836d07` | user_datasheets, datasheet_rows | `auth.uid()` RLS x7 |
| 15 | `20260312000001_create_agent_tables` | available_agent_types, user_agents, agent_workspaces, agent_heartbeat_log | `auth.users` FK x3, `auth.uid()` RLS x11, `GRANT SELECT TO anon, authenticated` |
| 16 | `20260312000002_workspace_trigger` | — | `GRANT EXECUTE TO authenticated` |
| 17 | `20260312000003_seed_agent_types` | — (seed data) | None |
| 18 | `20260312000004_backfill_existing_users` | — (backfill) | None |
| 19 | `20260312000005_tools_skill_config_verify` | — (patch) | None |
| 20 | `20260313000006_heartbeat_queue` | notifications | `pgmq.create('heartbeat_jobs')`, `auth.users` FK x1, `auth.uid()` RLS x2 |
| 21 | `20260313000007_heartbeat_cron_jobs` | — | `cron.schedule/unschedule` x2, `net.http_post` x2, `vault.decrypted_secrets` x4 — **ENTIRE FILE DROPPED** |
| 22 | `20260313000008_heartbeat_dispatcher_fn` | — (function) | `GRANT EXECUTE TO service_role` |
| 23 | `20260313000009_morning_digest_cron` | — | `cron.schedule/unschedule` x2, `net.http_post` x1, `vault.decrypted_secrets` x2 — **ENTIRE FILE DROPPED** |
| 24 | `20260313000010_push_subscriptions` | push_subscriptions | `auth.users` FK x1, `auth.uid()` RLS x1 |
| 25 | `20260313000011_next_digest_run_at` | — | `cron.schedule/unschedule` x2, `net.http_post`, `vault.decrypted_secrets` — **ENTIRE FILE DROPPED** |
| 26 | `20260318000001_langgraph_schema` | langgraph.checkpoints, langgraph.checkpoint_writes, langgraph.checkpoint_migrations, langgraph.store | `GRANT ... TO service_role` (keep — Railway uses a single superuser role) |
| 27 | `20260318000002_pgvector_embeddings` | document_embeddings | `CREATE EXTENSION vector WITH SCHEMA extensions` → change to `public`, `auth.users` FK x1, `auth.uid()` RLS x3 |
| 28 | `20260318000003_feature_flag` | — | None |
| 29 | `20260319000001_agent_audit_log` | agent_audit_log | `auth.users` FK x1, `auth.uid()` RLS x1, `GRANT EXECUTE TO service_role` |
| 30 | `20260319000002_governance_columns` | — | None |
| 31 | `20260319000003_acct_sales_schema` | — | None |
| 32 | `20260319000004_business_stage` | — | None |
| 33 | `20260320000001_cadence_config` | — | None |
| 34 | `20260320000001_ops_agent_tables` | support_tickets, contracts, candidates, press_coverage, projects, project_milestones | `auth.users` FK x5, `auth.uid()` RLS x5, `auth.uid()` in subquery x1 |
| 35 | `20260320000002_cadence_dispatcher_v2` | — (function) | `GRANT EXECUTE TO service_role` |
| 36 | `20260320000003_event_detector` | — (function + cron) | `pgmq_public.send()` x3, `cron.schedule/unschedule` x2 — **pg_cron block DROPPED, pgmq calls replaced** |

**Total application tables in `public` schema (verified):**
profiles, agent_tasks, invoices, transactions, social_posts, leads, outreach_emails, integrations, business_artifacts, agent_assets, automation_settings, task_templates, agent_validators, email_summaries, calendar_events, daily_briefings, email_drafts, user_datasheets, datasheet_rows, available_agent_types, user_agents, agent_workspaces, agent_heartbeat_log, notifications, push_subscriptions, document_embeddings, agent_audit_log, support_tickets, contracts, candidates, press_coverage, projects, project_milestones = **34 tables**

---

## Standard Stack

### Core Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| psql | Bundled with postgres:18 | Apply RAILWAY_MIGRATION.sql | `psql $DATABASE_URL -f RAILWAY_MIGRATION.sql` |
| Railway Postgres | postgres:18 (trixie template) | Target database | pgvector pre-installed via template |
| pgvector | pre-installed | Vector similarity search | Extension already active on Railway trixie template |

### Installation
No npm packages needed for this phase. Tools are pre-available in the Railway environment and local psql client.

---

## Architecture Patterns

### Six Sanitization Passes (apply in order)

#### Pass 1: Drop entire Supabase-only files
These three files contain ONLY pg_cron/vault/pg_net content. Drop them entirely from the compiled SQL.

- `20260112115051_f7c4d2f1` — pg_cron + pg_net extension creates
- `20260313000007_heartbeat_cron_jobs` — cron.schedule calls via vault secrets
- `20260313000009_morning_digest_cron` — cron.schedule via vault secrets
- `20260313000011_next_digest_run_at` — cron.schedule + digest scheduling via vault
- `20251216145906_04fefdf8` — storage bucket + storage.objects policies (no storage on Railway)

#### Pass 2: Create `public.users` table (NEW — insert at top of file)
Every `auth.users(id)` FK must resolve to this table. Logto will INSERT rows here upon first authenticated request (Phase 21). Structure matches what Logto supplies as `sub` claim (UUID).

```sql
-- public.users: populated by API server on first authenticated request (Phase 21)
-- Mirrors Logto's user identity into the application schema.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Pass 3: Replace all `auth.users` FK references

Every occurrence of:
```sql
REFERENCES auth.users(id) ON DELETE CASCADE
```
Becomes:
```sql
REFERENCES public.users(id) ON DELETE CASCADE
```

Also replace:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
With an INSERT on `public.users` instead:
```sql
-- profiles row created by API server at first sign-in (no trigger needed)
-- Drop handle_new_user() trigger entirely; function kept for reference but not wired.
```
And replace the trigger body to reference `public.users`:
```sql
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Pass 4: Drop all RLS policies and `ENABLE ROW LEVEL SECURITY`

Row Level Security relied on `auth.uid()`. On Railway, user isolation is enforced at the application layer: every query includes `WHERE user_id = $1` with `$1` bound to the `sub` claim from the Logto JWT. Drop all:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- `CREATE POLICY ...` statements
- Any `USING (auth.uid() = user_id)` or `WITH CHECK (auth.uid() = user_id)` expressions

#### Pass 5: Replace pgmq calls in `check_event_triggers()`

The `check_event_triggers()` function in `20260320000003_event_detector.sql` calls `pgmq_public.send()` three times. Replace these with direct INSERT into a lightweight `public.event_trigger_queue` table, or remove the pgmq calls and leave the queue empty (BullMQ in Phase 23 handles this differently). The safest approach: comment out the `pgmq_public.send()` calls and replace with a `RAISE NOTICE` stub. The actual event detection loop logic is kept; only the queue enqueue call changes.

```sql
-- RAILWAY: pgmq replaced by BullMQ (Phase 23).
-- Event detection function retained for Phase 23 worker to call directly.
-- pgmq_public.send() calls removed; BullMQ worker polls get_due_cadence_agents() instead.
```

Drop the `cron.schedule('check-event-triggers', ...)` block at the bottom of that file.

#### Pass 6: Fix pgvector extension schema

Supabase installs extensions in the `extensions` schema. Railway's trixie template installs `vector` in the `public` schema. Change:
```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```
To:
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- installs in public schema by default
```

### Pass 7: Handle `GRANT` statements for Supabase roles

Supabase-specific role references to drop or neutralize:
- `GRANT SELECT ON public.available_agent_types TO anon, authenticated;` — drop (no `anon`/`authenticated` roles on Railway)
- `GRANT EXECUTE ON FUNCTION ... TO service_role;` — Railway has a single `postgres` superuser; these GRANTs are no-ops but harmless. Keep or replace with `TO PUBLIC` if needed.
- `GRANT EXECUTE ON FUNCTION public.create_agent_workspace() TO authenticated;` — drop.

### `PRODUCTION_MIGRATION.sql` Note

The existing `PRODUCTION_MIGRATION.sql` in the migrations directory is an earlier concatenated snapshot covering phases 1-5 only. It is **not** the source of truth — use the 35 individual files in chronological order for the new `RAILWAY_MIGRATION.sql`.

### Recommended Project Structure
```
worrylesssuperagent/
├── RAILWAY_MIGRATION.sql      # Output of Plan 20-01 — single flat file
└── scripts/
    └── verify-railway-schema.sql  # Verification queries for Plan 20-02
```

### Anti-Patterns to Avoid

- **Don't run migrations via Supabase CLI against Railway.** The Supabase CLI assumes a Supabase-managed Postgres with special schemas (`_realtime`, `storage`, `auth`). Use plain `psql` directly.
- **Don't keep `ALTER PUBLICATION supabase_realtime ADD TABLE`** — the `supabase_realtime` publication does not exist on Railway. This line will error on apply.
- **Don't wrap the entire file in a transaction block.** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction in PostgreSQL (it commits immediately). The file must run outside a transaction wrapper, or each `ALTER TYPE ADD VALUE` must be in its own transaction. The safest approach: no wrapping transaction.
- **Don't assume pgvector dimension is flexible at apply time.** The `embedding vector(1536)` column is fixed. If the embedding model changes, a separate migration is required. Do not try to parameterize this in the initial apply.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User isolation without RLS | Custom schema-level views per user | `WHERE user_id = $jwt_sub` in every query | Application-layer scoping is simpler and faster without Supabase Auth |
| Migration runner | Custom version table + apply logic | Single flat `psql -f RAILWAY_MIGRATION.sql` | Fresh deploy has no prior state; ordered flat file is idempotent enough |
| pgmq queue on Railway | Postgres-native pgmq | BullMQ + Redis (Phase 23) | pgmq extension is not available on Railway's managed Postgres |
| pg_cron on Railway | pg_cron extension | node-cron inside LangGraph server (Phase 23) | pg_cron is not available on Railway Postgres |

---

## Common Pitfalls

### Pitfall 1: `ALTER TYPE ADD VALUE` inside a transaction
**What goes wrong:** PostgreSQL raises `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block` if the file is applied with `psql` in autocommit-off mode.
**Why it happens:** `ALTER TYPE ADD VALUE` has special transaction semantics in PostgreSQL — the new value is not visible until the transaction commits. Supabase migrations run each statement individually, bypassing this.
**How to avoid:** Apply with `psql` default settings (autocommit on). Do not wrap the file in `BEGIN ... COMMIT`. The file contains `ALTER TYPE lead_status ADD VALUE IF NOT EXISTS ...` and `ALTER TYPE agent_type ADD VALUE IF NOT EXISTS ...` that will fail inside a transaction.
**Warning signs:** Error message mentions "cannot run inside a transaction block."

### Pitfall 2: `REFERENCES auth.users` missed in one table
**What goes wrong:** `psql` errors with `ERROR: schema "auth" does not exist` on the first FK constraint that still references `auth.users`.
**Why it happens:** There are 16 `auth.users` FK references across 11 files. Missing even one causes the entire `RAILWAY_MIGRATION.sql` to fail at that statement (psql continues by default; the table is created without the FK, breaking referential integrity silently).
**How to avoid:** After authoring RAILWAY_MIGRATION.sql, run: `grep -n 'auth\.users\|auth\.uid' RAILWAY_MIGRATION.sql` — result must be zero matches before applying.
**Warning signs:** Tables apply but FK constraints silently absent.

### Pitfall 3: pgvector schema mismatch
**What goes wrong:** `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions` fails because the `extensions` schema does not exist on Railway, or the vector extension is already installed and the `WITH SCHEMA` conflicts.
**Why it happens:** Supabase installs extensions in a dedicated `extensions` schema. Railway's trixie template pre-installs vector in the `public` schema.
**How to avoid:** Use `CREATE EXTENSION IF NOT EXISTS vector;` (no schema clause). Railway's pre-installed extension will be a no-op and the table DDL `embedding vector(1536)` will resolve correctly.
**Warning signs:** `ERROR: schema "extensions" does not exist` or `ERROR: extension "vector" already exists`.

### Pitfall 4: `supabase_realtime` publication reference
**What goes wrong:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.business_artifacts` errors with `ERROR: publication "supabase_realtime" does not exist`.
**Why it happens:** Supabase auto-creates this publication for its Realtime service. Railway Postgres has no such publication.
**How to avoid:** Drop this line from the compiled RAILWAY_MIGRATION.sql entirely. Railway frontend will use polling or SSE from the API server rather than Postgres replication.
**Warning signs:** Error on the `business_artifacts` migration block.

### Pitfall 5: `service_role` / `anon` / `authenticated` role grants
**What goes wrong:** `GRANT SELECT ON ... TO anon, authenticated` errors with `ERROR: role "anon" does not exist`.
**Why it happens:** These are Supabase-created roles. Railway Postgres only has the `postgres` superuser.
**How to avoid:** Drop all `GRANT ... TO anon`, `GRANT ... TO authenticated`, and `GRANT EXECUTE TO service_role` statements. The Railway API server connects as `postgres` (superuser) and has all privileges.
**Warning signs:** `ERROR: role "anon" does not exist`.

### Pitfall 6: `PERFORM pgmq_public.send(...)` in `check_event_triggers()`
**What goes wrong:** The function compiles (it's PL/pgSQL, compiled lazily), but calling it at runtime fails with `ERROR: function pgmq_public.send(unknown, jsonb, integer) does not exist`.
**Why it happens:** The `pgmq` extension is not available on Railway.
**How to avoid:** Replace the three `PERFORM pgmq_public.send(...)` calls with no-ops or `RAISE NOTICE` in the compiled SQL. The BullMQ worker in Phase 23 will call `get_due_cadence_agents()` directly, making `check_event_triggers()` redundant for its original purpose.
**Warning signs:** Runtime error when any code calls `check_event_triggers()`.

### Pitfall 7: `handle_new_user()` trigger has no target
**What goes wrong:** If the trigger `on_auth_user_created` on `auth.users` is not dropped, psql may error because the `auth` schema doesn't exist.
**Why it happens:** Original migration creates the trigger on `auth.users`. On Railway there is no `auth` schema.
**How to avoid:** Drop the `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users ...` statement. Replace with a trigger on `public.users` or handle profile creation in the API server's sign-in route (Phase 21 decision). For this phase, create the trigger on `public.users`.

---

## Code Examples

### Complete list of `auth.users` FK occurrences (all 16 must change)

**File → Table → Column pattern:**
```
20251204060048  profiles.user_id          → REFERENCES public.users(id)
20251204060048  agent_tasks.user_id       → REFERENCES public.users(id)
20251204060048  invoices.user_id          → REFERENCES public.users(id)
20251204060048  transactions.user_id      → REFERENCES public.users(id)
20251204060048  social_posts.user_id      → REFERENCES public.users(id)
20251204060048  leads.user_id             → REFERENCES public.users(id)
20251204060emails.user_id     → REFERENCES public.users(id)
20251204060048  integrations.user_id      → REFERENCES public.users(id)
20260312000001  user_agents.user_id       → REFERENCES public.users(id)
20260312000001  agent_workspaces.user_id  → REFERENCES public.users(id)
20260312000001  agent_heartbeat_log.user_id → REFERENCES public.users(id)
20260313000006  notifications.user_id     → REFERENCES public.users(id)
20260313000010  push_subscriptions.user_id → REFERENCES public.users(id)
20260318000002  document_embeddings.user_id → REFERENCES public.users(id)
20260319000001  agent_audit_log.user_id   → REFERENCES public.users(id)
20260320000001  support_tickets.user_id   → REFERENCES public.users(id)
20260320000001  contracts.user_id         → REFERENCES public.users(id)
20260320000001  candidates.user_id        → REFERENCES public.users(id)
20260320000001  press_coverage.user_id    → REFERENCES public.users(id)
20260320000001  projects.user_id          → REFERENCES public.users(id)
```

### `public.users` table DDL (insert at top of RAILWAY_MIGRATION.sql)
```sql
-- public.users: Logto-managed identity, mirrored into app schema.
-- API server inserts/upserts on first authenticated request using JWT sub claim.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `handle_new_user()` trigger — Railway version
```sql
-- Replace auth.users trigger target with public.users
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### pgvector extension — Railway-correct form
```sql
-- Railway trixie template: vector pre-installed in public schema
CREATE EXTENSION IF NOT EXISTS vector;
```

### Verification script skeleton for Plan 20-02
```sql
-- Verify all application tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','agent_tasks','invoices','transactions','social_posts',
    'leads','outreach_emails','integrations','business_artifacts','agent_assets',
    'automation_settings','task_templates','agent_validators','email_summaries',
    'calendar_events','daily_briefings','email_drafts','user_datasheets',
    'datasheet_rows','available_agent_types','user_agents','agent_workspaces',
    'agent_heartbeat_log','notifications','push_subscriptions','document_embeddings',
    'agent_audit_log','support_tickets','contracts','candidates','press_coverage',
    'projects','project_milestones','users'
  )
ORDER BY table_name;
-- Expected: 35 rows

-- Verify langgraph schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'langgraph'
ORDER BY table_name;
-- Expected: checkpoint_migrations, checkpoint_writes, checkpoints, store

-- Verify pgvector active
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row

-- Verify no auth.* references in any function or trigger
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%auth.%';
-- Expected: 0 rows

-- Verify no RLS enabled
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 0 rows

-- Verify seed data in available_agent_types
SELECT COUNT(*) FROM public.available_agent_types;
-- Expected: 13

-- Verify profiles references public.users
SELECT
  tc.table_name, kcu.column_name, ccu.table_schema, ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'user_id';
-- Expected: foreign_table = 'users', table_schema = 'public'
```

### psql apply command
```bash
psql "$DATABASE_URL" -f worrylesssuperagent/RAILWAY_MIGRATION.sql 2>&1 | tee migration-log.txt
# Check for errors:
grep -i 'error\|fatal' migration-log.txt
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| RLS with `auth.uid()` | `WHERE user_id = $jwt_sub` in application queries | Simpler, faster — no Postgres function call overhead per row; auth enforcement moves to API layer |
| `pgmq` for background jobs | BullMQ + Redis (Phase 23) | `check_event_triggers()` pgmq calls must be stubbed in this phase; Phase 23 wires real job dispatch |
| `pg_cron` for scheduling | `node-cron` in LangGraph server (Phase 23) | All cron SQL blocks dropped in this phase; scheduling lives in application code |
| Supabase Realtime via publication | API Server SSE + polling | `supabase_realtime` publication reference dropped |

---

## Open Questions

1. **`check_event_triggers()` pgmq replacement**
   - What we know: Phase 23 uses BullMQ. The function body can be kept as pure event-detection SQL.
   - What's unclear: Should the function's pgmq calls become a no-op stub now, or should the function be restructured to return a result set that Phase 23's BullMQ worker can poll?
   - Recommendation: Replace `pgmq_public.send()` with `RAISE NOTICE` stub in Phase 20. Phase 23 will restructure the function to return a TABLE result set if needed.

2. **`project_milestones` RLS subquery references `auth.uid()`**
   - What we know: The policy is `USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_milestones.project_id AND user_id = auth.uid()))` — an indirect user check.
   - What's unclear: After RLS is dropped, the application must enforce this via a JOIN in any query on `project_milestones`.
   - Recommendation: Drop the policy with all others; document in Phase 22 API server that `project_milestones` queries must always JOIN `projects` and filter `projects.user_id = $jwt_sub`.

3. **`GRANT ... TO service_role` statements in langgraph schema**
   - What we know: Railway uses a single `postgres` superuser — it has all privileges already.
   - What's unclear: Whether these GRANTs error or silently no-op on Railway.
   - Recommendation: Keep the GRANTs as-is; if `service_role` role doesn't exist, psql will error. Safest: replace `TO service_role` with `TO postgres` or drop the GRANT lines entirely (superuser has all privileges).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (SQL verification queries — no automated test runner for this phase) |
| Config file | `scripts/verify-railway-schema.sql` (created in Plan 20-02) |
| Quick run command | `psql "$DATABASE_URL" -f scripts/verify-railway-schema.sql` |
| Full suite command | Same — all checks are in one file |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | RAILWAY_MIGRATION.sql applies with zero errors | smoke | `psql "$DATABASE_URL" -f RAILWAY_MIGRATION.sql 2>&1 \| grep -c ERROR` → must be 0 | Wave 0 |
| DB-02 | All 34 public tables + users table exist | smoke | `psql -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"` | Wave 0 |
| DB-03 | langgraph schema has 4 tables | smoke | `psql -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='langgraph'"` | Wave 0 |
| DB-04 | vector extension active + document_embeddings has embedding column | smoke | `psql -c "SELECT extname FROM pg_extension WHERE extname='vector'"` | Wave 0 |
| DB-05 | profiles.user_id FK points to public.users | smoke | verify-railway-schema.sql FK query | Wave 0 |

### Wave 0 Gaps
- [ ] `worrylesssuperagent/RAILWAY_MIGRATION.sql` — created in Plan 20-01
- [ ] `scripts/verify-railway-schema.sql` — created in Plan 20-02

---

## Sources

### Primary (HIGH confidence)
- Direct audit of all 35 migration files in `worrylesssuperagent/supabase/migrations/` — every `auth.*`, `pgmq`, `cron.*`, `vault.*`, `storage.*`, `supabase_realtime` occurrence catalogued above
- `REQUIREMENTS.md` — DB-01 through DB-05 requirements read directly
- `ROADMAP.md` — Phase 20 success criteria and plan structure read directly
- `STATE.md` — confirmed key decisions: Logto replaces Supabase Auth; BullMQ replaces pgmq; node-cron replaces pg_cron

### Secondary (MEDIUM confidence)
- PostgreSQL documentation (training knowledge): `ALTER TYPE ADD VALUE` cannot run inside a transaction — confirmed behavior, flagged in pitfalls
- Railway Postgres trixie template: pgvector pre-installed — confirmed from Phase 19 research context in STATE.md

### Tertiary (LOW confidence)
- `service_role` grant behavior on Railway Postgres: unverified whether Railway creates this role. Flag as open question.

---

## Metadata

**Confidence breakdown:**
- Migration audit: HIGH — all source files read directly
- Sanitization patterns: HIGH — derived from direct file inspection
- Railway Postgres extension behavior: MEDIUM — based on Phase 19 research in STATE.md and training knowledge
- `service_role` grant behavior: LOW — not confirmed against Railway docs

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain — PostgreSQL schema migration patterns do not change rapidly)
