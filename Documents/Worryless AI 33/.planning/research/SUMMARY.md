# Project Research Summary

**Project:** Worryless AI — Multi-Agent Business Automation Platform
**Domain:** Proactive multi-agent SaaS — agent team management, heartbeat scheduling, MD workspace editing
**Researched:** 2026-03-12
**Confidence:** HIGH (all four research areas resolved with official sources or verified codebase-grounded analysis)

---

## Executive Summary

Worryless AI is building a proactive AI team management layer on top of an existing Supabase + React SPA. The core challenge is not UI novelty but infrastructure correctness: a heartbeat system that fans out across up to 12 agents per user must be built queue-first or it will time out, generate runaway LLM costs, and deliver a broken experience before it ever gets used. Research is unambiguous — the dispatcher+pgmq queue architecture is the only viable approach for Supabase's pg_cron constraints, and it must be built this way from day one rather than retrofitted later.

The product's value depends on making AI agents feel like employees rather than software. Research across Lindy AI, AutoGen Studio, and agentic UX literature identifies a consistent set of table-stakes patterns: role-framed agent cards with activity timestamps, streaming status labels during processing, a morning briefing digest from the Chief of Staff, and HEARTBEAT_OK suppression that ensures agents only surface genuine signals. The differentiating UX moment is the post-onboarding team activation animation — a low-effort, high-emotional-impact step that sets the mental model for everything that follows. None of these patterns require new infrastructure beyond what is already decided.

The three risks that can kill the milestone are: (1) heartbeat runaway from a broken suppression check creating notification spam and budget bleed overnight; (2) the onboarding team selector step killing conversion if implemented as a heavy decision grid rather than a pre-checked, single-click accept flow; and (3) users silently degrading agent quality by editing SOPs.md in ways that break the heartbeat checklist format with no recovery path. All three have clear mitigations that must ship with their respective features, not as follow-up work.

---

## Key Findings

### Recommended Stack

The existing React + Supabase + Deno Edge Functions stack is fully capable of delivering this milestone without adding any new backend services. Four specific additions are required: (1) Supabase Queues (pgmq extension, GA late 2024) for the heartbeat fan-out; (2) native Web Push API with VAPID via `@negrel/webpush` (JSR) for browser push notifications — no Firebase, no OneSignal; (3) CodeMirror 6 via `@uiw/react-codemirror` for the workspace editor — not Monaco, which reads as an IDE to non-technical users; and (4) `EdgeRuntime.waitUntil()` (released 2024) to decouple the heartbeat runner's HTTP acknowledgment from its background LLM processing.

Resend is already integrated and requires no changes beyond adding a heartbeat alert email template. AI streaming uses `fetch()` directly on the frontend — `supabase.functions.invoke()` buffers the full response and cannot stream, a documented limitation (functions-js #67). Markdown workspace content is stored as plain `text` columns with generated `tsvector` + GIN index for full-text search; JSONB would add overhead with zero structural benefit for unstructured prose.

**Core technologies:**
- **Supabase Queues (pgmq):** heartbeat job queue — the only architecture that keeps dispatcher + runner within edge function timeout limits
- **`@negrel/webpush` (JSR):** VAPID push from Deno edge functions — zero-dependency, no Google account required
- **`@uiw/react-codemirror` + `@codemirror/lang-markdown`:** workspace file editor — ~50KB, mobile-friendly, document-editor feel for non-technical users
- **`EdgeRuntime.waitUntil()`:** background LLM processing after cron HTTP acknowledgment — prevents 150s timeout from killing in-flight heartbeat runs
- **Broadcast from Database (Supabase Realtime, 2024):** trigger-based in-app notification bell — no polling, no edge function needed for in-tab updates

**Details:** `.planning/research/STACK.md`

---

### Expected Features

Research across Lindy AI, AutoGen Studio, Relevance AI, and agentic UX literature (Smashing Magazine Feb 2026) produced a clear split between what non-technical entrepreneurs expect on day one and what delivers the "wow" moment.

**Must have (table stakes) — missing these makes the product feel incomplete:**
- Agent recommendation with per-agent reasoning card tied to onboarding answers — blank lists feel arbitrary
- Pre-checked team acceptance with a single "Activate My Team" CTA — opt-out, not opt-in
- Streaming status labels during agent work ("Reviewing your invoices...") — static spinners feel broken
- Last active timestamp + pulsing activity indicator per agent in Team view
- Morning briefing digest from Chief of Staff synthesizing overnight agent findings
- CodeMirror markdown editor with auto-save (debounced 2s) — plain textarea signals amateurism
- MEMORY.md "learned X things" counter in agent card — makes agents feel alive and growing
- Intent preview before any high-risk agent action — prevents the surprise outputs that permanently break trust

**Should have (differentiators that create the "wow" moment):**
- Team activation animation after onboarding ("Your team is getting briefed on [Business Name]") — 2-3 seconds, enormous emotional payoff for minimal engineering
- Heartbeat notifications in the agent's own voice — "Your Marketing Manager flagged..." not "Worryless AI alerts you..."
- Severity-tiered notifications (Urgent / Heads-up / Digest) — only Urgent triggers push or email; the rest surface in-app

**Defer to v2+:**
- Per-agent autonomy dial (Suggest / Confirm / Autopilot) — validator system already handles tiers 1 and 2; tier 3 Autopilot is a separate trust milestone
- Collapsible "How I got here" reasoning trail — high value but adds per-response complexity
- Per-agent notification preferences — build the delivery system first; preferences are a refinement
- Custom freeform agent creation — fixed 12-type catalog is sufficient for v1

**Anti-features to explicitly avoid:**
- Blank "create your agent" form (cognitive overload)
- Push notification on every heartbeat tick — HEARTBEAT_OK runs are always silent
- Full Monaco editor for workspace files (wrong mental model for entrepreneurs)
- Lateral agent spawning (agents creating agents)

**Details:** `.planning/research/FEATURES.md`

---

### Architecture Approach

The architecture is a 4-table schema built around two runtime paths: an activation path (user spawns an agent → trigger auto-populates workspace) and a heartbeat path (cron → dispatcher → pgmq queue → runner → LLM → conditional notification). These two paths share the same schema but are otherwise independent, which allows Phase 2 (spawner + onboarding) and Phase 3 (workspace editor) to be built in parallel after Phase 1 (schema) is complete.

The OrgChartView is a fixed two-level CSS Flexbox layout, not a third-party org chart library. The AgentWorkspaceEditor is a shadcn/ui Sheet (slide-in panel), not a new ActiveView navigation entry — this avoids adding 12 workspace routes to the Dashboard's view union. The Agent Spawner runs entirely server-side as an edge function; the Lovable API key must not reach the browser.

**Major components:**
1. **`available_agent_types` table** — static seed-only catalog of 12 types + Chief of Staff; stores all 6 default MD templates per type; source of truth for workspace initialization
2. **`user_agents` table** — tracks which agents each user has activated; holds heartbeat config (interval, active hours, enabled); `next_heartbeat_at` drives dispatcher query
3. **`agent_workspaces` table** — one row per (user, agent, file_type); 6 rows per activated agent; `UNIQUE(user_id, agent_type_id, file_type)`; auto-populated by Postgres trigger on `user_agents` insert
4. **`agent_heartbeat_log` table** — sparse, surfaced and error outcomes only; suppresses OK writes; indexed on `(user_id, agent_type_id, run_at DESC)`
5. **`heartbeat-dispatcher` edge function** — cron-invoked every 5 min; queries `user_agents WHERE next_heartbeat_at <= now()`; enqueues to pgmq; updates `next_heartbeat_at` immediately to prevent double-dispatch
6. **`heartbeat-runner` edge function** — cron-invoked every 1 min; reads 5 messages from pgmq per invocation; runs LLM call per message; deletes on success; lets visibility timeout retry on failure
7. **`agent-spawner` edge function** — called once at end of onboarding; assembles business context + catalog; calls LLM in JSON mode; inserts `user_agents` rows with `is_active = false` until user accepts
8. **`AgentTeamSelectorStep` component** — step 12 of `ConversationalOnboarding`; pre-checked checkboxes; single "Accept Suggested Team" CTA; sets `onboarding_completed = true` only on accept
9. **`AgentWorkspaceEditor` Sheet** — file tab bar for 5 editable files; MEMORY.md read-only pane; HeartbeatConfig inline; `Reset to defaults` button per file
10. **`OrgChartView` component** — CSS Flexbox two-level hierarchy; `HeartbeatStatusIndicator` (compact) per agent card; no third-party library

**Details:** `.planning/research/ARCHITECTURE.md`

---

### Critical Pitfalls

Five pitfalls with production-breaking consequences identified from codebase analysis and external research:

1. **Heartbeat runaway burns budget overnight** — If suppression logic fails (e.g., JSON parse error causes HEARTBEAT_OK check to evaluate false), every quiet agent tick becomes a billable LLM call and a false notification. Prevention: use structured output (`response_format: json_object`) for heartbeat responses; enforce per-user daily call budgets at the dispatcher level; cap agents per dispatcher run at 50. Ship suppression correctness verification before enabling push notifications.

2. **Edge function timeout kills dispatcher mid-fan-out** — A sequential loop inside the dispatcher will time out at Supabase's 150s free plan limit. A single cron tick cannot process 500 users × 4 agents sequentially. Prevention: queue-based architecture is non-negotiable from day one. The dispatcher only enqueues; it never runs LLM calls. The runner processes 5 messages max per invocation within timeout.

3. **Agent Spawner recommends wrong agents for niche businesses** — Gemini Flash has weak coverage for non-mainstream business types, and businesses with sparse/no websites (common in the East African target market) leave the spawner with thin context. Prevention: build the checkbox-with-reasons UI as the safety net; limit default team to 4-5 agents; store raw spawner output and user's final selection for analysis.

4. **Users break agents by editing SOPs badly with no recovery path** — Non-technical users editing HEARTBEAT.md can overwrite the checklist format that the runner depends on; editing SOPs.md with conflicting instructions silently degrades output; pasted content may contain inadvertent prompt injection. Prevention: validate HEARTBEAT.md format on save (must parse as a checklist); provide a "Reset to defaults" button per file (immutable templates in `available_agent_types`); sanitize user-edited content before injecting into system prompts. These must ship with the editor, not as follow-up.

5. **Agent Team Selector step kills onboarding conversion** — Asking a fatigued user to make decisions at step 12 of an 11-step flow is risky. Each additional form step reduces completion by 5-7%. Prevention: make the selector a visually dominant "Accept Suggested Team" single-click path; limit display to 4-5 pre-checked agents; show the full 12-agent catalog only via the post-onboarding Agent Marketplace. Instrument per-step drop-off analytics before shipping.

**Details:** `.planning/research/PITFALLS.md`

---

## Implications for Roadmap

Research resolves a clear 5-phase build order. The critical dependency chain is: schema first, then spawner + workspace editor in parallel, then heartbeat system, then org view + notifications. Phases 2 and 3 can run concurrently after Phase 1.

### Phase 1: Database Foundation

**Rationale:** Every other component — spawner, workspace editor, heartbeat system, org view — depends on the 4-table schema and its triggers. Nothing else can start in earnest until these tables exist and are correctly wired. This is the shortest phase with the highest blocking factor.

**Delivers:** `available_agent_types` seeded with 12 agent types + Chief of Staff (including all 6 default MD templates per type); `user_agents` table with heartbeat config columns; `agent_workspaces` table with Postgres trigger that auto-populates 6 workspace rows on agent activation; `agent_heartbeat_log` table; updated `supabase/types.ts`; RLS policies on all new tables; `user_push_subscriptions` table for VAPID storage.

**Features from FEATURES.md:** Prerequisite for all features — no direct user-facing deliverable.

**Pitfall avoidance:** Unique constraints on `(user_id, agent_type_id)` in `user_agents` and `(user_id, agent_type_id, file_type)` in `agent_workspaces` prevent the double-init duplicate spawning pitfall (Pitfall 11) at the database level before any application code is written.

---

### Phase 2: Agent Spawner and Onboarding Tail

**Rationale:** The onboarding flow modification is the entry point for all new users. It must come before the marketplace or workspace editor is useful, since users need at least one activated agent to see those panels. The Agent Team Selector is the higher-risk component (Pitfall 5 — conversion drop) and requires careful implementation of the pre-checked, single-click accept path.

**Delivers:** `agent-spawner` edge function (JSON-mode LLM call with fixed catalog in system prompt; returns ranked recommendations with `why` and `first_week_value` copy); `AgentTeamSelectorStep` component (pre-checked checkboxes, single CTA, `is_active = false` until accepted); `ConversationalOnboarding.tsx` step 12 addition; team activation animation ("briefing your team" loading state with agent avatars); migration to backfill `user_agents` rows for existing users with the 4 default agents.

**Stack from STACK.md:** Lovable AI Gateway with `response_format: json_object`; Supabase `functions.invoke` for spawner call; existing onboarding component extended.

**Pitfall avoidance:** Pre-checked checkboxes with bypass path (Pitfall 5); confidence threshold on spawner output to limit default team to 4-5 agents (Pitfall 3); idempotent spawner with upsert logic (Pitfall 11); store raw spawner output in `user_agents` for recommendation quality analysis (Pitfall 3 detection).

**Research flag:** STANDARD PATTERNS — Agent recommendation via JSON-mode LLM call is well-documented; onboarding flow modification is bounded to one component. No additional research phase needed.

---

### Phase 3: Agent MD Workspace Editor and Marketplace

**Rationale:** Can start in parallel with Phase 2 after Phase 1 completes — requires only the schema. The workspace editor gives value to users who already have agents (existing users and new users who completed Phase 2). The marketplace lets users activate additional agents post-onboarding.

**Delivers:** `AgentWorkspaceEditor` Sheet component (CodeMirror 6 tabs for IDENTITY, SOUL, SOPs, HEARTBEAT, TOOLS; MEMORY.md read-only pane with "learned X things" counter; debounced 2s auto-save; Reset to defaults button per file; HeartbeatConfig inline section); `AgentMarketplace` component (catalog grid with active badges, Activate CTA); `HeartbeatStatusIndicator` component (reused in OrgChartView later); Dashboard sidebar entries for Team and Marketplace views.

**Stack from STACK.md:** `@uiw/react-codemirror` + `@codemirror/lang-markdown` (lazy-loaded to avoid bundle impact); `react-markdown` + `remark-gfm` (already in codebase) for preview tab; debounced Supabase UPDATE for auto-save.

**Features from FEATURES.md:** CodeMirror markdown editor with auto-save (table stakes); MEMORY.md counter (differentiator); Reset to defaults (critical for Pitfall 4 recovery path).

**Pitfall avoidance:** HEARTBEAT.md format validation on save — must parse as a checklist before write is accepted (Pitfall 4); content sanitization layer before prompt injection (Pitfall 4); Reset to defaults available from day one (Pitfall 4); MEMORY.md rendered read-only with no CodeMirror instance (Pitfall 4).

**Research flag:** STANDARD PATTERNS for CodeMirror integration. NEEDS RESEARCH for the HEARTBEAT.md format validation logic — the checklist grammar must be defined before building the validator.

---

### Phase 4: Heartbeat System

**Rationale:** Depends on Phase 1 (schema) and Phase 3 (HEARTBEAT.md content must be editable before the system reads it). This is the highest-risk phase technically — the queue architecture must be correct from day one. Suppression correctness must be verified before push notifications are enabled.

**Delivers:** pgmq `heartbeat_jobs` queue (enabled via Supabase Dashboard); `heartbeat-dispatcher` edge function (queries `user_agents WHERE next_heartbeat_at <= now() LIMIT 50`; enqueues to pgmq; updates `next_heartbeat_at` immediately); `heartbeat-runner` edge function (reads 5 messages per invocation; assembles HEARTBEAT.md + SOPs.md + MEMORY.md context; calls Lovable Gateway; HEARTBEAT_OK → delete message, no DB write; surfaced → insert `agent_heartbeat_log`, trigger notification path); `pg_cron` jobs (dispatcher every 5 min; runner every 1 min); `EdgeRuntime.waitUntil()` wrapping LLM processing; business-hours enforcement using user timezone in dispatcher query; per-user daily call budget guard at dispatcher level.

**Stack from STACK.md:** pgmq via `supabase.schema('pgmq_public').rpc()`; `EdgeRuntime.waitUntil()` for background processing; structured output (`response_format: json_object`) for HEARTBEAT_OK detection; Supabase Vault for storing project URL and anon key used by cron SQL.

**Pitfall avoidance:** Queue architecture prevents timeout (Pitfall 2); structured output prevents suppression bypass (Pitfall 1); LIMIT 50 cap prevents burst (Pitfall 1); optimistic locking on pgmq messages prevents duplicate processing (Pitfall 8); user timezone in dispatcher query prevents 3am heartbeats (Pitfall 10); daily budget guard prevents overnight runaway (Pitfall 1).

**Research flag:** NEEDS RESEARCH for per-user daily call budget enforcement strategy — decide whether to use a counter column on `user_agents`, a Redis-style increment in pgmq, or a daily aggregate query. Verify `EdgeRuntime.waitUntil()` interaction with pg_cron HTTP response timing on paid vs free plan. Standard patterns apply to the queue consumption and dispatcher architecture itself.

---

### Phase 5: Org View, Notifications, and Realtime

**Rationale:** Depends on Phase 4 for live heartbeat data. The OrgChartView is the product's primary "team is alive" surface — it needs real `last_heartbeat_at` timestamps and `agent_heartbeat_log` entries to be meaningful. Notification delivery (push and email) is gated on suppression correctness from Phase 4 being verified first.

**Delivers:** `OrgChartView` component (Chief of Staff centered at top; CSS Flexbox specialist grid; `HeartbeatStatusIndicator` compact per card; last active timestamp; pulsing green dot for agents active in last 4 hours; no third-party org chart library); morning briefing digest via Chief of Staff (separate `morning-briefing` edge function invoked once per day per user; synthesizes all `agent_heartbeat_log` entries from previous 24h; routes through existing Chief of Staff orchestrator); VAPID push notification delivery for Urgent-severity heartbeat findings (`send-push-notification` edge function; frontend service worker; VAPID key generation and storage); Resend email alert template for Urgent findings; Supabase Realtime Broadcast from Database trigger on `notifications` table insert for in-app notification bell; severity tier classification (Urgent / Heads-up / Digest) in heartbeat runner output parsing.

**Stack from STACK.md:** `@negrel/webpush` (JSR) for VAPID in Deno; `public/sw.js` service worker; Supabase Realtime Broadcast from Database (trigger-based, released 2024); Resend `resend@2.0.0` (already integrated); `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` Supabase secrets.

**Features from FEATURES.md:** Morning briefing digest (table stakes); pulsing last-active indicator (table stakes); heartbeat notifications in agent's own voice (differentiator); severity-tiered notifications (differentiator); streaming status labels during agent processing.

**Pitfall avoidance:** Severity tiering ensures only Urgent findings trigger push/email — HEARTBEAT_OK and Heads-up are always silent (Pitfall 1 + notification fatigue); Realtime Broadcast from Database keeps in-app bell real-time without polling overhead.

**Research flag:** NEEDS RESEARCH for morning briefing timing and per-user timezone scheduling — the `morning-briefing` cron must run once per user at their local morning, which requires a different cron strategy than the heartbeat dispatcher (pg_cron runs UTC; may need to segment users by timezone bucket). STANDARD PATTERNS for VAPID push from Deno and Realtime Broadcast trigger.

---

### Phase Ordering Rationale

- Phase 1 before everything: schema triggers are synchronous with agent activation — if the trigger doesn't exist when the first `user_agents` insert happens, workspace rows are never created and manual recovery is required.
- Phases 2 and 3 in parallel: they share the schema but have no component dependencies on each other. Running them in parallel shortens the critical path to Phase 4.
- Phase 3 before Phase 4: heartbeat runner reads HEARTBEAT.md content that users may have customized; the workspace editor must exist so users can configure their agents before heartbeats start.
- Phase 4 before Phase 5: OrgChartView and notification delivery both require live heartbeat data and suppression correctness to be meaningful and safe.
- Phase 5 last: it is the product's "showroom" layer — displaying data from all previous phases. It can start UI scaffolding against the schema immediately but cannot display real agent activity until Phase 4 is running.

### Research Flags

Phases needing deeper research during planning:

- **Phase 4 (Heartbeat System):** Per-user daily call budget enforcement mechanism needs a decision — counter column vs aggregate query vs external rate limiter. Interaction of `EdgeRuntime.waitUntil()` with paid vs free plan duration limits needs verification before setting batch size.
- **Phase 5 (Org View and Notifications):** Morning briefing per-user timezone scheduling strategy. pg_cron minimum granularity is 1 minute and runs UTC — a per-timezone-bucket approach may be needed for users distributed across time zones.
- **Phase 3 (Workspace Editor):** HEARTBEAT.md checklist grammar definition — must be specified before writing the format validator to avoid building the wrong validator.

Phases with standard, well-documented patterns (skip research-phase):

- **Phase 1 (Schema):** Standard Supabase migrations, RLS, and Postgres triggers — no research needed.
- **Phase 2 (Spawner + Onboarding):** JSON-mode LLM calls and React component extension — established patterns in the codebase.
- **Phase 4 (Queue Architecture):** pgmq dispatcher + runner pattern is directly documented in official Supabase blog and docs.
- **Phase 5 (VAPID Push):** `@negrel/webpush` + service worker pattern is fully documented with Deno examples.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 5 stack questions resolved against official Supabase docs (pgmq, cron, streaming, push, realtime). One MEDIUM-HIGH: `@negrel/webpush` JSR library verified but less battle-tested than npm web-push. |
| Features | HIGH | Competitor analysis from official sources (Lindy, AutoGen, AgentOps). Agentic UX patterns from Smashing Magazine Feb 2026 (primary source). One MEDIUM: "reasoning card" per agent is a novel pattern — no direct competitor example found; inferred from trust literature. |
| Architecture | HIGH | Schema, trigger, timeout safety analysis, and queue patterns all verified against official Supabase limits documentation. One MEDIUM: pg_cron practical job limit inferred from community reports + docs recommendation; not an exact published number. |
| Pitfalls | HIGH (codebase-grounded) / MEDIUM (external) | Pitfalls 1-5 grounded in actual codebase patterns (CONCERNS.md findings, existing edge function code). External industry failure modes (Glean, Arize, OWASP) are MEDIUM confidence — consistent across multiple sources but not Worryless-specific. |

**Overall confidence: HIGH**

The research is unusually strong because the architecture and pitfalls research was grounded in the actual codebase rather than generic patterns. The main source of residual uncertainty is the East African / Kenyan market context for the spawner recommendation quality — LLM behavior on niche or informal-sector businesses is hard to predict from documentation alone and will need empirical testing during Phase 2.

### Gaps to Address

- **Spawner recommendation quality for niche businesses:** The agent spawner's accuracy for non-mainstream business types in the East African context cannot be fully assessed from documentation. Mitigate by instrumenting acceptance rate tracking from day one (Phase 2) and iterating on the system prompt based on real user data.
- **HEARTBEAT.md checklist grammar:** The exact format the heartbeat runner expects to parse from HEARTBEAT.md must be defined before Phase 3 validation logic is built. This is a two-hour specification task, not a research gap — but it must happen before Phase 3 begins.
- **Morning briefing cron strategy for multi-timezone users:** The morning briefing digest must run once per user at their local morning time. pg_cron is UTC-only with 1-minute minimum granularity. Whether to use timezone bucket scheduling, a per-user next-run timestamp approach (same as heartbeat dispatcher), or a different mechanism needs a spike during Phase 5 planning.
- **Per-user daily heartbeat budget enforcement:** No clear best-practice for in-Supabase rate limiting at user level. Options: counter column on `user_agents` reset daily by cron, aggregate query in dispatcher before enqueue, or a lightweight token bucket in pgmq metadata. Decision needed before Phase 4 begins.
- **CodeMirror bundle impact:** `@uiw/react-codemirror` adds ~50KB gzipped. The existing Vite SPA bundle size is unknown. Verify with `vite-bundle-visualizer` before committing to the import; lazy-load the `AgentWorkspaceEditor` Sheet to ensure CodeMirror only loads when the panel is opened.

---

## Sources

### Primary (HIGH confidence)

- [Supabase Queues Docs](https://supabase.com/docs/guides/queues) — pgmq API, queue creation, visibility timeout behavior
- [Supabase Queues: Consuming with Edge Functions](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions) — batch read pattern, delete-on-success
- [Processing Large Jobs with Edge Functions, Cron, and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — dispatcher + queue fan-out architecture
- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits) — 150s free / 400s paid wall-clock limits
- [Background Tasks in Edge Functions](https://supabase.com/blog/edge-functions-background-tasks-websockets) — `EdgeRuntime.waitUntil()` pattern
- [Realtime Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database) — trigger-based broadcast, `realtime.broadcast_changes()`
- [Supabase Cron](https://supabase.com/docs/guides/cron) — job registration, vault secret usage, 8-job concurrent limit
- [Push Notifications via Supabase Edge Functions](https://supabase.com/docs/guides/functions/examples/push-notifications) — VAPID pattern in Deno
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) — generated tsvector column, GIN index
- [AutoGen Studio v0.4 User Guide](https://microsoft.github.io/autogen/dev//user-guide/autogenstudio-user-guide/index.html) — visual agent management patterns
- [Lindy 3.0 Launch](https://www.lindy.ai/blog/lindy-3-0) — AI employee framing, team accounts
- [Designing Agentic AI: Practical UX Patterns](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/) — autonomy dial, intent preview, recommendation reveal
- [OWASP LLM Top 10 2025 — Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — workspace sanitization rationale
- [react-codemirror](https://github.com/uiwjs/react-codemirror) — bundle size, Vite compatibility, markdown extension

### Secondary (MEDIUM confidence)

- [Secrets of Agentic UX — UX Magazine](https://uxmag.com/articles/secrets-of-agentic-ux-emerging-design-patterns-for-human-interaction-with-ai-agents) — onboarding trust patterns
- [Help Your Users Avoid Notification Fatigue — MagicBell](https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue) — 61% retention stat for preference-following notifications
- [Relevance AI Reviews — G2](https://www.g2.com/products/relevance-ai/reviews) — pre-built role templates, version history
- [Glean: Hallucinations in Enterprise Agent Onboarding](https://www.glean.com/perspectives/when-llms-hallucinate-in-enterprise-contexts-and-how-contextual-grounding) — niche business context failure mode
- [Arize: Why AI Agents Break in Production](https://arize.com/blog/common-ai-agent-failures/) — production failure modes
- [SaaS Onboarding Best Practices 2025](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist) — per-step drop-off rates (5-7% per additional step)
- [Openclaw Runaway Heartbeat Issue #3181](https://github.com/openclaw/openclaw/issues/3181) — heartbeat runaway documented in sister project
- [Multi-Tenant Security Pitfalls 2025](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) — userId-from-body vulnerability pattern

### Tertiary (LOW confidence / needs validation)

- `supabase/functions-js#67` — `supabase.functions.invoke()` streaming buffering issue; confirmed in GitHub discussions but no official documentation acknowledgment
- Community reports on pg_cron practical job limits beyond 8-32 concurrent — the 8-job concurrent recommendation is official; the performance degradation curve beyond that is community-reported

---

*Research completed: 2026-03-12*
*Ready for roadmap: yes*
