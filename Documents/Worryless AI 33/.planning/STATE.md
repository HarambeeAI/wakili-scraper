---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02-agent-spawner-team-selector/02-05-PLAN.md
last_updated: "2026-03-12T20:31:26.433Z"
last_activity: 2026-03-12 — Roadmap created; 52 requirements mapped across 5 phases
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
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

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 4 pre-planning:** Per-user daily heartbeat budget enforcement mechanism needs a decision before Phase 4 begins (counter column vs aggregate query vs pgmq metadata token bucket)
- **Phase 5 pre-planning:** Morning briefing per-user timezone scheduling strategy — pg_cron is UTC-only; need to decide on timezone-bucket approach vs per-user next-run timestamp
- **Phase 3 pre-planning:** HEARTBEAT.md checklist grammar must be defined before building the format validator in the workspace editor

## Session Continuity

Last session: 2026-03-12T19:59:38.672Z
Stopped at: Completed 02-agent-spawner-team-selector/02-05-PLAN.md
Resume file: None
