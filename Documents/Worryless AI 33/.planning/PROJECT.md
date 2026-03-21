# Worryless AI — Proactive Multi-Agent Business Platform

## What This Is

Worryless AI is a multi-agent automation platform that spawns a tailored AI team for small business owners and teams (2–10 people). After a guided onboarding that collects deep business context and detects business stage (Starting/Running/Scaling), an Agent Spawner recommends and activates a full org-structured team of AI specialists — each with a defined identity, SOPs, memory, and role-specific tools backed by a LangGraph multi-agent server. Agents run proactively via a cadence engine (daily/weekly/monthly/quarterly), surfacing insights and taking approved actions without waiting to be asked. Every agent interaction happens through an intelligent chat interface with inline generative UI components.

## Core Value

Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.

## Requirements

### Validated

<!-- v1.0 — Proactive Multi-Agent Foundation -->

- ✓ Email/password authentication with Supabase Auth — v1.0
- ✓ Multi-step conversational onboarding (11 steps) — v1.0
- ✓ Website crawl → Business Artifacts knowledge base — v1.0
- ✓ Four default agent UIs: Accountant, Marketer, Sales Rep, Personal Assistant — v1.0
- ✓ Chief of Staff orchestrator routing queries to specialist agents — v1.0
- ✓ Agent validator system (per-agent human approval chain) — v1.0
- ✓ Task lifecycle: pending → scheduled → running → needs_approval → completed — v1.0
- ✓ Scheduled task automation via Supabase cron — v1.0
- ✓ Chat interface with markdown rendering, file attachments — v1.0
- ✓ Business Artifacts panel — v1.0
- ✓ Dashboard with overview metrics — v1.0
- ✓ Agent-specific UIs: invoice tracking, lead pipeline, social post scheduling, email/calendar — v1.0
- ✓ Google Gmail + Calendar integration for Personal Assistant — v1.0
- ✓ Content generation, image generation, lead research, outreach generation — v1.0
- ✓ Landing page with pricing, specialists, FAQ — v1.0

<!-- v2.0 — Agent Intelligence Layer -->

- ✓ LangGraph server (Node.js/TypeScript) on Railway with PostgresSaver checkpointing — v2.0
- ✓ Hierarchical supervisor topology: CoS → 5 specialists + COO → 7 operational agents — v2.0
- ✓ Real tool execution per agent via LangChain tool() definitions — v2.0
- ✓ Human-in-the-loop via interrupt() for high-risk actions with inline approval cards — v2.0
- ✓ Supabase Edge Functions as JWT-validating proxy to LangGraph server — v2.0
- ✓ Accountant: 12 financial tools (invoice CRUD, P&L, cashflow, tax, anomaly detection) — v2.0
- ✓ Marketer: 12 tools (content gen, brand images, Playwright publishing, analytics, research) — v2.0
- ✓ Sales Rep: 12 tools (Apify leads, Resend outreach, pipeline analysis, revenue forecasting) — v2.0
- ✓ Personal Assistant: 10 tools (Gmail API, Calendar API, Drive API, inbox triage, meeting prep) — v2.0
- ✓ 7 operational agents with domain-specific tools (CS, Legal, HR, PR, Procurement, Data Analyst, Ops) — v2.0
- ✓ Per-agent memory via LangGraph Store — v2.0
- ✓ Shared business context namespace across all agents — v2.0
- ✓ pgvector document embeddings for RAG — v2.0
- ✓ Chat persistence via PostgresSaver — v2.0
- ✓ Proactive cadence engine: pg_cron → pgmq → full LangGraph graph execution — v2.0
- ✓ Role-specific heartbeat checklists per agent — v2.0
- ✓ Daily/weekly/monthly/quarterly cadence per agent — v2.0
- ✓ Goal ancestry on tasks (mission → objective → project → task) — v2.0
- ✓ Token budget enforcement per agent — v2.0
- ✓ Chat-first generative UI: AgentChatView replacing static dashboards — v2.0
- ✓ GenerativeUIRenderer: charts, tables, forms, approval cards, kanbans, calendars, timelines — v2.0
- ✓ SSE streaming with text deltas + UI components + tool indicators — v2.0
- ✓ Agent-to-UI data pipeline: tool nodes populate uiComponents, SSE emits, frontend renders inline — v2.0
- ✓ Onboarding redesign: business stage detection, integration setup, first CoS briefing — v2.0
- ✓ Playwright persistent browser for Marketer social media operations — v2.0
- ✓ Immutable audit log for all agent actions — v2.0
- ✓ Atomic task checkout preventing double-work — v2.0

### Active

<!-- v2.1 — Railway Deployment (Full Platform Migration) -->

## Current Milestone: v2.1 Railway Deployment

**Goal:** Migrate the entire Worryless AI platform off Supabase onto Railway — self-hosted PostgreSQL, self-hosted auth (Logto), Edge Functions converted to Express API routes, direct Gemini API replacing Lovable gateway, and full production deployment with domains.

**Target features:**

**Infrastructure Migration**
- [ ] PostgreSQL provisioned on Railway with all 20+ migrations applied
- [ ] Logto auth replacing Supabase Auth (email/password, JWT sessions)
- [ ] pg_cron + pgmq scheduling replaced with Railway-compatible alternative (node-cron or BullMQ + Redis)

**API Layer Migration**
- [ ] 23 Supabase Edge Functions converted to Express routes on Railway
- [ ] RLS replaced with Express middleware authorization (user_id from JWT)
- [ ] Direct Gemini API calls replacing Lovable AI Gateway

**Service Deployment**
- [ ] LangGraph Server deployed on Railway (Docker, Playwright Chromium)
- [ ] API Server deployed on Railway (Express, replaces Edge Functions)
- [ ] Frontend deployed on Railway (static Vite build)
- [ ] VAPID keys generated for push notifications
- [ ] All external API keys configured (Firecrawl, Apify, Resend, Gemini, Google OAuth)

**Frontend Migration**
- [ ] @supabase/supabase-js replaced with direct API calls to Railway API server
- [ ] Auth flow rewired to Logto
- [ ] Environment variables updated for Railway endpoints

### Out of Scope

- Custom freeform agent creation (describe-a-role → generate agent) — fixed catalog sufficient for now
- Real-time agent-to-agent messaging in UI — agents coordinate via CoS delegation and shared Store
- Mobile app — web-first, PWA works well
- Marketplace with community-contributed agent templates — focus on first-party quality
- Multi-workspace / agency mode (managing multiple client businesses)
- Voice input for agent chat
- Offline mode — real-time proactive agents are core value

## Current State

**Shipped:** v2.0 Agent Intelligence Layer (2026-03-20)

**Architecture:**
- Frontend: React 18 + TypeScript SPA (Vite) + Tailwind + shadcn/ui (~19,700 LOC)
- LangGraph Server: Node.js/TypeScript on Railway (~16,700 LOC) with PostgresSaver, Store, pgvector
- Backend: Supabase PostgreSQL + Edge Functions (Deno) as JWT proxy
- AI: Lovable AI Gateway (Gemini 3 Flash for text, Nano Banana 2 for images)
- Scheduling: pg_cron + pgmq → full LangGraph graph execution
- Browser: Playwright persistent contexts for Marketer social media ops

**13-agent hierarchy:**
- Chief of Staff (root supervisor) → Accountant, Marketer, Sales Rep, Personal Assistant, COO
- COO (level-2 supervisor) → Customer Support, Legal, HR, PR, Procurement, Data Analyst, Operations

**114 v2.0 requirements delivered** across 9 phases (10-18), 43 plans.

## Context

**Target User:** Small business owners and teams of 2–10 people. Not developers. The platform must feel like onboarding a real team — not configuring software.

**Openclaw Concepts:**
- Heartbeat framework: proactive agent ticks that suppress noise (HEARTBEAT_OK) but surface real insights
- MD file workspace per agent: IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS — stored in Supabase
- Per-agent skill/tool filtering: each agent type gets only the tools relevant to their role
- Org structure with depth limits: orchestrator → specialists, no lateral spawning

## Constraints

- **Frontend Stack**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Database**: Supabase PostgreSQL with RLS. LangGraph checkpointing in `langgraph` schema
- **Edge Functions**: JWT proxy to LangGraph server — not for agent execution
- **LangGraph Server**: Node.js/TypeScript on Railway. `@langchain/langgraph`, PostgresSaver, Store
- **AI Models**: Lovable AI Gateway (Gemini 3 Flash), Nano Banana 2 (images), Claude API (complex reasoning)
- **Scheduling**: pg_cron + pgmq → LangGraph graph execution
- **API Keys**: External service keys developer-provided via Supabase Vault
- **No TypeScript strictness**: `noImplicitAny: false`, `strictNullChecks: false`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store MD workspaces in Supabase table (not filesystem) | Web app has no OS filesystem access; Supabase text fields are editable, queryable, and RLS-protected | ✓ Good |
| Single heartbeat-dispatcher cron (not per-agent crons) | Supabase pg_cron has limited slots; one dispatcher that iterates due agents is more scalable | ✓ Good |
| Fixed 12-agent catalog (not freeform) | Freeform agent creation requires complex prompt engineering and UX; fixed catalog ships faster | ✓ Good |
| HEARTBEAT_OK suppression: no DB write on suppressed runs | Reduces DB writes by ~90% on quiet days | ✓ Good |
| Agent Team Selector at onboarding tail-end | Users most engaged and context-primed right after onboarding | ✓ Good |
| LangGraph on Railway (not embedded in Edge Functions) | Edge Functions have 60s timeout; LangGraph needs persistent connections, streaming | ✓ Good — clean separation |
| Hierarchical supervisor (not flat) | Prevents CoS from managing 12 agents directly; COO handles operational tier | ✓ Good — clean routing |
| Playwright persistent browser for Marketer | Social media APIs are limited/expensive; real browser sessions give full access | ✓ Good — enables analytics scraping |
| SSE streaming (not WebSockets) | Simpler, works through proxies, sufficient for one-way agent→client streaming | ✓ Good |
| Agent-to-UI via uiComponents state channel | Clean separation: agents write typed objects, frontend renders — no coupling | ✓ Good |
| interrupt() for HITL (not custom approval flow) | LangGraph native pattern; checkpointed state survives restarts | ✓ Good |

---
*Last updated: 2026-03-21 after v2.1 milestone started — Full Railway deployment: migrate off Supabase, self-hosted auth (Logto), direct Gemini API, all services on Railway.*
