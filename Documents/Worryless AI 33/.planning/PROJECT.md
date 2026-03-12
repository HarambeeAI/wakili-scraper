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

<!-- New capabilities being built in this milestone -->

**Agent Spawner & Team Selection**
- [ ] Agent Spawner service: on onboarding completion, analyzes business context and generates a recommended agent team tailored to the specific business
- [ ] Agent Team Selector UI: tail-end of onboarding shows recommended team with checkboxes, reasons per agent, and "Accept Suggested Team" CTA
- [ ] Fixed catalog of 12 spawnable agent types with default MD workspaces (see Constraints)
- [ ] User can add agents post-onboarding from an Agent Marketplace panel in the dashboard
- [ ] `user_agents` table tracks which agents each user has activated beyond the 4 defaults

**Agent MD Workspace System**
- [ ] Each agent has a 6-file MD workspace: IDENTITY.md, SOUL.md, SOPs.md, MEMORY.md, HEARTBEAT.md, TOOLS.md
- [ ] `agent_workspaces` table stores all workspace files per agent per user
- [ ] Default workspace files auto-generated at agent spawn time using business context
- [ ] Agent Settings panel in dashboard: user can view and edit IDENTITY, SOUL, SOPs, HEARTBEAT files
- [ ] MEMORY.md is agent-written only (read-only in UI) — agents append learnings after tasks

**Heartbeat System**
- [ ] `heartbeat-runner` edge function: per-agent proactive check-in on configurable interval (default 4h, business hours only)
- [ ] Each agent reads its HEARTBEAT.md checklist + recent task history on each tick
- [ ] If nothing needs attention: agent replies HEARTBEAT_OK → suppressed (no noise)
- [ ] If something surfaces: creates a proactive notification + optionally a task
- [ ] `agent_heartbeat_log` table tracks all heartbeat runs, outcomes, suppressed vs surfaced
- [ ] Push/email notification delivery when heartbeat surfaces something meaningful
- [ ] Per-agent heartbeat configuration (interval, active hours, enable/disable)

**Role-Based Tooling & Skills**
- [ ] Each agent type ships with a defined skill set matched to their role (see Tooling section in Context)
- [ ] `available_agent_types` registry table: agent type definitions, default MD templates, skill configs
- [ ] Skills system: each agent's TOOLS.md documents available integrations and how to use them
- [ ] Web browsing skill available to research-capable agents (Legal, Customer Support, PR)
- [ ] Code execution skill for data analysis agents (Accountant, Data Analyst)
- [ ] Connected tools respect role boundaries (e.g. HR agent writes to team calendar, not invoices)

**Org Structure & Agent Hierarchy**
- [ ] Chief of Staff as depth-0 orchestrator: can delegate to any depth-1 agent and synthesize outputs
- [ ] Depth-1 agents cannot spawn further — they execute using their own tools
- [ ] Dashboard "Team" view: org chart showing active agents, heartbeat status, last activity timestamp

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

- **Tech Stack**: React + Supabase + Deno Edge Functions — all additions must fit this stack; no new backend services
- **AI Model**: Lovable AI Gateway (Gemini 3 Flash) — heartbeat and workspace generation use the same gateway
- **Storage**: Agent workspaces stored as text rows in `agent_workspaces` Supabase table (not OS files — this is a web app)
- **Scheduling**: Heartbeats use Supabase `pg_cron` — one cron job per agent per user is not scalable; use a single `heartbeat-dispatcher` cron that fans out
- **No TypeScript strictness**: existing codebase has `noImplicitAny: false`, `strictNullChecks: false` — maintain this to avoid breaking changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store MD workspaces in Supabase table (not filesystem) | Web app has no OS filesystem access; Supabase text fields are editable, queryable, and RLS-protected | — Pending |
| Single heartbeat-dispatcher cron (not per-agent crons) | Supabase pg_cron has limited slots; one dispatcher that iterates due agents is more scalable | — Pending |
| Fixed 12-agent catalog for v1 (not freeform) | Freeform agent creation requires complex prompt engineering and UX; fixed catalog ships faster with better quality defaults | — Pending |
| HEARTBEAT_OK suppression: no DB write on suppressed runs | Reduces DB writes by ~90% on quiet days; only surface and log non-OK heartbeats | — Pending |
| Agent Team Selector at onboarding tail-end (not post-onboarding) | Users are most engaged and context-primed right after completing onboarding; conversion is higher than a post-login prompt | — Pending |

---
*Last updated: 2026-03-12 after initialization*
