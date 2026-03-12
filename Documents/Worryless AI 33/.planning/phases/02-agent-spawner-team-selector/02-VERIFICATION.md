---
phase: 02-agent-spawner-team-selector
verified: 2026-03-12T23:30:00Z
status: human_needed
score: 10/11 must-haves verified
re_verification: false
human_verification:
  - test: "Complete onboarding through validator_sales step and confirm Step 12 (Agent Team Selector) appears"
    expected: "After clicking Continue on validator_sales, the AgentTeamSelector renders with a loading skeleton, then shows three tiers of agents. The old 'Complete Setup' / 'processing' screen never appears."
    why_human: "nextStep() array routing is correct in code but rendering the correct step in context of full onboarding session requires browser execution"
  - test: "Accept suggested team and confirm dashboard sidebar shows activated agents"
    expected: "After accepting the team, the briefing animation runs for ~2 seconds, then the dashboard loads with all default 5 agents plus any selected additional agents visible in the sidebar AI Agents section"
    why_human: "fetchUserAgents() refetch on onComplete() is wired correctly in code but live DB interaction needed to confirm sidebar populates"
  - test: "Verify orchestrator TOOL BOUNDARIES in Supabase Edge Function logs for an HR agent task"
    expected: "In Supabase Edge Functions logs for orchestrator, system prompt for HR agent includes 'TOOL BOUNDARIES: You are the HR Manager. You are ONLY permitted to use tools and capabilities in this category list: hr_management, recruitment, onboarding_workflows, compliance'"
    why_human: "buildAgentPrompt is async and fetches from DB at runtime — can only confirm correct injection via live Supabase logs"
---

# Phase 2: Agent Spawner + Team Selector Verification Report

**Phase Goal:** Implement the agent spawner and team selector — a Supabase edge function that recommends a personalized agent team from the catalog, an onboarding step that lets users accept/modify the team, and a dynamic dashboard sidebar driven by the user's actual agent roster.
**Verified:** 2026-03-12T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | spawn-agent-team returns catalog-validated recommendations only | VERIFIED | filterRecommendations() in index.ts guards against all non-catalog IDs; 6 unit tests in spawn.test.ts confirm; validAdditionalIds Set built from live DB query |
| 2 | Edge function rejects missing/invalid JWT with 401 | VERIFIED | Two-client pattern confirmed in index.ts lines 68-89; missing Authorization header returns 401; invalid token returns 401 via auth.getUser() |
| 3 | No userId accepted from request body | VERIFIED | index.ts only reads `businessName, industry, description, location` from body; user identity exclusively from JWT |
| 4 | Step 12 (AgentTeamSelector) is inserted after validator_sales | VERIFIED | ConversationalOnboarding.tsx line 656: steps array includes `agent_team_selector` after `validator_sales`; validator_sales Continue button calls `nextStep` (line 1262) not `handleComplete` |
| 5 | Default 5 agents rendered as pre-checked and locked | VERIFIED | AgentTeamSelector.tsx line 211-238: defaultAgents rendered with CheckCircle2 icon + "Included" badge; no Checkbox (cannot be toggled) |
| 6 | Recommended agents pre-checked and enabled; remaining agents unchecked and enabled | VERIFIED | AgentTeamSelector.tsx lines 251-295 (recommended with Checkbox checked); lines 309-336 (remaining with Checkbox unchecked) |
| 7 | handleTeamAccept inserts user_agents rows before setting onboarding_completed | VERIFIED | ConversationalOnboarding.tsx lines 787-818: upserts DEFAULT_IDS loop, then additionalIds loop, then profiles.update with onboarding_completed: true; order is sequential and awaited |
| 8 | Briefing animation (2-3 seconds) with progress bar runs before dashboard loads | VERIFIED | Lines 776-822: setStep("briefing"), Progress value, setBriefingProgress 10→40→70→100, then setTimeout(2000), then onComplete() |
| 9 | Dynamic sidebar driven by user_agents DB query, not static list | VERIFIED | DashboardSidebar.tsx: static agentItems const removed entirely; dynamicAgentItems built from userAgents prop (line 86); Dashboard.tsx fetchUserAgents() queries user_agents JOIN available_agent_types |
| 10 | GenericAgentPanel renders for any agent:${id} view | VERIFIED | Dashboard.tsx lines 160-172: activeView.startsWith("agent:") → GenericAgentPanel; GenericAgentPanel.tsx exists and renders displayName + description |
| 11 | Orchestrator injects TOOL BOUNDARIES into agent system prompts | VERIFIED (code) | orchestrator/index.ts lines 204-248: buildAgentPrompt async, fetches skill_config from available_agent_types, appends TOOL BOUNDARIES section; all 3 callers at lines 667, 703, 795 use await |

**Score:** 10/11 truths fully verified (11th requires human log inspection)

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `worrylesssuperagent/supabase/migrations/20260312000005_tools_skill_config_verify.sql` | SQL verification + conditional patch for 13 agents | VERIFIED | 231 lines; 2 diagnostic SELECTs; 13 skill_config UPDATE blocks; 13 default_tools_md UPDATE blocks; Phase 2 checklist comment |
| `worrylesssuperagent/supabase/functions/spawn-agent-team/index.ts` | Deno edge function: JWT verify, catalog fetch, LLM call, ID filtering | VERIFIED | 228 lines; exports extractJson + filterRecommendations; two-client pattern; graceful LLM failure |
| `worrylesssuperagent/supabase/functions/spawn-agent-team/spawn.test.ts` | 6 Deno unit tests for extractJson and filterRecommendations | VERIFIED | 83 lines; 6 Deno.test blocks; imports from index.ts |
| `worrylesssuperagent/src/components/onboarding/AgentTeamSelector.tsx` | Step 12 React component: three-tier agent list, loading skeleton, Accept CTA | VERIFIED | 358 lines; calls spawn-agent-team; three sections rendered; onAccept(Set<string>) callback |
| `worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx` | Extended onboarding with agent_team_selector and briefing steps | VERIFIED | agent_team_selector + briefing in Step type union (line 50-51); handleTeamAccept wired; fire-and-forget workspace personalization |
| `worrylesssuperagent/src/pages/Dashboard.tsx` | fetchUserAgents() + userAgents state + refetch on onComplete + extended ActiveView | VERIFIED | UserAgent interface; fetchUserAgents queries user_agents JOIN available_agent_types; onComplete callback calls fetchUserAgents; agent: routing in renderContent |
| `worrylesssuperagent/src/components/dashboard/DashboardSidebar.tsx` | Dynamic agent list from userAgents prop replacing static agentItems | VERIFIED | Static agentItems const absent; dynamicAgentItems from userAgents prop; LEGACY_VIEW_MAP; AGENT_ICONS for all 13 types |
| `worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx` | Generic panel for any agent type without dedicated panel | VERIFIED | 31 lines; renders displayName, description; "Chat coming soon" placeholder |
| `worrylesssuperagent/supabase/functions/orchestrator/index.ts` | buildAgentPrompt now async, fetches skill_config, injects TOOL BOUNDARIES | VERIFIED | Lines 204-248: async buildAgentPrompt; DB lookup for skill_config; TOOL BOUNDARIES appended; non-blocking catch |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| spawn-agent-team/index.ts | available_agent_types table | SELECT id, display_name, description, skill_config | WIRED | index.ts line 98-100: `from("available_agent_types").select("id, display_name, description, skill_config")` |
| spawn-agent-team/index.ts | LOVABLE_AI_GATEWAY | fetch POST with system prompt constraining to validAdditionalIds | WIRED | index.ts lines 156-170: fetch to LOVABLE_AI_GATEWAY with system prompt listing validAdditionalIdsList |
| ConversationalOnboarding.tsx validator_sales step | nextStep() — NOT handleComplete() | onClick handler calls nextStep for validator_sales | WIRED | Line 1262: `onClick={nextStep}` — handleComplete defined (line 665) but has exactly one reference (its own definition); never called from validator_sales |
| AgentTeamSelector.tsx useEffect | supabase.functions.invoke('spawn-agent-team') | useEffect on mount | WIRED | AgentTeamSelector.tsx lines 60-65: invoke("spawn-agent-team", { body: { businessName, industry, description, location } }) |
| handleTeamAccept in ConversationalOnboarding.tsx | supabase.from('user_agents').upsert | INSERT default 5 + selected additional agents | WIRED | Lines 787-806: two loops upsert DEFAULT_IDS then additionalIds with ignoreDuplicates: true |
| handleTeamAccept in ConversationalOnboarding.tsx | agent_workspaces token personalization | fire-and-forget after onComplete() | WIRED | Lines 826-862: non-awaited .then() chain selects identity/soul workspaces, replaces {business_name}/{industry}/{city}/{country}/{description} tokens |
| Dashboard.tsx fetchUserAgents() | supabase user_agents JOIN available_agent_types | select with eq is_active = true | WIRED | Dashboard.tsx lines 49-56: join query confirmed |
| DashboardSidebar.tsx | userAgents prop from Dashboard.tsx | props.userAgents mapped to dynamicAgentItems | WIRED | DashboardSidebar line 86: `(userAgents || []).map(...)` |
| Dashboard.tsx renderContent | GenericAgentPanel | activeView.startsWith('agent:') | WIRED | Lines 160-172: pattern match and render confirmed |
| orchestrator/index.ts buildAgentPrompt() | available_agent_types.skill_config | service-role supabase query SELECT skill_config WHERE id = agentKey | WIRED | Lines 226-230: adminClient.from("available_agent_types").select("skill_config, display_name").eq("id", agentKey).single() |
| orchestrator/index.ts callers | buildAgentPrompt() | await at all 3 call sites | WIRED | Lines 667, 703, 795: all use `await buildAgentPrompt(...)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPAWN-01 | 02-02 | spawn-agent-team edge function recommends agents based on business context | SATISFIED | index.ts exists; reads businessName/industry/description/location; LLM call with business context; catalog-constrained output |
| SPAWN-02 | 02-02 | Structured JSON output (temperature 0.3) constrained to catalog IDs | SATISFIED | temperature: 0.3 confirmed (index.ts line 167); catalog IDs enforced via filterRecommendations; note: response_format:json_object not used (Gemini Flash does not support it via Lovable Gateway — documented in RESEARCH.md; prompt-only JSON is correct approach) |
| SPAWN-03 | 02-03 | Onboarding gains Step 12 between validator_sales and onboarding_completed | SATISFIED | ConversationalOnboarding.tsx: agent_team_selector in Step type union (line 50); in steps array after validator_sales (line 656); onboarding_completed only set in handleTeamAccept (line 818) |
| SPAWN-04 | 02-03 / 02-04 | Three-tier display: locked defaults, recommended with reasoning, unchecked rest | SATISFIED | AgentTeamSelector.tsx three-section layout confirmed; defaultAgents locked; recommendedAgents pre-checked with reasoning/first_week_value; remainingAgents unchecked |
| SPAWN-05 | 02-03 | Accept in one click or customize before accepting | SATISFIED | Single "Accept Suggested Team" CTA (AgentTeamSelector.tsx line 342); toggleAgent() allows checkbox state changes before accepting |
| SPAWN-06 | 02-03 | 2-3 second briefing animation before dashboard loads | SATISFIED | handleTeamAccept: setStep("briefing") + setBriefingProgress 10→100 + setTimeout(2000) before onComplete() |
| SPAWN-07 | 02-03 | Agents inserted as user_agents rows; workspaces auto-populated with business context | SATISFIED (with deviation) | user_agents rows upserted in handleTeamAccept; workspace auto-population via Phase 1 trigger; business-context personalization is deterministic token replacement (not LLM call as REQUIREMENTS.md wording says) — PLAN 03 intentionally changed approach, documented in SUMMARY; functional outcome is identical or better |
| TOOLS-01 | 02-01 | Each agent type has skill_config JSON field | SATISFIED | Migration 00005 verifies and patches skill_config for all 13 agents; conditional UPDATE guards ensure role-appropriate values |
| TOOLS-02 | 02-01 | Catalog ships with role-appropriate tool configs | SATISFIED | All 13 agents have distinct role-appropriate skill_config arrays; migration patches confirm mappings (hr_manager: hr_management/recruitment; accountant: invoice_parsing/etc.) |
| TOOLS-03 | 02-01 | Each agent's TOOLS.md workspace file documents available tools | SATISFIED | default_tools_md seeded for all 13 agents in migration 00005; Phase 1 on_agent_activated trigger populates tools workspace row at agent activation |
| TOOLS-04 | 02-05 | Orchestrator respects agent tool boundaries | SATISFIED (code verified, live log requires human) | buildAgentPrompt async; fetches skill_config from available_agent_types; appends TOOL BOUNDARIES section; non-blocking failure; all 3 callers await-updated |

**All 11 Phase 2 requirements accounted for. 0 orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `GenericAgentPanel.tsx` | 25 | "Chat coming soon" placeholder | INFO | Expected: plan explicitly approved this because ChatInterface accepts no agentType prop; SUMMARY documents this decision; new agents are usable (panel renders), full chat integration is deferred |
| `ConversationalOnboarding.tsx` | 665 | `handleComplete` function defined but never called | INFO | Dead code — old onboarding completion path; does not affect new flow as validator_sales calls nextStep; poses no functional risk but is unused code |
| `ConversationalOnboarding.tsx` | 52-53 | `"processing"` and `"complete"` remain in Step type union | INFO | Dead union members; processing case renders at line 1306 but is unreachable via nextStep(); no functional impact |

No BLOCKER or WARNING anti-patterns found.

---

### Human Verification Required

#### 1. Step 12 Renders After validator_sales

**Test:** Complete onboarding through the validator_sales step, click Continue.
**Expected:** The AgentTeamSelector component renders with 6 skeleton cards while loading, then shows: (a) Your Core Team section with 5 locked agents, (b) Recommended for [Business Name] section with 1-5 pre-checked agents and reasoning text, (c) Add more to your team section with unchecked catalog agents.
**Why human:** Code routing is correct (nextStep array at line 655-657) but rendering the correct step in a full onboarding session requires browser execution.

#### 2. Team Acceptance → Dashboard With Correct Sidebar

**Test:** Accept the suggested team. Observe the briefing animation, then confirm the dashboard sidebar.
**Expected:** Briefing animation shows "Briefing your team on [Business Name]..." with a progress bar advancing over ~2 seconds. Dashboard loads with the AI Agents sidebar section populated with at least the 5 default agents (Chief of Staff, Personal Assistant, Accountant, Marketer, Sales Rep) plus any selected additional agents.
**Why human:** fetchUserAgents() refetch on onComplete() is correctly wired (Dashboard.tsx line 135) but live DB interaction and sidebar re-render require browser execution.

#### 3. Orchestrator TOOL BOUNDARIES in Live Logs

**Test:** Send a task via the chat interface (e.g., "Help me onboard a new employee"). Check Supabase Edge Functions → orchestrator → Logs.
**Expected:** System prompt for the HR agent includes `TOOL BOUNDARIES: You are the HR Manager. You are ONLY permitted to use tools and capabilities in this category list: hr_management, recruitment, onboarding_workflows, compliance.`
**Why human:** buildAgentPrompt fetches skill_config at runtime from the live database. The code path is correct but the actual Supabase query execution can only be confirmed in live logs.

---

## Summary

Phase 2 goal achievement is strong. All 9 artifacts exist and are substantively implemented. All 11 requirements are addressed. All critical wiring is confirmed:

- The spawn-agent-team edge function is fully wired: JWT auth, catalog fetch, LLM call with prompt-only JSON, catalog ID guard (filterRecommendations), graceful degradation on LLM failure.
- The onboarding flow correctly places Step 12 after validator_sales — validator_sales now calls nextStep(), and onboarding_completed is set only after user_agents are inserted.
- The AgentTeamSelector component renders three-tier agent selection with the correct locked/pre-checked/unchecked behavior.
- The dynamic sidebar is fully data-driven; static agentItems is gone; LEGACY_VIEW_MAP prevents double-rendering of the 5 default agents.
- The orchestrator buildAgentPrompt is async and injects TOOL BOUNDARIES into every delegated agent system prompt.

Three items require human verification because they depend on live runtime behavior (browser rendering, live Supabase logs).

One noted deviation: SPAWN-07 in REQUIREMENTS.md mentions "second LLM call" for workspace personalization, but the implementation uses deterministic token replacement (no LLM). This was a planned and documented change (RESEARCH.md, PLAN-03, SUMMARY-03) — Gemini Flash does not support response_format, and the Phase 1 trigger already seeds workspace rows with {business_name} placeholder tokens, making deterministic replacement sufficient. The functional outcome (business-context-aware workspace content) is identical.

---

_Verified: 2026-03-12T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
