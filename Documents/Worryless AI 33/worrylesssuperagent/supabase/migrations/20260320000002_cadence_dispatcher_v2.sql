-- Migration 20260320000002: get_due_cadence_agents() SQL function (v2 dispatcher)
-- Purpose: Multi-tier cadence dispatcher that returns agents due for ANY cadence tier.
--          Returns cadence_tier TEXT in output so the runner knows which prompt to use.
--
-- Depends on: 20260320000001_cadence_config.sql (cadence_config + next_*_heartbeat_at columns)
-- Used by:    heartbeat-runner (LangGraph path) via supabaseAdmin.rpc('get_due_cadence_agents')
--
-- NOTE: The original get_due_heartbeat_agents() function is NOT dropped.
--       It continues to serve the old heartbeat-runner path (use_langgraph=false users).
--       Both functions coexist safely.
--
-- Tier logic:
--   daily:     next_heartbeat_at <= now()     + business-hours check + daily budget check
--   weekly:    next_weekly_heartbeat_at <= now() + business-hours check (no budget check — inherently limited by frequency)
--   monthly:   next_monthly_heartbeat_at <= now() + business-hours check
--   quarterly: next_quarterly_heartbeat_at <= now() + business-hours check
--
-- Business-hours check uses AT TIME ZONE with IANA timezone from profiles (DST-safe).
-- Daily budget check uses COUNT on agent_heartbeat_log (same as original function).
-- LIMIT 50 caps dispatcher work per invocation across all tiers combined.

CREATE OR REPLACE FUNCTION public.get_due_cadence_agents()
RETURNS TABLE (
  id                        UUID,
  user_id                   UUID,
  agent_type_id             TEXT,
  heartbeat_interval_hours  INTEGER,
  cadence_tier              TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$

  -- ── Daily tier ────────────────────────────────────────────────────────────
  -- Same logic as original get_due_heartbeat_agents() plus cadence_config check.
  -- Business-hours check + daily budget check apply here.
  SELECT
    ua.id,
    ua.user_id,
    ua.agent_type_id,
    ua.heartbeat_interval_hours,
    'daily'::text AS cadence_tier
  FROM public.user_agents ua
  JOIN public.profiles p ON p.user_id = ua.user_id
  WHERE
    ua.is_active = true
    AND ua.heartbeat_enabled = true
    AND (ua.cadence_config->>'daily_enabled')::boolean = true
    AND ua.next_heartbeat_at IS NOT NULL
    AND ua.next_heartbeat_at <= now()
    -- Business-hours check (DST-safe via AT TIME ZONE)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)
    -- Daily budget check: COUNT-based on heartbeat log (self-resetting, no counter column)
    -- Uses user's local timezone to determine "today" boundaries correctly
    AND (
      SELECT COUNT(*) FROM public.agent_heartbeat_log ahl
      WHERE ahl.user_id = ua.user_id
        AND ahl.agent_type_id = ua.agent_type_id
        AND ahl.run_at >= (
          date_trunc('day', now() AT TIME ZONE COALESCE(p.timezone, 'UTC'))
          AT TIME ZONE COALESCE(p.timezone, 'UTC')
        )
    ) < COALESCE(ua.heartbeat_daily_budget, 6)

  UNION ALL

  -- ── Weekly tier ───────────────────────────────────────────────────────────
  -- No daily budget check — weekly frequency is inherently budget-limited.
  -- Business-hours check still applies to ensure delivery at a reasonable time.
  SELECT
    ua.id,
    ua.user_id,
    ua.agent_type_id,
    ua.heartbeat_interval_hours,
    'weekly'::text AS cadence_tier
  FROM public.user_agents ua
  JOIN public.profiles p ON p.user_id = ua.user_id
  WHERE
    ua.is_active = true
    AND ua.heartbeat_enabled = true
    AND (ua.cadence_config->>'weekly_enabled')::boolean = true
    AND ua.next_weekly_heartbeat_at IS NOT NULL
    AND ua.next_weekly_heartbeat_at <= now()
    -- Business-hours check (DST-safe)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  UNION ALL

  -- ── Monthly tier ──────────────────────────────────────────────────────────
  -- No daily budget check — once-per-month frequency is self-limiting.
  -- Business-hours check applies.
  SELECT
    ua.id,
    ua.user_id,
    ua.agent_type_id,
    ua.heartbeat_interval_hours,
    'monthly'::text AS cadence_tier
  FROM public.user_agents ua
  JOIN public.profiles p ON p.user_id = ua.user_id
  WHERE
    ua.is_active = true
    AND ua.heartbeat_enabled = true
    AND (ua.cadence_config->>'monthly_enabled')::boolean = true
    AND ua.next_monthly_heartbeat_at IS NOT NULL
    AND ua.next_monthly_heartbeat_at <= now()
    -- Business-hours check (DST-safe)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  UNION ALL

  -- ── Quarterly tier ────────────────────────────────────────────────────────
  -- No daily budget check — once-per-quarter frequency is self-limiting.
  -- Business-hours check applies.
  SELECT
    ua.id,
    ua.user_id,
    ua.agent_type_id,
    ua.heartbeat_interval_hours,
    'quarterly'::text AS cadence_tier
  FROM public.user_agents ua
  JOIN public.profiles p ON p.user_id = ua.user_id
  WHERE
    ua.is_active = true
    AND ua.heartbeat_enabled = true
    AND (ua.cadence_config->>'quarterly_enabled')::boolean = true
    AND ua.next_quarterly_heartbeat_at IS NOT NULL
    AND ua.next_quarterly_heartbeat_at <= now()
    -- Business-hours check (DST-safe)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  -- Order: daily most urgent (most overdue), then weekly, monthly, quarterly
  -- LIMIT 50 caps dispatcher work per 5-minute cron invocation
  ORDER BY cadence_tier ASC, 1 ASC
  LIMIT 50;

$$;

-- Grant execute to service_role (dispatcher runs as service_role)
GRANT EXECUTE ON FUNCTION public.get_due_cadence_agents() TO service_role;
