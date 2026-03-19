-- Migration 20260320000001: cadence_config JSONB column + multi-tier timestamp columns
-- Purpose: Adds per-agent cadence configuration and next-run timestamps for the
--          proactive cadence engine (Phase 16). Enables daily/weekly/monthly/quarterly
--          heartbeat tiers, plus event-trigger cooldown tracking.
--
-- Depends on: 20260312000001_create_agent_tables.sql (user_agents table)
-- Used by:    20260320000002_cadence_dispatcher_v2.sql (get_due_cadence_agents function)
-- CAD-08 requirement: default config has sane defaults; users can adjust frequency

-- ──────────────────────────────────────────────────────────────────────────────
-- Add cadence_config JSONB column with default tier enablement flags
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS cadence_config JSONB NOT NULL DEFAULT '{
    "daily_enabled": true,
    "weekly_enabled": true,
    "monthly_enabled": false,
    "quarterly_enabled": false,
    "event_triggers_enabled": true,
    "event_cooldown_hours": 4
  }'::jsonb;

-- ──────────────────────────────────────────────────────────────────────────────
-- Add next-run timestamp columns for weekly/monthly/quarterly tiers
-- (daily tier reuses the existing next_heartbeat_at column)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS next_weekly_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_monthly_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_quarterly_heartbeat_at TIMESTAMPTZ;

-- Add last_event_notified_at for event-trigger cooldown tracking
ALTER TABLE public.user_agents
  ADD COLUMN IF NOT EXISTS last_event_notified_at TIMESTAMPTZ;

-- ──────────────────────────────────────────────────────────────────────────────
-- Backfill: set initial next-run times for existing active agents
-- Weekly:    next Monday 8am UTC (start of next week)
-- Monthly:   1st of next month 8am UTC
-- Quarterly: 1st of next quarter 8am UTC
-- Only set when the tier is enabled in cadence_config (weekly_enabled/monthly_enabled/quarterly_enabled)
-- ──────────────────────────────────────────────────────────────────────────────

UPDATE public.user_agents ua
SET
  next_weekly_heartbeat_at = CASE
    WHEN (ua.cadence_config->>'weekly_enabled')::boolean = true
    THEN date_trunc('week', now()) + INTERVAL '7 days' + INTERVAL '8 hours'
    ELSE NULL
  END,
  next_monthly_heartbeat_at = CASE
    WHEN (ua.cadence_config->>'monthly_enabled')::boolean = true
    THEN date_trunc('month', now()) + INTERVAL '1 month' + INTERVAL '8 hours'
    ELSE NULL
  END,
  next_quarterly_heartbeat_at = CASE
    WHEN (ua.cadence_config->>'quarterly_enabled')::boolean = true
    THEN date_trunc('quarter', now()) + INTERVAL '3 months' + INTERVAL '8 hours'
    ELSE NULL
  END
WHERE ua.is_active = true;

-- ──────────────────────────────────────────────────────────────────────────────
-- Indexes for cadence dispatcher efficiency
-- Partial indexes only on rows where the tier is enabled + not-null next-run time
-- ──────────────────────────────────────────────────────────────────────────────

-- Weekly heartbeat index
CREATE INDEX IF NOT EXISTS idx_user_agents_next_weekly_heartbeat
  ON public.user_agents (next_weekly_heartbeat_at ASC)
  WHERE is_active = true AND heartbeat_enabled = true AND next_weekly_heartbeat_at IS NOT NULL;

-- Monthly heartbeat index
CREATE INDEX IF NOT EXISTS idx_user_agents_next_monthly_heartbeat
  ON public.user_agents (next_monthly_heartbeat_at ASC)
  WHERE is_active = true AND heartbeat_enabled = true AND next_monthly_heartbeat_at IS NOT NULL;

-- Quarterly heartbeat index
CREATE INDEX IF NOT EXISTS idx_user_agents_next_quarterly_heartbeat
  ON public.user_agents (next_quarterly_heartbeat_at ASC)
  WHERE is_active = true AND heartbeat_enabled = true AND next_quarterly_heartbeat_at IS NOT NULL;
