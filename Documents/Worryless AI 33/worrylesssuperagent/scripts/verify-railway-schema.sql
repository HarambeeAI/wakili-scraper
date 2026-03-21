-- ============================================================
-- Railway Schema Verification Script
-- Run: psql "$DATABASE_URL" -f scripts/verify-railway-schema.sql
-- ============================================================

-- CHECK 1: All 34 public-schema tables exist (33 app tables + users)
SELECT 'CHECK 1: Public tables' AS check_name, COUNT(*) AS actual, 34 AS expected
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users','profiles','agent_tasks','invoices','transactions','social_posts',
    'leads','outreach_emails','integrations','business_artifacts','agent_assets',
    'automation_settings','task_templates','agent_validators','email_summaries',
    'calendar_events','daily_briefings','email_drafts','user_datasheets',
    'datasheet_rows','available_agent_types','user_agents','agent_workspaces',
    'agent_heartbeat_log','notifications','push_subscriptions','document_embeddings',
    'agent_audit_log','support_tickets','contracts','candidates','press_coverage',
    'projects','project_milestones'
  );

-- CHECK 2: langgraph schema has 4 tables
SELECT 'CHECK 2: Langgraph tables' AS check_name, COUNT(*) AS actual, 4 AS expected
FROM information_schema.tables
WHERE table_schema = 'langgraph'
  AND table_type = 'BASE TABLE';

-- CHECK 3: pgvector extension is active
SELECT 'CHECK 3: pgvector extension' AS check_name, COUNT(*) AS actual, 1 AS expected
FROM pg_extension WHERE extname = 'vector';

-- CHECK 4: document_embeddings has embedding column of type USER-DEFINED (vector)
SELECT 'CHECK 4: embedding column' AS check_name, COUNT(*) AS actual, 1 AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_embeddings'
  AND column_name = 'embedding'
  AND data_type = 'USER-DEFINED';

-- CHECK 5: profiles.user_id FK references public.users
SELECT 'CHECK 5: profiles FK' AS check_name,
  ccu.table_schema || '.' || ccu.table_name AS actual,
  'public.users' AS expected
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'user_id';

-- CHECK 6: No RLS enabled on any public table
SELECT 'CHECK 6: No RLS' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- CHECK 7: No auth.* references in function bodies
SELECT 'CHECK 7: No auth refs in functions' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%auth.%';

-- CHECK 8: Seed data in available_agent_types
SELECT 'CHECK 8: Agent type seeds' AS check_name, COUNT(*) AS actual, 13 AS expected
FROM public.available_agent_types;

-- CHECK 9: users table has correct columns (id UUID, email TEXT, created_at TIMESTAMPTZ)
SELECT 'CHECK 9: users columns' AS check_name, COUNT(*) AS actual, 3 AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('id', 'email', 'created_at');
