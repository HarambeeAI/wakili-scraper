-- Migration 20260320000003: check_event_triggers() SQL function + pg_cron schedule
-- Purpose: Detects threshold business events (overdue invoices, stale deals, expiring contracts)
--          and enqueues immediate pgmq jobs with cadence_tier='event' every 5 minutes.
--
-- Event types handled:
--   overdue_invoice  -> accountant agent
--   stale_deal       -> sales_rep agent
--   expiring_contract -> legal_advisor agent
--
-- Depends on:
--   20260312000001_create_agent_tables.sql  (user_agents)
--   20260318000003_feature_flag.sql         (profiles.use_langgraph)
--   20260319000003_acct_sales_schema.sql    (invoices, leads)
--   20260320000001_ops_agent_tables.sql     (contracts)
--   20260320000001_cadence_config.sql       (cadence_config JSONB, last_event_notified_at)
--   20260313000006_heartbeat_queue.sql      (pgmq heartbeat_jobs queue)
--
-- CAD-07 requirement: event-triggered proactive actions with configurable cooldowns

CREATE OR REPLACE FUNCTION public.check_event_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  cooldown_interval INTERVAL;
BEGIN

  -- ── Event 1: Overdue invoices -> accountant ─────────────────────────────────
  -- Detects invoices in 'sent' status with due_date in the past 7 days.
  -- Prevents false positives for very old invoices (older than 7 days already
  -- should have been caught by a previous run).

  FOR r IN
    SELECT DISTINCT
      ua.id AS user_agent_id,
      ua.user_id,
      ua.agent_type_id,
      ua.cadence_config,
      ua.last_event_notified_at
    FROM public.user_agents ua
    JOIN public.profiles p ON p.user_id = ua.user_id
    WHERE ua.is_active = true
      AND ua.agent_type_id = 'accountant'
      AND (ua.cadence_config->>'event_triggers_enabled')::boolean = true
      AND p.use_langgraph = true
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.user_id = ua.user_id
          AND i.status = 'sent'
          AND i.due_date < NOW()
          AND i.due_date > NOW() - INTERVAL '7 days'
      )
  LOOP
    cooldown_interval := (
      (COALESCE(r.cadence_config->>'event_cooldown_hours', '4')::int) || ' hours'
    )::interval;
    IF r.last_event_notified_at IS NULL
       OR r.last_event_notified_at < NOW() - cooldown_interval
    THEN
      PERFORM pgmq_public.send(
        'heartbeat_jobs',
        jsonb_build_object(
          'user_agent_id', r.user_agent_id,
          'user_id',       r.user_id,
          'agent_type_id', r.agent_type_id,
          'cadence_tier',  'event',
          'event_type',    'overdue_invoice'
        ),
        0
      );
      UPDATE public.user_agents
        SET last_event_notified_at = NOW()
      WHERE id = r.user_agent_id;
    END IF;
  END LOOP;

  -- ── Event 2: Stale deals -> sales_rep ──────────────────────────────────────
  -- Detects leads in an open pipeline stage with no activity for 3+ days.

  FOR r IN
    SELECT DISTINCT
      ua.id AS user_agent_id,
      ua.user_id,
      ua.agent_type_id,
      ua.cadence_config,
      ua.last_event_notified_at
    FROM public.user_agents ua
    JOIN public.profiles p ON p.user_id = ua.user_id
    WHERE ua.is_active = true
      AND ua.agent_type_id = 'sales_rep'
      AND (ua.cadence_config->>'event_triggers_enabled')::boolean = true
      AND p.use_langgraph = true
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.user_id = ua.user_id
          AND l.status NOT IN ('closed_won', 'closed_lost', 'rejected')
          AND l.updated_at < NOW() - INTERVAL '3 days'
      )
  LOOP
    cooldown_interval := (
      (COALESCE(r.cadence_config->>'event_cooldown_hours', '4')::int) || ' hours'
    )::interval;
    IF r.last_event_notified_at IS NULL
       OR r.last_event_notified_at < NOW() - cooldown_interval
    THEN
      PERFORM pgmq_public.send(
        'heartbeat_jobs',
        jsonb_build_object(
          'user_agent_id', r.user_agent_id,
          'user_id',       r.user_id,
          'agent_type_id', r.agent_type_id,
          'cadence_tier',  'event',
          'event_type',    'stale_deal'
        ),
        0
      );
      UPDATE public.user_agents
        SET last_event_notified_at = NOW()
      WHERE id = r.user_agent_id;
    END IF;
  END LOOP;

  -- ── Event 3: Expiring contracts -> legal_advisor ────────────────────────────
  -- Detects active contracts whose end_date falls within the next 7 days.
  -- NOTE: contracts table uses end_date (not expiry_date) — confirmed from
  --       20260320000001_ops_agent_tables.sql schema.

  FOR r IN
    SELECT DISTINCT
      ua.id AS user_agent_id,
      ua.user_id,
      ua.agent_type_id,
      ua.cadence_config,
      ua.last_event_notified_at
    FROM public.user_agents ua
    JOIN public.profiles p ON p.user_id = ua.user_id
    WHERE ua.is_active = true
      AND ua.agent_type_id = 'legal_advisor'
      AND (ua.cadence_config->>'event_triggers_enabled')::boolean = true
      AND p.use_langgraph = true
      AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.user_id = ua.user_id
          AND c.status = 'active'
          AND c.end_date IS NOT NULL
          AND c.end_date::timestamptz < NOW() + INTERVAL '7 days'
          AND c.end_date::timestamptz > NOW()
      )
  LOOP
    cooldown_interval := (
      (COALESCE(r.cadence_config->>'event_cooldown_hours', '4')::int) || ' hours'
    )::interval;
    IF r.last_event_notified_at IS NULL
       OR r.last_event_notified_at < NOW() - cooldown_interval
    THEN
      PERFORM pgmq_public.send(
        'heartbeat_jobs',
        jsonb_build_object(
          'user_agent_id', r.user_agent_id,
          'user_id',       r.user_id,
          'agent_type_id', r.agent_type_id,
          'cadence_tier',  'event',
          'event_type',    'expiring_contract'
        ),
        0
      );
      UPDATE public.user_agents
        SET last_event_notified_at = NOW()
      WHERE id = r.user_agent_id;
    END IF;
  END LOOP;

END;
$$;

-- Grant execute to service_role (pg_cron runs as service_role)
GRANT EXECUTE ON FUNCTION public.check_event_triggers() TO service_role;

-- ── pg_cron schedule: every 5 minutes ─────────────────────────────────────────
-- Unschedule first to make migration idempotent on re-run

SELECT cron.unschedule('check-event-triggers')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-event-triggers'
);

SELECT cron.schedule(
  'check-event-triggers',
  '*/5 * * * *',
  $$SELECT public.check_event_triggers()$$
);
