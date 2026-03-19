---
phase: 13-accountant-sales-rep-agent-tools
plan: 01
subsystem: database, infra, api
tags: [postgres, typescript, pg, csv-parse, pdf-parse, langgraph]

# Dependency graph
requires:
  - phase: 12-cos-tools-governance
    provides: base-agent.ts with createLLMNode/createRespondNode (now exported)
  - phase: 01-database-foundation
    provides: leads, invoices, outreach_emails tables and lead_status ENUM
provides:
  - DB migration extending lead_status ENUM with proposal/closed_won/closed_lost
  - outreach_emails columns for Resend webhook correlation (resend_email_id, click_count, open_count)
  - leads columns for follow-up scheduling (follow_up_scheduled_at) and deal value (deal_value)
  - invoices.vendor_email column for chase-invoice email delivery
  - Partial unique index on leads(user_id, email) for dedup prevention
  - Exported createLLMNode and createRespondNode from base-agent.ts
  - Shared DB pool singleton (src/tools/shared/db.ts)
  - All Accountant type interfaces (src/tools/accountant/types.ts)
  - All Sales Rep type interfaces (src/tools/sales/types.ts)
  - csv-parse and pdf-parse npm dependencies installed
affects: [13-02, 13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: [csv-parse, pdf-parse, @types/pdf-parse]
  patterns:
    - Shared pg Pool singleton in src/tools/shared/db.ts imported by all tool files
    - Tool type contracts in per-agent types.ts files (accountant/types.ts, sales/types.ts)
    - Export keyword added to node factory functions without changing behavior

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260319000003_acct_sales_schema.sql
    - worrylesssuperagent/langgraph-server/src/tools/shared/db.ts
    - worrylesssuperagent/langgraph-server/src/tools/accountant/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/sales/types.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/agents/base-agent.ts
    - worrylesssuperagent/langgraph-server/package.json
    - worrylesssuperagent/langgraph-server/package-lock.json

key-decisions:
  - "Shared DB pool in tools/shared/db.ts mirrors store.ts pattern — consistent pool management across all tool files"
  - "createLLMNode/createRespondNode exported with export keyword only — no signature or behavior changes"
  - "Partial unique index on leads(user_id, email) WHERE email IS NOT NULL — allows leads without email while preventing email-based dupes"

patterns-established:
  - "All Phase 13 tool files import getPool() from src/tools/shared/db.ts"
  - "Type contracts defined in per-agent types.ts files, imported by tool implementation files"
  - "ADD VALUE IF NOT EXISTS pattern for ENUM extensions (safe for Supabase migration runner)"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 13 Plan 01: Foundation — DB Migration + Base Exports + Type Contracts Summary

**Phase 13 foundation: ENUM extensions, 5 schema columns, shared pg Pool singleton, exported graph node factories, and complete type contracts for accountant + sales tool files.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T04:52:00Z
- **Completed:** 2026-03-19T05:00:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- DB migration adds proposal/closed_won/closed_lost pipeline stages to lead_status ENUM plus 5 new columns across 3 tables
- Shared DB pool utility (getPool()) established as the single import point for all Phase 13 tool files
- createLLMNode and createRespondNode exported from base-agent.ts without any behavioral modification
- Complete type interfaces for all 13 Accountant tools and 12 Sales Rep tools defined in typed contracts
- csv-parse and pdf-parse installed for bank statement and receipt parsing tools in later plans

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + npm dependencies** - `5174254` (chore)
2. **Task 2: Export base-agent factories + shared DB pool + type contracts** - `4a3eb42` (feat)

## Files Created/Modified
- `worrylesssuperagent/supabase/migrations/20260319000003_acct_sales_schema.sql` - ENUM extensions + 5 column additions + 3 indexes across invoices/leads/outreach_emails
- `worrylesssuperagent/langgraph-server/src/tools/shared/db.ts` - getPool() singleton for all tool files
- `worrylesssuperagent/langgraph-server/src/tools/accountant/types.ts` - 13 type interfaces for Accountant tools including InvoiceRow.vendor_email
- `worrylesssuperagent/langgraph-server/src/tools/sales/types.ts` - 12 type interfaces for Sales Rep tools including OutreachEmailRow with Resend tracking fields
- `worrylesssuperagent/langgraph-server/src/agents/base-agent.ts` - Added export to createLLMNode and createRespondNode
- `worrylesssuperagent/langgraph-server/package.json` - Added csv-parse, pdf-parse, @types/pdf-parse

## Decisions Made
- Shared DB pool in tools/shared/db.ts mirrors store.ts pattern — consistent pool management
- createLLMNode/createRespondNode exported with export keyword only, no behavior changes
- Partial unique index on leads(user_id, email) WHERE email IS NOT NULL — prevents email dupes while allowing null-email leads

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 13 plans (13-02 through 13-05) can now import from the foundation established here
- getPool(), createLLMNode, createRespondNode, and all type interfaces are available
- Migration SQL ready to apply to Supabase when deploying

---
*Phase: 13-accountant-sales-rep-agent-tools*
*Completed: 2026-03-19*
