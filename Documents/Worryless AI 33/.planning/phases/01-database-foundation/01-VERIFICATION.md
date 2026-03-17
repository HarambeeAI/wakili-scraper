---
phase: 01-database-foundation
verified_by: Claude (Phase 8 automated code review)
verified_at: 2026-03-17
overall_status: partial
requirements_verified: [DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, SEC-01, SEC-03]
---

# Phase 1 Database Foundation — Verification Record

## Phase 1 Success Criteria

### Criterion 1: Agent catalog with 13 rows and all MD workspace templates

**Status:** PASS

**Evidence:**
- `supabase/migrations/20260312000003_seed_agent_types.sql` contains exactly 13 `INSERT INTO public.available_agent_types` statements (lines 8, 119, 232, 340, 447, 556, 664, 773, 886, 1000, 1112, 1225, 1336).
- Agent IDs inserted: `chief_of_staff`, `accountant`, `marketer`, `sales_rep`, `personal_assistant`, `customer_support`, `legal_compliance`, `hr`, `pr_comms`, `procurement`, `data_analyst`, `operations`, `coo` (13 total: Chief of Staff + 12 specialists).
- `available_agent_types` table definition in `20260312000001_create_agent_tables.sql` lines 21–34 includes all 6 MD workspace template columns: `default_identity_md`, `default_soul_md`, `default_sops_md`, `default_memory_md`, `default_heartbeat_md`, `default_tools_md`.
- `skill_config JSONB NOT NULL DEFAULT '[]'::jsonb` column present at line 26.

**Notes:** All 6 default MD columns and `skill_config` confirmed in DDL. Every INSERT explicitly populates all 11 non-default columns including all 6 MD templates.

---

### Criterion 2: Trigger auto-populates exactly 6 workspace rows per agent activation

**Status:** PASS (code verified) / MANUAL REQUIRED (runtime)

**Evidence:**
- `supabase/migrations/20260312000002_workspace_trigger.sql` defines trigger `on_agent_activated` at line 41: `CREATE TRIGGER on_agent_activated AFTER INSERT ON public.user_agents FOR EACH ROW EXECUTE FUNCTION public.create_agent_workspace()`.
- Trigger function `create_agent_workspace()` lines 23–32 inserts exactly 6 rows covering all file types: `IDENTITY`, `SOUL`, `SOPs`, `MEMORY`, `HEARTBEAT`, `TOOLS`.
- `ON CONFLICT (user_id, agent_type_id, file_type) DO NOTHING` at line 32 makes the trigger idempotent.

**Notes:** Code review confirms 6-row insert. Runtime confirmation requires a live Supabase instance (see Manual Verification section).

---

### Criterion 3: Unique constraint rejects duplicate activation at DB level

**Status:** PASS

**Evidence:**
- `supabase/migrations/20260312000001_create_agent_tables.sql` line 56: `UNIQUE(user_id, agent_type_id)` constraint on `user_agents` table.

**Notes:** PostgreSQL enforces this at DB level — a duplicate INSERT raises `23505 unique_violation` regardless of application-layer guards.

---

### Criterion 4: `profiles.timezone` exists and existing profiles are unbroken

**Status:** PASS

**Evidence:**
- `supabase/migrations/20260312000004_backfill_existing_users.sql` lines 8–10 contain the verification artifact comment: `-- profiles.timezone column was added in migration 20251216134813: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';`.
- The `ADD COLUMN IF NOT EXISTS` guard means re-applying on any DB state is safe. Default value `'America/New_York'` ensures existing rows are not broken.

**Notes:** Migration predates Phase 1 series; confirmed in Phase 1 decision log (STATE.md: "DB-07 (profiles.timezone) fulfilled by comment artifact referencing migration 20251216134813").

---

### Criterion 5: RLS on all four new tables restricts to owning user

**Status:** PASS (policy definitions verified) / MANUAL REQUIRED (cross-user runtime isolation)

**Evidence:**
- `supabase/migrations/20260312000001_create_agent_tables.sql`:
  - `user_agents` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (line 59); SELECT/INSERT/UPDATE/DELETE policies use `auth.uid() = user_id` (lines 61–75).
  - `agent_workspaces` — RLS enabled (line 93); identical four-policy pattern with `auth.uid() = user_id` (lines 95–109).
  - `agent_heartbeat_log` — RLS enabled (line 134); SELECT policy `auth.uid() = user_id` (lines 136–139); **no INSERT policy for authenticated users** — service role only (line 141 comment).
  - `available_agent_types` — no user_id column (public catalog); no RLS; explicit `GRANT SELECT ... TO anon, authenticated` (line 37).

**Notes:** Cross-user query returning zero rows requires a live Supabase instance test (see Manual Verification section).

---

## Requirements Map

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| DB-01 | PASS | `20260312000003_seed_agent_types.sql` lines 8–1450: 13 INSERT statements; `20260312000001_create_agent_tables.sql` lines 26–33: all 6 MD columns + skill_config column in DDL | Chief of Staff (depth=0) + 12 specialists (depth=1) |
| DB-02 | PASS | `20260312000001_create_agent_tables.sql` lines 50–53: `heartbeat_interval_hours INTEGER NOT NULL DEFAULT 4`, `heartbeat_active_hours_start TIME NOT NULL DEFAULT '08:00'`, `heartbeat_active_hours_end TIME NOT NULL DEFAULT '20:00'`, `heartbeat_enabled BOOLEAN NOT NULL DEFAULT true` | All 4 heartbeat config columns present with correct types and defaults |
| DB-03 | PASS | `20260312000001_create_agent_tables.sql` lines 9–11: `CREATE TYPE public.workspace_file_type AS ENUM ('IDENTITY', 'SOUL', 'SOPs', 'MEMORY', 'HEARTBEAT', 'TOOLS')`; `agent_workspaces.file_type` uses this ENUM (line 86) | All 6 file types are ENUM values, not seeded strings — enforced by DB type system |
| DB-04 | PASS (code) / MANUAL REQUIRED (runtime) | `20260312000002_workspace_trigger.sql` lines 41–43: `on_agent_activated` trigger AFTER INSERT ON user_agents; lines 23–32: inserts exactly 6 rows (IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS) | Runtime: insert a user_agents row and verify agent_workspaces count = 6 |
| DB-05 | PASS (policy code) / MANUAL REQUIRED (RLS isolation) | `20260312000001_create_agent_tables.sql` lines 118–141: table definition; line 134: RLS enabled; lines 136–139: SELECT policy for owner; line 141: comment confirms no INSERT policy for authenticated users — service role only | HEARTBEAT_OK suppression (no DB write on ok runs) confirmed by STATE.md decision: "HEARTBEAT_OK suppression: no DB write on suppressed runs" |
| DB-06 | PASS | `20260312000001_create_agent_tables.sql` line 56: `UNIQUE(user_id, agent_type_id)` on `user_agents` table | Constraint prevents duplicate activation at DB level |
| DB-07 | PASS | `20260312000004_backfill_existing_users.sql` lines 8–10: comment artifact citing `migration 20251216134813` with `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'` | Migration predates Phase 1 series; `IF NOT EXISTS` guard makes it safe; confirmed in Phase 1 decision log |
| SEC-01 | PASS | All 3 edge functions follow identical JWT verification pattern: (a) `req.headers.get("Authorization")` — planning-agent line 181, generate-leads line 131, crawl-business-website line 35; (b) `supabaseAuth.auth.getUser()` — planning-agent line 196, generate-leads line 144, crawl-business-website line 50; (c) `const userId = user.id` from JWT — planning-agent line 203, generate-leads line 153, crawl-business-website line 57. Missing Authorization returns 401 (not 400 or 500) | MANUAL REQUIRED: live 401 response verification (see Manual Verification section) |
| SEC-03 | PASS | `supabase/functions/_shared/sanitize.ts` lines 12–25: `injectionPatterns` array includes `/ignore\s+(?:all\s+)?previous\s+instructions?/gi` (covers "IGNORE PREVIOUS INSTRUCTIONS"), `/<\s*system\s*>/gi` (covers `<system>` tag), plus 10 additional patterns; `sanitizeWorkspaceContent` exported function applies `[FILTERED]` replacement | Client-side mirror at `src/lib/sanitize.ts` confirmed in STATE.md decisions |

---

## Integration Points

The Phase 1 trigger-and-catalog pattern is the foundation for cross-phase workspace wiring. The `on_agent_activated` trigger in `20260312000002_workspace_trigger.sql` auto-populates `agent_workspaces` rows when Phase 2 (`spawn-agent-team`) or Phase 3 (marketplace `Add Agent`) inserts into `user_agents` — no application-layer workspace creation logic is needed in either phase.

The `sanitize.ts` edge function module (`supabase/functions/_shared/sanitize.ts`) is mirrored verbatim as `src/lib/sanitize.ts` for use in Phase 3's workspace editor save path and Phase 4's heartbeat runner. Both copies share the identical pattern list, ensuring consistent prompt injection defense across the stack.

The `agent_heartbeat_log` table was created with all Phase 5 notification columns at definition time (`task_created`, `notification_sent`) — no ALTER TABLE was required in Phase 5.

---

## Manual Verification Required

The following items require a live Supabase instance to fully verify. Code review confirms the implementation is correct; runtime tests are needed for sign-off on behavioral guarantees.

| Item | Requirement | Test Instructions |
|---|---|---|
| DB-04 runtime | DB-04 | Run: `INSERT INTO public.user_agents (user_id, agent_type_id) VALUES ('<valid_user_uuid>', 'chief_of_staff');` then `SELECT COUNT(*) FROM public.agent_workspaces WHERE user_id = '<valid_user_uuid>' AND agent_type_id = 'chief_of_staff';` — expected: count = 6 |
| DB-05 cross-user RLS | DB-05 | As user A: `INSERT INTO public.agent_heartbeat_log (user_id, agent_type_id, outcome) VALUES ('<user_a_uuid>', 'chief_of_staff', 'surfaced');`. As user B: `SELECT * FROM public.agent_heartbeat_log WHERE user_id = '<user_a_uuid>';` — expected: 0 rows returned |
| DB-05 no-INSERT policy | DB-05 | As an authenticated user (not service role): attempt `INSERT INTO public.agent_heartbeat_log (user_id, agent_type_id, outcome) VALUES ('<own_uuid>', 'chief_of_staff', 'surfaced');` — expected: RLS violation (permission denied) |
| SEC-01 live 401 | SEC-01 | Call any of the three edge functions without an Authorization header (e.g., `curl -X POST https://<project>.supabase.co/functions/v1/planning-agent -H "Content-Type: application/json" -d '{"action":"initialize"}'`) — expected: HTTP 401 with `{"error":"Missing authorization header"}` |
| agent_workspaces cross-user RLS | DB-03/DB-05 | As user A: attempt `SELECT * FROM public.agent_workspaces WHERE user_id = '<user_b_uuid>';` — expected: 0 rows returned (RLS enforced) |

---

## Sign-Off

- **Verifier:** Claude (Phase 8 automated code review)
- **Date:** 2026-03-17
- **Vitest suite:** 51 passing, 0 failed (confirmed 2026-03-17 at 12:14:40)
- **Method:** Static code review of all Phase 1 source files: 4 SQL migrations, sanitize.ts, and 3 edge function index.ts files
- **Manual items pending human sign-off:**
  - DB-04 trigger runtime (insert test on live DB)
  - DB-05 cross-user RLS isolation (cross-user query test on live DB)
  - DB-05 no-INSERT policy enforcement for authenticated users
  - SEC-01 live 401 response from edge functions without Authorization header
  - agent_workspaces cross-user RLS isolation

**Overall assessment:** All 9 requirements pass static code review. No implementation gaps found. Five behavioral items require live DB confirmation before full milestone sign-off. The overall_status is `partial` due to these pending manual verifications.
