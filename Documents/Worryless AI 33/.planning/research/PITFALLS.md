# Domain Pitfalls

**Domain:** Proactive multi-agent SaaS — heartbeat scheduling, agent spawning, MD workspaces, onboarding flow extension, role-based tool access
**Researched:** 2026-03-12
**Confidence:** HIGH (codebase-grounded) / MEDIUM (external patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, runaway costs, or broken production apps.

---

### Pitfall 1: Heartbeat Runaway — Unbounded LLM Calls Burn Budget Overnight

**What goes wrong:**
The dispatcher cron wakes every N minutes and fans out to all agents that are "due". If suppression logic fails (or is missing), every agent makes a full LLM call on every tick. At 12 agents x 4-hour interval x 8 business hours x 100 users, that is 3,600 LLM calls per day under normal operation. A bug that drops the `HEARTBEAT_OK` short-circuit — e.g., a JSON parse error in the suppression check, or an exception before the early-return — turns every quiet tick into a billable call. This exact failure mode is documented in the Openclaw issue tracker (runaway heartbeat loop, Issue #3181).

**Why it happens:**
The existing codebase already has fragile LLM JSON parsing via regex fallback (`orchestrator/index.ts` lines 641–644, `generate-outreach/index.ts` line 182). If the heartbeat agent response does not parse cleanly, the suppression condition silently evaluates to false and the tick is logged as "surfaced" even though nothing was found. The result is notification spam AND cost bleed simultaneously.

**Consequences:**
- Gemini API cost spikes with no alerting (codebase has zero error monitoring today)
- Non-technical users receive dozens of false "something needs attention" notifications
- User trust collapses within days; churn follows
- The existing scheduled-task system already has no retry or error monitoring — the same gap applies here

**Prevention:**
1. Implement hard per-user daily heartbeat call budgets enforced at the dispatcher level, not inside the agent function.
2. Use structured output (`response_format: { type: "json_object" }`) for heartbeat responses — do not rely on regex extraction to determine HEARTBEAT_OK vs. surfaced.
3. Log every tick outcome to `agent_heartbeat_log` before the LLM call, not after — so a crash mid-call leaves a visible record.
4. Add a per-agent `last_heartbeat_at` guard: if the last run was less than `min_interval_minutes` ago, skip regardless of cron fire time. Protects against duplicate dispatcher invocations.
5. Cap maximum agents eligible per dispatcher run (e.g., 50 at a time) to prevent a single cron tick from spawning 100+ concurrent edge function calls.

**Detection / Early Warning Signs:**
- Gemini API spend grows faster than user count
- `agent_heartbeat_log` shows surfaced rate > 15% across all agents (quiet businesses generate very little genuine insight daily)
- Edge function invocation count in Supabase dashboard spikes without corresponding user activity
- Non-technical users report "too many notifications" in first week

**Phase that must address this:** Heartbeat System phase — build suppression correctness before enabling notifications.

---

### Pitfall 2: Supabase Edge Function Timeout Kills the Dispatcher Mid-Fan-Out

**What goes wrong:**
The `heartbeat-dispatcher` is a single edge function invoked by a pg_cron job. It must query all due agents, fan out calls, and return within Supabase's wall-clock limit (150 seconds on free plan, 400 seconds on paid). If there are 500 users each with 4 active agents, the dispatcher has 2,000 agents to evaluate. Sequential HTTP calls to per-agent runner functions will hit the timeout. The cron job shows as "completed" (pg_cron fires and gets a response back from pg_net) even if the dispatcher timed out and left most agents unprocessed — a silent partial failure.

**Why it happens:**
The existing codebase has a custom `calculateNextRun` cron parser that only handles daily/weekly/monthly patterns and has zero tests (CONCERNS.md). Adding heartbeat scheduling on top of this untested foundation multiplies the failure surface. Additionally, Supabase pg_cron has a documented concurrency limit of 8–32 concurrent jobs depending on plan; a per-agent-per-user cron approach is explicitly not viable.

**Consequences:**
- Agents silently miss their heartbeat windows with no user visibility
- "Hours saved" and activity metrics go stale, undermining the platform's core value claim
- Debugging is extremely difficult without error monitoring

**Prevention:**
1. The dispatcher must be queue-based, not loop-based. Write all due agents to a `heartbeat_queue` table in one fast query, then return 200. A separate `heartbeat-worker` edge function polls the queue and processes one agent per invocation. This is the Supabase-recommended pattern for large jobs (see Processing large jobs with Edge Functions, Cron, and Queues).
2. Set a hard cap on agents processed per dispatcher run with a `LIMIT` clause; remaining agents stay in queue for the next minute's tick.
3. Use `pg_cron` to fire the dispatcher every minute, not every 4 hours. The dispatcher only enqueues; the interval logic lives in the queue row (`next_run_at`), not the cron schedule.
4. Mark queue rows as `processing` before starting work (optimistic locking) to prevent duplicate processing across concurrent workers.

**Detection / Early Warning Signs:**
- pg_cron job duration consistently near 150 seconds
- `agent_heartbeat_log` shows gaps (agents with no run record in expected window)
- Supabase edge function logs show 504 Gateway Timeout on dispatcher invocations

**Phase that must address this:** Heartbeat System phase — architecture must be queue-based from day one; retrofitting is much harder.

---

### Pitfall 3: Agent Spawner Recommends Irrelevant Agents for Niche or Atypical Businesses

**What goes wrong:**
The Agent Spawner analyzes onboarding context (business name, industry, description, website crawl) and recommends a team from the 12-agent catalog. For mainstream business types (e.g., e-commerce, professional services), the LLM recommendation is likely reasonable. For niche businesses — solo artists, traditional craft businesses, informal sector operators, unusual hybrids — the model has poor training coverage and will confidently recommend agents that are wrong for the context (e.g., recommending a `procurement` agent to a one-person yoga studio, or a `legal_compliance` agent to a market trader).

**Why it happens:**
Gemini Flash is optimized for speed and general coverage, not domain-specific nuance. The existing website crawler (`crawl-business-website`) feeds into business artifacts, but the crawl quality depends entirely on the website's content richness. Businesses with sparse or no website (common in the Kenyan/East African market given the project's location context) will have thin crawl artifacts, leaving the spawner with limited signal. Hallucination of business context is the #1 documented failure mode in enterprise LLM onboarding (Yellow.ai enterprise study, Glean context engineering report).

**Consequences:**
- Users adopt a "wrong" team, never engage with the agents, churn
- Users feel the product doesn't understand their business — the opposite of the core value proposition
- Worse: an irrelevant agent runs heartbeats and surfaces noise, accelerating distrust

**Prevention:**
1. The Agent Team Selector UI must show checkboxes with plain-English reason strings per agent ("Your business sells physical products, so this agent tracks supplier invoices"). Users must be able to deselect. Never auto-accept.
2. Implement a confidence threshold inside the spawner: if the LLM returns a low-confidence reason for an agent recommendation, exclude it from the defaults and show it only under an "Optional additions" accordion.
3. Always default to a smaller safe team (4–5 agents) rather than the full 12. Non-technical users are overwhelmed by too many agents; underselecting is safer than overselecting.
4. Store the raw spawner output and the user's final selection in `user_agents` for analysis — this is the primary feedback signal to improve recommendations over time.
5. Allow the user to change their agent team at any time post-onboarding (Agent Marketplace panel), so a wrong initial recommendation is not permanent.

**Detection / Early Warning Signs:**
- Low acceptance rate on pre-checked agents (users unchecking more than 3 of the recommended agents)
- Heartbeat surfaced rate is near-zero for certain agent types shortly after activation (agent is active but has nothing relevant to do)
- Support requests: "Why do I have a [HR/Legal/Procurement] agent? I don't need that."

**Phase that must address this:** Agent Spawner & Team Selection phase — validation UI is the safety net; build it before enabling auto-recommendations.

---

### Pitfall 4: Users Break Their Agents by Editing SOPs Badly — No Recovery Path

**What goes wrong:**
The Agent Settings panel exposes IDENTITY.md, SOUL.md, SOPs.md, and HEARTBEAT.md for user editing. A non-technical entrepreneur will not understand what "system prompt" means but will want to "improve" their agent by editing its instructions. Common edits that silently degrade behavior:
- Overwriting the structured HEARTBEAT.md checklist with a paragraph of conversational text, causing the agent to misparse its task list
- Adding conflicting instructions to SOPs.md ("always be formal" and "always be casual and friendly")
- Accidentally deleting the TOOLS.md-referenced skill invocation patterns, causing tool calls to fail silently
- Writing prompt injection content unintentionally (e.g., pasting a template that contains "Ignore previous instructions and...")

The codebase already shows that the orchestrator has a single-tool-call-only limit (`toolCalls[0]`), meaning malformed SOPs that cause unexpected tool call patterns will silently truncate agent behavior.

**Why it happens:**
The Openclaw-borrowed concept of editable MD workspaces is powerful for technical users but is a sharp edge for non-technical ones. OWASP 2025 rates prompt injection as the #1 LLM vulnerability. User-authored content in SOPs.md is untrusted input that feeds directly into the system prompt. The architecture does not yet include any sanitization layer between user edits and prompt assembly.

**Consequences:**
- Agent silently produces worse output; user blames the platform, not their edits
- In the worst case, a user inadvertently injects instructions that override safety behavior or cause data leakage to other tools
- Workspace state diverges from defaults with no way to reset

**Prevention:**
1. Add a "Reset to defaults" button per workspace file. The default templates must be stored in `available_agent_types` and remain immutable — users edit a copy, not the template.
2. Validate HEARTBEAT.md format on save: it must parse as a valid checklist (lines starting with `- [ ]`). Reject saves that would produce an unparseable checklist with an inline error message.
3. Sanitize user-edited workspace content before injecting into system prompts: strip or escape common injection patterns (`Ignore previous instructions`, `</system>`, `<|im_start|>`, etc.).
4. Show a "last working version" diff on the settings page so users can see what changed and revert.
5. MEMORY.md is correctly scoped as agent-write-only in the spec. Enforce this at the RLS level, not just in the UI — the column should have no UPDATE permission for the user role.

**Detection / Early Warning Signs:**
- Spike in user edits followed by drop in task completion rate for that agent
- Heartbeat surfaced rate goes to zero after a user edits their HEARTBEAT.md
- Support requests: "My agent stopped working after I changed something"
- MEMORY.md grows faster than expected (could indicate injected instructions causing agents to write excessively)

**Phase that must address this:** Agent MD Workspace System phase — validation and reset must ship with the edit UI, not as a follow-up.

---

### Pitfall 5: Agent Team Selector Step Kills Onboarding Conversion

**What goes wrong:**
The existing onboarding is 11 steps and already complete. Adding a 12th step — the Agent Team Selector — introduces a decision point at the moment users are most fatigued (end of a long flow). Industry data is consistent: each additional form step reduces completion by 5–7%, and each additional minute reduces conversion by ~3%. The agent selector presents a grid of 12 agent types with reasons, checkboxes, and a CTA. For a non-technical user who has just spent 5–10 minutes on business context steps, this is cognitively expensive.

**Why it happens:**
The temptation is to add the selector "while users are already in onboarding flow" because it feels like the right moment. The PROJECT.md rationale ("users are most engaged and context-primed right after completing onboarding") is partially correct but ignores that context-primed is not the same as decision-ready. Users have just provided data; they want to see the product working, not make more configuration decisions.

**Consequences:**
- Drop in trial-to-activation rate
- Users who do complete the selector but rush through it accept a default team that doesn't fit their business (see Pitfall 3)
- Abandonment at this exact step is invisible unless step-level analytics are instrumented

**Prevention:**
1. Make the Agent Team Selector a post-completion interstitial, not a blocking step. After the "Your AI team is ready" success screen, show the selector as an optional enhancement: "Customize your team (takes 30 seconds)" with a "Use suggested team" bypass that is visually dominant.
2. Pre-check the spawner's recommended team (5 agents max), make the default path a single "Accept team" click. Expanded customization is revealed on toggle.
3. Instrument per-step drop-off analytics before shipping this step. The existing `ConversationalOnboarding` flow has zero test coverage (CONCERNS.md); adding a new step into untested flow code is high-risk.
4. If the selector is kept as a blocking step, limit it to showing 4–5 pre-checked agents. The full catalog of 12 should only be accessible via the post-onboarding Agent Marketplace.

**Detection / Early Warning Signs:**
- Overall onboarding completion rate drops after shipping the selector step
- Time-on-step for the selector step exceeds 90 seconds on average
- Users frequently click "Skip" or "Accept all" without interacting with checkboxes (rubber-stamp behavior)
- Session recordings show scroll hesitation and rage clicks on the selector UI

**Phase that must address this:** Agent Spawner & Team Selection phase — design the bypass path first; A/B test against adding any new step to onboarding.

---

## Moderate Pitfalls

---

### Pitfall 6: Agent Workspace Bloat Degrades Query Performance Over Time

**What goes wrong:**
Each activated agent creates 6 rows in `agent_workspaces`. With 12 spawnable agent types per user, a fully activated account generates 72 workspace rows. MEMORY.md grows with every completed task (agents append learnings). Over months of active use, MEMORY.md rows can grow to tens of kilobytes each. The `orchestrator` edge function already fetches full business knowledge on every request (CONCERNS.md performance issue); if workspace content is fetched the same way, context window pressure and query latency both grow unboundedly.

**Prevention:**
1. Cap MEMORY.md content length server-side before write (e.g., max 8,000 characters). When the cap is reached, trigger a summarization pass that condenses older memories.
2. Do not fetch all 6 workspace files on every heartbeat tick. Load only HEARTBEAT.md + MEMORY.md (recent N entries) for heartbeat runs; load the full workspace only for chat interactions.
3. Add a created-at/updated-at index on `agent_workspaces (user_id, agent_type)` — lookups will be frequent.
4. Implement the `profiles.knowledge_base_cache` pattern already recommended in CONCERNS.md; apply the same pattern to agent workspace assembly.

**Phase that must address this:** Agent MD Workspace System phase.

---

### Pitfall 7: Role-Based Tool Boundaries Enforced Only in UI — Agents Access Each Other's Data at DB Level

**What goes wrong:**
The PROJECT.md specifies that tool access is role-scoped (e.g., HR agent writes to team calendar, not invoices). The existing codebase already has a critical security pattern: `userId` accepted from request body without JWT verification in three edge functions (CONCERNS.md — `planning-agent`, `generate-leads`, `crawl-business-website`). New agent runner functions built on the same pattern will inherit this vulnerability. An agent runner that accepts `{ userId, agentType }` from the request body without verifying the JWT can be called by any user to execute any agent on any other user's data.

**Why it happens:**
The codebase-wide pattern is to use the service role key server-side while accepting the userId from the body. This works only when the caller is always the legitimate user. For heartbeat runners (called by pg_cron, not by the user), there is no user JWT in play — the cron job provides no user identity. This forces server-side trust decisions without a clean security model.

**Consequences:**
- Cross-tenant data access: one user's heartbeat runner could, via a bug or injection, operate on another user's workspace
- An agent with broad tool access (e.g., COO agent, data_analyst) becomes a high-privilege target
- Regulatory risk: if the platform handles financial or HR data, a cross-tenant breach is a material incident

**Prevention:**
1. Heartbeat runners must derive `userId` exclusively from a server-side source (e.g., a signed queue record with an HMAC, or a Supabase service-role lookup of the queue row) — never from user-supplied input.
2. Each agent type must have an explicit allowlist of Supabase tables and operations it may access, enforced at the RLS policy level, not just in the edge function code.
3. Audit all new edge functions against the pattern in CONCERNS.md before merging: extract userId from verified JWT or from a server-controlled queue record.
4. Apply the fix already recommended in CONCERNS.md to existing functions (`planning-agent`, `generate-leads`, `crawl-business-website`) before building new agent runners on top — the vulnerability compounds.

**Detection / Early Warning Signs:**
- Any edge function that accepts both `userId` and `agentType` from the request body without JWT verification
- Supabase logs show edge function calls with no Authorization header (pg_cron-originated calls)
- RLS is absent on new tables (`agent_workspaces`, `user_agents`, `agent_heartbeat_log`, `available_agent_types`)

**Phase that must address this:** Security hardening should be a prerequisite before any agent runner has write access to user data; address in the first phase that introduces new edge functions.

---

### Pitfall 8: The heartbeat-dispatcher Cron Fires Duplicate Runs If Previous Run Is Still In-Flight

**What goes wrong:**
pg_cron does not check whether the previous invocation of a job has completed before firing the next one. If the dispatcher runs every minute but takes 90 seconds to process the queue, two dispatcher instances will be running simultaneously and will both claim the same queue rows, producing duplicate heartbeat runs per agent.

**Prevention:**
1. Use optimistic locking: update queue rows to `processing` status in the same query that selects them (`UPDATE ... WHERE status = 'pending' RETURNING *`). PostgreSQL's row-level locking ensures only one worker claims each row.
2. Add a `claimed_at` timestamp and a cleanup job that resets rows stuck in `processing` for more than 10 minutes (handle crashes).

**Phase that must address this:** Heartbeat System phase.

---

## Minor Pitfalls

---

### Pitfall 9: Default Workspace Files Generated With Stale Business Context

**What goes wrong:**
When an agent is spawned, its IDENTITY.md, SOPs.md, and HEARTBEAT.md are generated using the business context at spawn time. If the user updates their business profile, website, or uploaded docs later, the workspace files are not automatically regenerated. The agent continues operating on outdated context indefinitely.

**Prevention:**
1. Store the `business_context_version` at workspace generation time (e.g., a hash of the business_artifacts rows used).
2. Show a "Workspace may be outdated" badge in the Agent Settings panel if the user's business context has changed since the workspace was last generated.
3. Provide a "Regenerate from current business context" button per agent (destructive action, with confirmation).

**Phase that must address this:** Agent MD Workspace System phase.

---

### Pitfall 10: Agent Heartbeat Runs During Non-Business Hours Due to Timezone Mismatch

**What goes wrong:**
The HEARTBEAT.md design specifies "business hours only." Supabase pg_cron runs in UTC. If the dispatcher does not translate user timezone to UTC correctly, agents will fire at 3am local time for users in non-UTC timezones (e.g., East Africa Time, UTC+3).

**Prevention:**
1. Store `timezone` on the user profile (already likely captured in onboarding for Kenyan market).
2. The dispatcher query that determines "due" agents must convert `next_run_at` using the user's stored timezone offset, not UTC.
3. Test with a UTC+3 user explicitly during development.

**Phase that must address this:** Heartbeat System phase.

---

### Pitfall 11: planning-agent Duplicate Initialization Affects Agent Workspace Init

**What goes wrong:**
The existing `planning-agent` has a documented bug: calling `initialize` twice creates duplicate scheduled tasks (CONCERNS.md). The agent workspace generation step will likely reuse a similar pattern. If the onboarding completion event fires twice (e.g., user refreshes mid-onboarding completion, or a React StrictMode double-effect), agents will be spawned twice, producing duplicate workspace rows that conflict.

**Prevention:**
1. Use upsert with a unique constraint on `(user_id, agent_type, file_name)` for `agent_workspaces`.
2. Apply the same fix to `user_agents`: unique constraint on `(user_id, agent_type)`.
3. Make the Agent Spawner idempotent: check for existing agent records before inserting.

**Phase that must address this:** Agent Spawner & Team Selection phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Heartbeat System | Runaway LLM costs from suppression logic failure | Structured output for HEARTBEAT_OK, hard call budgets, queue-based architecture |
| Heartbeat System | Dispatcher timeout on edge function wall-clock limit | Queue-fan-out pattern, not sequential loop |
| Heartbeat System | Duplicate runs from concurrent dispatcher invocations | Optimistic locking on queue rows |
| Heartbeat System | Timezone mismatch for business-hours enforcement | Store and use user timezone in dispatcher query |
| Agent Spawner & Team Selection | Wrong agents recommended for niche businesses | Confidence threshold, smaller default team, user can deselect |
| Agent Spawner & Team Selection | New onboarding step kills conversion rate | Post-completion interstitial with dominant bypass CTA |
| Agent Spawner & Team Selection | Duplicate agent spawning on double-init | Idempotent spawner, unique constraints |
| Agent MD Workspace System | User edits break agent behavior silently | Validation on save, reset-to-default button, injection sanitization |
| Agent MD Workspace System | Workspace content bloat degrades performance | MEMORY.md size cap, targeted workspace loading, summarization |
| Agent MD Workspace System | Stale workspace after business context update | Context version tracking, "Workspace outdated" badge |
| Role-Based Tooling | Agent accesses wrong user's data via userId-from-body pattern | Server-side userId derivation, per-table RLS per agent type |
| Role-Based Tooling | Tool permission sprawl as catalog grows | Explicit allowlist per agent type in `available_agent_types` registry |

---

## Sources

- Supabase Edge Functions Limits (official): https://supabase.com/docs/guides/functions/limits
- Supabase Processing Large Jobs with Edge Functions, Cron, and Queues (official): https://supabase.com/blog/processing-large-jobs-with-edge-functions
- Supabase pg_cron Debugging Guide (official): https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz
- Supabase Cron UI Timeout Issue (GitHub): https://github.com/supabase/supabase/issues/37629
- OWASP LLM Top 10 2025 — Prompt Injection #1: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Arize: Why AI Agents Break in Production: https://arize.com/blog/common-ai-agent-failures/
- AWS: Why AI Agents Give Inconsistent Results and How Agent SOPs Fix It: https://aws.amazon.com/blogs/publicsector/why-your-ai-agents-give-inconsistent-results-and-how-agent-sops-fix-it/
- Promptfoo: Model Upgrades Break Agent Safety: https://www.promptfoo.dev/blog/model-upgrades-break-agent-safety/
- SaaS Onboarding Best Practices 2025 (Flowjam): https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist
- Multi-Tenant Security Pitfalls (SecurityBoulevard 2025): https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/
- Glean: Hallucinations in Enterprise Agent Onboarding: https://www.glean.com/perspectives/when-llms-hallucinate-in-enterprise-contexts-and-how-contextual-grounding
- Openclaw Runaway Heartbeat Issue: https://github.com/openclaw/openclaw/issues/3181
- ServiceNow Second-Order Prompt Injection (TheHackerNews): https://thehackernews.com/2025/11/servicenow-ai-agents-can-be-tricked-into-acting-against-each-other-via-second-order-prompts.html
