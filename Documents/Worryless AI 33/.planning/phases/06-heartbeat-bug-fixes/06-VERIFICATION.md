---
phase: 06-heartbeat-bug-fixes
verified: 2026-03-13T14:42:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Amber dot visible in Team view after live heartbeat run"
    expected: "AgentCard shows amber dot when agent has a heartbeat_log row with severity urgent/headsup/digest"
    why_human: "Requires live Supabase environment + pgmq queue processing; cannot be confirmed via static code analysis"
  - test: "Clicking AgentCard navigates to agent dedicated panel (ORG-04)"
    expected: "Click on any AgentCard triggers navigation to the correct agent view"
    why_human: "Navigation flow requires a running browser; static code shows onClick wiring but cannot confirm view resolution end-to-end"
---

# Phase 6: Heartbeat Bug Fixes Verification Report

**Phase Goal:** Fix two critical heartbeat bugs — (1) dispatcher-to-runner field name mismatch causing zero heartbeats to ever process, and (2) getHeartbeatStatus() severity check causing amber status dot to be permanently invisible.
**Verified:** 2026-03-13T14:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                              | Status     | Evidence                                                                                     |
|----|----------------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------|
| 1  | Dispatcher enqueues pgmq messages with snake_case keys (user_id, agent_type_id, user_agent_id)     | VERIFIED   | `heartbeat-dispatcher/index.ts` lines 42-44: `user_agent_id`, `user_id`, `agent_type_id`    |
| 2  | Runner destructures those keys and processHeartbeat completes without throwing                     | VERIFIED   | `heartbeat-runner/index.ts` line 50: `const { user_id: userId, agent_type_id: agentTypeId } = message` — keys now match |
| 3  | Heartbeat jobs deleted after successful processing (no infinite re-queue loop)                     | VERIFIED   | `heartbeat-runner/index.ts` line 291: `rpc("delete", { queue_name: "heartbeat_jobs", msg_id: msg.msg_id })` called after `processHeartbeat` succeeds |
| 4  | HB-01 through HB-09 pipeline (LLM call, severity routing, notification insert, email, push, log) is reachable | VERIFIED   | Runner code flow confirmed: LLM call (line 126), severity parse (151), log insert (163), notification insert (183), email send (203), VAPID push (213) all reachable |
| 5  | getHeartbeatStatus returns 'attention' for 'urgent', 'headsup', 'digest'                           | VERIFIED   | `heartbeatStatus.ts` lines 8-13: `lastOutcome === 'urgent' \|\| lastOutcome === 'headsup' \|\| lastOutcome === 'digest'` |
| 6  | getHeartbeatStatus does NOT return 'attention' for legacy 'surfaced'                               | VERIFIED   | 'surfaced' not present in heartbeatStatus.ts; vitest confirms `getHeartbeatStatus(anyISO, 'surfaced')` is not 'attention' |
| 7  | AgentCard passes lastHeartbeatOutcome (severity) to getHeartbeatStatus and renders HeartbeatStatusDot | VERIFIED   | `AgentCard.tsx` line 26: `getHeartbeatStatus(agent.lastHeartbeatAt, agent.lastHeartbeatOutcome)` → line 40: `<HeartbeatStatusDot status={status} />` |
| 8  | useTeamData selects severity column and passes it as lastHeartbeatOutcome                          | VERIFIED   | `useTeamData.ts` line 44: `.select('agent_type_id, run_at, severity')`; line 69: `lastHeartbeatOutcome: stats.lastSeverity` |
| 9  | All vitest tests pass (51 tests, 8 files, zero failures)                                           | VERIFIED   | `npx vitest run` output: `8 passed (8)`, `51 passed \| 8 todo (59)`, 0 failures             |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact                                                                 | Expected                                    | Status     | Details                                                                                        |
|--------------------------------------------------------------------------|---------------------------------------------|------------|------------------------------------------------------------------------------------------------|
| `worrylesssuperagent/supabase/functions/heartbeat-dispatcher/index.ts`   | Fixed pgmq enqueue payload, snake_case keys | VERIFIED   | Contains `user_agent_id: agent.id`, `user_id: agent.user_id`, `agent_type_id: agent.agent_type_id`; purge note comment present |

### Plan 02 Artifacts

| Artifact                                                             | Expected                                            | Status     | Details                                                                                          |
|----------------------------------------------------------------------|-----------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| `worrylesssuperagent/src/lib/heartbeatStatus.ts`                     | Severity-based attention check (urgent/headsup/digest) | VERIFIED   | Line 8-13: multi-value OR check; 'surfaced' fully removed; 17 lines, non-trivial                 |
| `worrylesssuperagent/src/__tests__/useTeamData.test.ts`              | 4 severity-based test cases replacing old 'surfaced' test | VERIFIED   | Contains `returns attention when outcome is urgent`, `headsup`, `digest`, and negative `surfaced` case |

---

## Key Link Verification

| From                                          | To                                              | Via                           | Status     | Details                                                                                    |
|-----------------------------------------------|-------------------------------------------------|-------------------------------|------------|--------------------------------------------------------------------------------------------|
| `heartbeat-dispatcher/index.ts` pgmq send     | `heartbeat-runner/index.ts` processHeartbeat    | pgmq message object keys      | WIRED      | Dispatcher sends `user_id`, `agent_type_id`, `user_agent_id`; runner destructures `user_id`, `agent_type_id` — contract matches |
| `useTeamData.ts` (selects severity, passes as lastHeartbeatOutcome) | `heartbeatStatus.ts` getHeartbeatStatus | AgentCard props               | WIRED      | `useTeamData.ts:69` sets `lastHeartbeatOutcome: stats.lastSeverity`; `AgentCard.tsx:26` passes it to `getHeartbeatStatus` |
| `heartbeatStatus.ts` getHeartbeatStatus       | `HeartbeatStatusDot` amber render               | status prop                   | WIRED      | `AgentCard.tsx:40` `<HeartbeatStatusDot status={status} />`; `HeartbeatStatusDot.tsx` renders `bg-amber-500` when `status === 'attention'` |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                 | Status     | Evidence                                                                                           |
|-------------|-------------|-----------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------|
| HB-01       | 06-01       | heartbeat-dispatcher enqueues agents due for heartbeat into pgmq             | SATISFIED  | Dispatcher confirmed functional; snake_case fix unblocks queue processing                         |
| HB-02       | 06-01       | heartbeat-runner reads messages and processes: HEARTBEAT.md + LLM + severity | SATISFIED  | Runner reads queue, calls processHeartbeat, full pipeline now reachable after field name fix       |
| HB-03       | 06-01       | LLM response includes severity: urgent/headsup/digest/ok; ok = suppressed   | SATISFIED  | Runner line 154: `if (severity === "ok") return` — suppression logic confirmed                    |
| HB-04       | 06-01       | Non-OK runs: urgent → push + email + in-app; headsup → in-app; digest → morning batch | SATISFIED  | Runner lines 182-242: notification insert (urgent+headsup), email (urgent), VAPID push (urgent)   |
| HB-05       | 06-01       | Per-day call budget enforced by dispatcher query                             | SATISFIED  | Budget check in `get_due_heartbeat_agents` SQL function (dispatcher line 18-21)                   |
| HB-06       | 06-01       | Heartbeats fire only during user configured active hours                     | SATISFIED  | Active hours enforced via `get_due_heartbeat_agents` SQL; `parseActiveHours` utility + tests pass  |
| HB-07       | 06-01       | agent_heartbeat_log records severity, finding, timestamp for non-OK runs    | SATISFIED  | Runner lines 162-173: inserts `severity`, `summary`, `run_at`, `outcome` — confirmed in runner    |
| HB-08       | 06-02       | Agent settings panel shows heartbeat config: interval, active hours, toggle  | SATISFIED  | `useHeartbeatConfig.test.ts` 7/7 tests pass; `useHeartbeatConfig` hook confirmed working          |
| HB-09       | 06-01       | Chief of Staff sends 8am morning digest of digest-severity findings          | SATISFIED  | `send-morning-digest` edge function pre-existing; field name fix enables digest rows to be written |
| ORG-04      | 06-02       | Clicking AgentCard in Team view navigates to agent's dedicated panel         | SATISFIED  | `AgentCard.tsx` line 35: `onClick={() => onNavigate(resolveView(agent.agentTypeId))}` — navigation wired |

**Note on ORG-04:** REQUIREMENTS.md defines ORG-04 as "clicking AgentCard navigates to agent panel" — this is a navigation concern, not the amber dot. Plan 02 claimed ORG-04 closure via the amber dot fix, but the navigation was already implemented in AgentCard.tsx (onClick → onNavigate). The amber dot fix is more accurately ORG-02 (heartbeat status indicator). Both behaviors are correctly implemented in the codebase regardless; ORG-04 is satisfied.

---

## Anti-Patterns Found

No blocker anti-patterns detected in modified files.

| File                                             | Pattern Checked                               | Result                                  |
|--------------------------------------------------|-----------------------------------------------|-----------------------------------------|
| `heartbeat-dispatcher/index.ts`                  | camelCase keys (userAgentId, userId, agentTypeId) | None found — only snake_case present |
| `heartbeat-dispatcher/index.ts`                  | TODO/FIXME/placeholder comments               | None found                              |
| `src/lib/heartbeatStatus.ts`                     | Legacy 'surfaced' check                       | Absent — replaced by severity OR check  |
| `src/lib/heartbeatStatus.ts`                     | return null / empty implementation            | None — full logic present               |
| `src/__tests__/useTeamData.test.ts`              | Old single 'surfaced' positive assertion      | Removed — 4 correct severity tests present |

---

## Human Verification Required

### 1. Amber attention dot in live Team view

**Test:** Log in to the app; ensure an agent has a row in `agent_heartbeat_log` with `severity = 'urgent'`, `'headsup'`, or `'digest'`. Navigate to the Team view and observe the AgentCard for that agent.
**Expected:** The amber dot (`bg-amber-500`) is visible on the card.
**Why human:** Requires a live Supabase environment and a populated `agent_heartbeat_log` row. Static analysis confirms the full code path (severity → getHeartbeatStatus → 'attention' → HeartbeatStatusDot renders amber), but the visual result can only be confirmed in a running browser.

### 2. End-to-end heartbeat job processing

**Test:** Trigger the heartbeat-dispatcher edge function (or invoke it manually via Supabase Functions dashboard). Then trigger heartbeat-runner within 30 seconds. Observe pgmq queue state before and after.
**Expected:** A message is enqueued with snake_case keys, the runner reads it, processHeartbeat executes without throwing, and the message is deleted from the queue.
**Why human:** Requires a live Supabase + pgmq environment. The fix is a one-line field name change that is code-verified, but queue acknowledgment (message deletion after success) can only be confirmed against a real queue.

### 3. AgentCard navigation (ORG-04)

**Test:** In the Team view, click on any AgentCard.
**Expected:** The UI navigates to that agent's dedicated panel view.
**Why human:** Navigation flow (onNavigate callback → view string → routing) requires a running browser. Code analysis confirms onClick wiring is present and `resolveView` maps agent_type_id to view strings.

---

## Gaps Summary

No gaps. All must-haves from both plan frontmatters are verified:

- **Bug 1 (dispatcher field mismatch):** The pgmq message object in `heartbeat-dispatcher/index.ts` now uses `user_agent_id`, `user_id`, `agent_type_id` (snake_case). The runner destructures exactly these keys. The camelCase keys that caused every heartbeat to silently fail are gone. Commit `02a8941` confirmed present.

- **Bug 2 (amber dot always invisible):** `heartbeatStatus.ts` now checks `lastOutcome === 'urgent' || lastOutcome === 'headsup' || lastOutcome === 'digest'` — the three values that `useTeamData` actually passes from the `severity` column. The legacy `'surfaced'` check is removed. Commits `23ad120` (TDD RED) and `5b0fe21` (TDD GREEN) confirmed present.

- **HB-08 confirmed:** `useHeartbeatConfig.test.ts` 7/7 tests pass in the full vitest run (51 tests, 0 failures).

- **Full test suite:** 8 test files, 51 tests passed, 0 failures as of 2026-03-13.

---

_Verified: 2026-03-13T14:42:00Z_
_Verifier: Claude (gsd-verifier)_
