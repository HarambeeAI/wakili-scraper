# Requirements: Worryless AI — Proactive Multi-Agent Milestone

**Defined:** 2026-03-12
**Core Value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.

---

## v1 Requirements

### Database Foundation

- [x] **DB-01**: System stores a catalog of 12 agent types (`available_agent_types`) with default MD workspace templates, skill configs, and heartbeat defaults
- [x] **DB-02**: System tracks which agents each user has activated (`user_agents`) including heartbeat config (interval, active hours, enabled flag) and activation timestamp
- [x] **DB-03**: Each activated agent has a 6-file MD workspace (`agent_workspaces`): IDENTITY.md, SOUL.md, SOPs.md, MEMORY.md, HEARTBEAT.md, TOOLS.md — stored as text rows, one row per file per agent per user
- [x] **DB-04**: Workspace files are auto-populated from catalog defaults via Postgres trigger when a `user_agents` row is inserted
- [x] **DB-05**: System logs heartbeat outcomes (`agent_heartbeat_log`) for surfaced and error runs only — suppressed (HEARTBEAT_OK) runs are not written to reduce DB load
- [x] **DB-06**: Unique constraint on `user_agents(user_id, agent_type)` prevents double-activation at DB level
- [x] **DB-07**: `profiles` table gains `timezone` column (used for business-hours heartbeat enforcement and morning digest scheduling)

### Agent Spawner & Team Selector

- [x] **SPAWN-01**: On onboarding completion, a `spawn-agent-team` edge function analyzes the user's business context (industry, description, website artifacts, location) and returns a ranked list of recommended additional agents with per-agent reasoning and first-week value description
- [x] **SPAWN-02**: Agent Spawner uses structured JSON output (temperature 0.3, response_format: json_object) and is constrained to catalog agent type IDs to prevent hallucinated agent types
- [x] **SPAWN-03**: Onboarding flow gains a new final step (Step 12: Agent Team Selector) rendered after validator setup and before `onboarding_completed` is set to true
- [x] **SPAWN-04**: Agent Team Selector displays: (a) default 5 agents pre-checked and locked, (b) AI-recommended additional agents pre-checked with reasoning card explaining why they fit this specific business, (c) remaining catalog agents unchecked
- [x] **SPAWN-05**: User can accept the suggested team in one click ("Accept Suggested Team" CTA) or customize by checking/unchecking agents before accepting
- [x] **SPAWN-06**: After team acceptance, a 2–3 second animated "Briefing your team on [Business Name]..." screen runs before the dashboard loads — establishing the AI-employee mental model
- [x] **SPAWN-07**: Activated agents (beyond the 4 defaults) are inserted as `user_agents` rows and their workspaces auto-populated with business-context-aware content via a second LLM call

### MD Workspace System

- [x] **WS-01**: Each agent's settings panel in the dashboard includes a Workspace tab with 6 sub-tabs (IDENTITY / SOUL / SOPs / MEMORY / HEARTBEAT / TOOLS)
- [x] **WS-02**: IDENTITY, SOUL, SOPs, HEARTBEAT, and TOOLS files are user-editable via CodeMirror 6 markdown editor (lazy-loaded to protect bundle size)
- [x] **WS-03**: MEMORY.md is read-only in the UI — agents append to it after completing tasks; users can read but not edit
- [x] **WS-04**: Workspace edits auto-save with 2-second debounce — no explicit save button needed
- [x] **WS-05**: Each editable workspace file has a "Reset to defaults" action that restores the original catalog template content (with confirmation dialog)
- [x] **WS-06**: Server-side sanitization strips prompt injection patterns from workspace content before it is inserted into any LLM system prompt
- [x] **WS-07**: All AI calls that use workspace content inject files in the order: IDENTITY → SOUL → SOPs → TOOLS → MEMORY (HEARTBEAT only on heartbeat runs)

### Agent Marketplace

- [x] **MKT-01**: Dashboard has an "Add Agent" entry point (in sidebar under AI Team section and in the Team org view) that opens the Agent Marketplace panel
- [x] **MKT-02**: Marketplace displays all 12 catalog agent types with: role title, description, key skills, and "Add to Team" button — already-activated agents show "Active" state
- [x] **MKT-03**: Adding an agent from the Marketplace creates a `user_agents` row, triggers workspace auto-population, and immediately shows the agent in the dashboard sidebar and Team view
- [x] **MKT-04**: Users can deactivate an agent from their team (with confirmation) — deactivated agents retain their workspace data but stop heartbeating and disappear from navigation

### Heartbeat System

- [x] **HB-01**: A `heartbeat-dispatcher` edge function (triggered by a single pg_cron job every 5 minutes) queries `user_agents` for agents due for a heartbeat tick and enqueues them into a pgmq queue (`heartbeat_jobs`)
- [x] **HB-02**: A `heartbeat-runner` edge function (triggered by pg_cron every 1 minute) reads up to 5 messages from `heartbeat_jobs` and processes each: reads HEARTBEAT.md + recent task history, calls LLM, evaluates response
- [x] **HB-03**: LLM heartbeat response must include structured severity field: `{ severity: "urgent" | "headsup" | "digest" | "ok", finding: string }` — if severity is "ok", the run is suppressed with no DB write
- [x] **HB-04**: Non-OK heartbeat runs create a notification record and optionally a task: "urgent" → push notification + email + in-app; "headsup" → in-app only; "digest" → batched into morning Chief of Staff briefing
- [x] **HB-05**: Each user has a per-day call budget per agent (default: 6 heartbeat calls/day) enforced by the dispatcher query — prevents cost runaway
- [x] **HB-06**: Heartbeats only fire during the user's configured active hours (default: 08:00–20:00 in their timezone) — dispatcher uses `profiles.timezone` for this check
- [x] **HB-07**: `agent_heartbeat_log` records: agent_type, user_id, severity, finding, timestamp — only for non-OK outcomes
- [x] **HB-08**: Each agent's settings panel shows heartbeat configuration: interval (1h / 2h / 4h / 8h), active hours (start/end), and enabled toggle
- [ ] **HB-09**: Chief of Staff sends a morning daily briefing digest at 8am (user timezone) consolidating all "digest"-severity heartbeat findings from the past 24 hours across all agents

### Notifications

- [ ] **NOTIF-01**: Dashboard has a notification bell (header) showing unread count; clicking opens a notification panel with severity-tiered entries
- [ ] **NOTIF-02**: In-app notifications use Supabase Realtime Broadcast (DB trigger → Realtime channel) so alerts appear without page refresh
- [ ] **NOTIF-03**: "Urgent" heartbeat findings trigger a push notification via native Web Push API + VAPID (no third-party service)
- [ ] **NOTIF-04**: "Urgent" heartbeat findings also trigger an email via the existing Resend integration
- [ ] **NOTIF-05**: Users can mark notifications as read individually or "Mark all read"
- [ ] **NOTIF-06**: Notification entries link to the relevant agent view (clicking an accountant heartbeat alert opens the Accountant panel)

### Org Structure View

- [ ] **ORG-01**: Dashboard has a "Team" view (accessible from sidebar) showing an org chart: Chief of Staff at top, all activated agents below as direct reports
- [ ] **ORG-02**: Each agent card in the Team view shows: agent name, role, avatar/icon, heartbeat status indicator (green pulse = active, grey = sleeping, amber = needs attention), last active timestamp, and task count (last 7 days)
- [ ] **ORG-03**: Heartbeat status indicator shows a live pulse animation when an agent's heartbeat fired in the last hour
- [ ] **ORG-04**: Clicking an agent card in the Team view navigates to that agent's dedicated panel
- [ ] **ORG-05**: "Add Agent" button is prominently placed in the Team view, opening the Agent Marketplace

### Role-Based Tooling

- [x] **TOOLS-01**: Each agent type in `available_agent_types` has a `skill_config` JSON field listing enabled tool categories for that role
- [x] **TOOLS-02**: `available_agent_types` catalog ships with role-appropriate tool configs (see Context in PROJECT.md for per-role skill list)
- [x] **TOOLS-03**: Each agent's TOOLS.md workspace file documents (in plain English) what tools the agent can use and how — this is injected into the agent's system prompt so it knows its own capabilities
- [x] **TOOLS-04**: The orchestrator edge function respects agent tool boundaries when routing tasks — an HR agent cannot trigger invoice functions, a Sales agent cannot trigger calendar writes

### Security

- [x] **SEC-01**: All new edge functions that execute agent actions verify the calling user's identity via JWT (from Authorization header), not from a `userId` field in the request body
- [x] **SEC-02**: Heartbeat dispatcher (cron-originated, no user JWT) uses a service-role key and fetches user identity from `user_agents` table directly — never from caller input
- [x] **SEC-03**: Workspace content is sanitized on write (strip `IGNORE PREVIOUS INSTRUCTIONS`, `<system>`, and known injection patterns) before storage and before LLM injection

---

## v2 Requirements

### Extended Agent Capabilities

- **EXT-01**: Custom freeform agent creation — describe a role, system generates MD workspace
- **EXT-02**: Agent-to-agent direct messaging visible in Team view chat log
- **EXT-03**: Community marketplace with shared agent workspace templates
- **EXT-04**: Multi-workspace mode (agency: manage multiple client businesses)

### Advanced Heartbeat

- **HB-V2-01**: Agent learning loop — MEMORY.md auto-updated by agent after each heartbeat finding that led to a completed task
- **HB-V2-02**: Heartbeat trend analysis — Chief of Staff weekly summary of which agents fired most, what categories of issues surfaced
- **HB-V2-03**: Cross-agent heartbeat coordination — Chief of Staff heartbeat synthesizes findings from all agents and produces one unified brief

### Integrations

- **INT-V2-01**: WhatsApp notification channel for heartbeat alerts
- **INT-V2-02**: Slack workspace integration for team notification delivery
- **INT-V2-03**: Mobile PWA with home screen install for push notification support on iOS

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time agent-to-agent messaging UI | Agents communicate through Chief of Staff delegation; lateral messaging adds UX complexity for marginal value in v1 |
| Agent-controlled browser automation (clicking UI) | Tool integrations via APIs only in v1; Playwright-style automation requires sandboxed infrastructure |
| Per-agent isolated compute environment | Web app hosted on Supabase Edge; no container isolation available without new infrastructure |
| Freeform agent creation (describe-a-role) | Fixed catalog ships faster with better quality defaults; freeform requires complex prompt engineering and UX validation |
| Mobile native app | Web-first; PWA covers push notifications |
| Multi-tenant agency mode | Not target market for v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 — Database Foundation | Complete |
| DB-02 | Phase 1 — Database Foundation | Complete |
| DB-03 | Phase 1 — Database Foundation | Complete |
| DB-04 | Phase 1 — Database Foundation | Complete |
| DB-05 | Phase 1 — Database Foundation | Complete |
| DB-06 | Phase 1 — Database Foundation | Complete |
| DB-07 | Phase 1 — Database Foundation | Complete |
| SEC-01 | Phase 1 — Database Foundation | Complete |
| SEC-02 | Phase 4 — Heartbeat System | Complete |
| SEC-03 | Phase 1 — Database Foundation | Complete |
| SPAWN-01 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-02 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-03 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-04 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-05 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-06 | Phase 2 — Agent Spawner + Team Selector | Complete |
| SPAWN-07 | Phase 2 — Agent Spawner + Team Selector | Complete |
| TOOLS-01 | Phase 2 — Agent Spawner + Team Selector | Complete |
| TOOLS-02 | Phase 2 — Agent Spawner + Team Selector | Complete |
| TOOLS-03 | Phase 2 — Agent Spawner + Team Selector | Complete |
| TOOLS-04 | Phase 2 — Agent Spawner + Team Selector | Complete |
| WS-01 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-02 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-03 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-04 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-05 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-06 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| WS-07 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| MKT-01 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| MKT-02 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| MKT-03 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| MKT-04 | Phase 3 — MD Workspace Editor + Marketplace | Complete |
| HB-01 | Phase 4 — Heartbeat System | Complete |
| HB-02 | Phase 4 — Heartbeat System | Complete |
| HB-03 | Phase 4 — Heartbeat System | Complete |
| HB-04 | Phase 4 — Heartbeat System | Complete |
| HB-05 | Phase 4 — Heartbeat System | Complete |
| HB-06 | Phase 4 — Heartbeat System | Complete |
| HB-07 | Phase 4 — Heartbeat System | Complete |
| HB-08 | Phase 4 — Heartbeat System | Complete |
| HB-09 | Phase 4 — Heartbeat System | Pending |
| NOTIF-01 | Phase 5 — Org View + Notifications | Pending |
| NOTIF-02 | Phase 5 — Org View + Notifications | Pending |
| NOTIF-03 | Phase 5 — Org View + Notifications | Pending |
| NOTIF-04 | Phase 5 — Org View + Notifications | Pending |
| NOTIF-05 | Phase 5 — Org View + Notifications | Pending |
| NOTIF-06 | Phase 5 — Org View + Notifications | Pending |
| ORG-01 | Phase 5 — Org View + Notifications | Pending |
| ORG-02 | Phase 5 — Org View + Notifications | Pending |
| ORG-03 | Phase 5 — Org View + Notifications | Pending |
| ORG-04 | Phase 5 — Org View + Notifications | Pending |
| ORG-05 | Phase 5 — Org View + Notifications | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

**Phase distribution:**
- Phase 1 (Database Foundation): DB-01..07 + SEC-01..03 = 10 requirements
- Phase 2 (Agent Spawner + Team Selector): SPAWN-01..07 + TOOLS-01..04 = 11 requirements
- Phase 3 (MD Workspace Editor + Marketplace): WS-01..07 + MKT-01..04 = 11 requirements
- Phase 4 (Heartbeat System): HB-01..09 = 9 requirements
- Phase 5 (Org View + Notifications): NOTIF-01..06 + ORG-01..05 = 11 requirements

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation — traceability expanded to individual rows; coverage count corrected from 46 to 52*
