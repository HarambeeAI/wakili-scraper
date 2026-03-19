---
phase: 03-md-workspace-editor-agent-marketplace
plan: 01
subsystem: testing
tags: [vitest, jsdom, typescript, prompt-injection, sanitization]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: sanitize.ts edge function logic to mirror client-side
provides:
  - vitest test infrastructure with jsdom + @/ alias
  - sanitizeWorkspaceContent client mirror (WS-06)
  - buildWorkspacePrompt utility with IDENTITY->SOUL->SOPs->TOOLS->MEMORY->HEARTBEAT ordering (WS-07)
  - failing test stubs for useWorkspaceAutoSave (WS-04, WS-05 placeholders)
affects: [03-02-workspace-editor, 03-03-agent-marketplace, 03-04-heartbeat-format-validator]

# Tech tracking
tech-stack:
  added: [vitest@4, @testing-library/react, @testing-library/jest-dom, jsdom]
  patterns: [TDD pure-function testing, client-mirror pattern for edge function logic]

key-files:
  created:
    - worrylesssuperagent/vitest.config.ts
    - worrylesssuperagent/src/lib/sanitize.ts
    - worrylesssuperagent/src/lib/buildWorkspacePrompt.ts
    - worrylesssuperagent/src/__tests__/sanitize.test.ts
    - worrylesssuperagent/src/__tests__/buildWorkspacePrompt.test.ts
    - worrylesssuperagent/src/__tests__/useWorkspaceAutoSave.test.ts
  modified:
    - worrylesssuperagent/package.json
    - worrylesssuperagent/package-lock.json

key-decisions:
  - "vitest.config.ts excludes supabase/ dir to avoid Deno https: import errors in Node ESM loader"
  - "sanitize.ts is verbatim mirror of edge function — identical pattern list, identical [FILTERED] replacement"
  - "useWorkspaceAutoSave.test.ts uses it.todo stubs so vitest exits 0 without the hook existing yet"

patterns-established:
  - "Client-mirror pattern: client-side lib files mirror edge function logic with sync comment"
  - "Test-first Wave 0 gate: pure utility tests pass before any UI components are built"

requirements-completed: [WS-06, WS-07]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 3 Plan 01: Test Infrastructure + Sanitize + BuildWorkspacePrompt Summary

**vitest with jsdom installed, sanitizeWorkspaceContent client mirror and buildWorkspacePrompt injection-order utility created, 9 tests passing green (6 sanitize + 3 buildWorkspacePrompt) with 2 todo stubs for useWorkspaceAutoSave**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T03:14:33Z
- **Completed:** 2026-03-13T03:18:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed vitest v4 with jsdom environment and @/ alias — Wave 0 test gate established
- Created sanitize.ts: exact client mirror of supabase/functions/_shared/sanitize.ts with 12 injection patterns → [FILTERED] replacement (WS-06)
- Created buildWorkspacePrompt.ts: assembles workspace files in IDENTITY→SOUL→SOPs→TOOLS→MEMORY order with optional HEARTBEAT (WS-07)
- All 9 active tests pass green; useWorkspaceAutoSave.test.ts shows 2 pending todos (not failures); exit code 0

## Task Commits

Each task was committed atomically (inside worrylesssuperagent nested repo):

1. **Task 1: Install vitest and create vitest.config.ts** - `993ce86` (chore)
2. **Task 2: Create sanitize.ts + buildWorkspacePrompt.ts + all test files** - `44902d1` (feat)

## Files Created/Modified
- `worrylesssuperagent/vitest.config.ts` - vitest config: jsdom env, globals, @/ alias, supabase/ excluded
- `worrylesssuperagent/src/lib/sanitize.ts` - client-side prompt injection sanitizer (12 patterns)
- `worrylesssuperagent/src/lib/buildWorkspacePrompt.ts` - workspace file assembly utility with WorkspaceFileType union
- `worrylesssuperagent/src/__tests__/sanitize.test.ts` - 6 WS-06 unit tests
- `worrylesssuperagent/src/__tests__/buildWorkspacePrompt.test.ts` - 3 WS-07 unit tests
- `worrylesssuperagent/src/__tests__/useWorkspaceAutoSave.test.ts` - 2 it.todo stubs (WS-04, WS-05 placeholders)
- `worrylesssuperagent/package.json` - added vitest, @testing-library/react, @testing-library/jest-dom, jsdom to devDependencies
- `worrylesssuperagent/package-lock.json` - lockfile updated

## Decisions Made
- vitest.config.ts excludes `supabase/**` to prevent Node's ESM loader from attempting to resolve `https:` Deno imports in spawn.test.ts
- sanitize.ts is a verbatim copy of the edge function logic — same patterns array, same `[FILTERED]` replacement, same `.trim()` — with a sync comment to keep both files aligned
- useWorkspaceAutoSave.test.ts uses `it.todo` (not `it.skip`) so vitest counts them as pending and exits 0 without the hook being implemented

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added supabase/ exclude to vitest.config.ts**
- **Found during:** Task 1 (vitest setup)
- **Issue:** vitest picked up `supabase/functions/spawn-agent-team/spawn.test.ts` which uses `https:` Deno imports; Node's ESM loader throws "Only URLs with a scheme in: file and data are supported"
- **Fix:** Added `exclude: ['**/node_modules/**', '**/dist/**', '**/supabase/**']` to vitest config
- **Files modified:** worrylesssuperagent/vitest.config.ts
- **Verification:** `npx vitest run` no longer picks up Deno test files; exits 0 after test discovery
- **Committed in:** 993ce86 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to prevent Deno-specific imports crashing the Node test runner. No scope creep.

## Issues Encountered
- `worrylesssuperagent/` is a nested Git repository — commits had to be made inside that repo (not the outer home-directory repo). Files from Task 2 were pre-existing as untracked (created in a previous incomplete session) and were committed normally after verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 0 gate passed: vitest green, sanitizeWorkspaceContent and buildWorkspacePrompt tested
- Plan 03-02 (WorkspaceEditor component) can proceed — buildWorkspacePrompt is importable via @/lib/buildWorkspacePrompt
- sanitize.ts is importable via @/lib/sanitize for Plan 03-02 save handler
- useWorkspaceAutoSave stubs are in place for Plan 03-02 implementation

## Self-Check: PASSED
- worrylesssuperagent/vitest.config.ts: FOUND
- worrylesssuperagent/src/lib/sanitize.ts: FOUND
- worrylesssuperagent/src/lib/buildWorkspacePrompt.ts: FOUND
- worrylesssuperagent/src/__tests__/sanitize.test.ts: FOUND
- worrylesssuperagent/src/__tests__/buildWorkspacePrompt.test.ts: FOUND
- worrylesssuperagent/src/__tests__/useWorkspaceAutoSave.test.ts: FOUND
- Commit 993ce86: FOUND (chore(03-01): install vitest)
- Commit 44902d1: FOUND (feat(03-01): add sanitize.ts, buildWorkspacePrompt.ts, and test files)

---
*Phase: 03-md-workspace-editor-agent-marketplace*
*Completed: 2026-03-13*
