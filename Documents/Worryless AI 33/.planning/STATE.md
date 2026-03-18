---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Agent Intelligence Layer
status: defining_requirements
stopped_at: ""
last_updated: "2026-03-18T21:00:00.000Z"
last_activity: 2026-03-18 — Milestone v2.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.
**Current focus:** Defining requirements for v2.0 Agent Intelligence Layer

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-18 — Milestone v2.0 started

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

Decisions from v1.0 (carried forward):
- Store MD workspaces as text rows in `agent_workspaces` table (not filesystem)
- Single `heartbeat-dispatcher` cron (not per-agent crons)
- Fixed 12-agent catalog for v1 (ships faster with better quality defaults)
- HEARTBEAT_OK suppression: no DB write on suppressed runs
- Agent Team Selector at onboarding tail-end (Step 12)

New v2.0 decisions:
- LangGraph server on Railway (Node.js/TypeScript) instead of Edge Functions for agent execution
- PostgresSaver for checkpointing connected to Supabase PostgreSQL (separate `langgraph` schema)
- Playwright persistent browser for Marketer social media (not fragile API integrations)
- Nano Banana 2 (Gemini 3.1 Flash Image) for brand-consistent image generation
- Developer-provided API keys (Apify, Resend, Firecrawl) via Supabase Vault — users never configure keys
- Hierarchical supervisor: Chief of Staff (root) → COO (level-2 for operational agents)
- Chat-first generative UI replacing static agent dashboards
- Business-stage-aware onboarding (Starting / Running / Scaling)
- Patterns borrowed from Paperclip AI: goal ancestry, atomic task checkout, token budgets, audit log

### Pending Todos

None yet.

### Blockers/Concerns

- LangGraph JS (`@langchain/langgraph`) ecosystem maturity vs. Python — verify all needed features exist in TS version before committing
- Playwright persistent browser context at scale — each user needs isolated browser data; evaluate storage and resource requirements
- PostgresSaver connection to Supabase — verify compatibility with Supabase's connection pooling (PgBouncer)
- Google OAuth for PA — requires Google Cloud project setup and consent screen approval

## Session Continuity

Last session: 2026-03-18
Stopped at: Milestone v2.0 initialized, proceeding to requirements definition
Resume file: None
