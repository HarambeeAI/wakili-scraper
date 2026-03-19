---
phase: 07-workspace-prompt-wiring-push-optin
verified: 2026-03-14T16:30:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Existing user first-load push opt-in banner"
    expected: "Banner appears above DashboardOverview on first load after deleting push_opt_in_shown from localStorage; Skip dismisses it; Reload does not show it again"
    why_human: "Browser push permission API and serviceWorker.ready cannot be exercised by automated grep/file checks"
  - test: "Permission denied guard"
    expected: "Banner does NOT appear when Notification.permission is blocked in browser settings"
    why_human: "Requires live browser with permission manipulation"
  - test: "Onboarding push_opt_in step renders after briefing animation"
    expected: "After briefing animation ends, push_opt_in step renders PushOptInBanner instead of landing directly on dashboard; Enable and Skip both proceed to dashboard"
    why_human: "Requires full onboarding flow execution in a real browser"
---

# Phase 7: Workspace Prompt Wiring + Push Opt-In Verification Report

**Phase Goal:** Workspace file injection wired into all AI prompt surfaces (orchestrator, heartbeat-runner, chat-with-agent) and push notification opt-in banner wired for both new (onboarding) and existing (dashboard) users.
**Verified:** 2026-03-14T16:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | heartbeat-runner injects all 6 workspace files (IDENTITY→SOUL→SOPs→TOOLS→MEMORY→HEARTBEAT) | VERIFIED | `workspaceRows` SELECT fetches `file_type, content` without `.eq("file_type",...)` filter; `buildWorkspacePrompt(files, true)` called at line 109 of heartbeat-runner/index.ts |
| 2 | Deno _shared/buildWorkspacePrompt.ts is a verbatim mirror of src/lib/buildWorkspacePrompt.ts | VERIFIED | Both files are byte-for-byte identical in logic; _shared version has 2-line comment header only; exports `WorkspaceFileType` and `buildWorkspacePrompt` with identical signatures |
| 3 | Orchestrator Chief of Staff prompt includes workspace files | VERIFIED | `chiefWorkspaceBlock` fetched via `fetchAndBuildWorkspacePrompt(userId, 'chief_of_staff', supabaseAdmin)` at line 1013; passed to `buildOrchestratorPrompt(businessKnowledge, chiefWorkspaceBlock)` at line 1024 |
| 4 | Each specialist agent delegation injects that specialist's own workspace files | VERIFIED | `executeSpecialist` and `executeSpecialistStreaming` both accept `userId?` and call `buildAgentPrompt(agentKey, businessKnowledge, adminClient, userId)`; all 4 non-streaming call sites pass `userId`; streaming path via `createStreamingResponse` also passes `userId` to `executeSpecialistStreaming` at line 1143 |
| 5 | chat-with-agent injects workspace files when userId is present | VERIFIED | Request body destructures `userId`; `fetchAgentWorkspaceBlock(userId, agent)` called when userId present; `finalSystemPrompt` used in messages array |
| 6 | If userId is absent, all functions fall back gracefully to base prompts | VERIFIED | `if (userId && supabaseAdmin)` guard in orchestrator handler; `try/catch` in `fetchAndBuildWorkspacePrompt` returns `''` on error; `fetchAgentWorkspaceBlock` also returns `''` on any failure |
| 7 | PushOptInBanner component exists with correct null-guards and button behaviour | VERIFIED | `PushOptInBanner.tsx` exports `PushOptInBanner`; returns null when `!('PushManager' in window)` or `Notification.permission === 'denied'`; `useEffect` auto-dismisses when `isSubscribed` becomes true; Enable calls `subscribe()` then `onDismiss()`; Skip calls `onDismiss()` |
| 8 | Onboarding push_opt_in step inserted between briefing and onComplete() | VERIFIED | `'push_opt_in'` in Step union at line 53 of ConversationalOnboarding.tsx; `handleTeamAccept` calls `setStep("push_opt_in")` at line 866; `renderStep()` case `"push_opt_in"` renders PushOptInBanner at line 1310; `onDismiss` sets `localStorage.setItem("push_opt_in_shown", "1")` then calls `onComplete()` |
| 9 | Dashboard shows first-load push opt-in for existing users | VERIFIED | `showPushOptIn` state at line 51; useEffect guards on `user`, `showOnboarding`, `checkingOnboarding`, PushManager, denied permission, localStorage key, and existing subscription at lines 119–131; overview case renders `PushOptInBanner` above `DashboardOverview` when `showPushOptIn && user` |
| 10 | Banner suppressed after any interaction via localStorage | VERIFIED | `onDismiss` in Dashboard.tsx sets `localStorage.setItem('push_opt_in_shown', '1')` and calls `setShowPushOptIn(false)`; same flag set in ConversationalOnboarding onDismiss |
| 11 | Vitest test scaffold exists for usePushSubscription (Wave 0) | VERIFIED | `src/__tests__/usePushSubscription.test.ts` has 6 `it.todo` stubs matching the planned pattern |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `worrylesssuperagent/supabase/functions/_shared/buildWorkspacePrompt.ts` | Deno mirror of buildWorkspacePrompt, exports WorkspaceFileType and buildWorkspacePrompt | VERIFIED | File exists, 20 lines, verbatim logic match to src/lib version, correct exports |
| `worrylesssuperagent/src/__tests__/usePushSubscription.test.ts` | Wave 0 it.todo stubs for NOTIF-03 | VERIFIED | File exists, 6 it.todo stubs, correct describe block |
| `worrylesssuperagent/supabase/functions/heartbeat-runner/index.ts` | Full 6-file workspace injection using buildWorkspacePrompt | VERIFIED | Imports buildWorkspacePrompt, fetches all 6 rows in one SELECT, calls buildWorkspacePrompt(files, true) |
| `worrylesssuperagent/supabase/functions/orchestrator/index.ts` | fetchAndBuildWorkspacePrompt helper + Chief of Staff and specialist injection | VERIFIED | Imports buildWorkspacePrompt and sanitizeWorkspaceContent; helper exists; buildOrchestratorPrompt accepts workspaceBlock; buildAgentPrompt accepts userId; all executeSpecialist call sites pass userId |
| `worrylesssuperagent/supabase/functions/chat-with-agent/index.ts` | Workspace injection path when userId provided | VERIFIED | Imports buildWorkspacePrompt; fetchAgentWorkspaceBlock helper exists; userId destructured from req.json(); finalSystemPrompt used in messages |
| `worrylesssuperagent/src/components/push/PushOptInBanner.tsx` | Reusable push opt-in UI with null-guards | VERIFIED | File exists; exports PushOptInBanner; PushManager/denied guards; useEffect auto-dismiss; Enable and Skip buttons wired |
| `worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx` | push_opt_in step between briefing and onComplete() | VERIFIED | push_opt_in in Step union; setStep("push_opt_in") in handleTeamAccept; renderStep case wired; localStorage flag set |
| `worrylesssuperagent/src/pages/Dashboard.tsx` | First-load push opt-in banner for existing users | VERIFIED | PushOptInBanner imported; showPushOptIn state; post-onboarding useEffect with all guards; conditional render in overview case |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| heartbeat-runner index.ts | _shared/buildWorkspacePrompt.ts | `import { buildWorkspacePrompt } from '../_shared/buildWorkspacePrompt.ts'` | WIRED | Import at line 6; called at line 109 with `(workspaceFiles, true)` |
| heartbeat-runner processHeartbeat() | agent_workspaces table (all 6 rows) | SELECT file_type, content without file_type filter | WIRED | Query at lines 60–64; no `.eq("file_type",...)` — fetches all rows for user+agent |
| orchestrator buildOrchestratorPrompt() | fetchAndBuildWorkspacePrompt('chief_of_staff') | `await fetchAndBuildWorkspacePrompt(userId, 'chief_of_staff', supabaseAdmin)` | WIRED | chiefWorkspaceBlock fetched at line 1013; passed to buildOrchestratorPrompt at line 1026 |
| orchestrator buildAgentPrompt(agentKey) | fetchAndBuildWorkspacePrompt(agentKey) | `await fetchAndBuildWorkspacePrompt(userId, agentKey, adminClient)` | WIRED | buildAgentPrompt accepts userId; calls fetchAndBuildWorkspacePrompt when userId && adminClient present |
| orchestrator executeSpecialist/Streaming call sites | userId propagation | userId passed as 5th argument to all 4 non-streaming call sites and via createStreamingResponse closure to streaming | WIRED | Lines 1246, 1265, 1284, 1302 pass userId; line 1143 passes userId in streaming closure |
| chat-with-agent request body | agent_workspaces table | userId from req.json() → fetchAgentWorkspaceBlock | WIRED | userId destructured at line 145; fetchAgentWorkspaceBlock called at line 158 |
| PushOptInBanner | usePushSubscription | `const { isSubscribed, isLoading, subscribe } = usePushSubscription(userId)` | WIRED | Import at line 4; hook called at line 12; subscribe used in Enable button handler |
| ConversationalOnboarding handleTeamAccept() | push_opt_in step | `setStep('push_opt_in')` instead of onComplete() | WIRED | setStep("push_opt_in") at line 866; original onComplete() replaced |
| Dashboard.tsx post-onboarding useEffect | PushOptInBanner | setShowPushOptIn(true) → conditional render of PushOptInBanner | WIRED | setShowPushOptIn(true) at line 127; `{showPushOptIn && user && <PushOptInBanner .../>}` in overview case |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WS-07 | 07-01, 07-02 | All AI calls inject workspace files in order: IDENTITY → SOUL → SOPs → TOOLS → MEMORY (HEARTBEAT only on heartbeat runs) | SATISFIED | heartbeat-runner, orchestrator, and chat-with-agent all use buildWorkspacePrompt with correct ordering; isHeartbeat=true only in heartbeat-runner |
| NOTIF-03 | 07-03, 07-04 | Push notification opt-in via native Web Push API + VAPID surfaced at onboarding completion and Dashboard first load | SATISFIED (automated); NEEDS HUMAN (browser behavior) | PushOptInBanner, onboarding push_opt_in step, Dashboard useEffect all implemented; browser push permission flow requires human verification |

No orphaned requirements found. REQUIREMENTS.md maps WS-07 and NOTIF-03 to Phase 7 — both claimed by plans in this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/placeholder/stub patterns detected in phase artifacts | — | — |

All files verified:
- No empty implementations (`return null` in PushOptInBanner is a legitimate browser-capability guard, not a stub)
- No hand-rolled prompts surviving in heartbeat-runner (old `sanitizedHeartbeat` variable and single-file fetch replaced)
- No console.log-only handlers

---

### Human Verification Required

#### 1. Existing User First-Load Banner

**Test:** Log in as a user who has completed onboarding. Open DevTools > Application > Local Storage, delete `push_opt_in_shown` if present. Reload the dashboard.
**Expected:** A card banner reading "Stay informed on urgent findings" appears above the overview with "Enable notifications" and "Skip for now" buttons. Clicking "Skip for now" dismisses the banner immediately. Reloading again does not show the banner (localStorage key suppresses it).
**Why human:** The `navigator.serviceWorker.ready` promise and `pushManager.getSubscription()` call cannot be exercised by static analysis.

#### 2. Permission Denied Guard

**Test:** In DevTools > Application > Permissions, set Notifications to "Block" for localhost. Delete `push_opt_in_shown` from localStorage. Reload the dashboard.
**Expected:** The banner does NOT appear at all — the `Notification.permission === 'denied'` check fires before any subscription check.
**Why human:** Browser permission state requires live browser environment.

#### 3. Onboarding push_opt_in Step

**Test:** Log in as a new user (or set `onboarding_completed = false` in Supabase profiles). Complete onboarding through the briefing step and wait for the animation to finish.
**Expected:** The push_opt_in step renders showing PushOptInBanner instead of immediately landing on the dashboard. Clicking "Enable notifications" triggers the browser permission dialog. Clicking "Skip for now" or completing the permission dialog navigates the user to the dashboard. The `push_opt_in_shown` localStorage key is set, preventing the Dashboard banner from also appearing.
**Why human:** Requires full browser-side onboarding flow execution.

---

### Gaps Summary

No automated gaps found. All 11 must-have truths are verified against the actual codebase. All 7 commits documented in summaries exist in the git log. All key wiring paths from plan frontmatter are confirmed present and connected.

The only items remaining are the three browser-side verifications listed above, which require a human tester in a real browser environment. These are expected for any Web Push / Notification permission flow and were explicitly flagged as `checkpoint:human-verify` in Plan 04.

---

### Commit Verification

All 7 commits documented in plan summaries confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `0793ee8` | 07-01 Task 1 | Wave 0 scaffolds (Deno mirror + push subscription test stubs) |
| `b7df9c5` | 07-01 Task 2 | heartbeat-runner 6-file workspace injection |
| `406003e` | 07-02 Task 1 | orchestrator workspace wiring |
| `0f71319` | 07-02 Task 2 | chat-with-agent workspace wiring |
| `d586027` | 07-03 Task 1 | PushOptInBanner component |
| `f252ed7` | 07-03 Task 2 | onboarding push_opt_in step |
| `a2c1917` | 07-04 Task 1 | Dashboard first-load push opt-in banner |

---

_Verified: 2026-03-14T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
