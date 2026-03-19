# Roadmap: Worryless AI — Proactive Multi-Agent Platform

## Milestones

- ✅ **v1.0 Proactive Multi-Agent Foundation** - Phases 1-9 (shipped 2026-03-17)
- 🚧 **v2.0 Agent Intelligence Layer** - Phases 10-17 (in progress)

## Phases

<details>
<summary>✅ v1.0 Proactive Multi-Agent Foundation (Phases 1-9) - SHIPPED 2026-03-17</summary>

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
- [x] 01-01: Create 4 new tables, 2 ENUMs, and RLS policies
- [x] 01-02: Workspace auto-population trigger function
- [x] 01-03: Seed 13 agent types with full MD workspace templates
- [x] 01-04: Backfill existing users and human verification checkpoint
- [x] 01-05: Security hardening: JWT fix in 3 edge functions + sanitize.ts module

### Phase 2: Agent Spawner + Team Selector
**Goal**: New users complete onboarding and land in the dashboard with a curated AI team already activated and briefed on their business — agents are not configured after the fact
**Depends on**: Phase 1
**Requirements**: SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-04, SPAWN-05, SPAWN-06, SPAWN-07, TOOLS-01, TOOLS-02, TOOLS-03, TOOLS-04
**Success Criteria** (what must be TRUE):
  1. After completing onboarding Step 11 (validators), a new Step 12 appears showing a recommended agent team with per-agent reasoning cards tied to the user's industry and business description
  2. Clicking "Accept Suggested Team" activates all checked agents, triggers the briefing animation, and lands the user on the dashboard with agents visible in the sidebar
  3. The `spawn-agent-team` edge function returns only agent type IDs that exist in `available_agent_types`
  4. Each agent in the activated team has a `skill_config` that matches its role definition
  5. Existing users with the 4 default agents are not affected
**Plans**: 5 plans

Plans:
- [x] 02-01: Verify + patch skill_config for all 13 agent types
- [x] 02-02: spawn-agent-team edge function with catalog ID guard + unit tests
- [x] 02-03: Onboarding Step 12: AgentTeamSelector component + integration
- [x] 02-04: Dynamic dashboard sidebar + GenericAgentPanel for new agent types
- [x] 02-05: Orchestrator tool boundary enforcement via skill_config injection

### Phase 3: MD Workspace Editor + Agent Marketplace
**Goal**: Users can view and customize any agent's identity, soul, SOPs, heartbeat checklist, and tools through a purpose-built markdown editor — and can add or remove agents from their team at any time post-onboarding
**Depends on**: Phase 1
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, WS-06, WS-07, MKT-01, MKT-02, MKT-03, MKT-04
**Success Criteria** (what must be TRUE):
  1. Opening an agent's settings panel reveals a Workspace tab with 6 sub-tabs; MEMORY.md tab is read-only
  2. Edits to editable files are saved automatically within 2 seconds of the user stopping typing
  3. Clicking "Reset to defaults" and confirming restores the original catalog template
  4. The Agent Marketplace panel lists all 12 catalog agent types with correct active/inactive states
  5. A user can deactivate an agent from their team; workspace data is preserved, heartbeat stops
**Plans**: 5 plans

Plans:
- [x] 03-01: Test infra (vitest) + sanitize.ts client mirror + buildWorkspacePrompt utility
- [x] 03-02: WorkspaceEditor (CodeMirror 6) + WorkspaceEditorLazy + useAgentWorkspace hook
- [x] 03-03: useAgentMarketplace hook + AgentMarketplaceCard + AgentMarketplace panel
- [x] 03-04: WorkspaceTabs (6 sub-tabs) + MemoryTab + GenericAgentPanel Workspace sheet
- [x] 03-05: Dashboard wiring: sidebar Add Agent entry + marketplace view

### Phase 4: Heartbeat System
**Goal**: Each active agent proactively checks in on its configured schedule during business hours, surfaces only genuine findings, and stays silent when nothing needs the user's attention
**Depends on**: Phase 3
**Requirements**: SEC-02, HB-01, HB-02, HB-03, HB-04, HB-05, HB-06, HB-07, HB-08, HB-09
**Success Criteria** (what must be TRUE):
  1. A single `heartbeat-dispatcher` pg_cron job runs every 5 minutes, enqueues only agents due within the user's active hours
  2. When LLM returns `severity: "ok"`, zero rows are written to `agent_heartbeat_log` and zero notifications created
  3. When LLM returns `severity: "urgent"`, push notification and email fire within the same invocation
  4. Each agent's settings panel shows heartbeat config with interval selector, active hours, and enable/disable toggle
  5. The dispatcher enforces a per-agent daily call budget — agents at limit are skipped
**Plans**: 6 plans

Plans:
- [x] 04-01: Wave 0 test scaffolds: heartbeatParser, heartbeatDispatcher, useHeartbeatConfig stubs
- [x] 04-02: DB migrations: pgmq queue + notifications table + heartbeat_daily_budget + pg_cron jobs
- [x] 04-03: HeartbeatConfig UI: useHeartbeatConfig hook + HeartbeatConfigSection + GenericAgentPanel wiring
- [x] 04-04: heartbeat-dispatcher edge function
- [x] 04-05: heartbeat-runner edge function
- [x] 04-06: send-morning-digest edge function + severity column migration

### Phase 5: Org View + Notifications
**Goal**: Users can see their entire AI team at a glance and receive alerts through the right channel at the right severity without notification fatigue
**Depends on**: Phase 4
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, ORG-01, ORG-02, ORG-03, ORG-04, ORG-05
**Success Criteria** (what must be TRUE):
  1. Team view shows org chart with Chief of Staff at top and all activated agents as direct reports with status indicators
  2. Notification bell shows unread count that updates in real time via Supabase Realtime
  3. Clicking a notification navigates to the relevant agent's panel; mark-read works immediately
  4. Chief of Staff delivers morning digest at 8am in user's timezone consolidating all digest-severity findings
  5. Push, email, and in-app notifications all fire correctly per severity level
**Plans**: 5 plans

Plans:
- [x] 05-01: Wave 0 test scaffolds: useNotifications + useTeamData stubs
- [x] 05-02: useNotifications hook + NotificationBell component + DashboardHeader wiring
- [x] 05-03: useTeamData hook + TeamView org chart + DashboardSidebar + Dashboard wiring
- [x] 05-04: Web Push: push_subscriptions migration + sw.js + usePushSubscription + Settings toggle
- [x] 05-05: Per-user timezone morning digest: next_digest_run_at column + send-morning-digest refactor

### Phase 6: Heartbeat Bug Fixes
**Goal**: Restore full heartbeat system operation by fixing the dispatcher→runner field name mismatch and the heartbeat status amber dot
**Depends on**: Phase 4, Phase 5
**Plans**: 2 plans

Plans:
- [x] 06-01: Fix dispatcher→runner field name mismatch
- [x] 06-02: Fix getHeartbeatStatus() field check

### Phase 7: Workspace Prompt Wiring + Push Opt-In
**Goal**: Wire buildWorkspacePrompt() into all production AI call paths and surface push notification opt-in during onboarding
**Depends on**: Phase 3, Phase 5
**Plans**: 4 plans

Plans:
- [x] 07-01: Wave 0 scaffolds + wire buildWorkspacePrompt() into heartbeat-runner
- [x] 07-02: Wire buildWorkspacePrompt() into orchestrator and chat-with-agent
- [x] 07-03: PushOptInBanner component + push_opt_in step in onboarding flow
- [x] 07-04: First-load push opt-in banner in Dashboard for existing users

### Phase 8: Phase Verifications
**Goal**: Produce VERIFICATION.md for all four unverified phases (01, 03, 04, 05)
**Depends on**: Phase 6
**Plans**: 4 plans

Plans:
- [x] 08-01: VERIFICATION.md for Phase 1 (Database Foundation)
- [x] 08-02: VERIFICATION.md for Phase 3 (MD Workspace Editor + Marketplace)
- [x] 08-03: VERIFICATION.md for Phase 4 (Heartbeat System)
- [x] 08-04: VERIFICATION.md for Phase 5 (Org View + Notifications)

### Phase 9: Tech Debt Cleanup
**Goal**: Remove dead code, consolidate duplicate modules, fix cosmetic label discrepancies, and make TeamView reactively update on marketplace adds
**Depends on**: Phase 6, Phase 7
**Plans**: 3 plans

Plans:
- [x] 09-01: Remove handleComplete() dead code + unreachable Step union members
- [x] 09-02: Consolidate sanitize.ts duplicates into a single shared module
- [x] 09-03: Fix "Step 11 of 11" cosmetic label + add TeamView Realtime subscription

</details>

---

### v2.0 Agent Intelligence Layer (In Progress)

**Milestone Goal:** Migrate from hand-rolled agentic layer to LangChain/LangGraph with real tool execution, persistent memory, chat-first generative UI, proactive cadence, and business-stage-aware onboarding.

## Phase Details

### Phase 10: LangGraph Infrastructure
**Goal**: The foundational LangGraph server, persistence layer, and proxy are operational — every subsequent phase can deploy agent graphs without revisiting infrastructure
**Depends on**: Phase 9 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. A LangGraph server running on Railway responds to the health check endpoint and processes requests forwarded from the Supabase Edge Function proxy
  2. The Edge Function proxy validates a user's JWT and forwards the request to the LangGraph server via SSE — unauthenticated requests are rejected before reaching the server
  3. PostgresSaver checkpoints agent thread state to the `langgraph` schema in Supabase — a conversation can be interrupted and resumed from the exact same state
  4. The LangGraph Store is connected and can write and retrieve per-agent memory objects scoped to a user namespace
  5. The `use_langgraph` feature flag in `profiles` exists and controls whether requests route to the new server or the legacy path — no user experiences the new system until the flag is enabled
**Plans**: 4 plans

Plans:
- [ ] 10-01-PLAN.md — Database migrations: langgraph schema, pgvector, feature flag
- [ ] 10-02-PLAN.md — LangGraph server scaffold with health check, persistence, and echo graph
- [ ] 10-03-PLAN.md — Edge Function proxy with JWT validation and SSE forwarding
- [ ] 10-04-PLAN.md — Feature flag hook and Supabase TypeScript type updates

### Phase 11: Agent Graph Topology + Memory Foundation
**Goal**: The full 13-agent hierarchical graph is wired and routing correctly — Chief of Staff can receive a user message, decide which agent(s) to invoke, and return a response with conversation state persisted
**Depends on**: Phase 10
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07, MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07
**Success Criteria** (what must be TRUE):
  1. A message to Chief of Staff routes correctly to the appropriate specialist subgraph via `Command` objects — sending a finance question reaches the Accountant subgraph, not the Marketer
  2. A request requiring multiple agents triggers parallel fan-out via `Send()` and both agent responses are combined in the final reply
  3. Any high-risk action (sending email, publishing post, financial transaction) causes the graph to pause at `interrupt()` and surface an approval card to the user before proceeding
  4. All agent conversations persist across sessions — a user who closes the browser and returns sees their full conversation history and can continue where they left off
  5. Each agent reads its namespaced memory from the LangGraph Store before acting and writes updated learnings after tool execution
**Plans**: 5 plans

Plans:
- [ ] 11-01-PLAN.md — Agent state schema, type constants, LLM client, memory read/write helpers
- [ ] 11-02-PLAN.md — Base agent factory + 4 specialist subgraphs (Accountant, Marketer, Sales Rep, PA)
- [ ] 11-03-PLAN.md — COO supervisor + 7 operational agent subgraphs
- [ ] 11-04-PLAN.md — Chief of Staff root supervisor with Command routing + Send fan-out
- [ ] 11-05-PLAN.md — HITL interrupt, thread management, RAG retrieval, server route update

### Phase 12: Chief of Staff Tools + Governance
**Goal**: Chief of Staff is a working strategic orchestrator — it compiles real morning briefings, delegates to specialist agents with goal ancestry, cross-correlates findings, and every action is audited with enforced token budgets
**Depends on**: Phase 11
**Requirements**: COS-01, COS-02, COS-03, COS-04, COS-05, COS-06, COS-07, GOV-01, GOV-02, GOV-03, GOV-04
**Success Criteria** (what must be TRUE):
  1. The Chief of Staff compiles a morning briefing that aggregates real heartbeat findings, overdue tasks, and today's calendar events — organized by urgency with action buttons per item
  2. When the Chief of Staff delegates to a specialist, the delegated task carries a full goal chain (mission → objective → project → task) visible in the audit log
  3. Every agent action and tool call is written to the immutable `agent_audit_log` table with input, output, and token count — users can ask "why did you do this?" and get a traceable answer
  4. Each agent has a monthly token budget enforced in three tiers: warning at 80%, auto-pause at 100%, and override requires human approval
  5. Atomic task checkout prevents two concurrent cadence runs from claiming the same work item — double-execution never occurs
**Plans**: 4 plans

Plans:
- [ ] 12-01-PLAN.md — DB migrations (audit log table, governance columns) + governance TypeScript modules + AgentState goalChain
- [ ] 12-02-PLAN.md — Base agent governance hooks: token budget pre-check + audit log post-write in createLLMNode
- [ ] 12-03-PLAN.md — All 7 CoS tools: morning briefing, delegation, fan-out, cross-agent memory, correlation, action items, agent health
- [ ] 12-04-PLAN.md — CoS supervisor integration: cosTools node, goalChain routing, tool-enriched responses

### Phase 13: Accountant + Sales Rep Agent Tools
**Goal**: Users have a working AI CFO and sales development rep — the Accountant executes real financial operations against live data and the Sales Rep runs the full prospecting-to-proposal cycle with real tool calls
**Depends on**: Phase 12
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, ACCT-06, ACCT-07, ACCT-08, ACCT-09, ACCT-10, ACCT-11, ACCT-12, SALES-01, SALES-02, SALES-03, SALES-04, SALES-05, SALES-06, SALES-07, SALES-08, SALES-09, SALES-10, SALES-11, SALES-12
**Success Criteria** (what must be TRUE):
  1. The Accountant can parse an uploaded bank statement or receipt photo and produce categorized transactions — user sees structured results without any manual data entry
  2. The Accountant generates a real P&L report and 90-day cashflow projection from live transaction and invoice data — numbers reflect actual records, not placeholder text
  3. Any Accountant action requiring email send (invoice chase) or financial commitment pauses for user approval via HITL before executing
  4. The Sales Rep generates a batch of qualified leads via Apify, researches the top prospect, and composes a personalized outreach email — all without the user providing any API keys
  5. The Sales Rep's pipeline analysis shows real conversion rates and revenue forecast from actual lead records — stale deals are automatically flagged
**Plans**: 5 plans

Plans:
- [ ] 13-01-PLAN.md — Foundation: DB migration (ENUM extension, columns), base-agent exports, npm deps, shared DB pool, type contracts
- [ ] 13-02-PLAN.md — Accountant core tools: invoice CRUD, transaction recording, bank statement/receipt parsing, cashflow, P&L
- [ ] 13-03-PLAN.md — Accountant advanced tools (tax, anomaly, chase, runway, invoice PDF) + agent graph rewrite with tool node
- [ ] 13-04-PLAN.md — Sales core tools: lead generation (Apify), enrichment, research (Firecrawl), outreach composition, send (HITL), engagement
- [ ] 13-05-PLAN.md — Sales advanced tools (deal management, proposals, pipeline analysis) + agent graph rewrite with tool node

### Phase 14: Marketer + Persistent Browser
**Goal**: The Marketer is a closed-loop content engine — it creates brand-consistent content, publishes via the user's real browser sessions, and fetches actual analytics to close the performance feedback loop
**Depends on**: Phase 12
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08, MKT-09, MKT-10, MKT-11, MKT-12, BROWSER-01, BROWSER-02, BROWSER-03, BROWSER-04, BROWSER-05
**Success Criteria** (what must be TRUE):
  1. The user logs in to their social accounts once through the Marketer's persistent browser — subsequent publish operations use those saved sessions without asking for credentials again
  2. The Marketer generates a platform-specific social post with a brand-consistent image using Nano Banana 2 and schedules it — the post appears in the content calendar
  3. Publishing a scheduled post pauses for user approval, then executes via the real browser and confirms success — the user sees the post live on the platform
  4. When a social session expires, the Marketer's heartbeat detects it and notifies the user with a re-login prompt — the agent does not silently fail
  5. Fetching post analytics returns real engagement numbers scraped from the logged-in platform dashboard — the Marketer identifies top and bottom performers with WHY analysis
**Plans**: 5 plans

Plans:
- [ ] 14-01-PLAN.md — Foundation: npm deps (playwright, @google/genai), Dockerfile Chromium, type contracts, browser manager + login flow
- [ ] 14-02-PLAN.md — Content + image tools: generateSocialPost, generateBrandImage, editImage, createContentCalendar
- [ ] 14-03-PLAN.md — Schedule + publish + analytics tools: schedulePost, publishPost (HITL), fetchPostAnalytics, analyzePostPerformance, manageContentLibrary
- [ ] 14-04-PLAN.md — Research tools: monitorBrandMentions, analyzeCompetitor (Playwright), searchTrendingTopics
- [ ] 14-05-PLAN.md — Marketer barrel index + agent graph rewrite with marketerTools node

### Phase 15: Personal Assistant + Operational Agents
**Goal**: Users have a working Google Workspace-integrated executive assistant and a full tier-2 operational team — PA handles real email and calendar, and the seven COO-routed agents execute their domain-specific tools
**Depends on**: Phase 11
**Requirements**: PA-01, PA-02, PA-03, PA-04, PA-05, PA-06, PA-07, PA-08, PA-09, PA-10, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07
**Success Criteria** (what must be TRUE):
  1. The Personal Assistant reads the user's Gmail inbox, categorizes emails by urgency, and drafts a response to a flagged email — all three steps complete in a single agent invocation without user configuration beyond Google OAuth
  2. PA can create a calendar event with availability check and send invites — but only after the user approves the action via HITL
  3. A message routed to the COO reaches the correct tier-2 agent (e.g., a contract question reaches Legal, a hiring question reaches HR) — misrouting does not occur
  4. Customer Support can search the business knowledge base via RAG and draft a ticket response grounded in actual business artifacts — not generic text
  5. Data Analyst can query across all business tables (invoices, leads, posts, transactions) and return a chart-ready dataset for cross-functional analysis
**Plans**: 6 plans

Plans:
- [ ] 15-01-PLAN.md — Foundation: DB migration (5 ops tables), googleapis install, Google auth helper, 8 agent type contracts
- [ ] 15-02-PLAN.md — PA tools: email (read/triage/draft/send), calendar (list/create/conflicts/time), meeting brief, drive search
- [ ] 15-03-PLAN.md — CS + Legal + HR tools: ticket CRUD + KB RAG, contract review + calendar, recruiting + onboarding
- [ ] 15-04-PLAN.md — PR + Procurement tools: press releases + media monitoring + supplier search + PO with HITL
- [ ] 15-05-PLAN.md — Data Analyst + Operations tools: cross-functional queries + anomaly detection + project management
- [ ] 15-06-PLAN.md — All 8 agent graph rewrites with tool nodes + classification tests

### Phase 16: Proactive Cadence Engine
**Goal**: All agents run proactively on their configured cadence without user intervention — the system executes full LangGraph graphs on schedule and surfaces role-specific findings at the right time
**Depends on**: Phase 13, Phase 14, Phase 15
**Requirements**: CAD-01, CAD-02, CAD-03, CAD-04, CAD-05, CAD-06, CAD-07, CAD-08
**Success Criteria** (what must be TRUE):
  1. pg_cron triggers the cadence dispatcher which enqueues due agents via pgmq — agents run full LangGraph graph execution (not single LLM calls) on their scheduled cadence without any user action
  2. Each agent executes its role-specific heartbeat checklist: Accountant checks cashflow and overdue invoices, Marketer fetches analytics and content queue, Sales Rep checks stale deals and due follow-ups
  3. The daily cadence produces a morning briefing in the user's Chief of Staff chat by 8am in the user's timezone — the user wakes up to actionable insights
  4. Event-triggered proactive actions fire correctly: a post going viral triggers an immediate Marketer alert, an overdue invoice triggers an Accountant chase draft, a stale deal triggers a Sales Rep re-engagement suggestion
  5. Each agent's cadence config is stored in `user_agents.cadence_config` JSONB and respected by the dispatcher — users can adjust frequency and active hours per agent
**Plans**: 5 plans

Plans:
- [ ] 16-01-PLAN.md — DB migrations (cadence_config JSONB, multi-tier timestamps) + heartbeat prompts module with classification tests
- [ ] 16-02-PLAN.md — proactive-runner Edge Function + heartbeat-dispatcher multi-tier update
- [ ] 16-03-PLAN.md — Event-trigger detector SQL function + event type definitions + tests
- [ ] 16-04-PLAN.md — CadenceConfigSection UI + useCadenceConfig hook + GenericAgentPanel wiring
- [ ] 16-05-PLAN.md — Morning briefing CoS thread delivery + proactive-runner event handling + cadence barrel index

### Phase 17: Generative UI + Onboarding Redesign
**Goal**: Every agent tab is an intelligent chat interface with dynamic inline components, and the onboarding flow collects business stage context and ends with a real CoS briefing as the first message
**Depends on**: Phase 16
**Requirements**: GUI-01, GUI-02, GUI-03, GUI-04, GUI-05, GUI-06, GUI-07, GUI-08, GUI-09, GUI-10, ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ONB-06
**Success Criteria** (what must be TRUE):
  1. Opening any agent tab shows a chat interface — all static dashboards are replaced; the user interacts with agents via conversation and inline components appear within the chat flow
  2. Asking the Accountant for a P&L report renders an actual P&L table inline in the chat message — asking Sales Rep for pipeline status renders a Pipeline Kanban — components appear without navigating to a separate page
  3. A HITL approval request appears as an inline card with Approve/Reject/Discuss buttons — approving triggers the agent to continue execution immediately
  4. SSE streaming delivers text deltas and UI component directives progressively — the user sees the response being built in real time, not a loading spinner followed by a full response dump
  5. The onboarding flow includes a business stage question (Starting/Running/Scaling) whose answer shapes the recommended agent team, and the final onboarding step produces a real Chief of Staff briefing as the first chat message
**Plans**: TBD

## Progress

**Execution Order:**
Phase 10 → Phase 11 → Phase 12 → Phase 13 and Phase 14 (parallel) → Phase 15 (can start after Phase 11) → Phase 16 (all agents must have tools) → Phase 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v1.0 | 5/5 | Complete | 2026-03-12 |
| 2. Agent Spawner + Team Selector | v1.0 | 5/5 | Complete | 2026-03-17 |
| 3. MD Workspace Editor + Marketplace | v1.0 | 5/5 | Complete | 2026-03-13 |
| 4. Heartbeat System | v1.0 | 6/6 | Complete | 2026-03-13 |
| 5. Org View + Notifications | v1.0 | 5/5 | Complete | 2026-03-13 |
| 6. Heartbeat Bug Fixes | v1.0 | 2/2 | Complete | 2026-03-17 |
| 7. Workspace Prompt Wiring + Push Opt-In | v1.0 | 4/4 | Complete | 2026-03-17 |
| 8. Phase Verifications | v1.0 | 4/4 | Complete | 2026-03-17 |
| 9. Tech Debt Cleanup | v1.0 | 3/3 | Complete | 2026-03-17 |
| 10. LangGraph Infrastructure | v2.0 | 4/4 | Complete | 2026-03-18 |
| 11. Agent Graph Topology + Memory Foundation | v2.0 | 5/5 | Complete | 2026-03-18 |
| 12. Chief of Staff Tools + Governance | v2.0 | 4/4 | Complete | 2026-03-19 |
| 13. Accountant + Sales Rep Agent Tools | v2.0 | 5/5 | Complete | 2026-03-19 |
| 14. Marketer + Persistent Browser | v2.0 | 5/5 | Complete | 2026-03-19 |
| 15. Personal Assistant + Operational Agents | v2.0 | 6/6 | Complete | 2026-03-19 |
| 16. Proactive Cadence Engine | 1/5 | In Progress|  | - |
| 17. Generative UI + Onboarding Redesign | v2.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-12*
*Updated: 2026-03-19 — Phase 16 planned (5 plans in 3 waves)*
*Milestone v1.0: Proactive Multi-Agent Foundation — shipped 2026-03-17*
*Milestone v2.0: Agent Intelligence Layer — in progress*
