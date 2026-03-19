---
phase: 13-accountant-sales-rep-agent-tools
plan: 04
subsystem: api
tags: [apify, firecrawl, resend, hitl, langchain, postgres, langgraph]

# Dependency graph
requires:
  - phase: 13-01
    provides: shared DB pool (getPool), type contracts (GenerateLeadsInput, LeadRow, ProspectResearch, OutreachEmail, EmailEngagement), leads + outreach_emails DB schema

provides:
  - generateLeads: Apify REST API with 20-lead cap and ON CONFLICT (user_id, email) dedup
  - enrichLeadData: Firecrawl scrape + LLM synthesis stored in leads.notes
  - researchProspect: Firecrawl /v1/scrape + structured LLM ProspectResearch (15k char truncation)
  - composeOutreach: LLM personalized email with <150 word rule and one CTA
  - sendOutreach: interruptForApproval HITL gate + Resend delivery + outreach_emails DB record + lead status update
  - trackEmailEngagement: JOIN outreach_emails x leads with open_count/click_count/replied_at

affects: [14-sales-rep-graph, sales_rep-subgraph, salesTools node]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apify run-sync-get-dataset-items for synchronous lead scraping with 20-lead cap (LangGraph timeout constraint)"
    - "ON CONFLICT partial unique index dedup: leads with email use upsert, leads without email use plain INSERT"
    - "Firecrawl /v1/scrape with onlyMainContent:true + markdown format for both enrichment and research"
    - "interruptForApproval HITL gate as mandatory pre-send check for all outreach emails"
    - "send_outreach -> INSERT outreach_emails -> UPDATE leads.status='contacted' pipeline"

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/tools/sales/generate-leads.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/enrich-lead.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/research-prospect.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/compose-outreach.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/send-outreach.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/email-engagement.ts
  modified: []

key-decisions:
  - "Apify lead cap: Math.min(fetchCount ?? 20, 20) — LangGraph has shorter timeout than Edge Functions, 20 is safe ceiling"
  - "Leads without email use plain INSERT (partial unique index only covers rows WHERE email IS NOT NULL)"
  - "enrichLeadData falls back gracefully when FIRECRAWL_API_KEY is absent or website is null"
  - "researchProspect receives _userId (unused, underscore prefix) to match future audit logging pattern"
  - "sendOutreach HITL is mandatory — interruptForApproval called before any Resend API call"
  - "trackEmailEngagement open/click counts read from DB only — webhook-populated by separate Resend webhook handler"

patterns-established:
  - "Sales tool pattern: import getPool from ../shared/db.js + types from ./types.js + external API fetch"
  - "HITL pattern for high-risk tools: interruptForApproval -> check decision.approved -> proceed or return cancel message"

requirements-completed: [SALES-01, SALES-02, SALES-03, SALES-04, SALES-05, SALES-06]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 13 Plan 04: Sales Rep Core Tools Summary

**6 Sales Rep tools implementing prospecting-to-outreach pipeline: Apify lead gen (dedup via ON CONFLICT), Firecrawl enrichment + research, LLM personalized outreach composition, Resend email delivery behind mandatory HITL gate, and engagement tracking from outreach_emails table.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T05:03:20Z
- **Completed:** 2026-03-19T05:06:47Z
- **Tasks:** 2
- **Files modified:** 6 created

## Accomplishments

- SALES-01: generateLeads calls Apify REST API capped at 20 leads, upserts to leads table with ON CONFLICT (user_id, email) dedup preserving existing non-null fields
- SALES-02/03: enrichLeadData and researchProspect both use Firecrawl /v1/scrape + callLLMWithStructuredOutput for structured synthesis
- SALES-04: composeOutreach generates personalized email under 150 words with specific pain-point reference and single CTA
- SALES-05: sendOutreach calls interruptForApproval before any Resend API call — HITL is mandatory — then records in outreach_emails and updates lead status to 'contacted'
- SALES-06: trackEmailEngagement JOINs outreach_emails x leads, returns open_count/click_count/replied_at for up to 50 most recent sent emails

## Task Commits

Each task was committed atomically:

1. **Task 1: Lead generation (Apify) + Lead enrichment + Prospect research (Firecrawl)** - `a5ef01c` (feat)
2. **Task 2: Outreach composition + Send with HITL + Email engagement tracking** - `7ebb698` (feat)

## Files Created/Modified

- `worrylesssuperagent/langgraph-server/src/tools/sales/generate-leads.ts` - Apify REST API fetch with Math.min cap, ON CONFLICT upsert, plain INSERT for no-email leads
- `worrylesssuperagent/langgraph-server/src/tools/sales/enrich-lead.ts` - Firecrawl scrape (optional if key absent), LLM synthesis appended to leads.notes
- `worrylesssuperagent/langgraph-server/src/tools/sales/research-prospect.ts` - Firecrawl /v1/scrape + structured LLM ProspectResearch with 15000-char truncation
- `worrylesssuperagent/langgraph-server/src/tools/sales/compose-outreach.ts` - callLLMWithStructuredOutput for subject + HTML body, <150 word rule, temp=0.7
- `worrylesssuperagent/langgraph-server/src/tools/sales/send-outreach.ts` - interruptForApproval gate, Resend fetch, outreach_emails INSERT, leads UPDATE status
- `worrylesssuperagent/langgraph-server/src/tools/sales/email-engagement.ts` - JOIN query with open_count/click_count/replied_at mapping to EmailEngagement[]

## Decisions Made

- Apify cap is Math.min(input.fetchCount ?? 20, 20) — not 100 as in v1 Edge Function — because LangGraph graph execution has shorter request timeout
- Leads without email bypass ON CONFLICT (partial index only covers WHERE email IS NOT NULL) — plain INSERT used instead
- enrichLeadData Firecrawl call is conditional (FIRECRAWL_API_KEY presence + lead.website non-null) — LLM synthesis still runs with existing lead data if scrape skipped
- researchProspect accepts _userId with underscore prefix — reserved for future audit logging, not used in current implementation
- trackEmailEngagement reads open/click counts from DB only — Resend webhook handler populates these fields (separate concern, not Phase 13 scope)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no new external service configuration required. API keys (APIFY_API_TOKEN, FIRECRAWL_API_KEY, RESEND_API_KEY) were already documented in Phase 13-01 setup.

## Next Phase Readiness

- All 6 Sales Rep core tools ready for integration into Sales Rep subgraph (Phase 14 or equivalent salesTools node)
- HITL send_outreach requires graph node context for interruptForApproval — tool must be called from within a LangGraph node
- open/click tracking requires Resend webhook handler to populate outreach_emails.open_count and click_count columns

---
*Phase: 13-accountant-sales-rep-agent-tools*
*Completed: 2026-03-19*

## Self-Check: PASSED

All 6 tool files confirmed present on disk:
- FOUND: generate-leads.ts
- FOUND: enrich-lead.ts
- FOUND: research-prospect.ts
- FOUND: compose-outreach.ts
- FOUND: send-outreach.ts
- FOUND: email-engagement.ts

Commits confirmed:
- a5ef01c: feat(13-04): SALES-01/02/03
- 7ebb698: feat(13-04): SALES-04/05/06

tsc --noEmit: EXIT 0
