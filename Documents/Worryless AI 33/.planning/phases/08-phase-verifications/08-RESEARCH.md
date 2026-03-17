# Phase 8: Phase Verifications — Research

**Researched:** 2026-03-17
**Domain:** Code-review verification methodology; cross-referencing implementation artifacts against success criteria and requirements
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01..07 | Database Foundation schema, seed, triggers, RLS, timezone | Migration files confirmed on disk; trigger code verified in source |
| SEC-01 | JWT identity extraction in edge functions (no userId from body) | Three functions confirmed fixed in Plan 01-05 |
| SEC-03 | Workspace sanitization strips injection patterns | sanitize.ts confirmed with 12 patterns |
| WS-01..07 | MD Workspace Editor: CodeMirror, auto-save, read-only MEMORY, reset, sanitize, inject order | Files confirmed; WS-07 wired in heartbeat-runner + orchestrator + chat-with-agent (Phase 7) |
| MKT-01..04 | Agent Marketplace: listing, add, deactivate, sidebar/team entry point | Components confirmed in src/components/marketplace/ |
| HB-01..09 | Heartbeat system: dispatcher, runner, severity routing, notifications, budget, active hours, config UI, digest | Phase 6 fixed critical field mismatch; all pipeline files confirmed |
| NOTIF-01..06 | Notifications: bell, realtime, push, email, mark read, agent link navigation | Components confirmed; Phase 7 added push opt-in surface |
| ORG-01..05 | Org view: team chart, agent cards, heartbeat status, navigation, Add Agent | Phase 6 fixed amber dot; TeamView confirmed |
</phase_requirements>

---

## Summary

Phase 8 produces formal VERIFICATION.md documents for four phases that were completed but never formally verified: Phase 1 (Database Foundation), Phase 3 (MD Workspace Editor + Agent Marketplace), Phase 4 (Heartbeat System), and Phase 5 (Org View + Notifications). Each VERIFICATION.md is a code-review artifact that cross-references the phase's success criteria from ROADMAP.md against actual file contents, checking line-by-line that the implementation matches what was claimed.

This is not new code delivery — it is a systematic audit pass. The verifier reads source files, migration files, edge functions, hooks, and test files, then makes a binary pass/fail determination for each success criterion and requirement. The output is a structured document the milestone sign-off process consumes.

Critically, Phase 4 and Phase 5 verifications must account for bugs that were fixed in Phase 6 and functionality that was completed in Phase 7 (WS-07, NOTIF-03). The VERIFICATION.md for those phases therefore verifies the state of the code as it stands at Phase 8 time, not as it stood when the phase originally completed. The verification covers all gap-closure work as an integral part of assessing whether each requirement is finally satisfied.

**Primary recommendation:** Produce one VERIFICATION.md per unverified phase (08-01 through 08-04), reading the actual source files rather than only SUMMARY.md frontmatter. Every success criterion from ROADMAP.md and every requirement ID in scope must have an explicit PASS/FAIL with a file path or SQL snippet as evidence.

---

## Standard Stack

### Core (verification methodology)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| SUMMARY.md frontmatter | — | First-pass evidence: `requirements-completed` arrays across all plans | Already exists for all phases |
| Source file review | — | Ground-truth confirmation of implementation claims | Only authoritative source |
| vitest | 4.1.0 | Automated test confirmation | Already installed; 51 tests currently green |
| ROADMAP.md success criteria | — | Defines PASS thresholds for each phase | Authoritative acceptance criteria |

### Supporting

| Asset | Purpose | When to Use |
|-------|---------|-------------|
| MILESTONE-AUDIT.md | Known gaps, integration bugs, pre-diagnosed issues | Consult first — avoids re-discovering known bugs |
| VALIDATION.md per phase | Lists test file locations, manual test instructions | Reference for nyquist compliance checks |
| Migration SQL files | Prove schema structure (tables, columns, constraints, triggers, RLS) | Phase 1 and Phase 4 DB claims |
| Edge function source | Prove runtime behavior claims (SEC-01, SEC-02, HB-01..09) | Edge-function-dependent requirements |

---

## Architecture Patterns

### Recommended Structure for Each VERIFICATION.md

```
.planning/phases/NN-phase-name/
  NN-NN-PLAN.md         (already exists)
  NN-NN-SUMMARY.md      (already exists)
  NN-RESEARCH.md        (already exists)
  NN-VALIDATION.md      (already exists — nyquist_compliant: false)
  NN-VERIFICATION.md    (produced by this phase)
```

### Pattern 1: Verification Document Structure

Each VERIFICATION.md must contain:

1. **Frontmatter** — phase, requirements verified, overall status (passed/failed/partial)
2. **Success Criteria Check** — one section per success criterion from ROADMAP.md, with explicit PASS/FAIL and file evidence
3. **Requirements Map** — table mapping each requirement ID to status and evidence
4. **Integration Points** — cross-phase wiring that was validated
5. **Remaining Manual Tests** — any criteria that require a live Supabase instance to verify
6. **Sign-Off** — verifier and timestamp

### Pattern 2: Evidence Standard

For each claim, evidence must be one of:
- **File path + line reference** — "File X line Y confirms Z"
- **SQL construct** — "Migration 00001 line N: `UNIQUE(user_id, agent_type_id)`"
- **Test name** — "heartbeatParser.test.ts: `defaults to 'ok' on malformed JSON` — PASS"
- **Manual-only** — explicit acknowledgment that live DB is required; document the test instruction

Never accept SUMMARY.md frontmatter as sole evidence. SUMMARY.md lists what was intended; source files confirm what was shipped.

### Pattern 3: Gap-Closure Accounting

Phase 4 and Phase 5 had critical bugs fixed in Phase 6. The verification must:
1. Note the original bug as found in the audit
2. Confirm the fix is present in source
3. Mark the requirement PASS (with fix) rather than FAIL

Example accounting entry:
```
HB-01: PASS (fixed Phase 6)
  - Bug: dispatcher enqueued camelCase keys; runner expected snake_case
  - Fix: heartbeat-dispatcher/index.ts line 41-45 now uses snake_case
  - Evidence: user_agent_id, user_id, agent_type_id confirmed at commit 02a8941
```

### Anti-Patterns to Avoid

- **SUMMARY trust without source check:** Never mark a requirement PASS based only on SUMMARY.md `requirements-completed` — cross-check the actual file
- **Conflating Phase 4 original state with current state:** Phase 4 was shipped with bugs; verify current source, not what was shipped at phase completion time
- **Treating manual-only verifications as FAIL:** Some behaviors (trigger fires on INSERT, RLS cross-user isolation) require a live DB. Mark as "MANUAL REQUIRED" not "FAIL"
- **Missing gap-closure requirements:** WS-07 and NOTIF-03 are partially in Phase 3 and Phase 5 respectively but were completed in Phase 7. The Phase 3 and Phase 5 VERIFICATION.md must note the Phase 7 closure and confirm completion

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discovering what files exist | Don't reconstruct from memory | Read the actual file at the path SUMMARY.md cites | Source files are on disk; every SUMMARY.md cites exact paths |
| Re-auditing known bugs | Don't re-diagnose | Consult MILESTONE-AUDIT.md | All integration bugs are already documented with file+line |
| Inventing success criteria | Don't write your own acceptance bar | Use the success criteria verbatim from ROADMAP.md Phase X | Each phase has 5 numbered success criteria |
| Reporting test coverage | Don't enumerate tests manually | Run `npx vitest run` and report the actual count and pass/fail | Suite takes 1.5s and gives authoritative count |

---

## Common Pitfalls

### Pitfall 1: Verifying Original Phase State Instead of Current State

**What goes wrong:** Verifier reads Phase 4 and marks HB-01 FAIL because the dispatcher had camelCase keys. But Phase 6 already fixed this.
**Why it happens:** Confusion between "what was true when Phase 4 completed" and "is the requirement satisfied today."
**How to avoid:** Always read the current source file. The VERIFICATION.md records the current state of the codebase, not the historical state at phase-close time.
**Warning signs:** If you're about to write "FAIL" for any HB-01..09 or ORG-04 requirement, pause — Phase 6 fixed those. Confirm by reading heartbeat-dispatcher/index.ts and heartbeatStatus.ts.

### Pitfall 2: Missing the WS-07 and NOTIF-03 Phase 7 Completions

**What goes wrong:** Phase 3 VERIFICATION.md marks WS-07 FAIL (buildWorkspacePrompt not called in production) because the verifier only looks at Phase 3 artifacts.
**Why it happens:** The audit gap was "partial" for WS-07 at Phase 3 time, but Phase 7 Plans 01 and 02 wired it into heartbeat-runner, orchestrator, and chat-with-agent.
**How to avoid:** For Phase 3 WS-07 and Phase 5 NOTIF-03, verify the current wiring state (Phase 7 artifacts) and mark PASS with a note that completion occurred in Phase 7.
**Warning signs:** Any attempt to verify WS-07 without checking heartbeat-runner/index.ts and orchestrator/index.ts.

### Pitfall 3: Treating "No VERIFICATION.md" as Implying "Nothing Was Built"

**What goes wrong:** Assuming unverified means incomplete. All four phases have complete SUMMARY.md files, committed source code, and passing tests.
**Why it happens:** The milestone audit found missing VERIFICATION.md files, not missing implementations.
**How to avoid:** The VERIFICATION.md is the record that a human review confirmed the code — it does not mean nothing was built. Start each verification from the source files.

### Pitfall 4: Manual-Only DB Tests Blocking Progress

**What goes wrong:** Verifier marks Phase 1 "BLOCKED" because trigger behavior requires a live Supabase instance.
**Why it happens:** DB trigger and RLS tests genuinely cannot be run in vitest.
**How to avoid:** Mark these as "MANUAL REQUIRED" with specific test instructions, move on, and note that sign-off for those specific criteria requires a human with DB access. The VERIFICATION.md still provides meaningful coverage for all code-reviewable claims.

### Pitfall 5: Overlooking agent_heartbeat_log Columns

**What goes wrong:** Verifier checks migration 00001 for the severity column and doesn't find it, incorrectly concludes the schema is wrong.
**Why it happens:** The severity column was added in migration 00009 (morning_digest_cron.sql), not in 00001.
**How to avoid:** When verifying schema claims, check all migration files in sequence. The `severity TEXT CHECK (severity IN ('urgent','headsup','digest'))` column is in 20260313000009.

---

## Code Examples

### How to Confirm a SQL Construct

```sql
-- From 20260312000001_create_agent_tables.sql
-- Verify DB-06: unique constraint on user_agents
UNIQUE(user_id, agent_type_id)  -- line 56 of create_agent_tables.sql

-- Verify DB-04: trigger exists
CREATE TRIGGER on_agent_activated
  AFTER INSERT ON public.user_agents
  FOR EACH ROW EXECUTE FUNCTION public.create_agent_workspace();
-- Source: 20260312000002_workspace_trigger.sql lines 41-43
```

### How to Confirm JWT Security (SEC-01)

Look for this pattern in each hardened edge function:
```typescript
// Source: supabase/functions/planning-agent/index.ts
const authHeader = req.headers.get("Authorization");
// ... create anonClient ...
const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
if (authError || !user) {
  return new Response("Unauthorized", { status: 401 });
}
const userId = user.id; // extracted from JWT, NOT from request body
```

Three functions to verify: planning-agent, generate-leads, crawl-business-website.

### How to Confirm WS-07 Injection Order

In heartbeat-runner (Phase 7 wired):
```typescript
// Source: supabase/functions/heartbeat-runner/index.ts
// fetchAndBuildWorkspacePrompt calls buildWorkspacePrompt(files, true)
// buildWorkspacePrompt in _shared/buildWorkspacePrompt.ts outputs:
// IDENTITY -> SOUL -> SOPs -> TOOLS -> MEMORY -> HEARTBEAT (when isHeartbeat=true)
```
Verify injection order: IDENTITY, SOUL, SOPs, TOOLS, MEMORY, HEARTBEAT — this matches WS-07 spec.

### How to Confirm ORG-04 Fix (Phase 6)

```typescript
// Source: src/lib/heartbeatStatus.ts (AFTER Phase 6 fix)
// Should read:
if (
  lastOutcome === "urgent" ||
  lastOutcome === "headsup" ||
  lastOutcome === "digest"
)
  return "attention";
// NOT: lastOutcome === "surfaced"
```

### How to Confirm Dispatcher Fix (Phase 6)

```typescript
// Source: supabase/functions/heartbeat-dispatcher/index.ts
// Should contain snake_case keys:
message: {
  user_agent_id: agent.id,
  user_id: agent.user_id,
  agent_type_id: agent.agent_type_id,
}
// NOT: { userAgentId, userId, agentTypeId }
```

---

## Phase-by-Phase Verification Scope

### Phase 1: Database Foundation (Plan 08-01)

**Success criteria to verify (5 total from ROADMAP.md):**
1. `available_agent_types` exists with 13 rows (Chief of Staff depth=0 + 12 specialists)
2. Inserting into `user_agents` auto-creates exactly 6 `agent_workspaces` rows — code-review trigger; live DB test marked manual
3. UNIQUE constraint on `user_agents(user_id, agent_type_id)` exists — confirm in migration 00001 line 56
4. `profiles.timezone` column exists — confirmed by 20251216134813 migration; comment in Plan 01-04
5. All 4 tables have RLS policies — confirm in migration 00001

**Requirements in scope:** DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, SEC-01, SEC-03

**Key files to read:**
- `supabase/migrations/20260312000001_create_agent_tables.sql`
- `supabase/migrations/20260312000002_workspace_trigger.sql`
- `supabase/migrations/20260312000003_seed_agent_types.sql`
- `supabase/migrations/20260312000004_backfill_existing_users.sql`
- `supabase/functions/_shared/sanitize.ts`
- `supabase/functions/planning-agent/index.ts`
- `supabase/functions/generate-leads/index.ts`
- `supabase/functions/crawl-business-website/index.ts`

**Confidence on code-reviewable claims:** HIGH (migration files are on disk, sanitize.ts on disk)
**Manual-only items:** Trigger fires at INSERT runtime, RLS cross-user isolation, live edge function 401 response

---

### Phase 3: MD Workspace Editor + Agent Marketplace (Plan 08-02)

**Success criteria to verify (5 total from ROADMAP.md):**
1. Agent settings panel has Workspace tab with 6 sub-tabs; MEMORY is read-only — verify WorkspaceTabs + MemoryTab components
2. Auto-save within 2 seconds — verify useWorkspaceAutoSave hook has 2000ms debounce
3. Reset to defaults triggers catalog content restore — verify useAgentWorkspace hook reset function
4. Marketplace lists 12 catalog agents with Active badge / Add button — verify AgentMarketplace + AgentMarketplaceCard
5. Deactivation removes agent from sidebar/team, preserves workspace — verify UPDATE is_active=false pattern (not DELETE)

**Requirements in scope:** WS-01, WS-02, WS-03, WS-04, WS-05, WS-06, MKT-01, MKT-02, MKT-03, MKT-04
**Note on WS-07:** WS-07 was partially satisfied in Phase 3 (buildWorkspacePrompt exists and is tested). Completion in production wiring occurred in Phase 7. The verification records WS-07 as PASS with gap-closure note.

**Key files to read:**
- `src/hooks/useAgentWorkspace.ts`
- `src/hooks/useAgentMarketplace.ts`
- `src/components/marketplace/AgentMarketplace.tsx`
- `src/components/marketplace/AgentMarketplaceCard.tsx`
- `src/lib/buildWorkspacePrompt.ts`
- `src/lib/sanitize.ts`
- `src/__tests__/buildWorkspacePrompt.test.ts`
- `src/__tests__/sanitize.test.ts`
- `src/__tests__/useWorkspaceAutoSave.test.ts`
- Workspace tab components under `src/components/agents/`

---

### Phase 4: Heartbeat System (Plan 08-03)

**Success criteria to verify (5 total from ROADMAP.md):**
1. Single pg_cron dispatcher job queries `get_due_heartbeat_agents` for active-hours + budget filtering — verify migration 00007/00008 + dispatcher source
2. LLM `severity: "ok"` → zero DB writes — verify heartbeat-runner ok branch is a no-op insert path
3. LLM `severity: "urgent"` → notification + push + email in same invocation — verify runner urgent branch
4. Agent settings panel shows heartbeat config section — verify HeartbeatConfigSection + useHeartbeatConfig
5. Dispatcher enforces daily call budget (default 6) — verify `get_due_heartbeat_agents` SQL or dispatcher query

**Requirements in scope:** HB-01..09, SEC-02
**Critical note:** HB-01..09 were blocked by dispatcher field name bug (camelCase → snake_case). Phase 6 Plan 01 fixed this. Verify the fix is present in current dispatcher source (`user_agent_id`, `user_id`, `agent_type_id` in message payload).

**Key files to read:**
- `supabase/functions/heartbeat-dispatcher/index.ts`
- `supabase/functions/heartbeat-runner/index.ts`
- `supabase/functions/send-morning-digest/index.ts`
- `supabase/migrations/20260313000006_heartbeat_queue.sql`
- `supabase/migrations/20260313000007_heartbeat_cron_jobs.sql`
- `supabase/migrations/20260313000008_heartbeat_dispatcher_fn.sql`
- `supabase/migrations/20260313000009_morning_digest_cron.sql`
- `src/hooks/useHeartbeatConfig.ts`
- `src/components/agents/HeartbeatConfigSection.tsx` (or equivalent)
- `src/__tests__/heartbeatParser.test.ts` (51 passing — confirmed)
- `src/__tests__/heartbeatDispatcher.test.ts`
- `src/__tests__/useHeartbeatConfig.test.ts`

---

### Phase 5: Org View + Notifications (Plan 08-04)

**Success criteria to verify (5 total from ROADMAP.md):**
1. Team view shows org chart with Chief of Staff top, agents below; each card shows name/role/lastActive/taskCount/status — verify TeamView + AgentCard
2. Live pulsing green for recent heartbeat; grey sleeping; amber attention for surfaced findings — verify HeartbeatStatusDot + getHeartbeatStatus (ORG-04 fix from Phase 6)
3. Notification bell with realtime unread count via Supabase Realtime — verify NotificationBell + useNotifications subscription
4. Clicking notification navigates to agent; mark read / mark all read — verify NotificationBell onClick handler + resolveView
5. Chief of Staff morning digest at 8am in user timezone — verify send-morning-digest + next_digest_run_at migration

**Requirements in scope:** NOTIF-01..06, ORG-01..05
**Note on ORG-04:** amber dot bug fixed in Phase 6 Plan 02. Verify `heartbeatStatus.ts` checks `urgent || headsup || digest`, not `surfaced`.
**Note on NOTIF-03:** Push opt-in surface was added in Phase 7 Plans 03 and 04. The Phase 5 verification records NOTIF-03 as PASS with gap-closure note from Phase 7.

**Key files to read:**
- `src/components/team/TeamView.tsx`
- `src/components/team/AgentCard.tsx`
- `src/components/team/HeartbeatStatusDot.tsx`
- `src/components/dashboard/NotificationBell.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/hooks/useNotifications.ts`
- `src/hooks/useTeamData.ts`
- `src/lib/heartbeatStatus.ts`
- `src/hooks/usePushSubscription.ts`
- `supabase/migrations/20260313000010_push_subscriptions.sql`
- `supabase/migrations/20260313000011_next_digest_run_at.sql`
- `src/__tests__/useNotifications.test.ts`
- `src/__tests__/useTeamData.test.ts` (7 passing tests, 3 todos — confirmed)
- `src/__tests__/usePushSubscription.test.ts`

---

## State of the Art

| Original State | Verified Current State | When Changed | Impact on Verification |
|----------------|----------------------|--------------|----------------------|
| HB-01..09: dispatcher enqueued camelCase keys | snake_case keys confirmed in dispatcher source | Phase 6 Plan 01 (2026-03-13) | Mark HB-01..09 PASS (fixed) |
| ORG-04: heartbeatStatus checked `surfaced` (never received) | Now checks `urgent \|\| headsup \|\| digest` | Phase 6 Plan 02 (2026-03-13) | Mark ORG-04 PASS (fixed) |
| WS-07: buildWorkspacePrompt existed but not called in production | Wired into heartbeat-runner, orchestrator, chat-with-agent | Phase 7 Plans 01-02 (2026-03-14) | Mark WS-07 PASS (gap closed in Phase 7) |
| NOTIF-03: VAPID wired but no opt-in surface | PushOptInBanner in onboarding + Dashboard first-load | Phase 7 Plans 03-04 (2026-03-14) | Mark NOTIF-03 PASS (gap closed in Phase 7) |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |
| Current state | 51 passing, 14 todo, 0 failures (confirmed 2026-03-17) |

### Phase Requirements to Test Map

Phase 8 itself produces documentation artifacts (VERIFICATION.md files). Its "tests" are:
- The vitest suite must remain green throughout (no regressions from verification work)
- Each VERIFICATION.md must exist and have an explicit PASS/FAIL for every requirement ID in scope

| Req ID Range | Test Type | Automated Command |
|---|---|---|
| All phase 8 output artifacts | structure check | Verify `NN-VERIFICATION.md` files exist with correct frontmatter |
| Regression guard | unit | `cd worrylesssuperagent && npx vitest run` — 51 passing, 0 failed |

### Sampling Rate

- **Per plan commit:** `cd worrylesssuperagent && npx vitest run` — confirm no regressions
- **Phase gate:** All four VERIFICATION.md files exist; each has explicit PASS/FAIL per requirement in its scope

### Wave 0 Gaps

None — no new implementation code is produced in Phase 8. The test suite already exists. The only artifacts produced are VERIFICATION.md documents in `.planning/phases/`.

---

## Open Questions

1. **DB trigger and RLS — live verification**
   - What we know: Migration code confirms trigger function and RLS policies exist in SQL
   - What's unclear: Whether they were actually applied to the Supabase instance (no local DB is available for automated testing)
   - Recommendation: Mark these as "MANUAL REQUIRED" with specific verification queries; do not block VERIFICATION.md on them

2. **Heartbeat end-to-end — live verification**
   - What we know: Dispatcher (fixed), runner, cron jobs, and all severity routing logic are confirmed in source
   - What's unclear: Whether the pgmq queue processes correctly in the deployed Supabase environment
   - Recommendation: Code-review each component as PASS; mark the end-to-end flow as "MANUAL REQUIRED" for live deployment test

3. **agent_heartbeat_log column evolution**
   - What we know: The `outcome` column (ENUM: surfaced/error) is in migration 00001; the `severity` column (TEXT CHECK) was added in migration 00009
   - What's unclear: Whether both columns coexist correctly; runner writes both `outcome` and `severity`
   - Recommendation: Verify heartbeat-runner's INSERT statement includes both columns; confirm migration 00009 uses ALTER TABLE ADD COLUMN

---

## Sources

### Primary (HIGH confidence)

- Migration files on disk (20260312000001..20260313000011) — directly read; contents cited above
- `src/lib/heartbeatStatus.ts` — directly read; Phase 6 fix confirmed at line 9-12
- `supabase/functions/heartbeat-dispatcher/index.ts` — directly read; snake_case keys at lines 41-45
- `supabase/functions/_shared/sanitize.ts` — directly read; 12 patterns confirmed
- `src/lib/buildWorkspacePrompt.ts` — directly read; injection order confirmed
- `src/components/dashboard/NotificationBell.tsx` — directly read; full implementation confirmed
- `.planning/v1.0-v1.0-MILESTONE-AUDIT.md` — read; all known bugs and gaps documented
- vitest run output — executed 2026-03-17; 51 passing, 14 todo, 0 failures

### Secondary (MEDIUM confidence)

- SUMMARY.md frontmatter for all plans in Phases 1, 3, 4, 5 — reviewed; provide implementation intent cross-check
- ROADMAP.md success criteria — verbatim acceptance bar for each phase

### Tertiary (LOW confidence)

- None — all findings verified from primary sources

---

## Metadata

**Confidence breakdown:**
- What needs verifying (scope): HIGH — ROADMAP.md success criteria and REQUIREMENTS.md are definitive
- Which source files exist: HIGH — confirmed on disk via directory listings
- Current state of fixed bugs: HIGH — source files read and Phase 6 fix confirmed
- Manual-only tests (DB live): MEDIUM — migration SQL is verifiable; runtime behavior requires live DB

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase; no new phases add to these requirements)
