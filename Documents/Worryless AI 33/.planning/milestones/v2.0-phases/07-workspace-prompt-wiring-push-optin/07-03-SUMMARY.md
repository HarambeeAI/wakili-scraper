---
phase: 07-workspace-prompt-wiring-push-optin
plan: 03
subsystem: ui
tags: [react, push-notifications, onboarding, service-worker, web-push]

# Dependency graph
requires:
  - phase: 07-workspace-prompt-wiring-push-optin
    provides: usePushSubscription hook (plan 02) for managing browser push subscriptions
provides:
  - PushOptInBanner reusable component with null-guards for unsupported/denied browsers
  - push_opt_in step wired into ConversationalOnboarding between briefing animation and onComplete()
affects:
  - 07-04 (Dashboard first-load banner will check push_opt_in_shown localStorage flag)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PushOptInBanner null-returns when PushManager absent or permission denied — safe for HTTP dev environments
    - auto-dismiss via useEffect([isSubscribed]) pattern — banner self-clears if already subscribed
    - push_opt_in step at progress number 11 same as briefing — no progress bar increment for post-briefing step
    - fire-and-forget workspace personalization moved before setStep('push_opt_in') so it runs regardless of user push choice

key-files:
  created:
    - worrylesssuperagent/src/components/push/PushOptInBanner.tsx
  modified:
    - worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx

key-decisions:
  - "PushOptInBanner onDismiss sets localStorage push_opt_in_shown=1 so Dashboard Plan 04 banner knows not to re-show"
  - "fire-and-forget workspace personalization block moved before setStep('push_opt_in') — fires regardless of user push accept/skip choice"
  - "push_opt_in step shares currentStepNumber 11 with briefing — progress bar does not advance for the opt-in screen"

patterns-established:
  - "Push opt-in UI: null-guard on PushManager + denied permission before rendering any UI"
  - "Push opt-in UI: useEffect auto-dismiss when isSubscribed becomes true"

requirements-completed: [NOTIF-03]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 7 Plan 03: Push Opt-In Banner and Onboarding Step Summary

**PushOptInBanner component with browser null-guards wired as push_opt_in step between briefing animation and onComplete() in ConversationalOnboarding**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-14T08:22:26Z
- **Completed:** 2026-03-14T08:30:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `PushOptInBanner.tsx` in new `src/components/push/` directory with correct null-guards for unsupported browsers and denied permission state
- Auto-dismiss via `useEffect([isSubscribed])` so banner self-clears if user is already subscribed
- Inserted `push_opt_in` step into `ConversationalOnboarding.tsx` Step union, currentStepNumber map, nextStep array, and renderStep() switch
- `handleTeamAccept` now calls `setStep("push_opt_in")` instead of `onComplete()` after briefing animation; fire-and-forget personalization block moved before that call
- `onDismiss` callback sets `localStorage.setItem("push_opt_in_shown", "1")` for Plan 04 banner coordination before calling `onComplete()`
- TypeScript build: 0 errors. Full vitest suite: 51 passed, 0 failed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PushOptInBanner component** - `d586027` (feat)
2. **Task 2: Add push_opt_in step to onboarding flow** - `f252ed7` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `worrylesssuperagent/src/components/push/PushOptInBanner.tsx` - Reusable push opt-in card with BellRing icon, Enable/Skip buttons, null-guards
- `worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx` - push_opt_in step added between briefing and onComplete()

## Decisions Made
- `onDismiss` sets `localStorage.setItem("push_opt_in_shown", "1")` — coordinates with Dashboard Plan 04 to avoid re-showing the banner after onboarding
- Fire-and-forget workspace personalization block moved before `setStep("push_opt_in")` so it fires regardless of push accept/skip choice
- `push_opt_in` shares `currentStepNumber: 11` with briefing — no progress bar increment for the opt-in screen (user is already "done")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PushOptInBanner is reusable; Plan 04 (Dashboard first-load banner) can import it directly
- `localStorage.getItem("push_opt_in_shown")` flag is set on both accept and skip paths, ready for Plan 04 to gate the dashboard banner
- NOTIF-03 requirement fulfilled

---
*Phase: 07-workspace-prompt-wiring-push-optin*
*Completed: 2026-03-14*
