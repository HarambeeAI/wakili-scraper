-- Phase 15: Operational agent tables

-- OPS-01: Support tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  category TEXT,
  resolution TEXT,
  health_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ
);

-- OPS-02: Contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  contract_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'active', 'expired', 'terminated')),
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  value DECIMAL(12, 2),
  key_terms JSONB DEFAULT '{}',
  risk_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-03: Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  status TEXT DEFAULT 'applied' CHECK (status IN ('prospecting', 'applied', 'screened', 'interview', 'offer', 'hired', 'rejected')),
  resume_text TEXT,
  skills_score INTEGER,
  experience_score INTEGER,
  culture_score INTEGER,
  overall_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-04: Press coverage
CREATE TABLE public.press_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  publication TEXT NOT NULL,
  journalist TEXT,
  title TEXT NOT NULL,
  url TEXT,
  coverage_date DATE,
  reach INTEGER,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  follow_up_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-07: Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-07: Project milestones (child table)
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies (user can CRUD own rows)
CREATE POLICY "Users manage own support_tickets" ON public.support_tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own contracts" ON public.contracts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own candidates" ON public.candidates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own press_coverage" ON public.press_coverage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own milestones" ON public.project_milestones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_milestones.project_id AND user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id, status);
CREATE INDEX idx_contracts_user ON public.contracts (user_id, status);
CREATE INDEX idx_contracts_renewal ON public.contracts (user_id, renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX idx_candidates_user ON public.candidates (user_id, position, status);
CREATE INDEX idx_press_coverage_user ON public.press_coverage (user_id, coverage_date DESC);
CREATE INDEX idx_projects_user ON public.projects (user_id, status);
CREATE INDEX idx_milestones_project ON public.project_milestones (project_id, status);

-- Triggers (reuse existing update_updated_at_column function)
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
