-- Migration: 20260319000001_agent_audit_log.sql
-- Purpose: Create immutable audit log table for all agent actions (GOV-01)
-- INSERT-only via service_role. Authenticated users can only SELECT their own rows.
-- No INSERT/UPDATE/DELETE policies for authenticated role = immutability by policy absence.

CREATE TABLE public.agent_audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id  TEXT        NOT NULL,  -- Not FK — allows future agent types without migration
  action         TEXT        NOT NULL,  -- 'llm_response' | 'tool_call' | 'delegation' | 'briefing' | 'task_checkout'
  input          JSONB       NOT NULL DEFAULT '{}',
  output         JSONB       NOT NULL DEFAULT '{}',
  tool_calls     JSONB       NOT NULL DEFAULT '[]',  -- [{name, input, output}]
  tokens_used    INTEGER     NOT NULL DEFAULT 0,
  goal_chain     JSONB,      -- nullable — snapshot of goal ancestry at time of action
  thread_id      TEXT,       -- nullable — LangGraph thread_id for correlation
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit log (for "explain why" UI feature)
-- No INSERT/UPDATE/DELETE policies for authenticated role — only service_role can write
-- This enforces immutability: agents write via service_role connection; users can only read
CREATE POLICY "Users can read own audit log"
  ON public.agent_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Composite index for user+agent queries with time ordering (primary query pattern)
CREATE INDEX idx_audit_log_user_agent
  ON public.agent_audit_log (user_id, agent_type_id, created_at DESC);

-- Partial index for thread correlation (only non-null thread_ids)
CREATE INDEX idx_audit_log_thread
  ON public.agent_audit_log (thread_id) WHERE thread_id IS NOT NULL;
