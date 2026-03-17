---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 08-04-PLAN.md — Phase 5 Org View + Notifications VERIFICATION.md (NOTIF-01..06, ORG-01..05)
last_updated: "2026-03-17T09:37:39.970Z"
last_activity: 2026-03-12 — Roadmap created; 52 requirements mapped across 5 phases
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 36
  completed_plans: 36
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.
**Current focus:** Phase 1 — Database Foundation

## Current Position

Phase: 1 of 5 (Database Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-12 — Roadmap created; 52 requirements mapped across 5 phases

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 01-database-foundation P01 | 2 | 1 tasks | 1 files |
| Phase 01-database-foundation P05 | 3 | 2 tasks | 4 files |
| Phase 01-database-foundation P02 | 1 | 1 tasks | 1 files |
| Phase 01-database-foundation P03 | 6 | 1 tasks | 1 files |
| Phase 01-database-foundation P04 | 1 | 1 tasks | 1 files |
| Phase 02-agent-spawner-team-selector P01 | 2 | 2 tasks | 1 files |
| Phase 02-agent-spawner-team-selector P02 | 6 | 2 tasks | 2 files |
| Phase 02-agent-spawner-team-selector P04 | 3 | 2 tasks | 3 files |
| Phase 02-agent-spawner-team-selector P03 | 4 | 3 tasks | 2 files |
| Phase 02-agent-spawner-team-selector P05 | 12 | 1 tasks | 1 files |
| Phase 03-md-workspace-editor-agent-marketplace P03 | 2 | 2 tasks | 3 files |
| Phase 03-md-workspace-editor-agent-marketplace P01 | 4 | 2 tasks | 8 files |
| Phase 03-md-workspace-editor-agent-marketplace P02 | 15 | 3 tasks | 4 files |
| Phase 03-md-workspace-editor-agent-marketplace P04 | 2 | 2 tasks | 3 files |
| Phase 03-md-workspace-editor-agent-marketplace P05 | 5 | 1 tasks | 2 files |
| Phase 03-md-workspace-editor-agent-marketplace P05 | 5 | 2 tasks | 2 files |
| Phase 04-heartbeat-system P01 | 2 | 2 tasks | 4 files |
| Phase 04-heartbeat-system P02 | 2 | 2 tasks | 3 files |
| Phase 04-heartbeat-system P03 | 15 | 2 tasks | 4 files |
| Phase 04-heartbeat-system P05 | 8 | 1 tasks | 4 files |
| Phase 04-heartbeat-system P04 | 5 | 1 tasks | 4 files |
| Phase 04-heartbeat-system P06 | 2 | 1 tasks | 4 files |
| Phase 05-org-view-notifications P03 | 3 | 2 tasks | 8 files |
| Phase 05-org-view-notifications P01 | 3 | 2 tasks | 1 files |
| Phase 05-org-view-notifications P02 | 15 | 2 tasks | 5 files |
| Phase 05-org-view-notifications P05 | 5 | 1 tasks | 2 files |
| Phase 05-org-view-notifications P04 | 2 | 2 tasks | 5 files |
| Phase 06-heartbeat-bug-fixes P01 | 3 | 1 tasks | 1 files |
| Phase 06-heartbeat-bug-fixes P02 | 1 | 3 tasks | 2 files |
| Phase 07-workspace-prompt-wiring-push-optin P01 | 2 | 2 tasks | 3 files |
| Phase 07-workspace-prompt-wiring-push-optin P03 | 8 | 2 tasks | 2 files |
| Phase 07-workspace-prompt-wiring-push-optin P02 | 3 | 2 tasks | 2 files |
| Phase 07-workspace-prompt-wiring-push-optin P04 | 8 | 1 tasks | 1 files |
| Phase 08-phase-verifications P01 | 15 | 2 tasks | 1 files |
| Phase 08-phase-verifications P02 | 12 | 2 tasks | 1 files |
| Phase 08-phase-verifications P03 | 8 | 2 tasks | 1 files |
| Phase 08-phase-verifications P04 | 4 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Store MD workspaces as text rows in `agent_workspaces` table (not filesystem) — web app has no OS filesystem
- Single `heartbeat-dispatcher` cron (not per-agent crons) — pg_cron has limited concurrent job slots
- Fixed 12-agent catalog for v1 — ships faster with better quality defaults than freeform creation
- HEARTBEAT_OK suppression: no DB write on suppressed runs — reduces DB writes ~90% on quiet days
- Agent Team Selector at onboarding tail-end (Step 12) — users are most engaged right after finishing onboarding
- [Phase 01-database-foundation]: TEXT PK on available_agent_types to avoid ALTER TYPE issues with existing agent_type ENUM
- [Phase 01-database-foundation]: No INSERT policy on agent_heartbeat_log for authenticated users — service role only for audit integrity
- [Phase 01-database-foundation]: Two Supabase clients per function: anon-key for JWT verification (auth.getUser), service-role for DB writes — service role unchanged in planning-agent
- [Phase 01-database-foundation]: crawl-business-website validation guard simplified: !websiteUrl only (userId now guaranteed by JWT check)
- [Phase 01-database-foundation]: SECURITY DEFINER on create_agent_workspace() — trigger runs as postgres, not calling user, so RLS cannot block workspace creation
- [Phase 01-database-foundation]: ON CONFLICT DO NOTHING on workspace trigger inserts — makes trigger idempotent, safe to re-run on partial failures
- [Phase 01-database-foundation]: Separate INSERT per agent rather than multi-row VALUES — avoids dollar-quote tag collision across 13 agents x 6 columns
- [Phase 01-database-foundation]: Unique dollar-quote tag per column per agent (e.g., chief_identity, acct_soul) — prevents PostgreSQL parser ambiguity in large markdown strings
- [Phase 01-database-foundation]: ON CONFLICT DO NOTHING on backfill INSERT — idempotent, safe to re-apply on any database state
- [Phase 01-database-foundation]: WHERE onboarding_completed = true filter on backfill — prevents agent rows for users mid-onboarding
- [Phase 01-database-foundation]: DB-07 (profiles.timezone) fulfilled by comment artifact referencing migration 20251216134813 — no additional ALTER TABLE needed
- [Phase 02-agent-spawner-team-selector]: Conditional UPDATE guards (AND skill_config = '[]'::jsonb) make migration 00005 a safe no-op on correctly seeded databases
- [Phase 02-agent-spawner-team-selector]: TOOLS-03 fulfilled by comment recipe only — Phase 1 on_agent_activated trigger already handles TOOLS.md workspace row creation
- [Phase 02-agent-spawner-team-selector]: LOVABLE_API_KEY (not LOVABLE_AI_GATEWAY_KEY) is the correct bearer token env var — matches crawl-business-website pattern
- [Phase 02-agent-spawner-team-selector]: filterRecommendations exported from index.ts so spawn.test.ts can import and test pure logic without HTTP
- [Phase 02-agent-spawner-team-selector]: LLM errors return {recommendations: [], allAgents: [...]} with 200 status — no 500 thrown to client
- [Phase 02-agent-spawner-team-selector]: GenericAgentPanel shows placeholder (not ChatInterface) — ChatInterface accepts no agentType prop
- [Phase 02-agent-spawner-team-selector]: fetchUserAgents accepts currentUser param to avoid stale closure — called from useEffect([user]) and onComplete
- [Phase 02-agent-spawner-team-selector]: LEGACY_VIEW_MAP in DashboardSidebar maps 5 default agent_type_ids to existing view IDs — prevents double-render of defaults
- [Phase 02-agent-spawner-team-selector]: validator_sales Continue button now calls nextStep (not handleComplete) — onboarding_completed only set inside handleTeamAccept after user_agents are inserted
- [Phase 02-agent-spawner-team-selector]: Workspace personalization (SPAWN-07) is a deterministic token replace with no LLM call — fire-and-forget after onComplete() so user is not blocked
- [Phase 02-agent-spawner-team-selector]: buildAgentPrompt creates supabase client internally via Deno.env.get — consistent with fetchBusinessKnowledge; TOOL BOUNDARIES non-blocking; all 3 callers await-updated
- [Phase 03-md-workspace-editor-agent-marketplace]: onAgentChange stored in useRef to avoid stale closure in async mutation callbacks
- [Phase 03-md-workspace-editor-agent-marketplace]: 23505 duplicate insert re-adds agentTypeId to activeIds rather than rolling back — agent is effectively already active
- [Phase 03-md-workspace-editor-agent-marketplace]: vitest.config.ts excludes supabase/ dir to avoid Deno https: import errors in Node ESM loader
- [Phase 03-md-workspace-editor-agent-marketplace]: sanitize.ts is verbatim mirror of edge function — identical pattern list, identical [FILTERED] replacement
- [Phase 03-md-workspace-editor-agent-marketplace]: useWorkspaceAutoSave.test.ts uses it.todo stubs so vitest exits 0 without the hook existing yet
- [Phase 03-md-workspace-editor-agent-marketplace]: basicSetup imported from @codemirror/basic-setup (not @codemirror/view) — re-exported from that package in CM6
- [Phase 03-md-workspace-editor-agent-marketplace]: WorkspaceEditor mount useEffect has empty deps [] with eslint-disable comment — value sync handled by separate [value] effect to prevent cursor jump
- [Phase 03-md-workspace-editor-agent-marketplace]: useAgentWorkspace Supabase queries cast as any — agent_workspaces and available_agent_types not in generated types; TODO: regenerate after Phase 1 migrations
- [Phase 03-md-workspace-editor-agent-marketplace]: EditableWorkspaceTab inner component per editable tab — clean useAgentWorkspace isolation
- [Phase 03-md-workspace-editor-agent-marketplace]: Dialog (not Sheet) for workspace modal at max-w-4xl h-[80vh] — more vertical space for CodeMirror editor
- [Phase 03-md-workspace-editor-agent-marketplace]: userId fetched internally in GenericAgentPanel via supabase.auth.getUser() — callers keep existing interface
- [Phase 03-md-workspace-editor-agent-marketplace]: 'marketplace' added as explicit union member of ActiveView type for type safety
- [Phase 03-md-workspace-editor-agent-marketplace]: Add Agent entry sits inside AI Agents SidebarGroup (not a separate Marketplace group)
- [Phase 03-md-workspace-editor-agent-marketplace]: 'marketplace' added as explicit union member of ActiveView type for type safety
- [Phase 03-md-workspace-editor-agent-marketplace]: Add Agent entry sits inside AI Agents SidebarGroup (not a separate Marketplace group) — consistent with plan spec
- [Phase 04-heartbeat-system]: it.todo stubs mirror Phase 3 useWorkspaceAutoSave.test.ts pattern — vitest exits 0 on todo-only files
- [Phase 04-heartbeat-system]: worrylesssuperagent/ is a nested git repo — task commits land in that repo, plan metadata commit lands in outer repo
- [Phase 04-heartbeat-system]: pgmq.create() (logged) not create_unlogged() — low-volume heartbeat queue, correctness over speed
- [Phase 04-heartbeat-system]: Vault secret names 'service_role_key' and 'project_url' for pg_cron-to-edge-function auth — consistent with send-daily-briefing pattern
- [Phase 04-heartbeat-system]: notifications table has all Phase 5 columns at creation — no ALTER TABLE needed in Phase 5
- [Phase 04-heartbeat-system]: No INSERT RLS on notifications — service role only, matching agent_heartbeat_log precedent
- [Phase 04-heartbeat-system]: useHeartbeatConfig casts supabase queries as any for user_agents — columns not in generated types (same as useAgentWorkspace pattern)
- [Phase 04-heartbeat-system]: HeartbeatConfigSection uses HTML input[type=time] for active hours — no additional date library needed
- [Phase 04-heartbeat-system]: GenericAgentPanel CardContent changed to p-0 with inner padding to allow HeartbeatConfigSection border-t to span full width
- [Phase 04-heartbeat-system]: src/lib/heartbeatParser.ts is the vitest-importable mirror of _shared/heartbeatParser.ts — vitest.config.ts excludes supabase/ dir so both files are needed
- [Phase 04-heartbeat-system]: sendUrgentEmail fetches user email from profiles table (not auth.users admin API) — simpler, email populated during onboarding
- [Phase 04-heartbeat-system]: parseActiveHours() placed in src/utils/ (not supabase/_shared/) — vitest excludes supabase/ dir; src/utils/ accessible via @/ alias
- [Phase 04-heartbeat-system]: get_due_heartbeat_agents as SECURITY DEFINER SQL function — keeps AT TIME ZONE and COUNT budget logic in SQL where DST is always correct; edge function stays thin
- [Phase 04-heartbeat-system]: Morning digest delivered via notifications table (severity=digest, agent_type_id=chief_of_staff) — no messages table exists in codebase; send-daily-briefing uses Resend email which is a separate pre-existing feature
- [Phase 05-org-view-notifications]: HeartbeatStatus 'surfaced' outcome beats recency — attention status regardless of how recent the heartbeat is
- [Phase 05-org-view-notifications]: LEGACY_VIEW_MAP duplicated inline in AgentCard — decouples team component tree from DashboardSidebar internals
- [Phase 05-org-view-notifications]: useTeamData casts supabase queries as any for user_agents and agent_heartbeat_log — consistent with useAgentWorkspace pattern
- [Phase 05-org-view-notifications]: useTeamData.test.ts already existed with real passing tests (committed in 05-03) — kept as-is since it exceeds Wave 0 requirements
- [Phase 05-org-view-notifications]: useNotifications.test.ts uses it.todo stubs only in Wave 0 — useNotifications hook did not exist until Plan 02 committed it
- [Phase 05-org-view-notifications]: useNotifications casts supabase queries as any for notifications table — not in generated types, consistent with useAgentWorkspace/useHeartbeatConfig pattern
- [Phase 05-org-view-notifications]: resolveView uses inline LEGACY_VIEW_MAP inside hook — mirrors DashboardSidebar map, avoids cross-component import
- [Phase 05-org-view-notifications]: NotificationBell uses BellDot icon (lucide-react) when unreadCount > 0 — visual distinction without additional badge library
- [Phase 05-org-view-notifications]: next_digest_run_at dispatcher pattern (same as heartbeat_at) — hourly cron queries due users, advances column after delivery, no timezone-bucket crons needed
- [Phase 05-org-view-notifications]: Dynamic import of jsr:@negrel/webpush inside urgent try/catch — allows heartbeat-runner to deploy before VAPID keys are configured
- [Phase 05-org-view-notifications]: VAPID env vars treated as optional in heartbeat-runner — if absent, push skipped silently; email delivery unaffected
- [Phase 06-heartbeat-bug-fixes]: snake_case keys (user_agent_id, user_id, agent_type_id) are the authoritative pgmq message contract between dispatcher and runner
- [Phase 06-heartbeat-bug-fixes]: Fix the check not the data source (Option A): heartbeatStatus.ts checks urgent||headsup||digest severity values; useTeamData.ts and AgentCard.tsx unchanged
- [Phase 06-heartbeat-bug-fixes]: lastOutcome parameter name preserved — semantic imprecision pre-existed; renaming out of Phase 6 scope
- [Phase 07-workspace-prompt-wiring-push-optin]: buildWorkspacePrompt Deno mirror uses verbatim copy with 2-line comment header — diff excluding header is 0 lines
- [Phase 07-workspace-prompt-wiring-push-optin]: workspaceFiles initialised with empty strings for all 6 keys — handles missing rows gracefully without null checks downstream
- [Phase 07-workspace-prompt-wiring-push-optin]: PushOptInBanner onDismiss sets localStorage push_opt_in_shown=1 so Dashboard Plan 04 banner knows not to re-show
- [Phase 07-workspace-prompt-wiring-push-optin]: fire-and-forget workspace personalization block moved before setStep('push_opt_in') — fires regardless of user push accept/skip choice
- [Phase 07-workspace-prompt-wiring-push-optin]: fetchAndBuildWorkspacePrompt places workspace block AFTER basePrompt and BEFORE businessKnowledge — preserves WS-07 injection order (IDENTITY→SOUL→SOPs→TOOLS→MEMORY)
- [Phase 07-workspace-prompt-wiring-push-optin]: chat-with-agent uses self-contained fetchAgentWorkspaceBlock — edge functions independently deployed, cannot share runtime state with orchestrator
- [Phase 07-workspace-prompt-wiring-push-optin]: PushOptInBanner rendered above DashboardOverview using fragment wrapper — no changes to existing wrapper div layout needed
- [Phase 07-workspace-prompt-wiring-push-optin]: useEffect dependency includes checkingOnboarding to prevent banner flickering during loading phase
- [Phase 08-phase-verifications]: overall_status set to partial (not passed) — five Phase 1 behavioral items require live Supabase DB confirmation before milestone sign-off (DB-04 trigger runtime, DB-05 RLS isolation, SEC-01 live 401)
- [Phase 08-phase-verifications]: SEC-01 PASS on code review — all 3 edge functions follow identical JWT extraction pattern via auth.getUser(); userId always from user.id (JWT), never from req.body
- [Phase 08-phase-verifications]: WS-07 PASS with gap-closure note: utility and tests delivered Phase 3 (buildWorkspacePrompt.ts), production wiring completed Phase 7 (heartbeat-runner, orchestrator, chat-with-agent)
- [Phase 08-phase-verifications]: MKT-04 confirmed as soft-delete: deactivateAgent uses UPDATE is_active=false at useAgentMarketplace.ts:143, comment explicitly states NEVER DELETE — workspace rows preserved
- [Phase 08-phase-verifications]: HB-01..09 all marked PASS (fixed Phase 6) — Phase 6 snake_case fix makes the dispatcher→runner pipeline functional; VERIFICATION.md records current fixed state
- [Phase 08-phase-verifications]: SEC-02 confirmed from source only — _req unused, SUPABASE_SERVICE_ROLE_KEY explicit in dispatcher, no JWT extraction anywhere in dispatcher code
- [Phase 08-phase-verifications]: ORG-04 PASS (fixed Phase 6): heartbeatStatus.ts checks urgent||headsup||digest; original 'surfaced' check was never a real severity value
- [Phase 08-phase-verifications]: NOTIF-03 PASS (gap closed Phase 7): VAPID wiring Phase 5; PushOptInBanner + Dashboard first-load banner added Phase 7 Plans 03-04

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 4 pre-planning:** Per-user daily heartbeat budget enforcement mechanism needs a decision before Phase 4 begins (counter column vs aggregate query vs pgmq metadata token bucket)
- **Phase 5 pre-planning:** Morning briefing per-user timezone scheduling strategy — pg_cron is UTC-only; need to decide on timezone-bucket approach vs per-user next-run timestamp
- **Phase 3 pre-planning:** HEARTBEAT.md checklist grammar must be defined before building the format validator in the workspace editor

## Session Continuity

Last session: 2026-03-17T09:37:39.967Z
Stopped at: Completed 08-04-PLAN.md — Phase 5 Org View + Notifications VERIFICATION.md (NOTIF-01..06, ORG-01..05)
Resume file: None
