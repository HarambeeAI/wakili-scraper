-- Phase 17 ONB-06: Add business_stage column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_stage TEXT
  CHECK (business_stage IN ('starting', 'running', 'scaling'));

COMMENT ON COLUMN public.profiles.business_stage IS
  'Business maturity stage selected during onboarding. Values: starting, running, scaling. NULL = not yet set (pre-Phase 17 users).';
