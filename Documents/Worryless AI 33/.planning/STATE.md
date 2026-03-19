---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Agent Intelligence Layer
status: unknown
stopped_at: Completed 12-01-PLAN.md
last_updated: "2026-03-19T02:19:32.214Z"
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 13
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.
**Current focus:** Phase 12 — chief-of-staff-tools-+-governance

## Current Position

Phase: 12 (chief-of-staff-tools-+-governance) — EXECUTING
Plan: 2 of 4

## Performance Metrics

**Velocity (v1.0 completed):**

- Total plans completed: 39
- Phases completed: 9

**v2.0 in progress:**

- Plans completed: 10 (10-01: LangGraph DB migrations, 10-02: LangGraph server scaffold, 10-03: LangGraph proxy Edge Function, 10-04: Frontend feature flag hook, 11-01: Agent type constants + state schema + LLM client + memory helpers, 11-02: Base agent factory + 4 specialist subgraphs, 11-03: 7 operational agents + COO supervisor, 11-04: CoS root supervisor graph + agent registry, 11-05: HITL + thread manager + RAG + supervisor wired, 12-01: Governance infrastructure — audit log + token budget + atomic checkout + goal chain)
- Duration: 4 min + 6 min + ~8 min + 8 min + 7 min + 12 min + 9 min + 2 min + 2 min + 9 min

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions from v1.0 (carried forward):

- Store MD workspaces as text rows in `agent_workspaces` table (not filesystem)
- Single `heartbeat-dispatcher` cron (not per-agent crons)
- Fixed 12-agent catalog for v1 (ships faster with better quality defaults)
- HEARTBEAT_OK suppression: no DB write on suppressed runs

New v2.0 decisions:

- LangGraph server on Railway (Node.js/TypeScript) — not Edge Functions for agent execution
- PostgresSaver for checkpointing in separate `langgraph` schema in Supabase
- `use_langgraph` feature flag in profiles for gradual rollout
- Playwright persistent browser for Marketer social media (not fragile APIs)
- Nano Banana 2 (Gemini 3.1 Flash Image) for brand-consistent image generation
- Developer-provided API keys (Apify, Resend, Firecrawl) via Supabase Vault
- Hierarchical supervisor: CoS (root) → COO (level-2 for operational agents)
- Chat-first generative UI replacing all static agent dashboards
- Business-stage-aware onboarding (Starting / Running / Scaling)
- Paperclip AI patterns: goal ancestry, atomic task checkout, token budgets, audit log
- [Phase 10-langgraph-infrastructure]: langgraph schema isolated from public schema; service_role only access for LangGraph server
- [Phase 10-langgraph-infrastructure]: profiles.use_langgraph is the sole existing-table modification in Phase 10; DEFAULT FALSE ensures zero-impact rollout
- [Phase 10-langgraph-infrastructure]: pgvector dimension 1536 for OpenAI text-embedding-3-small; IVFFlat index deferred until >10k rows
- [Phase 10-langgraph-infrastructure]: PostgresSaver uses direct Supabase connection (port 5432) not pooled (port 6543) — prepared statements incompatible with PgBouncer
- [Phase 10-langgraph-infrastructure]: LangGraph Store implemented as raw pg Pool queries against langgraph.store table (no native Postgres Store in JS SDK)
- [Phase 10-langgraph-infrastructure]: JWT validation at proxy boundary — LangGraph server is auth-free, trusts user_id injected by Edge Function
- [Phase 10-04]: useLangGraphFlag defaults to false on error — legacy orchestrator is always the safe fallback for all users
- [Phase 10-04]: getChatEndpoint is a pure helper (not a hook) for use in both React and non-React contexts
- [Phase 10-04]: document_embeddings TypeScript type added proactively to prevent future type errors when 10-03 migrations go live
- [Phase 11]: LLM client uses direct fetch wrapper (not LangChain ChatModel) — simpler integration with Lovable AI Gateway's OpenAI-compatible endpoint
- [Phase 11]: Store namespace uses colon-separated prefix string: userId:agent_memory:agentType — encodes LangGraph tuple namespace as flat string for existing store.ts pg queries
- [Phase 11]: AgentState uiComponents and pendingApprovals use accumulator reducer while all other channels use last-write-wins
- [Phase 11]: Command.PARENT verified as '__parent__' in @langchain/langgraph@1.2.3 — correct constant for subgraph-to-parent routing
- [Phase 11]: Specialist agent subgraphs follow createBaseAgentGraph factory pattern: 40-60 line files with SYSTEM_PROMPT constant + create{Agent}Graph(checkpointer?) export
- [Phase 11]: Invoke-delegate subgraph pattern for COO ops agents — avoids checkpointer conflicts between parent and child graphs
- [Phase 11]: COO builder cast to any for dynamic node registration — TypeScript narrows StateGraph generics on each addNode call
- [Phase 11]: COO_REPORTS used as routing validation list with AGENT_TYPES.OPERATIONS as fallback for unexpected LLM output
- [Phase 11]: Invoke-delegate subgraph pattern for CoS direct reports — same as COO, avoids nested checkpointer conflicts
- [Phase 11]: AGENT_GRAPH_REGISTRY chief_of_staff entry is undefined — CoS is root supervisor, not a routable subgraph
- [Phase 11]: Thread index stored in LangGraph Store (userId:thread_index prefix) because PostgresSaver has no native list-threads API
- [Phase 11]: RAG retrieval provides both pgvector cosine similarity (Phase 12+) and PostgreSQL FTS fallback (available immediately)
- [Phase 11]: createSupervisorGraph replaces createEchoGraph in /invoke — echo graph no longer referenced in server
- [Phase 12]: Fire-and-forget audit writes (.catch pattern) — immutability eventually consistent; blocking agent hot path for audit unacceptable
- [Phase 12]: Lazy monthly budget reset — checkTokenBudget auto-resets when budget_reset_at passed; no pg_cron needed
- [Phase 12]: UPDATE...WHERE claimed_by IS NULL RETURNING id for atomic task checkout — atomic under READ COMMITTED, works with PgBouncer, simpler than advisory locks
- [Phase 12]: agent_tasks.agent_type migrated ENUM to TEXT — supports all 13 v2 agent types; old ENUM not dropped (deferred cleanup)
- [Phase 12]: GoalChainEntry[] | null as last-write-wins (not accumulator) — each delegation replaces full chain so subgraphs receive complete goal context

### Pending Todos

None yet.

### Blockers/Concerns

- LangGraph JS (`@langchain/langgraph`) ecosystem maturity vs. Python — verify all needed features exist in TS version before Phase 10
- Playwright persistent browser context at scale — each user needs isolated browser data; evaluate storage and resource requirements on Railway
- PostgresSaver connection to Supabase — RESOLVED: use direct connection (port 5432) not pooled (port 6543)
- Google OAuth for PA — requires Google Cloud project setup and consent screen approval before Phase 15

## Session Continuity

Last session: 2026-03-19T02:19:32.211Z
Stopped at: Completed 12-01-PLAN.md
Resume file: None
