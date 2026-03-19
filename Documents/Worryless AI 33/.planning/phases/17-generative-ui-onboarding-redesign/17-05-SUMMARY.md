---
phase: 17-generative-ui-onboarding-redesign
plan: 05
subsystem: ui
tags: [react, supabase, onboarding, tailwind, vitest, testing-library]

# Dependency graph
requires:
  - phase: 17-03
    provides: AgentChatView component (agentType + userId props) used in redesigned briefing step

provides:
  - profiles.business_stage TEXT column with CHECK constraint (starting/running/scaling)
  - BusinessStageSelector 3-card accessible radio component
  - IntegrationSetup component with Google OAuth + browser login tiles + skip link
  - ConversationalOnboarding with 2 new steps (business_stage, integration_setup) and real CoS briefing

affects:
  - LangGraph CoS invocations (business_stage now passed via businessContext)
  - profiles table (new business_stage column)
  - onboarding UX flow (16 steps total vs. 14 previously)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD for React component (RED failing import → GREEN component passes 4 tests)
    - BusinessStageSelector uses role=radiogroup + role=radio for WCAG accessibility
    - IntegrationSetup skip-link pattern (onContinue prop for gate-free progression)
    - fire-and-forget onboarding completion: onboarding_completed set before briefing AgentChatView loads

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260319000004_business_stage.sql
    - worrylesssuperagent/src/components/onboarding/BusinessStageSelector.tsx
    - worrylesssuperagent/src/components/onboarding/IntegrationSetup.tsx
    - worrylesssuperagent/src/__tests__/BusinessStageSelector.test.ts
  modified:
    - worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx

key-decisions:
  - "Migration filename changed from 20260319000001 to 20260319000004_business_stage.sql — 20260319000001 was already taken by agent_audit_log.sql"
  - "handleTeamAccept no longer calls setStep('push_opt_in') after workspace personalization — user now flows through integration_setup -> briefing -> push_opt_in via nextStep()"
  - "Removed 2-second artificial delay from handleTeamAccept — briefing is now real CoS chat, not a spinner that needed progress animation time"
  - "profiles.update() uses 'as any' cast for business_stage field — Supabase generated Database type does not yet reflect the new migration column"
  - "business_stage Continue button disabled when value empty — prevents advancing without selection"

patterns-established:
  - "Skip-link onboarding gate: optional steps expose onContinue prop so user never blocked"
  - "AgentChatView embedded in onboarding briefing — fire-and-forget, Go to Dashboard always available"

requirements-completed: [ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ONB-06]

# Metrics
duration: 10min
completed: 2026-03-19
---

# Phase 17 Plan 05: Onboarding Redesign — Business Stage + Integration Setup + Real CoS Briefing

**Business-stage-aware onboarding with 3-card selector (Starting/Running/Scaling), Google OAuth integration tile, and real CoS AgentChatView briefing replacing static spinner**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-19T10:52:00Z
- **Completed:** 2026-03-19T10:57:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- DB migration adds `profiles.business_stage TEXT CHECK (IN ('starting', 'running', 'scaling'))` with safe `IF NOT EXISTS` guard
- BusinessStageSelector renders 3 accessible radio cards; 4 unit tests covering labels, click selection, selected border state, and ARIA radiogroup
- IntegrationSetup offers Google Workspace OAuth redirect and Social Browser Login tile with skip-link
- ConversationalOnboarding now has 16 steps (up from 14); business_stage saved to profiles; briefing shows real Chief of Staff AgentChatView; onboarding completion is not blocked by briefing success/failure

## Task Commits

1. **Task 1: DB migration + BusinessStageSelector + test** - `cbc2efe` (feat)
2. **Task 2: IntegrationSetup component** - `79386e3` (feat)
3. **Task 3: ConversationalOnboarding rewiring** - `59031f1` (feat)

## Files Created/Modified

- `worrylesssuperagent/supabase/migrations/20260319000004_business_stage.sql` - profiles.business_stage column with CHECK constraint
- `worrylesssuperagent/src/components/onboarding/BusinessStageSelector.tsx` - 3-card accessible selector, STAGES const, Check icon on selected
- `worrylesssuperagent/src/components/onboarding/IntegrationSetup.tsx` - Google OAuth + Social browser tiles, skip-link
- `worrylesssuperagent/src/__tests__/BusinessStageSelector.test.ts` - 4 TDD tests (labels, click, border, radiogroup)
- `worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx` - new steps + imports + profile update + redesigned briefing

## Decisions Made

- Migration filename `20260319000004_business_stage.sql` (not `000001`) because `20260319000001_agent_audit_log.sql` already existed; chosen next sequential slot
- `handleTeamAccept` no longer auto-advances to `push_opt_in` — step flow now continues via `nextStep()` through integration_setup → briefing → push_opt_in
- Removed the 2-second `setTimeout` delay that existed for the old briefing progress animation
- `supabase.from("profiles").update({...} as any)` to include `business_stage` without TypeScript error on the generated Database type (column added by new migration, type not yet regenerated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration filename conflict — changed 20260319000001 to 20260319000004**
- **Found during:** Task 1 (pre-flight check of existing migrations)
- **Issue:** Plan specified filename `20260319000001_business_stage.sql` but `20260319000001_agent_audit_log.sql` already existed
- **Fix:** Renamed target to `20260319000004_business_stage.sql` (next available sequential slot for this date prefix)
- **Files modified:** Created with corrected name; no other file changes needed
- **Verification:** Migration file exists; no filename conflict
- **Committed in:** cbc2efe (Task 1 commit)

**2. [Rule 1 - Bug] handleTeamAccept setStep("push_opt_in") would bypass new steps**
- **Found during:** Task 3 (code review of handleTeamAccept flow)
- **Issue:** After plan changes, handleTeamAccept still called `setStep("push_opt_in")` after workspace personalization, skipping integration_setup and briefing
- **Fix:** Replaced `setStep("push_opt_in")` with `setIsAccepting(false)` — user now navigates forward via nextStep() through new steps
- **Files modified:** ConversationalOnboarding.tsx
- **Verification:** Step array order correct; nextStep() traverses integration_setup → briefing → push_opt_in
- **Committed in:** 59031f1 (Task 3 commit)

**3. [Rule 1 - Bug] Removed 2-second artificial delay from handleTeamAccept**
- **Found during:** Task 3 (refactoring briefing step)
- **Issue:** `await new Promise(resolve => setTimeout(resolve, 2000))` existed for old briefing spinner progress animation; no longer relevant since briefing is now real AgentChatView
- **Fix:** Removed the delay; handleTeamAccept completes faster and user sees integration_setup immediately
- **Files modified:** ConversationalOnboarding.tsx
- **Verification:** No compile errors; tests pass
- **Committed in:** 59031f1 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None — no external service configuration required beyond what exists. Google OAuth provider must already be configured in the Supabase dashboard (pre-existing requirement). The migration `20260319000004_business_stage.sql` must be applied to the Supabase project via `supabase db push` or the Supabase dashboard SQL editor.

## Next Phase Readiness

- Phase 17 is now complete (all 5 plans delivered)
- business_stage is stored to profiles and available for CoS LangGraph businessContext shaping
- AgentChatView briefing is fire-and-forget safe — onboarding completion not gated on CoS response
- The Supabase TypeScript types should be regenerated to include the `business_stage` column for type safety

## Self-Check: PASSED

All files found. All commits verified.

---
*Phase: 17-generative-ui-onboarding-redesign*
*Completed: 2026-03-19*
