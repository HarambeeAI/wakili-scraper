-- Phase 13: Accountant + Sales Rep schema extensions
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL.
-- Supabase migrations run each statement individually, so this is safe.

-- 1. Extend lead_status ENUM for full B2B pipeline stages
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_won';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_lost';

-- 2. Add columns to outreach_emails for Resend webhook correlation (SALES-06)
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outreach_resend_id
  ON public.outreach_emails (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- 3. Add columns to leads for follow-up scheduling (SALES-08) and deal value tracking
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deal_value DECIMAL(12,2);

-- 4. Add composite index for pipeline analysis queries (SALES-10, SALES-11, SALES-12)
CREATE INDEX IF NOT EXISTS idx_leads_status_updated
  ON public.leads (user_id, status, updated_at DESC);

-- 5. Add vendor_email to invoices for chase-invoice email delivery (ACCT-10)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vendor_email TEXT;

-- 6. Add unique constraint on leads(user_id, email) to prevent duplicate leads from repeated generateLeads calls (SALES-01)
-- Partial unique index: only enforced when email is NOT NULL (some leads may lack email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_user_email_unique
  ON public.leads (user_id, email)
  WHERE email IS NOT NULL;
