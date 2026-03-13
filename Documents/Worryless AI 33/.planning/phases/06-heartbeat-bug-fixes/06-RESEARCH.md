# Phase 6: Heartbeat Bug Fixes - Research

**Researched:** 2026-03-13
**Domain:** Deno Edge Functions (pgmq field naming), React/TypeScript heartbeat status logic
**Confidence:** HIGH — bugs confirmed by direct code inspection; no ambiguity about root cause or fix

---

## Summary

Phase 6 closes two discrete, fully diagnosed integration bugs found during the v1.0 milestone audit. Neither bug requires architectural change — both are surgical one-to-two line fixes on existing files.

**Bug 1 (BLOCKER):** `heartbeat-dispatcher/index.ts` enqueues pgmq messages with camelCase keys (`userId`, `agentTypeId`, `userAgentId`). `heartbeat-runner/index.ts` line 50 destructures those same messages with snake_case keys (`user_id`, `agent_type_id`). Both destructured values are `undefined` at runtime, causing an immediate throw inside `processHeartbeat`. The message is never deleted from the queue and re-queues indefinitely after the 30-second visibility timeout. Zero heartbeats are ever processed. This is the root cause of all HB-01 through HB-09 failures.

**Bug 2:** `heartbeatStatus.ts` function `getHeartbeatStatus()` checks `lastOutcome === 'surfaced'` to return the amber `'attention'` status. However, `useTeamData.ts` selects the `severity` column from `agent_heartbeat_log` (values: `'urgent'` / `'headsup'` / `'digest'`) and passes that as `lastHeartbeatOutcome` to `AgentCard`. The string `'surfaced'` is never passed — it is the `outcome` column value, not the `severity` column value. The amber attention dot is permanently off for every agent regardless of heartbeat findings.

**Primary recommendation:** Fix Bug 1 by aligning field names — the dispatcher payload should use snake_case to match the runner's existing destructuring (changing the enqueue site is the minimal-risk fix). Fix Bug 2 by updating `getHeartbeatStatus()` to check `lastOutcome === 'urgent' || lastOutcome === 'headsup' || lastOutcome === 'digest'` and update the existing test assertions that assert `'surfaced'` triggers `'attention'`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HB-01 | heartbeat-dispatcher queries due agents and enqueues into pgmq `heartbeat_jobs` | Fix dispatcher enqueue payload field names — Bug 1 fix unblocks queue consumption |
| HB-02 | heartbeat-runner reads up to 5 messages and processes each | Fix Bug 1 so runner's destructuring receives defined values and `processHeartbeat` executes |
| HB-03 | LLM response must include `{ severity, finding }` structured field; `ok` → suppressed | Runner severity routing code already correct; reachable only after Bug 1 fixed |
| HB-04 | Non-OK runs create notification + optional task; urgent → push+email+in-app | Notification insert and email/push code already correct; reachable only after Bug 1 fixed |
| HB-05 | Per-day per-agent call budget (default 6) enforced by dispatcher query | Budget enforcement lives in `get_due_heartbeat_agents` SQL; correct; reachable after Bug 1 fixed |
| HB-06 | Heartbeats only fire during user's configured active hours (dispatcher enforces) | Active hours check lives in SQL; correct; reachable after Bug 1 fixed |
| HB-07 | `agent_heartbeat_log` records agent_type, user_id, severity, finding, timestamp for non-OK | Log insert code already correct; reachable only after Bug 1 fixed |
| HB-08 | Agent settings panel shows heartbeat config (interval, active hours, enabled toggle) | HeartbeatConfigSection UI and useHeartbeatConfig hook exist and save correctly — HB-08 is partial/verified; no code changes needed |
| HB-09 | Chief of Staff sends morning digest at 8am consolidating `severity=digest` rows | send-morning-digest queries `agent_heartbeat_log` for `severity='digest'` rows; correct; will have data after Bug 1 fixed |
| ORG-04 | Clicking an agent card in Team view navigates to that agent's panel | Audit evidence: ORG-04 is specifically about the amber attention dot, not navigation. AgentCard `onClick` already navigates correctly via `resolveView`. The fix is the `getHeartbeatStatus` field check — Bug 2 fix |
</phase_requirements>

---

## Bug 1: Dispatcher → Runner Field Name Mismatch

### Root Cause (HIGH confidence — direct code inspection)

**File:** `worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts` lines 38–43

The dispatcher enqueues this object:
```typescript
message: {
  userAgentId: agent.id,           // camelCase
  userId: agent.user_id,           // camelCase
  agentTypeId: agent.agent_type_id, // camelCase
}
```

**File:** `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` line 50

The runner destructures with snake_case:
```typescript
const { user_id: userId, agent_type_id: agentTypeId } = message;
```

Both `user_id` and `agent_type_id` are absent from the message object. JavaScript destructuring returns `undefined` for missing keys — no error is thrown at destructure time. The guard on line 52–56 then throws:
```
Error: [heartbeat-runner] Message missing user_id or agent_type_id
```

The throw is caught by the per-message try/catch on line 294. The `pgmq.delete` call is skipped. The message re-appears after the 30-second visibility timeout and fails again indefinitely.

### Correct Fix Strategy

**Option A (recommended):** Change the dispatcher enqueue payload to snake_case, matching the runner's existing destructuring.

```typescript
// dispatcher/index.ts — enqueue message change
message: {
  user_agent_id: agent.id,         // was: userAgentId
  user_id: agent.user_id,          // was: userId
  agent_type_id: agent.agent_type_id, // was: agentTypeId
}
```

Runner code is unchanged. This is the minimal-blast-radius fix.

**Option B:** Change the runner destructuring to camelCase. Runner code is touched instead.

**Why Option A is preferred:** The runner's snake_case naming matches the Postgres column naming convention throughout the codebase. The dispatcher was the outlier. Fixing the outlier is more idiomatic.

### Cascade Impact

Fixing Bug 1 immediately enables:
- All LLM calls to `processHeartbeat` to complete
- `agent_heartbeat_log` rows to be written
- `notifications` rows to be written (urgent + headsup)
- Urgent email via Resend to fire
- Urgent VAPID push to fire (if keys configured)
- Morning digest (HB-09) to have data to consume

HB-01 through HB-09 are all gated on this single fix.

---

## Bug 2: Heartbeat Status Amber Dot Field Mismatch

### Root Cause (HIGH confidence — direct code inspection)

**File:** `worrylesssuperagent/src/lib/heartbeatStatus.ts` line 8

```typescript
if (lastOutcome === 'surfaced') return 'attention';
```

`'surfaced'` is the value of the `outcome` column in `agent_heartbeat_log`. It is always `'surfaced'` for non-OK runs (set by the runner on line 169 of runner's index.ts: `outcome: "surfaced"`).

**File:** `worrylesssuperagent/src/hooks/useTeamData.ts` line 44

```typescript
.select('agent_type_id, run_at, severity')
```

The query selects `severity`, not `outcome`. The `statsMap` on line 54 stores `lastSeverity: row.severity`. The `TeamAgent` object on line 69 sets `lastHeartbeatOutcome: stats.lastSeverity` — which is a severity value (`'urgent'`, `'headsup'`, `'digest'`).

`AgentCard` passes this to `getHeartbeatStatus(agent.lastHeartbeatAt, agent.lastHeartbeatOutcome)`. The function receives `'urgent'`/`'headsup'`/`'digest'` but checks for `'surfaced'` — never matches.

### Correct Fix Strategy

**Option A (recommended):** Update `getHeartbeatStatus()` to check severity values.

```typescript
// heartbeatStatus.ts — line 8 change
if (lastOutcome === 'urgent' || lastOutcome === 'headsup' || lastOutcome === 'digest') return 'attention';
```

The `TeamAgent` interface name `lastHeartbeatOutcome` is semantically a misnomer (it actually carries severity), but renaming it is tech debt, not a Phase 6 requirement. The field name can stay as-is; the check logic is fixed.

**Option B:** Change `useTeamData` to select the `outcome` column instead of `severity`. This would pass `'surfaced'` to the function, which already checks for `'surfaced'`. But this loses severity data from `TeamAgent`, which may be used elsewhere in future work.

**Why Option A is preferred:** `useTeamData` already exposes `lastHeartbeatOutcome` as severity. Changing the check in `getHeartbeatStatus` is a one-line fix with no interface changes.

### Test Impact

The existing test `useTeamData.test.ts` (line 14–17) asserts:
```typescript
it('returns attention when outcome is surfaced regardless of recency', () => {
  expect(getHeartbeatStatus(anyISO, 'surfaced')).toBe('attention');
```

This test must be updated to use severity values:
```typescript
it('returns attention when outcome is urgent', () => {
  expect(getHeartbeatStatus(anyISO, 'urgent')).toBe('attention');
```

Additional test cases should cover `'headsup'` and `'digest'` — both should return `'attention'`. The old `'surfaced'` assertion should be removed or replaced.

---

## Standard Stack

### Core (no new dependencies)

| Component | File | Current State |
|-----------|------|--------------|
| pgmq send API | `heartbeat-dispatcher/index.ts` | enqueue via `supabaseAdmin.schema("pgmq_public").rpc("send", {...})` |
| pgmq read API | `heartbeat-runner/index.ts` | dequeue via `supabaseAdmin.schema("pgmq_public").rpc("read", {...})` |
| pgmq delete API | `heartbeat-runner/index.ts` | delete via `supabaseAdmin.schema("pgmq_public").rpc("delete", {...})` |
| getHeartbeatStatus | `src/lib/heartbeatStatus.ts` | pure function, no deps |
| useTeamData | `src/hooks/useTeamData.ts` | supabase query hook |

No new libraries. No new migrations. No new edge functions. No schema changes required.

---

## Architecture Patterns

### Pattern: pgmq Message Payload Convention

The pgmq `send` RPC accepts a `message` parameter as a JSON object. The message schema is not enforced by pgmq — it is a contract between producer and consumer. The convention throughout this codebase (and Postgres generally) is snake_case column names. The dispatcher was the only place that deviated.

**Rule:** pgmq message payload keys must exactly match the destructuring keys in the consuming function. These are not TypeScript interfaces — there is no compile-time check. The contract is purely by convention.

### Pattern: Pure Function Status Resolution

`getHeartbeatStatus` is a pure function — no side effects, no network calls, fully unit testable. This is the correct pattern for UI status derivation. The fix is a change to the comparison condition only — the function signature and return type are unchanged.

### Pattern: Test-First for Pure Functions

The existing test in `useTeamData.test.ts` already covers `getHeartbeatStatus`. The fix requires updating the test assertions to match the new (correct) behavior before or alongside the code change. This is a test-driven bug fix pattern.

### Anti-Patterns to Avoid

- **Do not rename `lastHeartbeatOutcome` field** on `TeamAgent` interface — that is a broader refactor not scoped to Phase 6. Fix the comparison, not the naming.
- **Do not change the `outcome` column** in `agent_heartbeat_log` — it is used correctly by the runner (`outcome: "surfaced"`) for its own purpose (distinguishing surfaced vs suppressed runs). Bug 2 is about what `useTeamData` selects and passes downstream, not what the runner writes.
- **Do not add a `userAgentId` field lookup** in the runner — the runner only needs `user_id` and `agent_type_id` to function. The `user_agent_id` field in the dispatcher payload is informational; if it is renamed, the runner's non-use of it is fine.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Type-safe pgmq message schema | Custom TypeScript interface validation at runtime | Snake_case convention alignment — one-time fix at the producer |
| Severity-to-attention mapping | Custom enum transform layer | Direct multi-value OR check in `getHeartbeatStatus` |

---

## Common Pitfalls

### Pitfall 1: Fixing the Runner Side Instead of the Dispatcher Side

**What goes wrong:** Changing the runner to destructure camelCase (`const { userId, agentTypeId } = message`) instead of fixing the dispatcher payload. This works at runtime but makes the runner's variable names inconsistent with the Postgres snake_case convention used everywhere else.

**How to avoid:** Fix the dispatcher (producer). The runner is already correct by convention.

### Pitfall 2: Forgetting the Test Update for Bug 2

**What goes wrong:** `getHeartbeatStatus` check is updated to accept severity values, but the existing test at `useTeamData.test.ts` line 14 still asserts `'surfaced'` triggers `'attention'`. The test will now fail (correctly flagging the old assertion as wrong) but this breaks the test suite.

**How to avoid:** Update the test in the same commit as the `heartbeatStatus.ts` fix. Replace the `'surfaced'` assertion with `'urgent'`, `'headsup'`, and `'digest'` cases. Remove or invert the old `'surfaced'` test.

### Pitfall 3: Assuming ORG-04 is About Navigation

**What goes wrong:** ORG-04 states "Clicking an agent card navigates to that agent's panel." `AgentCard.tsx` already wires `onClick` to `onNavigate(resolveView(agent.agentTypeId))`. A planner reading only REQUIREMENTS.md might think navigation is unimplemented.

**How to avoid:** The audit evidence makes clear ORG-04's remaining gap is the amber attention dot, not navigation. Navigation is already implemented. Plan 06-02 should scope exclusively to the `getHeartbeatStatus` field mismatch fix.

### Pitfall 4: Worrying About Queue Poison Pills

**What goes wrong:** After fixing Bug 1, existing stuck messages in the `heartbeat_jobs` queue still have camelCase keys. A planner might think a queue flush step is needed.

**How to avoid:** pgmq messages expire or are deleted after the visibility timeout elapses and the runner attempts processing. After Bug 1 is deployed, any stuck messages will be processed correctly only if their content matches the new schema. Old camelCase-keyed messages will fail once more and re-queue. In development/staging this is a non-issue (queue can be cleared). For production, the queue likely has no live messages. Add a note in the plan to run `pgmq.purge('heartbeat_jobs')` as an optional cleanup step if old stuck messages exist.

---

## Code Examples

### Bug 1 Fix — Dispatcher Enqueue (Option A)

```typescript
// supabase/functions/heartbeat-dispatcher/index.ts lines 38-43
// BEFORE (broken):
message: {
  userAgentId: agent.id,
  userId: agent.user_id,
  agentTypeId: agent.agent_type_id,
}

// AFTER (fixed — matches runner's destructuring):
message: {
  user_agent_id: agent.id,
  user_id: agent.user_id,
  agent_type_id: agent.agent_type_id,
}
```

### Bug 2 Fix — getHeartbeatStatus Check

```typescript
// src/lib/heartbeatStatus.ts line 8
// BEFORE (broken):
if (lastOutcome === 'surfaced') return 'attention';

// AFTER (fixed — matches severity values from useTeamData):
if (lastOutcome === 'urgent' || lastOutcome === 'headsup' || lastOutcome === 'digest') return 'attention';
```

### Bug 2 Test Update

```typescript
// src/__tests__/useTeamData.test.ts — replace the 'surfaced' test block
it('returns attention when outcome is urgent', () => {
  const anyISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  expect(getHeartbeatStatus(anyISO, 'urgent')).toBe('attention');
});

it('returns attention when outcome is headsup', () => {
  const anyISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  expect(getHeartbeatStatus(anyISO, 'headsup')).toBe('attention');
});

it('returns attention when outcome is digest', () => {
  const anyISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  expect(getHeartbeatStatus(anyISO, 'digest')).toBe('attention');
});

it('does NOT return attention for legacy surfaced value (no longer passed)', () => {
  const anyISO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  expect(getHeartbeatStatus(anyISO, 'surfaced')).not.toBe('attention');
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (installed, config at `worrylesssuperagent/vitest.config.ts`) |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HB-01..07, HB-09 | Dispatcher enqueues snake_case keys; runner processes successfully | manual (requires live pgmq) | N/A — requires live Supabase pgmq | N/A |
| HB-08 | HeartbeatConfigSection UI exists and saves | unit (already passing) | `cd worrylesssuperagent && npx vitest run src/__tests__/useHeartbeatConfig.test.ts` | ✅ exists |
| ORG-04 | `getHeartbeatStatus` returns 'attention' for severity values | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/useTeamData.test.ts` | ✅ exists (needs update) |
| Bug 1 (field names) | Dispatcher payload uses snake_case | code review | `cd worrylesssuperagent && npx vitest run src/__tests__/` | ✅ (heartbeatDispatcher.test.ts exists, no field-name test — structural review sufficient) |

### Sampling Rate

- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all automated test requirements for this phase. The only outstanding Wave 0 item from Phase 4 (`heartbeatParser.test.ts`, `heartbeatDispatcher.test.ts`, `useHeartbeatConfig.test.ts`) are already present on disk from Phase 4 execution. The `useTeamData.test.ts` file exists and passes — it needs test assertion updates as part of Plan 06-02, not net-new scaffolding.

---

## Open Questions

1. **Queue state at deploy time**
   - What we know: pgmq messages with camelCase keys are stuck in the `heartbeat_jobs` queue on any deployed instance
   - What's unclear: Whether the production environment has a live queue with stuck messages
   - Recommendation: Plan 06-01 should include an optional cleanup step: `SELECT pgmq.purge('heartbeat_jobs');` runnable from Supabase SQL editor after deploying the dispatcher fix

2. **HB-08 verification scope**
   - What we know: Audit marks HB-08 as `partial` (code exists, no VERIFICATION.md). The HeartbeatConfigSection and useHeartbeatConfig hook are claimed complete in Phase 4 SUMMARY files.
   - What's unclear: Whether any code change is needed for HB-08 or only a verification artifact
   - Recommendation: Phase 6 plans should not include HB-08 code changes. A passing test (`useHeartbeatConfig.test.ts`) is sufficient to close HB-08 in this phase.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `supabase/functions/heartbeat-dispatcher/index.ts` — confirmed camelCase enqueue payload at lines 38–43
- Direct code inspection: `supabase/functions/heartbeat-runner/index.ts` — confirmed snake_case destructuring at line 50
- Direct code inspection: `src/lib/heartbeatStatus.ts` — confirmed `'surfaced'` check at line 8
- Direct code inspection: `src/hooks/useTeamData.ts` — confirmed `severity` column selected and passed as `lastHeartbeatOutcome` at lines 44, 69
- Direct code inspection: `src/__tests__/useTeamData.test.ts` — confirmed existing test asserts `'surfaced'` triggers `'attention'` (will need update)
- `.planning/v1.0-v1.0-MILESTONE-AUDIT.md` — audit evidence documents both bugs with exact file/line references

### Secondary (MEDIUM confidence)

- Phase 4 VALIDATION.md — test infrastructure confirmed: vitest, `src/__tests__/`, `npx vitest run`
- `vitest.config.ts` — confirmed `supabase/` directory excluded, `@` alias resolves to `src/`

---

## Metadata

**Confidence breakdown:**
- Bug root cause: HIGH — confirmed by direct inspection of both sides of each mismatch
- Fix strategy: HIGH — one-line changes with no architectural risk
- Test impact: HIGH — existing test file identified, exact assertion update documented
- Cascade effects: HIGH — audit documents all affected requirements with evidence

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable codebase, fixes are surgical)
