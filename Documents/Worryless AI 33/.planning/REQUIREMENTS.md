# Requirements: Worryless AI v2.0 — Agent Intelligence Layer

**Defined:** 2026-03-18
**Core Value:** Every entrepreneur gets a complete, context-aware AI department on day one — agents that know the business, stay proactive, and get smarter over time.

## v2.0 Requirements

### Infrastructure (INFRA)

- [ ] **INFRA-01**: LangGraph server (Node.js/TypeScript) deployed on Railway with health check endpoint
- [x] **INFRA-02**: PostgresSaver connected to Supabase PostgreSQL in dedicated `langgraph` schema for thread checkpointing
- [x] **INFRA-03**: LangGraph Store connected to Supabase PostgreSQL for persistent cross-thread agent memory
- [ ] **INFRA-04**: Supabase Edge Function proxy that validates JWT and forwards requests to LangGraph server via SSE
- [x] **INFRA-05**: pgvector extension enabled with `document_embeddings` table for RAG over business artifacts
- [x] **INFRA-06**: Feature flag (`use_langgraph`) in profiles table for gradual rollout
- [x] **INFRA-07**: All existing domain tables (invoices, leads, social_posts, transactions, etc.) remain unchanged — agents access via tools

### Agent Graph Topology (GRAPH)

- [ ] **GRAPH-01**: Root StateGraph with Chief of Staff as supervisor node routing to specialist subgraphs
- [ ] **GRAPH-02**: Conditional routing via LangGraph `Command` objects — CoS LLM decides which agent(s) to invoke
- [ ] **GRAPH-03**: Parallel fan-out via `Send()` when multiple agents needed for a single user request
- [ ] **GRAPH-04**: COO level-2 supervisor subgraph routing to 7 operational agents
- [ ] **GRAPH-05**: Human-in-the-loop via `interrupt()` for all high-risk actions (sending emails, publishing posts, financial transactions, POs)
- [ ] **GRAPH-06**: Each of the 13 agent types implemented as a LangGraph subgraph with role-specific tools
- [ ] **GRAPH-07**: Agent state schema with messages, userId, businessContext, uiComponents, pendingApprovals, responseMetadata

### Agent Tools — Chief of Staff (COS)

- [ ] **COS-01**: `compile_morning_briefing` tool aggregating all agent heartbeat findings, overdue tasks, and calendar events
- [ ] **COS-02**: `delegate_to_agent` tool routing work to specialists via LangGraph `Command` with goal ancestry context
- [ ] **COS-03**: `fan_out_to_agents` tool dispatching parallel work via `Send()` for multi-agent tasks
- [ ] **COS-04**: `query_cross_agent_memory` tool reading any agent's Store namespace for synthesis
- [ ] **COS-05**: `correlate_findings` tool detecting connections between concurrent agent heartbeat flags
- [ ] **COS-06**: `track_action_items` tool following up on items from previous briefings
- [ ] **COS-07**: `assess_agent_health` tool checking heartbeat status and error rates across all agents

### Agent Tools — Accountant (ACCT)

- [ ] **ACCT-01**: `create_invoice` and `list_invoices` tools for invoice CRUD
- [ ] **ACCT-02**: `record_transaction` tool with LLM auto-categorization
- [ ] **ACCT-03**: `parse_bank_statement` tool extracting transactions from CSV/PDF
- [ ] **ACCT-04**: `parse_receipt` tool using Gemini multimodal (photo to structured data)
- [ ] **ACCT-05**: `calculate_cashflow_projection` tool projecting 30/60/90 days
- [ ] **ACCT-06**: `generate_pl_report` tool producing P&L with MoM comparison
- [ ] **ACCT-07**: `track_budget_vs_actual` tool comparing spending against targets
- [ ] **ACCT-08**: `estimate_tax` tool calculating liability by jurisdiction
- [ ] **ACCT-09**: `detect_anomalous_transaction` tool flagging outlier transactions
- [ ] **ACCT-10**: `chase_overdue_invoice` tool drafting reminder (requires HITL)
- [ ] **ACCT-11**: `forecast_runway` tool calculating months of cash remaining
- [ ] **ACCT-12**: `generate_invoice_pdf` tool using Nano Banana 2

### Agent Tools — Marketer (MKT)

- [ ] **MKT-01**: `generate_social_post` tool for platform-specific content (IG, X, LinkedIn, TikTok)
- [ ] **MKT-02**: `generate_brand_image` tool using Nano Banana 2 with brand colors, product photos, logo
- [ ] **MKT-03**: `edit_image` tool for overlays, color adjustments, compositing
- [ ] **MKT-04**: `schedule_post` tool writing to social_posts table
- [ ] **MKT-05**: `publish_post` tool via Playwright persistent browser (requires HITL)
- [ ] **MKT-06**: `fetch_post_analytics` tool scraping platform dashboards via Playwright
- [ ] **MKT-07**: `analyze_post_performance` tool comparing metrics against averages with WHY analysis
- [ ] **MKT-08**: `create_content_calendar` tool generating weekly/monthly plan
- [ ] **MKT-09**: `monitor_brand_mentions` tool scanning web for business name
- [ ] **MKT-10**: `analyze_competitor` tool browsing competitor profiles via Playwright
- [ ] **MKT-11**: `search_trending_topics` tool for industry trend discovery
- [ ] **MKT-12**: `manage_content_library` tool for searching and reusing past assets

### Agent Tools — Sales Rep (SALES)

- [ ] **SALES-01**: `generate_leads` tool via Apify (developer-provided key)
- [ ] **SALES-02**: `enrich_lead_data` tool via web search
- [ ] **SALES-03**: `research_prospect` tool via Firecrawl + web search
- [ ] **SALES-04**: `compose_outreach` tool with personalization from prospect research + business context
- [ ] **SALES-05**: `send_outreach` tool via Resend (requires HITL)
- [ ] **SALES-06**: `track_email_engagement` tool via Resend webhooks
- [ ] **SALES-07**: `update_deal_status` tool moving leads through pipeline
- [ ] **SALES-08**: `schedule_follow_up` tool with optimal timing from memory
- [ ] **SALES-09**: `create_proposal` tool generating sales proposals
- [ ] **SALES-10**: `analyze_pipeline` tool for velocity and conversion rates
- [ ] **SALES-11**: `forecast_revenue` tool projecting from pipeline + historical rates
- [ ] **SALES-12**: `detect_stale_deals` tool flagging stuck deals

### Agent Tools — Personal Assistant (PA)

- [ ] **PA-01**: `read_emails` tool via Google Gmail API
- [ ] **PA-02**: `triage_inbox` tool categorizing by urgency/topic via LLM
- [ ] **PA-03**: `draft_email_response` tool matching user communication style
- [ ] **PA-04**: `send_email` tool via Gmail API (requires HITL)
- [ ] **PA-05**: `list_calendar_events` tool via Google Calendar API
- [ ] **PA-06**: `create_calendar_event` tool with availability check (requires HITL)
- [ ] **PA-07**: `prepare_meeting_brief` tool synthesizing attendee info, history, agenda, docs
- [ ] **PA-08**: `search_drive` tool via Google Drive API
- [ ] **PA-09**: `detect_calendar_conflicts` tool with resolution suggestions
- [ ] **PA-10**: `analyze_time_allocation` tool for meeting vs focus time breakdown

### Agent Tools — Operational Agents (OPS)

- [ ] **OPS-01**: Customer Support: ticket CRUD (new `support_tickets` table), KB RAG search, health scoring, churn detection
- [ ] **OPS-02**: Legal: contract review, contract calendar (new `contracts` table), regulatory monitoring, template drafting
- [ ] **OPS-03**: HR: job posting, resume screening, candidate tracking (new `candidates` table), onboarding plans, performance reviews
- [ ] **OPS-04**: PR: press release drafting, media monitoring, coverage tracking (new `press_coverage` table), sentiment analysis
- [ ] **OPS-05**: Procurement: supplier search, quote comparison, PO creation (requires HITL), vendor scoring
- [ ] **OPS-06**: Data Analyst: cross-functional query, statistical analysis, anomaly detection, chart generation, KPI aggregation
- [ ] **OPS-07**: Operations: project management (new `projects` table), milestone tracking, bottleneck analysis, SOP drafting

### Memory & Persistence (MEM)

- [ ] **MEM-01**: Per-agent memory namespace in LangGraph Store
- [ ] **MEM-02**: Shared business context namespace readable by all agents
- [ ] **MEM-03**: Memory writes after tool execution, user feedback, and heartbeat analysis
- [ ] **MEM-04**: Memory reads before every agent action
- [ ] **MEM-05**: All conversations persist via PostgresSaver across sessions and devices
- [ ] **MEM-06**: Thread management: continue old conversations or start new ones per agent
- [ ] **MEM-07**: RAG retrieval tool using pgvector embeddings

### Proactive Cadence (CAD)

- [ ] **CAD-01**: Cadence dispatcher using pg_cron + pgmq triggering full LangGraph execution
- [ ] **CAD-02**: Role-specific heartbeat checklists per agent
- [ ] **CAD-03**: Daily cadence: morning briefing, inbox triage, cashflow, pipeline, content queue
- [ ] **CAD-04**: Weekly cadence: cross-team summary, content performance, pipeline progression, expenses
- [ ] **CAD-05**: Monthly cadence: P&L, conversion analysis, marketing review, KPI dashboard
- [ ] **CAD-06**: Quarterly cadence: business review, strategic assessment, financial review, compliance
- [ ] **CAD-07**: Event-triggered proactive actions (viral post, stale deal, overdue invoice, etc.)
- [ ] **CAD-08**: Per-agent cadence config in `user_agents.cadence_config` JSONB

### Generative UI (GUI)

- [ ] **GUI-01**: `AgentChatView` replacing all static agent dashboards
- [ ] **GUI-02**: `GenerativeUIRenderer` mapping component types to React components
- [ ] **GUI-03**: Chart components via Recharts (bar, line, pie, area, gauge, sparkline)
- [ ] **GUI-04**: Data table components via @tanstack/react-table
- [ ] **GUI-05**: Dynamic form components from agent tool schemas
- [ ] **GUI-06**: Approval request cards with Approve/Reject/Discuss for HITL
- [ ] **GUI-07**: Domain-specific: Pipeline Kanban, Content Calendar, Invoice Tracker, Calendar Timeline, Meeting Brief
- [ ] **GUI-08**: SSE streaming with text deltas + UI components + tool indicators
- [ ] **GUI-09**: `useAgentChat` hook managing threads, streaming, UI, approvals
- [ ] **GUI-10**: Thread list sidebar for past conversations per agent

### Persistent Browser (BROWSER)

- [ ] **BROWSER-01**: Playwright persistent browser context per user for Marketer
- [ ] **BROWSER-02**: User login flow via embedded browser iframe/popup
- [ ] **BROWSER-03**: Session persistence via cookies/localStorage saved to disk
- [ ] **BROWSER-04**: Session expiry detection with re-login notification
- [ ] **BROWSER-05**: Browser-based operations: publish, analytics, competitor scraping

### Onboarding Redesign (ONB)

- [ ] **ONB-01**: Business stage question: Starting / Running / Scaling
- [ ] **ONB-02**: Stage-specific follow-up questions
- [ ] **ONB-03**: Agent team recommendation via CoS LangGraph graph
- [ ] **ONB-04**: Integration setup: Google OAuth for PA, browser login for Marketer
- [ ] **ONB-05**: First real briefing from CoS as first chat message
- [ ] **ONB-06**: Business stage stored in profiles, shapes agent interactions

### Governance (GOV)

- [ ] **GOV-01**: Immutable audit log table for all agent actions and tool calls
- [ ] **GOV-02**: Monthly token budget per agent with 3-tier enforcement
- [ ] **GOV-03**: Goal ancestry on tasks: mission to objective to project to task
- [ ] **GOV-04**: Atomic task checkout preventing double-work

## v2.1 Requirements (Deferred)

- A/B testing framework for content variants (Marketer)
- Newsletter/blog generation tools (Marketer)
- Compensation benchmarking via web search (HR)
- Crisis response workflow (PR)
- Vendor contract negotiation drafting (Procurement)
- Custom agent creation (describe-a-role to generate agent)
- Multi-workspace / agency mode
- Mobile app with push-to-agent chat
- Voice input for agent chat

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent-to-agent direct messaging in UI | Agents coordinate via CoS delegation and shared Store |
| Real-time video/voice calls with agents | Text chat + generative UI sufficient for v2 |
| Custom freeform agent creation | Fixed catalog with comprehensive tools is priority |
| Marketplace for community agent templates | Focus on first-party quality |
| Self-hosted LangGraph | Managed Railway deployment for all users |

## Traceability

**Coverage:**
- v2.0 requirements: 114 total
- Mapped to phases: 114
- Unmapped: 0

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 10 | Pending |
| INFRA-02 | Phase 10 | Complete |
| INFRA-03 | Phase 10 | Complete |
| INFRA-04 | Phase 10 | Pending |
| INFRA-05 | Phase 10 | Complete |
| INFRA-06 | Phase 10 | Complete |
| INFRA-07 | Phase 10 | Complete |
| GRAPH-01 | Phase 11 | Pending |
| GRAPH-02 | Phase 11 | Pending |
| GRAPH-03 | Phase 11 | Pending |
| GRAPH-04 | Phase 11 | Pending |
| GRAPH-05 | Phase 11 | Pending |
| GRAPH-06 | Phase 11 | Pending |
| GRAPH-07 | Phase 11 | Pending |
| MEM-01 | Phase 11 | Pending |
| MEM-02 | Phase 11 | Pending |
| MEM-03 | Phase 11 | Pending |
| MEM-04 | Phase 11 | Pending |
| MEM-05 | Phase 11 | Pending |
| MEM-06 | Phase 11 | Pending |
| MEM-07 | Phase 11 | Pending |
| COS-01 | Phase 12 | Pending |
| COS-02 | Phase 12 | Pending |
| COS-03 | Phase 12 | Pending |
| COS-04 | Phase 12 | Pending |
| COS-05 | Phase 12 | Pending |
| COS-06 | Phase 12 | Pending |
| COS-07 | Phase 12 | Pending |
| GOV-01 | Phase 12 | Pending |
| GOV-02 | Phase 12 | Pending |
| GOV-03 | Phase 12 | Pending |
| GOV-04 | Phase 12 | Pending |
| ACCT-01 | Phase 13 | Pending |
| ACCT-02 | Phase 13 | Pending |
| ACCT-03 | Phase 13 | Pending |
| ACCT-04 | Phase 13 | Pending |
| ACCT-05 | Phase 13 | Pending |
| ACCT-06 | Phase 13 | Pending |
| ACCT-07 | Phase 13 | Pending |
| ACCT-08 | Phase 13 | Pending |
| ACCT-09 | Phase 13 | Pending |
| ACCT-10 | Phase 13 | Pending |
| ACCT-11 | Phase 13 | Pending |
| ACCT-12 | Phase 13 | Pending |
| SALES-01 | Phase 13 | Pending |
| SALES-02 | Phase 13 | Pending |
| SALES-03 | Phase 13 | Pending |
| SALES-04 | Phase 13 | Pending |
| SALES-05 | Phase 13 | Pending |
| SALES-06 | Phase 13 | Pending |
| SALES-07 | Phase 13 | Pending |
| SALES-08 | Phase 13 | Pending |
| SALES-09 | Phase 13 | Pending |
| SALES-10 | Phase 13 | Pending |
| SALES-11 | Phase 13 | Pending |
| SALES-12 | Phase 13 | Pending |
| MKT-01 | Phase 14 | Pending |
| MKT-02 | Phase 14 | Pending |
| MKT-03 | Phase 14 | Pending |
| MKT-04 | Phase 14 | Pending |
| MKT-05 | Phase 14 | Pending |
| MKT-06 | Phase 14 | Pending |
| MKT-07 | Phase 14 | Pending |
| MKT-08 | Phase 14 | Pending |
| MKT-09 | Phase 14 | Pending |
| MKT-10 | Phase 14 | Pending |
| MKT-11 | Phase 14 | Pending |
| MKT-12 | Phase 14 | Pending |
| BROWSER-01 | Phase 14 | Pending |
| BROWSER-02 | Phase 14 | Pending |
| BROWSER-03 | Phase 14 | Pending |
| BROWSER-04 | Phase 14 | Pending |
| BROWSER-05 | Phase 14 | Pending |
| PA-01 | Phase 15 | Pending |
| PA-02 | Phase 15 | Pending |
| PA-03 | Phase 15 | Pending |
| PA-04 | Phase 15 | Pending |
| PA-05 | Phase 15 | Pending |
| PA-06 | Phase 15 | Pending |
| PA-07 | Phase 15 | Pending |
| PA-08 | Phase 15 | Pending |
| PA-09 | Phase 15 | Pending |
| PA-10 | Phase 15 | Pending |
| OPS-01 | Phase 15 | Pending |
| OPS-02 | Phase 15 | Pending |
| OPS-03 | Phase 15 | Pending |
| OPS-04 | Phase 15 | Pending |
| OPS-05 | Phase 15 | Pending |
| OPS-06 | Phase 15 | Pending |
| OPS-07 | Phase 15 | Pending |
| CAD-01 | Phase 16 | Pending |
| CAD-02 | Phase 16 | Pending |
| CAD-03 | Phase 16 | Pending |
| CAD-04 | Phase 16 | Pending |
| CAD-05 | Phase 16 | Pending |
| CAD-06 | Phase 16 | Pending |
| CAD-07 | Phase 16 | Pending |
| CAD-08 | Phase 16 | Pending |
| GUI-01 | Phase 17 | Pending |
| GUI-02 | Phase 17 | Pending |
| GUI-03 | Phase 17 | Pending |
| GUI-04 | Phase 17 | Pending |
| GUI-05 | Phase 17 | Pending |
| GUI-06 | Phase 17 | Pending |
| GUI-07 | Phase 17 | Pending |
| GUI-08 | Phase 17 | Pending |
| GUI-09 | Phase 17 | Pending |
| GUI-10 | Phase 17 | Pending |
| ONB-01 | Phase 17 | Pending |
| ONB-02 | Phase 17 | Pending |
| ONB-03 | Phase 17 | Pending |
| ONB-04 | Phase 17 | Pending |
| ONB-05 | Phase 17 | Pending |
| ONB-06 | Phase 17 | Pending |

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — Traceability mapped to phases 10-17*
