# Roadmap: Worryless AI — Proactive Multi-Agent Milestone

## Overview

This milestone transforms Worryless AI from a reactive 4-agent chat platform into a proactive AI department. The build starts with the database schema that everything else depends on, then fans out in parallel to the agent spawner (onboarding tail) and the workspace editor (agent configuration layer), before converging on the heartbeat engine and finally the org view and notification delivery layer. Every phase delivers a coherent, verifiable capability without breaking the existing auth, chat, task, and onboarding system.

## Phases

- [x] **Phase 1: Database Foundation** - Schema, seed catalog, triggers, and security hardening that every subsequent phase depends on (completed 2026-03-12)
- [ ] **Phase 2: Agent Spawner + Team Selector** - Onboarding Step 12, spawn-agent-team edge function, role tooling configs, and activation animation
- [x] **Phase 3: MD Workspace Editor + Agent Marketplace** - CodeMirror workspace editor, auto-save, reset-to-defaults, and marketplace panel (completed 2026-03-13)
- [x] **Phase 4: Heartbeat System** - Dispatcher, pgmq queue, runner, HEARTBEAT_OK suppression, business-hours enforcement, and call budgets (completed 2026-03-13)
- [x] **Phase 5: Org View + Notifications** - Team org chart, heartbeat status indicators, notification bell, push/email/in-app delivery, and morning digest (completed 2026-03-13)

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
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Verify + patch skill_config for all 13 agent types (TOOLS-01, TOOLS-02, TOOLS-03)
- [ ] 02-02-PLAN.md — spawn-agent-team edge function with catalog ID guard + unit tests (SPAWN-01, SPAWN-02)
- [ ] 02-03-PLAN.md — Onboarding Step 12: AgentTeamSelector component + ConversationalOnboarding integration (SPAWN-03–07)
- [ ] 02-04-PLAN.md — Dynamic dashboard sidebar + GenericAgentPanel for new agent types (SPAWN-04)
- [ ] 02-05-PLAN.md — Orchestrator tool boundary enforcement via skill_config injection (TOOLS-04)

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
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Test infra (vitest) + sanitize.ts client mirror + buildWorkspacePrompt utility + tests (WS-06, WS-07)
- [ ] 03-02-PLAN.md — WorkspaceEditor (CodeMirror 6) + WorkspaceEditorLazy + useAgentWorkspace hook (WS-02, WS-04, WS-05)
- [ ] 03-03-PLAN.md — useAgentMarketplace hook + AgentMarketplaceCard + AgentMarketplace panel (MKT-02, MKT-03, MKT-04)
- [ ] 03-04-PLAN.md — WorkspaceTabs (6 sub-tabs) + MemoryTab + GenericAgentPanel Workspace sheet (WS-01, WS-03, WS-05)
- [ ] 03-05-PLAN.md — Dashboard wiring: sidebar Add Agent entry + marketplace view + human verification checkpoint (WS-01, MKT-01, MKT-03, MKT-04)

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
**Plans**: 6 plans

Plans:
- [ ] 04-01-PLAN.md — Wave 0 test scaffolds: heartbeatParser, heartbeatDispatcher, useHeartbeatConfig stubs (HB-03, HB-05, HB-06, HB-08, SEC-02)
- [ ] 04-02-PLAN.md — DB migrations: pgmq queue + notifications table + heartbeat_daily_budget column + pg_cron jobs (SEC-02, HB-01, HB-05)
- [ ] 04-03-PLAN.md — HeartbeatConfig UI: useHeartbeatConfig hook + HeartbeatConfigSection + GenericAgentPanel wiring (HB-08)
- [ ] 04-04-PLAN.md — heartbeat-dispatcher edge function: due-agent query, business hours, budget enforcement, pgmq enqueue (HB-01, HB-05, HB-06, SEC-02)
- [ ] 04-05-PLAN.md — heartbeat-runner edge function: dequeue, LLM call, severity routing, HEARTBEAT_OK suppression, Resend email (HB-02, HB-03, HB-04, HB-07)
- [ ] 04-06-PLAN.md — send-morning-digest edge function + severity column migration + human verification checkpoint (HB-09)

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
**Plans**: 5 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 0 test scaffolds: useNotifications + useTeamData stubs (NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06, ORG-02, ORG-03)
- [ ] 05-02-PLAN.md — useNotifications hook + NotificationBell component + DashboardHeader wiring (NOTIF-01, NOTIF-02, NOTIF-05, NOTIF-06)
- [ ] 05-03-PLAN.md — useTeamData hook + TeamView org chart + DashboardSidebar + Dashboard wiring (ORG-01, ORG-02, ORG-03, ORG-04, ORG-05)
- [ ] 05-04-PLAN.md — Web Push: push_subscriptions migration + sw.js + usePushSubscription + Settings toggle + heartbeat-runner VAPID send (NOTIF-03)
- [ ] 05-05-PLAN.md — Per-user timezone morning digest: next_digest_run_at column + send-morning-digest refactor + human verification checkpoint (NOTIF-04)

### Phase 6: Heartbeat Bug Fixes
**Goal**: Restore full heartbeat system operation by fixing two critical integration bugs — the dispatcher→runner field name mismatch (camelCase vs snake_case) that silently breaks every job, and the heartbeat status amber dot that never shows because getHeartbeatStatus checks the wrong field value
**Depends on**: Phase 4, Phase 5 (fixes bugs introduced in those phases)
**Requirements**: HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-08, HB-09, ORG-04
**Gap Closure**: Closes gaps from audit

Plans:
- [ ] 06-01-PLAN.md — Fix dispatcher→runner field name mismatch: align camelCase enqueue payload with snake_case destructuring in runner (HB-01..09)
- [ ] 06-02-PLAN.md — Fix getHeartbeatStatus() field check: update to match severity values passed by useTeamData (ORG-04)

### Phase 7: Workspace Prompt Wiring + Push Opt-In
**Goal**: Wire buildWorkspacePrompt() into all production AI call paths in the correct injection order, and surface push notification opt-in during onboarding and first dashboard load so users can actually receive urgent alerts
**Depends on**: Phase 3, Phase 5
**Requirements**: WS-07, NOTIF-03
**Gap Closure**: Closes gaps from audit
**Plans**: 4 plans

Plans:
- [ ] 07-01-PLAN.md — Wave 0 scaffolds (Deno mirror + test stub) + wire buildWorkspacePrompt() into heartbeat-runner (WS-07)
- [ ] 07-02-PLAN.md — Wire buildWorkspacePrompt() into orchestrator (Chief of Staff + specialist agents) and chat-with-agent (WS-07)
- [ ] 07-03-PLAN.md — PushOptInBanner component + push_opt_in step in onboarding flow (NOTIF-03)
- [ ] 07-04-PLAN.md — First-load push opt-in banner in Dashboard for existing users + human verification (NOTIF-03)

### Phase 8: Phase Verifications
**Goal**: Produce VERIFICATION.md for all four unverified phases (01, 03, 04, 05) — code-review each phase's deliverables against its success criteria and requirements, creating the formal verification record needed to close the milestone
**Depends on**: Phase 6 (Phase 4 verification requires heartbeat system to be functional)
**Requirements**: (verification coverage for DB-01..07, SEC-01, SEC-03, WS-01..07, MKT-01..04, HB-01..09, NOTIF-01..06, ORG-01..05)
**Gap Closure**: Closes nyquist/verification gaps from audit

Plans:
- [ ] 08-01-PLAN.md — VERIFICATION.md for Phase 1 (Database Foundation): verify schema, triggers, RLS, seed data, security hardening
- [ ] 08-02-PLAN.md — VERIFICATION.md for Phase 3 (MD Workspace Editor + Marketplace): verify editor, auto-save, reset, marketplace add/deactivate
- [ ] 08-03-PLAN.md — VERIFICATION.md for Phase 4 (Heartbeat System): verify dispatcher, runner, config UI, budget enforcement, digest (after Phase 6 fixes)
- [ ] 08-04-PLAN.md — VERIFICATION.md for Phase 5 (Org View + Notifications): verify team view, notification bell, realtime, push, morning digest

### Phase 9: Tech Debt Cleanup
**Goal**: Remove dead code, consolidate duplicate modules, fix cosmetic label discrepancies, and make TeamView reactively update on marketplace adds — reducing future maintenance risk and drift
**Depends on**: Phase 6, Phase 7 (clean state before tidying)
**Requirements**: (no new requirements — quality/maintenance)
**Gap Closure**: Closes tech debt items from audit

Plans:
- [ ] 09-01-PLAN.md — Remove handleComplete() dead code + unreachable Step union members in ConversationalOnboarding.tsx (Phase 2 tech debt)
- [ ] 09-02-PLAN.md — Consolidate sanitize.ts duplicates (src/ vs supabase/functions/_shared/) into a single shared module (Phase 3 tech debt)
- [ ] 09-03-PLAN.md — Fix "Step 11 of 11" cosmetic label in AgentTeamSelector + add TeamView Realtime subscription for reactive marketplace updates (Phase 5 tech debt)

## Progress

**Execution Order:**
Phase 1 must complete before any other phase. Phases 2 and 3 can run in parallel after Phase 1. Phase 4 depends on Phase 3. Phase 5 depends on Phase 4. Phase 6 fixes bugs from Phases 4 and 5. Phase 7 wires missing integrations from Phases 3 and 5. Phase 8 depends on Phase 6. Phase 9 depends on Phases 6 and 7.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 5/5 | Complete   | 2026-03-12 |
| 2. Agent Spawner + Team Selector | 4/5 | In Progress|  |
| 3. MD Workspace Editor + Marketplace | 5/5 | Complete   | 2026-03-13 |
| 4. Heartbeat System | 6/6 | Complete   | 2026-03-13 |
| 5. Org View + Notifications | 5/5 | Complete   | 2026-03-13 |
| 6. Heartbeat Bug Fixes | 0/2 | Pending | |
| 7. Workspace Prompt Wiring + Push Opt-In | 3/4 | In Progress|  |
| 8. Phase Verifications | 2/4 | In Progress|  |
| 9. Tech Debt Cleanup | 0/3 | Pending | |

---
*Roadmap created: 2026-03-12*
*Updated: 2026-03-14 — Phase 7 plans created*
*Milestone: Proactive Multi-Agent Platform*
*Brownfield: existing auth, 4 agents, onboarding, tasks, and chat are working and must not be broken*
