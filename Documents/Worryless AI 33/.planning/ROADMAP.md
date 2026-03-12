# Roadmap: Worryless AI — Proactive Multi-Agent Milestone

## Overview

This milestone transforms Worryless AI from a reactive 4-agent chat platform into a proactive AI department. The build starts with the database schema that everything else depends on, then fans out in parallel to the agent spawner (onboarding tail) and the workspace editor (agent configuration layer), before converging on the heartbeat engine and finally the org view and notification delivery layer. Every phase delivers a coherent, verifiable capability without breaking the existing auth, chat, task, and onboarding system.

## Phases

- [ ] **Phase 1: Database Foundation** - Schema, seed catalog, triggers, and security hardening that every subsequent phase depends on
- [ ] **Phase 2: Agent Spawner + Team Selector** - Onboarding Step 12, spawn-agent-team edge function, role tooling configs, and activation animation
- [ ] **Phase 3: MD Workspace Editor + Agent Marketplace** - CodeMirror workspace editor, auto-save, reset-to-defaults, and marketplace panel
- [ ] **Phase 4: Heartbeat System** - Dispatcher, pgmq queue, runner, HEARTBEAT_OK suppression, business-hours enforcement, and call budgets
- [ ] **Phase 5: Org View + Notifications** - Team org chart, heartbeat status indicators, notification bell, push/email/in-app delivery, and morning digest

## Phase Details

### Phase 1: Database Foundation
**Goal**: All schema, seed data, triggers, RLS policies, and security primitives are in place — every subsequent phase can start writing application code immediately without waiting for DB changes
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, SEC-01, SEC-03
**Success Criteria** (what must be TRUE):
  1. The `available_agent_types` table exists with 12 agent type rows plus Chief of Staff, each carrying all 6 default MD workspace templates and role-appropriate skill configs
  2. Inserting a row into `user_agents` automatically produces exactly 6 rows in `agent_workspaces` (one per file type) via Postgres trigger — no application code needed
  3. A unique constraint on `user_agents(user_id, agent_type)` rejects a duplicate activation attempt at the DB level with a constraint violation, not a silent duplicate
  4. `profiles.timezone` column exists and accepts a valid IANA timezone string; existing profiles are not broken
  5. All four new tables (`available_agent_types`, `user_agents`, `agent_workspaces`, `agent_heartbeat_log`) have RLS policies that restrict reads and writes to the owning user; a cross-user query returns zero rows
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Create 4 new tables, 2 ENUMs, and RLS policies (Migration A)
- [ ] 01-02-PLAN.md — Workspace auto-population trigger function (Migration B)
- [ ] 01-03-PLAN.md — Seed 13 agent types with full MD workspace templates (Migration C)
- [ ] 01-04-PLAN.md — Backfill existing users and human verification checkpoint (Migration D)
- [ ] 01-05-PLAN.md — Security hardening: JWT fix in 3 edge functions + sanitize.ts module

### Phase 2: Agent Spawner + Team Selector
**Goal**: New users complete onboarding and land in the dashboard with a curated AI team already activated and briefed on their business — agents are not configured after the fact
**Depends on**: Phase 1
**Requirements**: SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-04, SPAWN-05, SPAWN-06, SPAWN-07, TOOLS-01, TOOLS-02, TOOLS-03, TOOLS-04
**Success Criteria** (what must be TRUE):
  1. After completing onboarding Step 11 (validators), a new Step 12 appears showing a recommended agent team with per-agent reasoning cards tied to the user's industry and business description — not a generic list
  2. Clicking "Accept Suggested Team" from Step 12 activates all checked agents, triggers the "Briefing your team on [Business Name]..." animation for 2–3 seconds, and lands the user on the dashboard with agents visible in the sidebar
  3. The `spawn-agent-team` edge function returns only agent type IDs that exist in `available_agent_types` — hallucinated or misspelled agent type IDs never reach the database
  4. Each agent in the activated team has a `skill_config` that matches its role definition from `available_agent_types` — an HR agent's config does not include invoice or calendar-write tool categories
  5. Existing users with the 4 default agents are not affected by this phase; their agent records remain intact
**Plans**: TBD

### Phase 3: MD Workspace Editor + Agent Marketplace
**Goal**: Users can view and customize any agent's identity, soul, SOPs, heartbeat checklist, and tools through a purpose-built markdown editor — and can add or remove agents from their team at any time post-onboarding
**Depends on**: Phase 1
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, WS-06, WS-07, MKT-01, MKT-02, MKT-03, MKT-04
**Success Criteria** (what must be TRUE):
  1. Opening an agent's settings panel reveals a Workspace tab with 6 sub-tabs (IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS); MEMORY.md tab is read-only and shows a count of entries the agent has written
  2. Edits to IDENTITY, SOUL, SOPs, HEARTBEAT, or TOOLS files are saved automatically within 2 seconds of the user stopping typing — no save button required and no data is lost on panel close
  3. Clicking "Reset to defaults" on any editable file and confirming the dialog restores the original catalog template — the user's edits are replaced and the restored content saves automatically
  4. The Agent Marketplace panel lists all 12 catalog agent types; already-active agents show an "Active" badge instead of an "Add to Team" button; clicking "Add to Team" creates the agent and its workspace rows and immediately shows it in the sidebar
  5. A user can deactivate an agent from their team; after deactivation the agent disappears from the sidebar and Team view, its workspace data is preserved, and no heartbeat fires for that agent
**Plans**: TBD

### Phase 4: Heartbeat System
**Goal**: Each active agent proactively checks in on its configured schedule during business hours, surfaces only genuine findings, and stays silent (no DB write, no notification) when nothing needs the user's attention
**Depends on**: Phase 3 (HEARTBEAT.md templates must be editable before the runner reads them)
**Requirements**: SEC-02, HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-08, HB-09
**Success Criteria** (what must be TRUE):
  1. A single `heartbeat-dispatcher` pg_cron job runs every 5 minutes, enqueues only agents whose `next_heartbeat_at` is due and whose current time falls within the user's configured active hours — agents never fire at 3am in the user's timezone
  2. When the LLM returns `severity: "ok"` for a heartbeat run, zero rows are written to `agent_heartbeat_log` and zero notifications are created — a quiet day produces no DB activity beyond the dispatcher's `next_heartbeat_at` update
  3. When the LLM returns `severity: "urgent"`, a notification record is created and the heartbeat runner triggers both a push notification and an email within the same invocation — the user receives the alert without refreshing
  4. Each agent's settings panel shows a heartbeat configuration section with interval selector (1h / 2h / 4h / 8h), active hours (start/end time), and an enable/disable toggle — changes persist and are respected by the next dispatcher run
  5. The dispatcher enforces a per-agent daily call budget (default 6 calls/day) — an agent that has reached its daily limit is skipped by the dispatcher even if `next_heartbeat_at` is due
**Plans**: TBD

### Phase 5: Org View + Notifications
**Goal**: Users can see their entire AI team at a glance — who is active, what each agent last surfaced, and whether anything needs attention — and receive alerts through the right channel at the right severity without notification fatigue
**Depends on**: Phase 4 (live heartbeat data and suppression correctness must be verified before push and email delivery are enabled)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, ORG-01, ORG-02, ORG-03, ORG-04, ORG-05
**Success Criteria** (what must be TRUE):
  1. The Team view (accessible from the sidebar) shows an org chart with Chief of Staff at the top and all activated agents below as direct reports; each card shows the agent's name, role, last active timestamp, task count for the past 7 days, and a heartbeat status indicator
  2. An agent whose heartbeat fired in the last hour shows a live pulsing green indicator on its card — agents that have not fired recently show a grey sleeping state, and agents with surfaced findings show an amber attention state
  3. A notification bell in the dashboard header shows an unread count that updates in real time (via Supabase Realtime Broadcast) when a new heartbeat finding is created — the user does not need to refresh to see the badge increment
  4. Clicking a notification entry in the notification panel navigates to the relevant agent's panel; users can mark individual notifications as read or mark all as read; the unread count updates immediately
  5. The Chief of Staff delivers a morning digest at 8am in the user's timezone that consolidates all "digest"-severity heartbeat findings from the previous 24 hours across all agents into a single briefing in the chat interface
**Plans**: TBD

## Progress

**Execution Order:**
Phase 1 must complete before any other phase. Phases 2 and 3 can run in parallel after Phase 1. Phase 4 depends on Phase 3. Phase 5 depends on Phase 4.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 0/5 | Planned | - |
| 2. Agent Spawner + Team Selector | 0/TBD | Not started | - |
| 3. MD Workspace Editor + Marketplace | 0/TBD | Not started | - |
| 4. Heartbeat System | 0/TBD | Not started | - |
| 5. Org View + Notifications | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-12*
*Milestone: Proactive Multi-Agent Platform*
*Brownfield: existing auth, 4 agents, onboarding, tasks, and chat are working and must not be broken*
