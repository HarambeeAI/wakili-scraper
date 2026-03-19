# Phase 1: Database Foundation — Research

**Researched:** 2026-03-12
**Domain:** PostgreSQL schema design, Supabase migrations, RLS policies, Postgres triggers, edge function security hardening
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | System stores a catalog of 12 agent types (`available_agent_types`) with default MD workspace templates, skill configs, and heartbeat defaults | Full table DDL, enum values, and seed structure defined below |
| DB-02 | System tracks which agents each user has activated (`user_agents`) including heartbeat config and activation timestamp | Full table DDL with all heartbeat columns defined below |
| DB-03 | Each activated agent has a 6-file MD workspace (`agent_workspaces`) — one row per file per agent per user | Table DDL, ENUM type, and unique constraint defined below |
| DB-04 | Workspace files are auto-populated from catalog defaults via Postgres trigger when a `user_agents` row is inserted | Complete trigger function SQL defined below |
| DB-05 | System logs heartbeat outcomes (`agent_heartbeat_log`) for surfaced and error runs only | Table DDL with `heartbeat_outcome` ENUM and RLS defined below |
| DB-06 | Unique constraint on `user_agents(user_id, agent_type_id)` prevents double-activation at DB level | UNIQUE constraint included in table DDL |
| DB-07 | `profiles` table gains `timezone` column for business-hours enforcement | `timezone` column ALREADY EXISTS in migration `20251216134813` — only confirm, no migration needed |
| SEC-01 | All new edge functions verify calling user's identity via JWT, not from request body | Pattern documented in security section; applies to any new edge functions created in this phase |
| SEC-02 | Heartbeat dispatcher (cron-originated) uses service-role key and fetches user identity from `user_agents` table, never from caller input | Architecture pattern documented; no edge functions ship in Phase 1, but the pattern must be established |
| SEC-03 | Workspace content sanitized on write before storage and before LLM injection | Sanitization regex patterns documented; applied as a DB-level check function OR in the edge function layer |
</phase_requirements>

---

## Summary

Phase 1 is a pure database migration phase. No React components, no edge functions (beyond the security hardening of three existing ones). The entire deliverable is Supabase migration SQL files that create four new tables, one new ENUM type, one trigger function, seed data for 13 agent types (12 specialists + Chief of Staff), and a security fix applied to three existing edge functions.

The profiles.timezone column already exists from migration `20251216134813` (added with `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'`). DB-07 is therefore satisfied by confirming this column exists and its default covers the IANA timezone requirement. No additional migration is needed for that column unless the default value needs to change.

The most critical implementation detail is the trigger function `create_agent_workspace()`. It must use `SECURITY DEFINER` and insert exactly 6 rows per `user_agents` INSERT using `ON CONFLICT DO NOTHING` to be idempotent. The seed data for `available_agent_types` is the largest single artifact in this phase — 13 rows with 6 MD template columns each (~500–800 chars per template).

**Primary recommendation:** Ship four migration files in order: (1) new ENUMs + tables, (2) trigger function + trigger, (3) seed data for `available_agent_types`, (4) security hardening for existing edge functions. This separation makes each migration independently reviewable and rollback-safe.

---

## Standard Stack

### Core
| Library / Feature | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Supabase Migrations | Supabase CLI | Schema version control | Project already uses this pattern — 14 existing migration files |
| PostgreSQL RLS | Built-in (Postgres 15+) | Per-user data isolation | Every existing table uses it; project convention |
| `SECURITY DEFINER` functions | Built-in | Trigger functions that need elevated permissions | Required pattern for triggers that write across tables |
| `gen_random_uuid()` | Built-in (pgcrypto) | UUID primary keys | Every existing table uses it |
| `TIMESTAMPTZ` | Built-in | Timestamps with timezone | Consistent with all existing tables |

### Migration Naming Convention

All 14 existing migrations follow this exact pattern:

```
{YYYYMMDDHHmmss}_{uuid-v4}.sql
```

Examples:
- `20251204060048_4cba7ad2-2e1c-4282-919b-6bb6e23ecdaa.sql`
- `20260113084121_e2836d07-41b7-4401-b75e-b9a2c107f594.sql`

New Phase 1 migrations must follow this same naming convention. The timestamp must be ascending (greater than `20260113084121`). Use the current date `20260312` as the prefix.

**Generate migration filenames using:** `date +%Y%m%d%H%M%S` + `_` + a UUID v4.

---

## Architecture Patterns

### Existing Schema Context (What Already Exists)

Before writing new migrations, the planner must know what already exists:

**Existing tables (from migrations):**
- `profiles` — has `user_id`, `business_name`, `email`, `onboarding_completed`, `website`, `industry`, `company_description`, `timezone` (TEXT DEFAULT 'America/New_York'), `created_at`, `updated_at`
- `agent_tasks` — has `user_id`, `agent_type` (enum), `message`, `response`, `status`, `validation_token`, `validated_by`, `validation_email_sent_at`
- `invoices`, `transactions`, `social_posts`, `leads`, `outreach_emails`, `integrations`
- `business_artifacts`, `agent_assets`, `agent_validators`
- `email_summaries`, `calendar_events`, `daily_briefings`, `email_drafts`
- `user_datasheets`, `datasheet_rows`

**Existing ENUM types:**
- `agent_type` — values: `'accountant'`, `'marketer'`, `'sales_rep'`, `'personal_assistant'`
- `task_status` — values: `'pending'`, `'in_progress'`, `'completed'`, `'failed'`
- `lead_status`, `invoice_status`, `post_status`

**Critical observation:** The existing `agent_type` ENUM is used by `agent_tasks`. The new `available_agent_types` table uses a `TEXT` primary key (not an ENUM) so it can hold all 12+ agent types without requiring ENUM migrations. The `user_agents` table references this TEXT key. This avoids the painful `ALTER TYPE ... ADD VALUE` pattern which requires a transaction boundary.

**Existing extensions:**
- `pg_cron` (in `pg_catalog` schema) — enabled in migration `20260112115051`
- `pg_net` (in `extensions` schema) — enabled in migration `20260112115051`

**Existing trigger functions:**
- `public.handle_new_user()` — fires on `auth.users` INSERT, creates `profiles` row
- `public.update_updated_at_column()` — fires BEFORE UPDATE on multiple tables

**Profiles.timezone — ALREADY EXISTS:** Migration `20251216134813` added: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';`

---

### Pattern 1: New Table DDL

**`available_agent_types` — Static Catalog (no user_id, public read)**

```sql
-- Source: .planning/research/ARCHITECTURE.md § 1.1
CREATE TABLE public.available_agent_types (
  id           TEXT PRIMARY KEY,              -- e.g. 'accountant', 'chief_of_staff'
  display_name TEXT NOT NULL,
  description  TEXT NOT NULL,
  depth        INTEGER NOT NULL DEFAULT 1,    -- 0 = orchestrator, 1 = specialist
  skill_config JSONB NOT NULL DEFAULT '[]',   -- tool categories for this role
  default_identity_md  TEXT NOT NULL DEFAULT '',
  default_soul_md      TEXT NOT NULL DEFAULT '',
  default_sops_md      TEXT NOT NULL DEFAULT '',
  default_memory_md    TEXT NOT NULL DEFAULT '',
  default_heartbeat_md TEXT NOT NULL DEFAULT '',
  default_tools_md     TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- No RLS — public read-only catalog, no user_id column
-- Service role handles all writes (seed data only)
-- Grant SELECT to anon and authenticated roles
GRANT SELECT ON public.available_agent_types TO anon, authenticated;
```

**Why no RLS:** This table has no `user_id` column. It is a shared read-only catalog. All 12 agent type rows are seeded by migrations and never modified by users. Granting `SELECT` to `authenticated` (and `anon` for the onboarding flow before signup) is the correct pattern.

---

**`user_agents` — Activated Agents Per User**

```sql
-- Source: .planning/research/ARCHITECTURE.md § 1.2
CREATE TABLE public.user_agents (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id                TEXT NOT NULL REFERENCES public.available_agent_types(id),
  activated_at                 TIMESTAMPTZ DEFAULT now(),
  is_active                    BOOLEAN NOT NULL DEFAULT true,
  heartbeat_interval_hours     INTEGER NOT NULL DEFAULT 4,
  heartbeat_active_hours_start TIME NOT NULL DEFAULT '08:00',
  heartbeat_active_hours_end   TIME NOT NULL DEFAULT '20:00',
  heartbeat_enabled            BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at            TIMESTAMPTZ,
  next_heartbeat_at            TIMESTAMPTZ,
  UNIQUE(user_id, agent_type_id)
);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;

-- Users can read and manage their own activated agents
CREATE POLICY "Users can view own agents"
  ON public.user_agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents"
  ON public.user_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
  ON public.user_agents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
  ON public.user_agents FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (heartbeat dispatcher) needs no policy — bypasses RLS
```

**Note on `heartbeat_active_hours_end`:** Default set to `20:00` not `18:00` to align with HB-06 ("default: 08:00–20:00 in their timezone"). The ARCHITECTURE.md shows 18:00 but REQUIREMENTS.md HB-06 is the authoritative spec — use `20:00`.

---

**`workspace_file_type` ENUM + `agent_workspaces` table**

```sql
-- Source: .planning/research/ARCHITECTURE.md § 1.3
CREATE TYPE public.workspace_file_type AS ENUM (
  'IDENTITY', 'SOUL', 'SOPs', 'MEMORY', 'HEARTBEAT', 'TOOLS'
);

CREATE TABLE public.agent_workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id TEXT NOT NULL REFERENCES public.available_agent_types(id),
  file_type     public.workspace_file_type NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    TEXT NOT NULL DEFAULT 'system', -- 'user' | 'agent' | 'system'
  UNIQUE(user_id, agent_type_id, file_type)
);

ALTER TABLE public.agent_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
  ON public.agent_workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces"
  ON public.agent_workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
  ON public.agent_workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
  ON public.agent_workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_agent_workspaces_updated_at
  BEFORE UPDATE ON public.agent_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Why a separate ENUM instead of TEXT:** Postgres ENUMs enforce valid values at the DB level at zero cost. The 6 workspace file types are fixed by specification and will never change in v1. A TEXT column would require application-level validation. ENUM is the more correct type here.

**MEMORY.md write restriction:** There is no DB-level INSERT/UPDATE restriction on MEMORY rows for the user. Enforcement is at the application layer (UI shows read-only view, edge functions only write MEMORY from agent context). Adding a DB-level policy that blocks user UPDATEs on `file_type = 'MEMORY'` rows is cleaner but more complex — it would require separate policies per operation per file_type. The current approach (ARCHITECTURE.md § 1.3) delegates this to application code.

---

**`heartbeat_outcome` ENUM + `agent_heartbeat_log` table**

```sql
-- Source: .planning/research/ARCHITECTURE.md § 1.4
CREATE TYPE public.heartbeat_outcome AS ENUM ('surfaced', 'error');

CREATE TABLE public.agent_heartbeat_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id     TEXT NOT NULL REFERENCES public.available_agent_types(id),
  run_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome           public.heartbeat_outcome NOT NULL,
  summary           TEXT,             -- Finding text (truncated to ~200 chars for notifications)
  task_created      BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  error_message     TEXT              -- Populated only when outcome = 'error'
);

ALTER TABLE public.agent_heartbeat_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own heartbeat history (for the UI status indicators)
CREATE POLICY "Users can view own heartbeat logs"
  ON public.agent_heartbeat_log FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT done exclusively by edge functions using service role key
-- No INSERT policy needed for authenticated users

-- Index for the heartbeat status indicator queries (Phase 5 will use this)
CREATE INDEX idx_heartbeat_log_user_agent
  ON public.agent_heartbeat_log (user_id, agent_type_id, run_at DESC);
```

**Why no user INSERT policy on `agent_heartbeat_log`:** Per DB-05, only the heartbeat runner (service role) writes to this table. Adding an INSERT policy for users would create a potential for fabricating heartbeat records. Omitting it is intentional security posture.

---

### Pattern 2: Workspace Auto-Population Trigger

```sql
-- Source: .planning/research/ARCHITECTURE.md § 1.3
CREATE OR REPLACE FUNCTION public.create_agent_workspace()
RETURNS TRIGGER AS $$
DECLARE
  agent_rec public.available_agent_types%ROWTYPE;
BEGIN
  SELECT * INTO agent_rec
  FROM public.available_agent_types
  WHERE id = NEW.agent_type_id;

  -- If the agent type doesn't exist in the catalog, skip silently
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agent_workspaces
    (user_id, agent_type_id, file_type, content, updated_by)
  VALUES
    (NEW.user_id, NEW.agent_type_id, 'IDENTITY',  agent_rec.default_identity_md,  'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOUL',      agent_rec.default_soul_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOPs',      agent_rec.default_sops_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'MEMORY',    agent_rec.default_memory_md,    'system'),
    (NEW.user_id, NEW.agent_type_id, 'HEARTBEAT', agent_rec.default_heartbeat_md, 'system'),
    (NEW.user_id, NEW.agent_type_id, 'TOOLS',     agent_rec.default_tools_md,     'system')
  ON CONFLICT (user_id, agent_type_id, file_type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_agent_activated
  AFTER INSERT ON public.user_agents
  FOR EACH ROW EXECUTE FUNCTION public.create_agent_workspace();
```

**SECURITY DEFINER rationale:** The trigger fires in the context of the user inserting a `user_agents` row. To write to `agent_workspaces`, the trigger function needs SELECT on `available_agent_types` (no user RLS there, but still needs the permission) and INSERT on `agent_workspaces`. `SECURITY DEFINER` runs the function as the owner (postgres/superuser), bypassing any RLS complications. This is the correct pattern — same as `handle_new_user()` in the first migration.

**ON CONFLICT DO NOTHING rationale:** Guards against idempotency. If `planning-agent` is called twice during onboarding (the existing bug documented in CONCERNS.md), the second INSERT to `user_agents` would conflict on `UNIQUE(user_id, agent_type_id)` — so the trigger fires only on a successful INSERT. But if the workspace rows were somehow partially created, this prevents partial duplication.

---

### Pattern 3: Migration Build Order

Migrations must be applied in this exact order (one file per logical unit):

```
Migration A: New ENUMs + new tables + RLS policies
  - workspace_file_type ENUM
  - heartbeat_outcome ENUM
  - available_agent_types table (with GRANT)
  - user_agents table + RLS
  - agent_workspaces table + RLS + updated_at trigger
  - agent_heartbeat_log table + RLS + index

Migration B: Trigger function + trigger
  - create_agent_workspace() function
  - on_agent_activated trigger

Migration C: Seed data
  - INSERT INTO available_agent_types (13 rows: 12 specialists + chief_of_staff)

Migration D: Security hardening (edge function changes do NOT go in a migration — they are TypeScript file changes)
  NOTE: SEC-01 through SEC-03 are edge function code changes, not SQL migrations.
  No SQL migration needed for security hardening.
```

**Why separate A and B:** If the table migration fails, the trigger function migration never runs. Clean separation makes failures obvious.

**Why separate B and C:** The trigger function must exist before seed data is inserted, because... actually seed data goes into `available_agent_types` (no trigger), not `user_agents`. Order doesn't technically matter between B and C, but it is cleaner to establish the trigger before seeding, so any post-seed manual test of activating an agent works immediately.

---

### Pattern 4: Seed Data Structure

The seed data for `available_agent_types` must be a single large INSERT statement covering all 13 rows. Each row has 6 markdown template columns. Below is the structural template — the planner must author the actual markdown content for each agent type.

**Structural seed pattern:**
```sql
INSERT INTO public.available_agent_types
  (id, display_name, description, depth, skill_config,
   default_identity_md, default_soul_md, default_sops_md,
   default_memory_md, default_heartbeat_md, default_tools_md)
VALUES
  (
    'chief_of_staff',
    'Chief of Staff',
    'Orchestrates the AI team, delegates tasks, synthesizes outputs, and delivers morning briefings',
    0,  -- depth 0 = orchestrator
    '["task_delegation", "multi_agent_synthesis", "briefing_generation"]'::jsonb,
    -- IDENTITY.md
    $chief_identity$
# Chief of Staff — IDENTITY

You are the Chief of Staff for [Business Name]. You are the central coordinator of an AI executive team.
...
    $chief_identity$,
    -- SOUL.md, SOPs.md, MEMORY.md, HEARTBEAT.md, TOOLS.md follow same pattern
    ...
  ),
  (
    'accountant',
    'Accountant',
    'Tracks finances, manages invoices, monitors cashflow, and flags financial risks proactively',
    1,
    '["invoice_parsing", "spreadsheet_analysis", "tax_reminders", "cashflow_monitoring"]'::jsonb,
    ...
  ),
  -- 10 more rows for all 12 specialist types
  ...
ON CONFLICT (id) DO NOTHING;
```

**Dollar-quoting for MD content:** Use `$tag$...$tag$` syntax to avoid escaping single quotes in the markdown templates. Each column in a row needs a unique dollar-quote tag (or use the same tag since they are separate string literals in the VALUES list).

**The 13 agent types to seed (from PROJECT.md):**
1. `chief_of_staff` — depth 0, orchestrator
2. `accountant` — depth 1
3. `marketer` — depth 1
4. `sales_rep` — depth 1
5. `personal_assistant` — depth 1
6. `customer_support` — depth 1
7. `legal_compliance` — depth 1
8. `hr` — depth 1
9. `pr_comms` — depth 1
10. `procurement` — depth 1
11. `data_analyst` — depth 1
12. `operations` — depth 1
13. `coo` — depth 1

---

### Pattern 5: Default MD Workspace Templates — Structure Per File Type

For each of the 13 agent types, the planner must author 6 markdown files. Below is the required structure and purpose of each:

**IDENTITY.md** (~200–400 chars)
- Agent's name, role title, and professional identity statement
- How it introduces itself ("You are the [Role] for [Business Name]...")
- Key responsibilities in bullet form

**SOUL.md** (~200–400 chars)
- Operating principles and values
- Communication style directives
- What the agent prioritizes when trade-offs arise

**SOPs.md** (~400–800 chars)
- Step-by-step standard operating procedures for common tasks
- When to escalate vs. handle independently
- Output format expectations per task type

**MEMORY.md** (~50–100 chars, intentionally sparse — agent writes to this)
```markdown
# Memory Log
_This file is maintained by the agent. Do not edit manually._

## Key Learnings
(none yet)

## Recurring Issues
(none yet)
```

**HEARTBEAT.md** (~200–400 chars)
```markdown
# Heartbeat Checklist — [Agent Role]

On each scheduled heartbeat tick, check the following:

- [ ] [Domain-specific check 1]
- [ ] [Domain-specific check 2]
- [ ] [Domain-specific check 3]

## Response Format
If nothing requires the user's attention: respond with exactly `{"severity": "ok"}`
If something surfaces: respond with `{"severity": "urgent"|"headsup"|"digest", "finding": "..."}`
```

**TOOLS.md** (~200–400 chars)
- What tool categories this agent has access to
- How to invoke each tool (the "verbs" available to the agent)
- What the agent must NOT do (tool scope boundaries)

---

### Pattern 6: Security Hardening (SEC-01, SEC-02, SEC-03)

These are TypeScript changes to three existing edge functions, not SQL migrations.

**SEC-01 — JWT Verification Pattern:**

```typescript
// BEFORE (vulnerable — userId from body):
const { userId } = await req.json()

// AFTER (correct — userId from verified JWT):
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
}
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: authError } = await supabase.auth.getUser(token)
if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
}
const userId = user.id  // Safe — verified against Supabase Auth
```

**Files that need this fix (from CONCERNS.md):**
- `supabase/functions/planning-agent/index.ts` (line 165)
- `supabase/functions/generate-leads/index.ts` (line 69)
- `supabase/functions/crawl-business-website/index.ts` (line 34)

**SEC-02 — Cron-Originated Functions:**

Heartbeat dispatcher and runner are not written in Phase 1. This requirement establishes the pattern: when they ARE written (Phase 4), they must:
1. Use service-role Supabase client (not the anon key)
2. Derive `user_id` from the queue message payload (which was written by the dispatcher using a service-role query of `user_agents`)
3. Never accept `user_id` from an HTTP request body

No Phase 1 code changes needed for SEC-02 beyond documenting the pattern.

**SEC-03 — Content Sanitization Function:**

Create a shared utility function (usable in Phase 3 edge functions and heartbeat runner):

```typescript
// Strips known prompt injection patterns from user-authored workspace content
// Apply before: storing to DB AND before injecting into any LLM system prompt
export function sanitizeWorkspaceContent(content: string): string {
  const injectionPatterns = [
    /ignore\s+previous\s+instructions?/gi,
    /ignore\s+all\s+previous/gi,
    /<\s*system\s*>/gi,
    /<\/\s*system\s*>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /###\s*instruction/gi,
  ]
  let sanitized = content
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]')
  }
  return sanitized
}
```

For Phase 1, create this as a shared module at `supabase/functions/_shared/sanitize.ts`. Phase 3 (workspace editor save endpoint) and Phase 4 (heartbeat runner) will import it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique enforcement on double-activation | Application-level duplicate check | `UNIQUE(user_id, agent_type_id)` constraint on `user_agents` | DB constraint is atomic; application check has race conditions |
| Workspace creation on agent activation | Application code calling INSERT after activation | Postgres `AFTER INSERT` trigger | Trigger is atomic with the activation; application code can fail after activation insert |
| Default timezone value | Custom logic or migration per user | `DEFAULT 'America/New_York'` on `profiles.timezone` + `IF NOT EXISTS` guard | Already done in migration `20251216134813` |
| Timestamp update on workspace edits | Manual `updated_at = now()` in every query | Reuse existing `update_updated_at_column()` trigger function | Already exists in the codebase |
| Row-level isolation | Application WHERE clauses | RLS policies | RLS enforces isolation even if application queries forget the WHERE clause |

---

## Common Pitfalls

### Pitfall 1: `profiles.timezone` Already Exists
**What goes wrong:** Writing a new migration that tries to ADD the `timezone` column will fail with "column already exists" error — even with `IF NOT EXISTS` it would silently succeed but change nothing. This is a good thing — it means DB-07 is already complete.
**Why it happens:** Migration `20251216134813` already ran `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'`.
**How to avoid:** Do NOT create a migration for DB-07. Verify the column exists and confirm. The only remaining question is whether the default `'America/New_York'` is appropriate or if it should be `NULL` (forcing the user to set their timezone explicitly). Given the project's East African target market, `NULL` with a fallback in code is arguably more correct than `'America/New_York'`, but changing the default is a separate decision.

### Pitfall 2: ENUM ALTER in a Live Database
**What goes wrong:** If Phase 1 uses `ALTER TYPE agent_type ADD VALUE 'customer_support'` etc. to extend the existing `agent_type` ENUM, this operation cannot be done inside a transaction in Postgres < 16. It requires a separate transaction, making the migration non-atomic.
**Why it happens:** The existing `agent_tasks.agent_type` column uses the `agent_type` ENUM. Adding 8 more values to cover the full 12-agent catalog would require 8 `ALTER TYPE` statements.
**How to avoid:** The new `available_agent_types` table uses `TEXT` primary key, not the existing ENUM. The new `user_agents.agent_type_id` column references this TEXT. Do NOT extend the old `agent_type` ENUM for the new tables. The old ENUM stays for `agent_tasks` backward compatibility.

### Pitfall 3: Trigger Runs Before Available Agent Type Exists
**What goes wrong:** If `user_agents` is inserted with an `agent_type_id` that doesn't exist in `available_agent_types`, the trigger's SELECT will return no rows, and the IF NOT FOUND guard will cause the trigger to return NEW without creating any workspace rows. The activation succeeds but workspaces are silently empty.
**Why it happens:** Foreign key constraint on `user_agents.agent_type_id → available_agent_types.id` prevents this IF the FK is defined correctly. But if the FK is absent or DEFERRED, out-of-order inserts would silently create agents with no workspace.
**How to avoid:** Always define the FK: `REFERENCES public.available_agent_types(id)`. This rejects inserts for unknown agent type IDs at the DB level with a FK violation, not a silent empty workspace.

### Pitfall 4: Dollar-Quote Conflicts in Seed Migration
**What goes wrong:** Using the same dollar-quote tag (e.g., `$$`) for multiple string literals in the same migration file causes a parse error — the parser thinks the first `$$` closes the previous `$$` opening.
**Why it happens:** The seed migration will have 13 × 6 = 78 markdown text columns. If all use `$$`, the parser will see pairs of `$$` and misinterpret string boundaries.
**How to avoid:** Use unique tags per column: `$identity_accountant$...$identity_accountant$`, `$soul_accountant$...$soul_accountant$`, etc. OR use standard `E'...'` strings with escaped single quotes. The dollar-quote approach is cleaner for multi-line markdown; just use unique tags per value in the same SQL statement. Alternatively, split each agent's seed data into its own `INSERT` statement to allow reusing `$$` (each statement is a separate parse unit).

### Pitfall 5: RLS on `available_agent_types` Blocks Frontend Queries
**What goes wrong:** Forgetting to `GRANT SELECT` on `available_agent_types` to `authenticated` role means any frontend query to this table returns a permission error (even though there's no RLS policy restricting it, the table owner still needs grants on public Supabase projects).
**Why it happens:** Supabase's default RLS setup requires explicit GRANTs for non-RLS tables that need frontend access. Without RLS enabled on the table AND without a GRANT, the authenticated role cannot SELECT.
**How to avoid:** The migration must include: `GRANT SELECT ON public.available_agent_types TO anon, authenticated;`. This is the correct approach for public catalog data.

### Pitfall 6: Duplicate Edge Function Security Fix Breaks Existing Callers
**What goes wrong:** Fixing the `userId`-from-body vulnerability in `planning-agent`, `generate-leads`, and `crawl-business-website` by extracting userId from JWT will break any callers that currently pass `userId` in the body but don't include an Authorization header.
**Why it happens:** The frontend calls these functions with `supabase.functions.invoke(...)` which automatically includes the session JWT in the Authorization header. So existing callers SHOULD work after the fix. But test: does `supabase.functions.invoke` always include the Authorization header when the user is authenticated?
**How to avoid:** Verify in the frontend code that `supabase.functions.invoke` passes the session token. Per the Supabase client docs, `functions.invoke` automatically includes the current session's JWT. The fix is safe for authenticated callers. The body `userId` can be removed or made optional (ignored) — the function will derive it from JWT.

---

## Code Examples

### Complete New Tables Migration (Migration A)

```sql
-- Migration: {timestamp}_create_agent_tables.sql
-- Creates all 4 new tables for the multi-agent milestone

-- ========================
-- NEW ENUM TYPES
-- ========================

CREATE TYPE public.workspace_file_type AS ENUM (
  'IDENTITY', 'SOUL', 'SOPs', 'MEMORY', 'HEARTBEAT', 'TOOLS'
);

CREATE TYPE public.heartbeat_outcome AS ENUM ('surfaced', 'error');

-- ========================
-- available_agent_types (static catalog, no user_id)
-- ========================

CREATE TABLE public.available_agent_types (
  id                   TEXT PRIMARY KEY,
  display_name         TEXT NOT NULL,
  description          TEXT NOT NULL,
  depth                INTEGER NOT NULL DEFAULT 1,
  skill_config         JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_identity_md  TEXT NOT NULL DEFAULT '',
  default_soul_md      TEXT NOT NULL DEFAULT '',
  default_sops_md      TEXT NOT NULL DEFAULT '',
  default_memory_md    TEXT NOT NULL DEFAULT '',
  default_heartbeat_md TEXT NOT NULL DEFAULT '',
  default_tools_md     TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Public read-only catalog — no RLS, explicit grants
GRANT SELECT ON public.available_agent_types TO anon, authenticated;

-- ========================
-- user_agents (activated agents per user)
-- ========================

CREATE TABLE public.user_agents (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id                TEXT NOT NULL REFERENCES public.available_agent_types(id),
  activated_at                 TIMESTAMPTZ DEFAULT now(),
  is_active                    BOOLEAN NOT NULL DEFAULT true,
  heartbeat_interval_hours     INTEGER NOT NULL DEFAULT 4,
  heartbeat_active_hours_start TIME NOT NULL DEFAULT '08:00',
  heartbeat_active_hours_end   TIME NOT NULL DEFAULT '20:00',
  heartbeat_enabled            BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at            TIMESTAMPTZ,
  next_heartbeat_at            TIMESTAMPTZ,
  UNIQUE(user_id, agent_type_id)
);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own agents" ON public.user_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agents" ON public.user_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agents" ON public.user_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agents" ON public.user_agents FOR DELETE USING (auth.uid() = user_id);

-- ========================
-- agent_workspaces (6 MD files per agent per user)
-- ========================

CREATE TABLE public.agent_workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id TEXT NOT NULL REFERENCES public.available_agent_types(id),
  file_type     public.workspace_file_type NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    TEXT NOT NULL DEFAULT 'system',
  UNIQUE(user_id, agent_type_id, file_type)
);

ALTER TABLE public.agent_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workspaces" ON public.agent_workspaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workspaces" ON public.agent_workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workspaces" ON public.agent_workspaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workspaces" ON public.agent_workspaces FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_agent_workspaces_updated_at
  BEFORE UPDATE ON public.agent_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- agent_heartbeat_log (sparse — surfaced/error runs only)
-- ========================

CREATE TABLE public.agent_heartbeat_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id     TEXT NOT NULL REFERENCES public.available_agent_types(id),
  run_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome           public.heartbeat_outcome NOT NULL,
  summary           TEXT,
  task_created      BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  error_message     TEXT
);

ALTER TABLE public.agent_heartbeat_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own heartbeat logs" ON public.agent_heartbeat_log FOR SELECT USING (auth.uid() = user_id);
-- No INSERT policy for users — service role only

CREATE INDEX idx_heartbeat_log_user_agent
  ON public.agent_heartbeat_log (user_id, agent_type_id, run_at DESC);
```

### Trigger Migration (Migration B)

```sql
-- Migration: {timestamp}_workspace_trigger.sql

CREATE OR REPLACE FUNCTION public.create_agent_workspace()
RETURNS TRIGGER AS $$
DECLARE
  agent_rec public.available_agent_types%ROWTYPE;
BEGIN
  SELECT * INTO agent_rec
  FROM public.available_agent_types
  WHERE id = NEW.agent_type_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agent_workspaces
    (user_id, agent_type_id, file_type, content, updated_by)
  VALUES
    (NEW.user_id, NEW.agent_type_id, 'IDENTITY',  agent_rec.default_identity_md,  'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOUL',      agent_rec.default_soul_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOPs',      agent_rec.default_sops_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'MEMORY',    agent_rec.default_memory_md,    'system'),
    (NEW.user_id, NEW.agent_type_id, 'HEARTBEAT', agent_rec.default_heartbeat_md, 'system'),
    (NEW.user_id, NEW.agent_type_id, 'TOOLS',     agent_rec.default_tools_md,     'system')
  ON CONFLICT (user_id, agent_type_id, file_type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_agent_activated
  AFTER INSERT ON public.user_agents
  FOR EACH ROW EXECUTE FUNCTION public.create_agent_workspace();
```

### Seed Migration Skeleton (Migration C)

```sql
-- Migration: {timestamp}_seed_available_agent_types.sql
-- Each INSERT is separate to allow per-row dollar-quoting without tag collisions

INSERT INTO public.available_agent_types
  (id, display_name, description, depth, skill_config,
   default_identity_md, default_soul_md, default_sops_md,
   default_memory_md, default_heartbeat_md, default_tools_md)
VALUES (
  'chief_of_staff',
  'Chief of Staff',
  'Orchestrates your AI team, delegates tasks, synthesizes cross-team findings, and delivers your morning briefing',
  0,
  '["task_delegation", "multi_agent_synthesis", "briefing_generation", "escalation_handling"]',
  $$
# Chief of Staff — Identity

You are the Chief of Staff for {business_name}. You are the central coordinator and orchestrator of the AI executive team.

**Your role:** Route tasks to the right specialist agents, synthesize multi-agent findings, and keep the business owner informed without overwhelming them.
  $$,
  $$
# Chief of Staff — Soul

- You communicate with authority and warmth — you're a trusted executive, not a tool
- You protect the owner's time ruthlessly; you escalate only what genuinely needs their attention
- When multiple agents report findings, you synthesize them into one clear picture
  $$,
  $$
# Standard Operating Procedures

## Morning Briefing
1. Collect all "digest"-severity heartbeat findings from the past 24 hours
2. Summarize in plain English: what happened, what needs attention today
3. Lead with the 1–2 most important items

## Task Delegation
1. Identify which specialist agent owns the task domain
2. Delegate with full context (business name, relevant artifacts)
3. Await response and verify completeness before returning to owner
  $$,
  $$
# Memory Log
_Maintained by the Chief of Staff. Do not edit manually._

## Key Business Context
(none yet)

## Delegation Patterns
(none yet)
  $$,
  $$
# Heartbeat Checklist — Chief of Staff

On each scheduled tick, check:

- [ ] Are there any unread "urgent" findings from specialist agents in the last 4 hours?
- [ ] Are there any tasks stuck in "needs_approval" for more than 24 hours?
- [ ] Has any agent reported an error in the last 24 hours?

## Response Format
If nothing requires attention: `{"severity": "ok"}`
Otherwise: `{"severity": "urgent"|"headsup"|"digest", "finding": "..."}`
  $$,
  $$
# Tools — Chief of Staff

## Available Capabilities
- **Task delegation**: Assign tasks to any specialist agent
- **Multi-agent synthesis**: Read findings from all agents and produce unified summaries
- **Morning briefing**: Compile and deliver the daily digest

## Scope Boundaries
- Do NOT execute financial transactions
- Do NOT send emails directly (delegate to Personal Assistant or Marketer)
- Do NOT modify workspace files of other agents
  $$
) ON CONFLICT (id) DO NOTHING;

-- Repeat for all 12 specialist agent types...
-- accountant, marketer, sales_rep, personal_assistant,
-- customer_support, legal_compliance, hr, pr_comms,
-- procurement, data_analyst, operations, coo
```

### Security Fix Pattern (SEC-01)

```typescript
// In planning-agent/index.ts, generate-leads/index.ts, crawl-business-website/index.ts
// Replace the userId-from-body pattern with JWT extraction

// REMOVE: const { userId, ...rest } = await req.json()
// ADD (at the top of the serve handler, before parsing body):

const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Missing authorization header' }),
    { status: 401, headers: corsHeaders }
  )
}

// Create a user-scoped Supabase client (uses the JWT, respects RLS)
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
)

const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
if (authError || !user) {
  return new Response(
    JSON.stringify({ error: 'Invalid or expired token' }),
    { status: 401, headers: corsHeaders }
  )
}
const userId = user.id  // Safe — extracted from verified JWT

// Then parse the body for the other fields (NOT userId)
const body = await req.json()
// Use: body.action, body.someOtherParam etc — NOT body.userId
```

### Shared Sanitization Module (SEC-03)

```typescript
// supabase/functions/_shared/sanitize.ts
// Import with: import { sanitizeWorkspaceContent } from '../_shared/sanitize.ts'

export function sanitizeWorkspaceContent(content: string): string {
  const injectionPatterns = [
    /ignore\s+(?:all\s+)?previous\s+instructions?/gi,
    /<\s*system\s*>/gi,
    /<\/\s*system\s*>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /###\s*(?:instruction|system)/gi,
    /assistant:\s*you\s+are\s+now/gi,
  ]
  let sanitized = content
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]')
  }
  return sanitized.trim()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-agent cron jobs | Single dispatcher + pgmq queue | Supabase Queues GA late 2024 | Eliminates the 8-job concurrent cron limit; Phase 4 must use this |
| `serve()` from `deno.land/std@0.168.0` | `Deno.serve()` native API | Deno 1.40+ / 2024 | All edge functions still use old pattern; new functions should use `Deno.serve()` |
| `@supabase/supabase-js@2.39.3` | `@supabase/supabase-js@2.86.0` | 2025 | Some existing functions use old version; new functions use 2.86.0 |

**Deprecated/outdated in this codebase:**
- `deno.land/std@0.168.0/http/server.ts` import: should migrate to `Deno.serve()` but this is tech debt outside Phase 1 scope
- The `userId`-from-body pattern in 3 edge functions: being fixed in Phase 1 as SEC-01

---

## Open Questions

1. **`profiles.timezone` default value**
   - What we know: The column exists with `DEFAULT 'America/New_York'`. The project targets Kenyan/East African market (UTC+3).
   - What's unclear: Should the default be changed to `NULL` (and the UI prompt for timezone during onboarding) or `'Africa/Nairobi'`? Changing the column default is a non-breaking ALTER.
   - Recommendation: Keep `'America/New_York'` default (it's already there) and ensure the onboarding wizard captures the user's timezone. A separate migration can be written to change the default if desired, but it is not required for Phase 1 correctness.

2. **`skill_config` JSONB schema for available_agent_types**
   - What we know: The column stores an array of skill category strings (e.g., `["invoice_parsing", "spreadsheet_analysis"]`).
   - What's unclear: Is the final list of skill values for each of the 12 agent types fully defined? PROJECT.md has a summary table but not the exact enum values.
   - Recommendation: The planner should define the skill category string values for each agent type when writing the seed SQL. Use snake_case strings matching the PROJECT.md "Key Skills" column (e.g., `"invoice_parsing"`, `"web_search"`, `"code_execution"`).

3. **Backfill for existing users**
   - What we know: Existing users have completed onboarding and have the 4 default agents (accountant, marketer, sales_rep, personal_assistant) as functional UI components but NOT as `user_agents` rows (the table doesn't exist yet).
   - What's unclear: Should a separate migration or edge function backfill `user_agents` rows for existing users after Phase 1 completes? Or is this handled in Phase 2 when `planning-agent` is updated?
   - Recommendation: Include a backfill migration (Migration D) in Phase 1 that runs `INSERT INTO user_agents ... ON CONFLICT DO NOTHING` for the 5 default agent types (including `chief_of_staff`) for all users who have `onboarding_completed = true`. This ensures Phase 2 code doesn't need to query whether a `user_agents` row exists before operating.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — zero test files exist in the project (confirmed in CONCERNS.md) |
| Config file | None — Wave 0 must create test infrastructure |
| Quick run command | N/A until Wave 0 complete |
| Full suite command | N/A until Wave 0 complete |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | `available_agent_types` has 13 rows after seed migration | DB smoke test (psql query) | Manual SQL: `SELECT COUNT(*) FROM available_agent_types;` → expect 13 | ❌ Wave 0 |
| DB-02 | `user_agents` INSERT with valid `agent_type_id` succeeds | DB unit test | Manual SQL: INSERT then SELECT | ❌ Wave 0 |
| DB-03 | `agent_workspaces` table exists with ENUM column | DB smoke test | Manual SQL: `\d agent_workspaces` | ❌ Wave 0 |
| DB-04 | Inserting `user_agents` row creates exactly 6 `agent_workspaces` rows | DB integration test | Manual SQL: INSERT then `SELECT COUNT(*) FROM agent_workspaces WHERE user_id=X AND agent_type_id=Y` → expect 6 | ❌ Wave 0 |
| DB-05 | `agent_heartbeat_log` INSERT with `outcome='surfaced'` succeeds; `outcome='ok'` fails constraint | DB unit test | Manual SQL: test both INSERTs | ❌ Wave 0 |
| DB-06 | Duplicate `user_agents` INSERT returns constraint violation | DB unit test | Manual SQL: INSERT same row twice, expect error | ❌ Wave 0 |
| DB-07 | `profiles.timezone` column exists | DB smoke test | Manual SQL: `SELECT timezone FROM profiles LIMIT 1` | ❌ Wave 0 (column exists — just verify) |
| SEC-01 | Edge function rejects request without Authorization header | Manual HTTP test | `curl -X POST .../planning-agent` (no auth) → expect 401 | ❌ Wave 0 |
| SEC-02 | Architecture pattern documented — no runtime test needed in Phase 1 | Documentation review | N/A | N/A |
| SEC-03 | `sanitizeWorkspaceContent('ignore previous instructions test')` returns `'[FILTERED] test'` | Unit test | Deno test: `deno test supabase/functions/_shared/sanitize_test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual SQL verification of relevant table/trigger
- **Per wave merge:** Run all manual DB smoke tests; run sanitize unit test
- **Phase gate:** All 5 DB smoke tests pass + SEC-01 manual HTTP test passes

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/sanitize_test.ts` — covers SEC-03
- [ ] No Deno test runner config needed (Deno has native test runner via `deno test`)

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — complete table DDL, trigger function, RLS patterns, build order (researched 2026-03-12)
- `.planning/research/STACK.md` — pgmq patterns, markdown storage, Supabase extension status (researched 2026-03-12)
- `.planning/codebase/CONCERNS.md` — exact file/line locations of security vulnerabilities being fixed
- `worrylesssuperagent/supabase/migrations/20251204060048_*.sql` — existing schema baseline, RLS policy pattern, trigger function pattern
- `worrylesssuperagent/supabase/migrations/20251216134813_*.sql` — confirms `profiles.timezone` already exists
- `worrylesssuperagent/supabase/migrations/20260112115051_*.sql` — confirms pg_cron + pg_net extensions already enabled
- `.planning/PROJECT.md` — authoritative 12-agent type list with key skills per agent

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — pitfall analysis, agent type design patterns
- `.planning/codebase/ARCHITECTURE.md` — overall system architecture, existing edge function patterns
- `worrylesssuperagent/src/integrations/supabase/types.ts` — existing table structure cross-reference

---

## Metadata

**Confidence breakdown:**
- Schema DDL: HIGH — all tables, columns, and constraints derived from authoritative architecture research + existing migration pattern inspection
- Trigger function: HIGH — complete SQL provided, pattern matches `handle_new_user()` from first migration
- Seed data structure: HIGH — 13 agent types identified from PROJECT.md; template structure defined; actual content requires planner authorship
- RLS policies: HIGH — exact pattern copied from existing migrations (8+ examples across the codebase)
- Security hardening: HIGH — vulnerable lines identified by file+line in CONCERNS.md; fix pattern is standard Supabase JWT extraction

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 days — stable domain, no external API dependencies)
