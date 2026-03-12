# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**AI / LLM Gateway:**
- Lovable AI Gateway - Central AI inference endpoint for all agent intelligence
  - Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions` (OpenAI-compatible format)
  - Auth: `LOVABLE_API_KEY` (Deno env var in all edge functions)
  - Default model: `google/gemini-3-flash-preview` (used in `chat-with-agent`, `orchestrator`, `generate-outreach`, `generate-content`, `crawl-business-website`, `send-daily-briefing`)
  - Image model: `google/gemini-3-pro-image-preview` (used in `generate-image`, `generate-invoice-image`)
  - Called by every edge function that generates AI content; no direct OpenAI or Google SDK - all proxied through Lovable

**Lead Generation:**
- Apify (`code_crafter~leads-finder` actor) - B2B lead scraping
  - Endpoint: `https://api.apify.com/v2/acts/code_crafter~leads-finder/run-sync-get-dataset-items`
  - Auth: `APIFY_API_TOKEN` query param (Deno env)
  - Used in: `supabase/functions/generate-leads/index.ts`
  - Fetches contact leads (name, email, phone, LinkedIn, company) filtered by keyword, location, industry, job title

**Web Scraping:**
- Firecrawl - Website crawling and content extraction
  - Endpoints: `https://api.firecrawl.dev/v1/map` (URL discovery) and `https://api.firecrawl.dev/v1/scrape` (content + screenshot)
  - Auth: `FIRECRAWL_API_KEY` (Deno env)
  - Used in: `supabase/functions/crawl-business-website/index.ts`
  - Crawls user-provided business website during onboarding to populate business knowledge base

**Email Sending:**
- Resend - Transactional email service
  - SDK: `https://esm.sh/resend@2.0.0` (loaded in edge function at runtime)
  - Auth: `RESEND_API_KEY` (Deno env)
  - From address: `myteam@worryless.ai`
  - Used in:
    - `supabase/functions/send-daily-briefing/index.ts` - AI-generated morning briefings
    - `supabase/functions/send-test-email/index.ts` - Test/development emails
    - `supabase/functions/send-validation-email/index.ts` - Task approval notification emails (calls Resend REST API directly, not SDK)

**Social Media (Planned/Stub):**
- Google OAuth / Gmail API / Google Calendar API - Email and calendar sync
  - Integration table stores `access_token`, `refresh_token`, `token_expires_at` for provider `"google"`
  - Used in: `supabase/functions/sync-gmail-calendar/index.ts`
  - Status: Stub implementation - OAuth tokens are stored but actual Gmail/Calendar API calls are not yet implemented (placeholder response returned)

## Data Storage

**Database:**
- Supabase (PostgreSQL) - Primary data store
  - Connection: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (edge functions) / `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend)
  - Client (frontend): `@supabase/supabase-js` via `src/integrations/supabase/client.ts`
  - Client (edge functions): `https://esm.sh/@supabase/supabase-js@2.39.3` or `@2.86.0`
  - Row Level Security enabled on all tables

**Core Database Tables** (from migrations in `supabase/migrations/`):
  - `profiles` - User business profile (business_name, industry, website, company_description, timezone, email, onboarding_completed)
  - `agent_tasks` - Task records per agent type with status, message, response, validation token
  - `agent_validators` - Human validators assigned per agent type for approval workflows
  - `automation_settings` - Per-user, per-agent automation on/off switches
  - `invoices` - Financial invoices (vendor, amount, currency, due_date, status)
  - `transactions` - Income/expense transactions linked to invoices
  - `social_posts` - Marketer social media posts (platform, content, image_url, schedule, status, engagement metrics)
  - `leads` - Sales leads (company, contact, email, phone, website, industry, location, score, source, status)
  - `outreach_emails` - Cold outreach emails tied to leads (subject, body, sent/opened/replied timestamps)
  - `business_artifacts` - Scraped/extracted business knowledge (type, title, content, source_url, image_url, metadata)
  - `integrations` - OAuth token storage for third-party providers (currently Google)
  - `email_summaries` - Processed email records with urgency_level, sender, subject, summary
  - `calendar_events` - Calendar events (title, start_time) for daily briefing
  - `daily_briefings` - Generated AI briefings with priorities, urgent_emails, schedule, summary_text, email_sent_at
  - `user_datasheets` - Uploaded CSV/datasheet metadata (name, description, column_names, row_count, file_url)
  - `datasheet_rows` - Row-level data from datasheets stored as JSONB (row_data)

**File Storage:**
- Supabase Storage - Used for uploaded datasheets (`file_url` in `user_datasheets`) and website screenshots (`image_url` in `business_artifacts`)

**Caching:**
- TanStack Query (React Query) - In-memory client-side cache with configurable stale times; no server-side cache layer

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Built-in authentication
  - Implementation: Email/password (standard Supabase auth)
  - Session persistence: `localStorage` with `autoRefreshToken: true` (`src/integrations/supabase/client.ts`)
  - New user trigger: `on_auth_user_created` DB trigger auto-creates a row in `public.profiles` on signup
  - Edge functions validate user via `supabase.auth.getUser(authHeader)` using Bearer token from `Authorization` header
  - RLS enforces `auth.uid() = user_id` on all tables

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Datadog, or similar error tracking SDK present

**Logs:**
- `console.log` / `console.error` throughout edge functions - viewable in Supabase Edge Function logs dashboard
- No structured logging format

## CI/CD & Deployment

**Hosting:**
- Frontend: Lovable platform (inferred from `lovable-tagger` dev plugin, OG image URLs pointing to `lovable.dev`, and `appUrl` construction in `send-validation-email` that derives app URL from Supabase URL)
- Backend: Supabase managed hosting (Edge Functions, PostgreSQL, Auth)

**CI Pipeline:**
- Not detected - No GitHub Actions, CircleCI, or similar CI config files present

## Environment Configuration

**Required frontend env vars (`.env` file, prefixed `VITE_`):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

**Required edge function secrets (set in Supabase project dashboard):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `RESEND_API_KEY`
- `APIFY_API_TOKEN`
- `FIRECRAWL_API_KEY`

**Secrets location:**
- Frontend: `.env` file (not committed; Vite `import.meta.env`)
- Edge functions: Supabase project secrets (set via Supabase dashboard or CLI; accessed via `Deno.env.get()`)

## Webhooks & Callbacks

**Incoming:**
- All edge functions accept HTTP POST requests from the frontend SPA
- `send-validation-email` generates a `validationToken` (UUID) and embeds a deep-link review URL in email; no dedicated inbound webhook endpoint for the approval callback - user clicks link which loads the dashboard with query params (`?task=...&token=...`)

**Outgoing:**
- Resend email delivery to end users (daily briefings, task validation notifications, test emails)
- Apify synchronous API call (blocks until dataset is returned)
- Firecrawl scrape/map calls (synchronous)
- Lovable AI Gateway calls (synchronous, per-request)

---

*Integration audit: 2026-03-12*
