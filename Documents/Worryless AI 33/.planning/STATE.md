---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Agent Intelligence Layer
status: unknown
stopped_at: Completed 16-03-PLAN.md
last_updated: "2026-03-19T09:34:18.935Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 34
  completed_plans: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.
**Current focus:** Phase 16 — proactive-cadence-engine

## Current Position

Phase: 16 (proactive-cadence-engine) — EXECUTING
Plan: 3 of 5

## Performance Metrics

**Velocity (v1.0 completed):**

- Total plans completed: 39
- Phases completed: 9

**v2.0 in progress:**

- Plans completed: 26 (10-01: LangGraph DB migrations, 10-02: LangGraph server scaffold, 10-03: LangGraph proxy Edge Function, 10-04: Frontend feature flag hook, 11-01: Agent type constants + state schema + LLM client + memory helpers, 11-02: Base agent factory + 4 specialist subgraphs, 11-03: 7 operational agents + COO supervisor, 11-04: CoS root supervisor graph + agent registry, 11-05: HITL + thread manager + RAG + supervisor wired, 12-01: Governance infrastructure — audit log + token budget + atomic checkout + goal chain, 12-02: Governance hooks wired into base agent createLLMNode, 12-03: 7 CoS tools (briefing, delegation, fan-out, memory, correlation, action items, health), 12-04: cosTools node integration — supervisor graph wired with cosTools + goalChain delegation + audit log, 13-01: Phase 13 foundation — DB migration + shared DB pool + base-agent exports + type contracts, 13-02: 6 base accountant tools (invoice, transaction, bank statement, receipt, cashflow, P&L), 13-03: 6 advanced accountant tools (tax, anomaly z-score, chase HITL, runway, HTML invoice) + graph rewrite with accountantTools node, 14-01: Playwright browser manager + marketer type contracts, 14-02: 4 marketer tools — generateSocialPost + createContentCalendar + generateBrandImage + editImage, 14-03: 3 tools — schedulePost + publishPost + fetchPostAnalytics + analyzePostPerformance + manageContentLibrary, 14-04: 3 research tools — monitorBrandMentions + analyzeCompetitor + searchTrendingTopics, 14-05: Marketer barrel index + agent graph rewrite with marketerTools node + classification tests, 15-01: Phase 15 foundation — DB migration + googleapis + 8 type contracts, 15-02: 10 PA tools (Gmail, Calendar, Drive) + barrel index + 20 tests, 15-03: 18 OPS tools (CS ticket CRUD + KB RAG + churn + Legal contract review + calendar + HR recruiting + onboarding) + 23 tests)
- Duration: 4 min + 6 min + ~8 min + 8 min + 7 min + 12 min + 9 min + 2 min + 2 min + 9 min + 5 min + 9 min + 15 min + 8 min + 10 min + 10 min + 4 min + 4 min + 4 min + 4 min + 3 min + 7 min + 6 min

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
- [Phase 12]: Governance at single chokepoint (createLLMNode) — 12 agents governed with 1 file modification
- [Phase 12]: budgetPaused returns AIMessage with user-friendly override CTA; budgetWarning is non-blocking (80-99% triggers flag only)
- [Phase 12]: GOV hook order in createLLMNode: extract content -> budget check -> build prompt (with goal chain) -> callLLM -> fire-and-forget writes -> return
- [Phase 12]: correlateFindings _userId convention — underscore prefix reserved for Plan 04 audit logging integration
- [Phase 12]: CoS tools are plain typed async functions (not LangChain Tool objects) — called deterministically by request classification, not LLM function-calling dispatch
- [Phase 12]: cosTools node pattern: data-gathering node before router ensures LLM always has real business data; classifyRequest uses regex heuristics not LLM; cosToolResults stored in businessContext; createFanOutSends used for multi-agent routing (COS-03)
- [Phase 13-01]: Shared DB pool in tools/shared/db.ts mirrors store.ts pattern — consistent pool management across all tool files
- [Phase 13-01]: createLLMNode/createRespondNode exported with export keyword only — no signature or behavior changes
- [Phase 13-01]: Partial unique index on leads(user_id, email) WHERE email IS NOT NULL — allows leads without email while preventing email-based dupes
- [Phase 13-accountant-sales-rep-agent-tools]: Apify cap Math.min(fetchCount ?? 20, 20) — LangGraph shorter timeout than Edge Functions; ON CONFLICT dedup with plain INSERT fallback for no-email leads
- [Phase 13-accountant-sales-rep-agent-tools]: sendOutreach HITL is mandatory — interruptForApproval called before any Resend API call; trackEmailEngagement reads open/click counts from DB only (Resend webhook populates them)
- [Phase 13-02]: pdf-parse v2 uses PDFParse class (not v1 pdfParse function) — import updated to named export with new PDFParse({ data: buffer }).getText() API
- [Phase 13-02]: parseReceipt bypasses callLLM via direct gateway fetch — callLLM stringifies content arrays breaking multimodal image_url format
- [Phase 13-03]: AGENT_GRAPH_REGISTRY and DIRECT_REPORT_FACTORIES widened to `(cp?) => any` — TypeScript narrows StateGraph generics per addNode call, making graphs with different node counts incompatible; cast to any follows Phase 11 COO precedent
- [Phase 13-03]: isChaseInvoice path fetches overdue invoice list rather than calling chaseOverdueInvoice directly — HITL interrupt requires specific invoice ID from user on follow-up turn
- [Phase 13-03]: forecastRunway returns runwayMonths=999 when netBurn <= 0 — signals infinite runway safely without divide-by-zero
- [Phase 13-05]: salesTools node follows cosTools pattern — regex classification before LLM, results in businessContext.salesToolResults
- [Phase 13-05]: createSubgraphNode factory typed as any in supervisor.ts — heterogeneous compiled graph topologies (salesTools vs accountantTools) cannot share a typed factory signature
- [Phase 14]: vitest added to langgraph-server devDependencies for browser unit tests
- [Phase 14]: [Phase 14-02]: callLLMWithStructuredOutput uses string schema description (not Zod) — matched actual LLM client API
- [Phase 14]: [Phase 14-02]: GoogleGenAI test mock uses ES6 class (not vi.fn) — new keyword requires constructor-compatible mock
- [Phase 14]: callLLMWithStructuredOutput uses string schema description (not Zod) -- matches actual API from llm/client.ts
- [Phase 14]: vi.mock factories use top-level vi.fn() references to avoid vitest hoisting ReferenceError -- object literals in factory closures fail
- [Phase 14-04]: page.evaluate uses string expression (not arrow function) to avoid TS DOM lib requirement in Node-only tsconfig
- [Phase 14-04]: firecrawlSearch extracted as shared helper within research-tools.ts — DRY for monitorBrandMentions and searchTrendingTopics
- [Phase 14-04]: vi.hoisted() pattern for vitest mock factories that reference shared mock objects across multiple tests
- [Phase 14-05]: isAnalyzePerformance regex uses analy[sz]e (not analyz) to match full word at boundary -- trailing \b fails on partial stem
- [Phase 14-05]: analytics-tools.ts page.evaluate converted to string expression to avoid TS DOM lib requirement (same pattern as 14-04 research-tools)
- [Phase 15-01]: googleapis (not google-auth-library) installed — bundles OAuth2 client + Gmail/Calendar/Drive API clients needed for PA agent in one package
- [Phase 15-01]: google-auth.ts reads tokens from integrations table (provider = 'google') — consistent with existing OAuth storage pattern from Phase 1 DB schema
- [Phase 15-01]: Type contracts are TypeScript interfaces only (no Zod/runtime validation) — matches existing pattern from accountant/types.ts, marketer/types.ts
- [Phase 15]: [Phase 15-04]: PO stored as agent_assets with asset_type='purchase_order'; agent_assets uses title not name column
- [Phase 15]: [Phase 15-04]: compareQuotes parses lead time strings (days/weeks/months) to numeric days for fair comparison
- [Phase 15]: extractBody helper walks Gmail payload.parts for text/plain before falling back — Gmail API returns nested MIME parts for multipart messages
- [Phase 15]: detectCalendarConflicts calls listCalendarEvents internally rather than the Calendar API directly — DRY and consistent event mapping
- [Phase 15-03]: vi.hoisted() pattern used for all test mock factories — consistent with Phase 14 pattern, avoids TDZ ReferenceError with vi.mock factory closures
- [Phase 15-03]: screenResume fetches candidate name in a second query after UPDATE — avoids requiring name in the function signature, keeps API minimal
- [Phase 15-03]: monitorRegulatory includes JSON parse fallback for raw text — LLM may return non-JSON on edge cases, fallback wraps content gracefully
- [Phase 15-03]: contractCalendar uses INTERVAL cast ('$n days')::INTERVAL — parameterized interval injection compatible with pg driver
- [Phase 15]: isPureNumeric strict check (Number() not parseFloat()) — prevents date strings like '2026-01' from being extracted as numeric values during z-score analysis
- [Phase 15]: mockQuery.mockReset() in beforeEach (not vi.clearAllMocks()) — preserves getPool mock while clearing call history for vitest test isolation
- [Phase 15-06]: Trailing \b removed from plural regex patterns (anomal, supplier, project, conflict) — word boundary fails on 'anomalies', 'suppliers', 'projects' because the plural 's' is a word character with no boundary after the stem
- [Phase 15-06]: coo.ts opsFactories widened to (cp?) => any — heterogeneous compiled graph topologies (csTools, legalTools, hrTools, etc.) cannot share a typed factory signature after tool node rewrites added different node counts per agent
- [Phase 16]: proactive-runner does NOT delete non-LangGraph user messages from queue — visibility timeout allows heartbeat-runner to pick them up (coexistence pattern)
- [Phase 16]: isProactive guards both checkTokenBudget and incrementTokenUsage — prevents false budget-paused messages AND budget consumption for proactive runs
- [Phase 16]: Deterministic proactive thread ID (proactive:agentType:userId) — persistent across runs for memory continuity and conversation threading
- [Phase 16]: [Phase 16-02]: proactive-runner duplicates HEARTBEAT_PROMPTS inline — Deno cannot import Node.js modules; isProactive guards both checkTokenBudget AND incrementTokenUsage; deterministic proactive thread IDs persist across runs
- [Phase 16]: accountant monthly prompt uses 'unusual or suspicious' instead of 'anomaly' — isAnomalyQuery regex requires word boundary after 'anomal' stem which 'anomaly' doesn't satisfy
- [Phase 16]: DEFAULT_CADENCE_CONFIG co-located in heartbeat-prompts.ts — single cadence module export point, no separate cadence-config.ts needed
- [Phase 16]: accountant prompts use 'invoices with outstanding balances' not 'overdue invoices' to avoid isChaseInvoice regex trigger (overdue.*invoice pattern)
- [Phase 16]: get_due_cadence_agents() uses UNION ALL across 4 tiers returning cadence_tier TEXT; original get_due_heartbeat_agents() preserved for legacy path
- [Phase 16-04]: configRef pattern for debounced closure — avoids stale config capture by maintaining a ref synced on every optimistic update
- [Phase 16]: [Phase 16-03]: contracts table uses end_date (not expiry_date) for expiring_contract event detector — SQL query adapted from plan spec

### Pending Todos

None yet.

### Blockers/Concerns

- LangGraph JS (`@langchain/langgraph`) ecosystem maturity vs. Python — verify all needed features exist in TS version before Phase 10
- Playwright persistent browser context at scale — each user needs isolated browser data; evaluate storage and resource requirements on Railway
- PostgresSaver connection to Supabase — RESOLVED: use direct connection (port 5432) not pooled (port 6543)
- Google OAuth for PA — requires Google Cloud project setup and consent screen approval before Phase 15

## Session Continuity

Last session: 2026-03-19T09:34:18.932Z
Stopped at: Completed 16-03-PLAN.md
Resume file: None
