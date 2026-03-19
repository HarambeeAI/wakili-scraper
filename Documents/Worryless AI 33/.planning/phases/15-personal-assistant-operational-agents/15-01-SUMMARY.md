---
phase: 15
plan: 01
subsystem: langgraph-server
tags: [database, migration, googleapis, type-contracts, google-oauth, operational-agents]
dependency_graph:
  requires: []
  provides:
    - "20260320000001_ops_agent_tables.sql (6 tables: support_tickets, contracts, candidates, press_coverage, projects, project_milestones)"
    - "src/tools/pa/google-auth.ts (getGoogleClient factory)"
    - "src/tools/pa/types.ts (PA type contracts)"
    - "src/tools/customer-support/types.ts (CS type contracts)"
    - "src/tools/legal/types.ts (Legal type contracts)"
    - "src/tools/hr/types.ts (HR type contracts)"
    - "src/tools/pr/types.ts (PR type contracts)"
    - "src/tools/procurement/types.ts (Procurement type contracts)"
    - "src/tools/data-analyst/types.ts (Data Analyst type contracts)"
    - "src/tools/operations/types.ts (Operations type contracts)"
  affects:
    - "All Phase 15 plans (import from this foundation)"
tech_stack:
  added:
    - googleapis (npm package for Google APIs)
  patterns:
    - "Google OAuth2 token refresh with DB persistence via on('tokens') event handler"
    - "TypeScript interface-only type contracts (no runtime overhead)"
key_files:
  created:
    - worrylesssuperagent/supabase/migrations/20260320000001_ops_agent_tables.sql
    - worrylesssuperagent/langgraph-server/src/tools/pa/google-auth.ts
    - worrylesssuperagent/langgraph-server/src/tools/pa/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/customer-support/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/legal/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/hr/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/pr/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/procurement/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/data-analyst/types.ts
    - worrylesssuperagent/langgraph-server/src/tools/operations/types.ts
  modified:
    - worrylesssuperagent/langgraph-server/package.json (googleapis added)
decisions:
  - "googleapis installed (not google-auth-library) — googleapis bundles OAuth2 client + all Google API clients needed for Gmail, Calendar, Drive in one package"
  - "google-auth.ts reads tokens from integrations table (provider = 'google') — consistent with existing OAuth storage pattern from Phase 1 DB schema"
  - "Type contracts are TypeScript interfaces only (no Zod/runtime validation) — matches existing pattern from accountant/types.ts, marketer/types.ts"
metrics:
  duration: "3 min"
  completed: "2026-03-19"
  tasks_completed: 2
  files_created: 10
  files_modified: 1
---

# Phase 15 Plan 01: Foundation — DB Migration + googleapis + 8 Type Contracts Summary

**One-liner:** 6 operational DB tables with RLS/indexes, googleapis installed, Google OAuth helper with auto-refresh, and 8 agent type contract files covering all PA and operational agents.

## What Was Built

### Task 1: DB Migration + npm Dependency
- Created `20260320000001_ops_agent_tables.sql` with 6 new tables for operational agents: `support_tickets`, `contracts`, `candidates`, `press_coverage`, `projects`, `project_milestones`
- All tables have: UUID primary keys, `user_id` FK with CASCADE delete, appropriate CHECK constraints, RLS enabled with owner-only access policies
- 7 indexes covering common query patterns (user+status, renewal_date partial index)
- 4 `update_updated_at_column` triggers reusing the existing function from Phase 1
- Installed `googleapis` npm package in `langgraph-server` (adds `google.auth.OAuth2` + Gmail/Calendar/Drive API clients)

### Task 2: Google Auth Helper + 8 Type Contracts
- `src/tools/pa/google-auth.ts`: `getGoogleClient(userId)` async factory — queries `public.integrations` for user's Google tokens, builds `google.auth.OAuth2` client, registers `on("tokens")` handler to persist refreshed tokens back to DB; throws user-friendly error when Google not connected
- `src/tools/pa/types.ts`: 12 interfaces covering email (EmailMessage, TriagedEmail, DraftedEmail), calendar (CalendarEvent, CreateEventInput, ConflictResult, MeetingBrief), drive (DriveFile), and analytics (TimeAllocation, PAClassification, BusySlot)
- `src/tools/customer-support/types.ts`: CSClassification, SupportTicketRow, CreateTicketInput, HealthScore, ChurnRisk
- `src/tools/legal/types.ts`: LegalClassification, ContractRow, ContractReview, RenewalAlert
- `src/tools/hr/types.ts`: HRClassification, CandidateRow, ResumeScreening, JobPosting, OnboardingPlan
- `src/tools/pr/types.ts`: PRClassification, PressCoverageRow, MediaMention, SentimentAnalysis
- `src/tools/procurement/types.ts`: ProcClassification, SupplierResult, QuoteComparison, PurchaseOrderInput, VendorScore
- `src/tools/data-analyst/types.ts`: DAClassification, QueryResult, ChartData, AnomalyResult, KPISummary
- `src/tools/operations/types.ts`: OpsClassification, ProjectRow, MilestoneRow, BottleneckAnalysis, SOPDocument, ProjectStatusSummary

## Verification Results

- `node -e "require('googleapis')"` — passes
- Migration file contains all 6 CREATE TABLE statements, RLS, indexes, triggers
- `npx tsc --noEmit` — exits 0, zero type errors

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: worrylesssuperagent/supabase/migrations/20260320000001_ops_agent_tables.sql
- FOUND: worrylesssuperagent/langgraph-server/src/tools/pa/google-auth.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/pa/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/customer-support/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/legal/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/hr/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/pr/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/procurement/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/data-analyst/types.ts
- FOUND: worrylesssuperagent/langgraph-server/src/tools/operations/types.ts

Commits verified:
- 9735f3a: feat(15-01): DB migration for 6 operational tables + googleapis install
- a4c4f00: feat(15-01): Google auth helper + 8 agent type contracts
