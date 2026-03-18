-- Migration: 20260319000002_governance_columns.sql
-- Purpose: Add governance columns for token budgets (GOV-02), atomic task checkout (GOV-04),
--          goal ancestry (GOV-03), and migrate agent_tasks.agent_type from ENUM to TEXT (v2 support)

-- ============================================================
-- Section A: Token budget columns on public.user_agents (GOV-02)
-- Lazy monthly reset: budget_reset_at checked on every call; no pg_cron required
-- ============================================================
ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS monthly_token_budget   INTEGER     DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS tokens_used_this_month INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_reset_at        TIMESTAMPTZ DEFAULT date_trunc('month', NOW() + INTERVAL '1 month'),
  ADD COLUMN IF NOT EXISTS budget_override_until  TIMESTAMPTZ;

-- ============================================================
-- Section B: Atomic checkout + goal ancestry columns on public.agent_tasks (GOV-04, GOV-03)
-- claimed_by: agent_type_id or 'heartbeat-runner' that owns this task
-- claimed_at: timestamp for stale-claim detection
-- goal_chain: JSONB array of { level, id?, description } — goal ancestry snapshot
-- ============================================================
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goal_chain JSONB DEFAULT NULL;

-- Partial index for fast claimable task queries (only unclaimed rows are candidates)
-- Reduces index size dramatically vs full table index
CREATE INDEX IF NOT EXISTS idx_agent_tasks_claimable
  ON public.agent_tasks (user_id, status, next_run_at)
  WHERE claimed_by IS NULL;

-- ============================================================
-- Section C: Migrate agent_tasks.agent_type from ENUM to TEXT (v2 agent types support)
-- The old public.agent_type ENUM only has 3 values: 'accountant', 'marketer', 'sales_rep'
-- v2 has 13 agent types referenced as TEXT in available_agent_types.id
-- USING clause preserves existing ENUM values as their TEXT representation
-- Do NOT drop public.agent_type ENUM here — other tables may reference it; defer cleanup
-- ============================================================
ALTER TABLE public.agent_tasks
  ALTER COLUMN agent_type TYPE TEXT USING agent_type::text;
