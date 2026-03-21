-- Migration 20260321000001: Ensure get_due_cadence_agents() exists on Railway Postgres
--
-- SCHED-03 Verification Result:
--   The function get_due_cadence_agents() was found in:
--     worrylesssuperagent/supabase/migrations/20260320000002_cadence_dispatcher_v2.sql
--   It was NOT found in PRODUCTION_MIGRATION.sql.
--
-- This migration creates the function using CREATE OR REPLACE so it is safe to run
-- on a database that already has the function (idempotent).
--
-- Source: 20260320000002_cadence_dispatcher_v2.sql (verbatim copy)
-- Called by: cadence-dispatcher.ts startCadenceScheduler() via getPool().query()

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
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)
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
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  UNION ALL

  -- ── Monthly tier ──────────────────────────────────────────────────────────
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
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  UNION ALL

  -- ── Quarterly tier ────────────────────────────────────────────────────────
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
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        >= EXTRACT(HOUR FROM ua.heartbeat_active_hours_start)
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(p.timezone, 'UTC')))
        < EXTRACT(HOUR FROM ua.heartbeat_active_hours_end)

  ORDER BY cadence_tier ASC, 1 ASC
  LIMIT 50;

$$;

-- Grant execute to service_role (dispatcher runs as service_role)
GRANT EXECUTE ON FUNCTION public.get_due_cadence_agents() TO service_role;
