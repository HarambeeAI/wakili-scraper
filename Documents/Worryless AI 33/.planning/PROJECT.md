# Worryless AI — Proactive Multi-Agent Business Platform

## What This Is

Worryless AI is a multi-agent automation platform that spawns a tailored AI team for small business owners and teams (2–10 people). After a guided onboarding that collects deep business context, an Agent Spawner recommends and activates a full org-structured team of AI specialists — each with a defined identity, SOPs, memory, and role-specific tools. Agents run proactively via a heartbeat system, surfacing insights and taking approved actions without waiting to be asked.

## Core Value

Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.

## Requirements

### Validated

<!-- Already exists and working in the current codebase -->

- ✓ Email/password authentication with Supabase Auth — existing
- ✓ Multi-step conversational onboarding (11 steps: business name, website, industry, location, description, validators) — existing
- ✓ Website crawl → Business Artifacts knowledge base — existing
- ✓ Four default agent UIs: Accountant, Marketer, Sales Rep, Personal Assistant — existing
- ✓ Chief of Staff orchestrator that routes queries to specialist agents — existing
- ✓ Agent validator system (per-agent human approval chain for high-risk tasks) — existing
- ✓ Task lifecycle: pending → scheduled → running → needs_approval → completed — existing
- ✓ Scheduled task automation via Supabase cron (`run-scheduled-tasks`) — existing
- ✓ Chat interface with markdown rendering, file attachments, multi-agent routing — existing
- ✓ Business Artifacts panel (company context, website content, uploaded docs) — existing
- ✓ Dashboard with overview metrics (hours saved, tasks completed, money saved) — existing
- ✓ Agent-specific UIs: invoice tracking, lead pipeline, social post scheduling, email/calendar — existing
- ✓ Google Gmail + Calendar integration for Personal Assistant — existing
- ✓ Content generation, image generation, lead research, outreach email generation — existing
- ✓ Landing page with pricing, specialists, FAQ — existing

### Active

<!-- v2.0 — Agent Intelligence Layer -->

## Current Milestone: v2.0 Agent Intelligence Layer

**Goal:** Migrate from hand-rolled agentic layer to LangChain/LangGraph with real tool execution, persistent memory, chat-first generative UI, proactive cadence (daily/weekly/monthly/quarterly), and business-stage-aware onboarding.

**Architecture:** See `.planning/V2_ARCHITECTURE.md` for full design.

**Target features:**

**LangGraph Multi-Agent Backend**
- [ ] Dedicated LangGraph server (Node.js/TypeScript) on Railway with PostgresSaver checkpointing
- [ ] Hierarchical supervisor topology: Chief of Staff (root) → 5 direct reports + COO (level-2 → 7 operational agents)
- [ ] Real tool execution per agent via LangChain `tool()` definitions mapped to role-specific APIs
- [ ] Human-in-the-loop via LangGraph `interrupt()` for high-risk actions (sending emails, publishing posts, financial transactions)
- [ ] Supabase Edge Functions retained as JWT-validating proxy to LangGraph server

**Per-Agent Tool Execution**
- [ ] Accountant: invoice CRUD, transaction recording, cashflow projection, P&L generation, tax estimation, anomaly detection
- [ ] Marketer: Nano Banana 2 image generation, Playwright persistent browser for social media (publish, analytics, competitor scraping), content calendar, A/B testing
- [ ] Sales Rep: Apify lead generation (developer-provided key), Resend outreach, email engagement tracking, pipeline analysis, revenue forecasting
- [ ] Personal Assistant: Google Workspace (Gmail API, Calendar API, Drive API), inbox triage, meeting prep, time allocation analysis
- [ ] All 13 agents with role-specific tools defined in V2_ARCHITECTURE.md

**Persistent Memory & RAG**
- [ ] Per-agent memory via LangGraph Store (accumulates learnings, user preferences, patterns)
- [ ] Business context shared across all agents via Store namespace
- [ ] pgvector document embeddings for RAG over business artifacts
- [ ] Chat persistence across sessions via PostgresSaver (all conversations preserved)

**Proactive Cadence Engine**
- [ ] pg_cron → pgmq → full LangGraph graph execution (replaces single-shot LLM severity check)
- [ ] Role-specific heartbeat checklists (e.g., Marketer: fetch analytics, check queue, scan trends)
- [ ] Daily/weekly/monthly/quarterly cadence per agent (not just heartbeat monitoring)
- [ ] Goal ancestry on all tasks (Paperclip pattern: mission → objective → project → task)
- [ ] Token budget enforcement per agent (80% warning, 100% pause, human override)

**Chat-First Generative UI**
- [ ] Each agent tab is a chat interface with dynamic inline UI components (replaces static dashboards)
- [ ] GenerativeUIRenderer: charts (Recharts), tables (@tanstack/react-table), forms, approval cards, kanban boards, calendars, timelines
- [ ] SSE streaming with text deltas + structured UI component directives
- [ ] Agent-specific UI components (Pipeline Kanban for Sales, Content Calendar for Marketer, P&L Statement for Accountant, etc.)

**Onboarding Redesign**
- [ ] Business stage detection: Starting / Running / Scaling (determines agent recommendations and initial interactions)
- [ ] Integration setup: Google OAuth for PA, Playwright browser login for Marketer social accounts
- [ ] First real briefing: Chief of Staff LangGraph graph produces actionable briefing from onboarding context

**Persistent Agent Browser (Marketer)**
- [ ] Playwright persistent browser context per user for social media operations
- [ ] User logs in once to social accounts on agent's browser (sessions persist)
- [ ] Session expiry detection and re-login prompts via heartbeat
- [ ] Publish, fetch analytics, monitor competitors via real browser (not limited APIs)

**Audit & Governance (Paperclip patterns)**
- [ ] Immutable audit log for all agent actions and tool calls
- [ ] Atomic task checkout preventing double-work
- [ ] Monthly token budgets per agent with enforcement

### Out of Scope

- Custom freeform agent creation (describe-a-role → generate agent) — deferred to v2; fixed catalog is sufficient for v1
- Real-time agent-to-agent messaging in the UI — agents communicate via task delegation through Chief of Staff
- Mobile app — web-first
- Marketplace with community-contributed agent templates — v2+
- Agent-controlled browser automation (clicking UI elements) — tool integration via APIs only in v1
- Multi-workspace / agency mode (managing multiple client businesses) — v2+

## Context

**Codebase:** React 18 + TypeScript SPA (Vite), Supabase backend (PostgreSQL + Edge Functions on Deno runtime). All AI calls route through Lovable AI Gateway using Google Gemini 3 Flash Preview. RLS enforces per-user data isolation on all tables.

**Target User:** Small business owners and teams of 2–10 people. Not developers. The platform must feel like onboarding a real team — not configuring software.

**Openclaw Concepts Borrowed:**
- Heartbeat framework: proactive agent ticks that suppress noise (HEARTBEAT_OK) but surface real insights
- MD file workspace per agent: IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS — stored in Supabase, editable in UI
- Per-agent skill/tool filtering: each agent type gets only the tools relevant to their role
- Org structure with depth limits: orchestrator → specialists, no lateral spawning

**Agent Catalog (12 types for v1):**

| Type | Role | Key Skills |
|------|------|-----------|
| accountant | Financial tracking, reporting, cashflow | Invoice parsing, spreadsheet analysis, tax reminders |
| marketer | Content, campaigns, brand | Social content, image gen, scheduling, analytics |
| sales_rep | Pipeline, leads, outreach | Lead research, email generation, CRM tracking |
| personal_assistant | Inbox, calendar, briefings | Gmail sync, calendar management, daily briefings |
| customer_support | Ticket routing, response drafting | Inbox triage, template matching, escalation |
| legal_compliance | Regulatory monitoring, contracts | Web search (legal DBs), document review, deadline tracking |
| hr | Team management, hiring, culture | Job description drafting, leave tracking, onboarding checklists |
| pr_comms | Brand mentions, press, thought leadership | Media monitoring, press release drafting, social listening |
| procurement | Suppliers, purchasing, approvals | Vendor database, PO drafting, spend tracking |
| data_analyst | Metrics, reporting, insights | Data parsing, chart generation, trend analysis |
| operations | Processes, SOPs, efficiency | SOP drafting, process mapping, task delegation |
| coo | Cross-functional coordination | Multi-agent reporting, escalation handling, weekly summaries |

**Chief of Staff** is always present as the orchestrator (not in the catalog — it's the default coordinator).

## Constraints

- **Frontend Stack**: React + TypeScript + Vite + Tailwind + shadcn/ui — unchanged
- **Database**: Supabase PostgreSQL with RLS — unchanged. LangGraph checkpointing in separate `langgraph` schema
- **Edge Functions**: Retained as JWT proxy to LangGraph server — not for agent execution
- **NEW: LangGraph Server**: Node.js/TypeScript on Railway. Uses `@langchain/langgraph`, PostgresSaver, Store
- **AI Models**: Lovable AI Gateway (Gemini 3 Flash for text, Nano Banana 2 for images). Claude API for complex reasoning
- **Scheduling**: pg_cron + pgmq retained — triggers LangGraph graph execution instead of single LLM calls
- **API Keys**: All external service keys (Apify, Resend, Firecrawl) developer-provided via Supabase Vault. Users never configure API keys
- **No TypeScript strictness**: existing codebase has `noImplicitAny: false`, `strictNullChecks: false` — maintain this

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store MD workspaces in Supabase table (not filesystem) | Web app has no OS filesystem access; Supabase text fields are editable, queryable, and RLS-protected | — Pending |
| Single heartbeat-dispatcher cron (not per-agent crons) | Supabase pg_cron has limited slots; one dispatcher that iterates due agents is more scalable | — Pending |
| Fixed 12-agent catalog for v1 (not freeform) | Freeform agent creation requires complex prompt engineering and UX; fixed catalog ships faster with better quality defaults | — Pending |
| HEARTBEAT_OK suppression: no DB write on suppressed runs | Reduces DB writes by ~90% on quiet days; only surface and log non-OK heartbeats | — Pending |
| Agent Team Selector at onboarding tail-end (not post-onboarding) | Users are most engaged and context-primed right after completing onboarding; conversion is higher than a post-login prompt | — Pending |

---
*Last updated: 2026-03-19 after Phase 12 complete — CoS is a working strategic orchestrator with 7 tools (briefing, delegation, fan-out, correlation, memory query, action tracking, health), immutable audit log, 3-tier token budget enforcement, atomic task checkout, goal ancestry on all delegations*
