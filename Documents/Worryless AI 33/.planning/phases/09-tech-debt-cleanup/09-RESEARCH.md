# Phase 9: Tech Debt Cleanup - Research

**Researched:** 2026-03-17
**Domain:** TypeScript dead code removal, module consolidation, React Realtime subscriptions
**Confidence:** HIGH

---

## Summary

Phase 9 contains three surgical cleanup items. Each is a small, low-risk change to a specific file or hook. No new libraries are required and no schema changes are needed. The work is entirely in existing TypeScript/React source files plus one unit-test update.

**Plan 09-01** removes a dead async function (`handleComplete`) and two unreachable `Step` union members (`"processing"` and `"complete"`) from `ConversationalOnboarding.tsx`. The function is defined once and never called anywhere in the codebase. The two Step values it sets are rendered in the switch statement but are never reached by the normal onboarding flow, which terminates via `handleTeamAccept` -> `"briefing"` -> `"push_opt_in"` -> `onComplete()`.

**Plan 09-02** deletes `src/lib/sanitize.ts` (the client-side mirror) and rewires the single existing consumer (`sanitize.test.ts`) to import from the canonical `supabase/functions/_shared/sanitize.ts` — or alternatively collapses both into a new shared location. The two files are byte-for-byte identical in logic (12 identical patterns, same `[FILTERED]` replacement), differing only in a one-line header comment. The test already imports from `@/lib/sanitize`; the import path must be updated.

**Plan 09-03** fixes the hardcoded "Step 11 of 11" string in `AgentTeamSelector.tsx` (the actual step is step 12 of the 11-step prior sequence), and adds a Supabase Realtime postgres_changes subscription to `useTeamData.ts` so that when a `user_agents` row is INSERT-ed (via the Marketplace), the Team view updates without requiring a page navigation away and back.

**Primary recommendation:** Treat each plan as a single-task execution. Each change touches at most two files. Run `npx vitest run` from `worrylesssuperagent/` after each plan to confirm no regressions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | project-configured | Dead code removal, type narrowing | Already in use |
| Supabase Realtime JS | bundled with `@supabase/supabase-js` | postgres_changes subscription | Established pattern in useNotifications.ts |
| vitest | ^4.1.0 | Unit test runner | Existing test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | project version | Supabase client | All DB/Realtime access |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Realtime subscription in useTeamData | Poll with setInterval | Polling is wasteful; Realtime is already used by useNotifications.ts — use the same pattern |
| Delete src/lib/sanitize.ts + re-export from _shared | Create a third shared location in src/utils/ | Simpler to either delete and update import OR keep two files; but two files is the current drift problem — deleting is cleaner |

---

## Architecture Patterns

### Pattern 1: Supabase Realtime postgres_changes subscription (project standard)

**What:** Subscribe to INSERT events on a table filtered by user_id; update local state when a new row arrives.

**When to use:** Any hook that needs live updates from a table without polling.

**Established in:** `src/hooks/useNotifications.ts`

```typescript
// Source: src/hooks/useNotifications.ts (project code, HIGH confidence)
const channel = supabase
  .channel(`user_agents:${userId}`)
  .on(
    'postgres_changes' as any,
    {
      event: 'INSERT',
      schema: 'public',
      table: 'user_agents',
      filter: `user_id=eq.${userId}`,
    },
    (_payload: any) => {
      // re-run fetchData() to refresh the team list
      fetchData();
    },
  )
  .subscribe();

return () => {
  supabase.removeChannel(channel);
};
```

The channel name must be unique per user. The return cleanup must call `supabase.removeChannel(channel)` to avoid channel leak on unmount/re-render.

### Pattern 2: Dead code removal in TypeScript union types

**What:** Remove unused union members from a `type Step = ...` discriminated union and the corresponding unreachable `case` blocks in a `switch` statement, plus the dead function that sets those steps.

**When to use:** When a function is defined but its call site was removed (as happened when the onboarding flow was refactored to use `handleTeamAccept` in Phase 2).

**Checklist for 09-01:**
1. Confirm `handleComplete` has zero call sites (verified: only one occurrence at the definition, line 669).
2. Remove the function body (lines 669–776).
3. Remove `"processing"` and `"complete"` from the `Step` union (lines 54–55).
4. Remove `case "processing":` and `case "complete":` blocks from `renderStep()` (lines 1323–1355).
5. Remove `"processing"` and `"complete"` entries from the step-number map (lines 612–613).
6. Remove the `step !== "complete"` guard in the progress bar render (line 1361 — only `step !== "welcome"` needs to remain, or the guard can be removed if push_opt_in also hides the bar).
7. Check that `progress`, `setProgress`, `statusMessage`, `setStatusMessage` state variables are not used elsewhere — if exclusively used by `handleComplete`, remove them too.
8. Remove unused lucide imports (`Check`) if no longer referenced.

### Pattern 3: Module consolidation (delete mirror, update import)

**What:** The `src/lib/sanitize.ts` file is documented as a "verbatim mirror" of `supabase/functions/_shared/sanitize.ts`. The vitest config excludes `supabase/` from the test runner, which is why the mirror was created. The correct fix is to either (a) delete the mirror and move the test import to a `src/utils/sanitize.ts` copy that vitest CAN reach, or (b) keep the canonical in `_shared/` and make `src/lib/sanitize.ts` a re-export shim.

**Recommended approach (a):** Move `_shared/sanitize.ts` content into `src/lib/sanitize.ts` as the single source of truth for client code, and make the edge function import from a relative path or symlink. However, Deno edge functions cannot import from `src/`. The cleanest split given the vitest exclusion constraint is:
- Keep `supabase/functions/_shared/sanitize.ts` as-is (used by Deno edge functions — heartbeat-runner, etc.)
- Keep `src/lib/sanitize.ts` as-is (used by client workspace editor save)
- Ensure both files are kept in sync by replacing the comment "keep in sync" with a concrete test that imports `sanitizeWorkspaceContent` from both paths and asserts identical output for the same input.

**Alternative approach (b):** Delete `src/lib/sanitize.ts` entirely and create `src/utils/sanitize.ts` that simply re-exports from a relative copy, with the test importing from `@/utils/sanitize`. This does not reduce duplication.

**Decision for 09-02:** The safest, simplest change is to add a cross-check comment/test that pins parity rather than deleting one file (since Deno edge functions cannot import from `src/` and vitest cannot import from `supabase/`). The planner should create a test that imports from `@/lib/sanitize`, asserts the 12 patterns it filters, and documents that the `_shared/` copy is kept in sync manually. The existing `sanitize.test.ts` already covers this — the plan task is to confirm the two files are currently identical, add a comment pinning that status, and optionally document the sync contract in the file header.

### Anti-Patterns to Avoid

- **Adding a Realtime subscription without cleanup:** Always return `() => supabase.removeChannel(channel)` from the useEffect. Failing to do so leaks WebSocket connections across navigation.
- **Subscribing to ALL user_agents changes:** Use `filter: \`user_id=eq.${userId}\`` to scope the subscription; without this the client would receive updates for every user.
- **Re-fetching inside the Realtime callback without a loading guard:** `useTeamData` has a `setLoading(true)` at the top of `fetchData()`. Calling `fetchData()` from within the subscription callback is safe since there is no spinner shown to the user during background refreshes (the state update is fast and optimistic).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live team list refresh | Custom polling interval | Supabase Realtime postgres_changes | Already used in useNotifications.ts; Realtime is push-based, not poll-based |
| Module sync enforcement | Manual "copy both files" process | Single source of truth or explicit test | Two-file sync drifts; tests are more reliable |

---

## Common Pitfalls

### Pitfall 1: Removing `"complete"` from Step union breaks the progress-bar guard

**What goes wrong:** Line 1361 checks `step !== "complete"` to hide the progress bar. If `"complete"` is removed from the union, TypeScript will warn that the comparison is always false. However, the `push_opt_in` step is the new terminal step — the progress bar should also be hidden there (or shown, depending on UX preference).

**How to avoid:** After removing `"complete"` from the union, update the progress-bar guard to also include `"push_opt_in"` if the design intention is to hide the bar at the end. Check current behavior: the bar IS shown on `"push_opt_in"` today. Decide whether to keep it.

**Warning signs:** TypeScript compiler error about comparing `Step` value to a string literal that is no longer in the union.

### Pitfall 2: Removing handleComplete leaves dangling state variables

**What goes wrong:** `handleComplete` uses `progress`, `setProgress`, `statusMessage`, `setStatusMessage`, and `isLoading`/`setIsLoading`. If these are only used by `handleComplete`, removing the function without removing the `useState` calls will produce "variable is declared but never read" warnings (or silently unused state).

**How to avoid:** Grep for each variable name in the file after removing `handleComplete`. If unused, remove the corresponding `useState`.

**Variables to audit:** `progress`, `statusMessage`, `isLoading` (the `setIsLoading` at line 671), `briefingProgress` (check if this is ONLY used by `"briefing"` step).

### Pitfall 3: "Step 11 of 11" — actual count

**What goes wrong:** The label says "Step 11 of 11" but the `nextStep()` array shows 14 entries (welcome through push_opt_in). The `agent_team_selector` step is the 12th step (index 11, 0-based). The prior validator steps are steps 7–10, so `agent_team_selector` is step 11 of 13 navigable steps (excluding `briefing` and `push_opt_in` which are not in the nextStep array).

**Correct label:** The `nextStep()` array has these steps: welcome(0), business_name(1), website(2), industry(3), location(4), description(5), meet_team(6), validator_personal_assistant(7), validator_accountant(8), validator_marketer(9), validator_sales(10), agent_team_selector(11), briefing(12), push_opt_in(13). Total navigable steps before completion = 14. `agent_team_selector` is step 12 of 14 — or if counting only interactive data-entry steps (excluding briefing and push_opt_in) it is step 12 of 12. "Step 12 of 12" is the semantically correct label.

**How to avoid:** Count entries in the `steps` array inside `nextStep()`. There are 14; but `briefing` and `push_opt_in` are non-data-entry transition steps. "Step 12 of 12" matches the REQUIREMENTS.md description "Step 12: Agent Team Selector".

### Pitfall 4: Realtime subscription channel name collision

**What goes wrong:** If `useTeamData` is mounted twice (e.g., in a StrictMode double-render), two channels with the same name will be subscribed. Supabase handles this gracefully with `supabase.channel()` — calling it with the same name returns the same channel object. Still, each useEffect should use a unique channel name if multiple subscriptions on the same table for the same user are expected.

**How to avoid:** Use a channel name that includes the table: `` `team:${userId}` `` or `` `user_agents:${userId}` ``. The cleanup `supabase.removeChannel(channel)` correctly unsubscribes on unmount.

---

## Code Examples

Verified patterns from project source:

### Supabase Realtime subscription cleanup (from useNotifications.ts)
```typescript
// Source: src/hooks/useNotifications.ts (project code)
return () => {
  cancelled = true;
  supabase.removeChannel(channel);
};
```

### Augmenting useTeamData with Realtime (target pattern for 09-03)
```typescript
// Inside the useEffect in useTeamData.ts, after calling fetchData():
const channel = (supabase as any)
  .channel(`team:${userId}`)
  .on(
    'postgres_changes' as any,
    {
      event: 'INSERT',
      schema: 'public',
      table: 'user_agents',
      filter: `user_id=eq.${userId}`,
    },
    () => {
      fetchData();
    },
  )
  .subscribe();

return () => {
  cancelled = true;
  supabase.removeChannel(channel);
};
```

The `cancelled` flag already exists in `useTeamData.ts`'s `fetchData` — but `fetchData` is defined inside `useEffect`, so it is not accessible to the subscription callback. The fix is to hoist `fetchData` or call a refresh function that sets state directly. Simplest: convert `fetchData` to be defined in the outer scope of `useEffect` and reference it from both the initial call and the subscription callback.

### Removing dead handleComplete (skeleton)
```typescript
// BEFORE (lines 54-55 in Step type):
| "processing"
| "complete"
// AFTER: remove these two lines

// BEFORE (line 669): entire handleComplete function (lines 669-776)
// AFTER: delete the function

// BEFORE (lines 1323-1355): case "processing": and case "complete": blocks
// AFTER: delete both cases
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| handleComplete() as terminal onboarding path | handleTeamAccept() -> briefing -> push_opt_in -> onComplete() | Phase 2/7 refactor | handleComplete is dead; remove it |
| src/lib/sanitize.ts as "keep in sync" mirror | Single canonical in _shared/, mirror in src/ | Phase 3 decision | Two files exist; sync is manual/comment-only |
| useTeamData fetches once on mount | useTeamData needs Realtime subscription | Phase 9 goal | After marketplace add, TeamView only refreshes on nav away/back |

---

## Open Questions

1. **Should `"briefing"` and `"push_opt_in"` steps be excluded from the total count in the step label?**
   - What we know: The `nextStep()` steps array has 14 entries including briefing and push_opt_in; those are non-interactive transition steps.
   - What's unclear: Whether "Step 12 of 12" or "Step 12 of 14" is the intended label.
   - Recommendation: Use "Step 12 of 12" — consistent with REQUIREMENTS.md which calls it "Step 12: Agent Team Selector" and implies 12 navigable steps.

2. **For 09-02: should we enforce sync via a test or via module consolidation?**
   - What we know: vitest excludes `supabase/`, Deno cannot import from `src/`. The two-file pattern is the only viable architecture given these constraints.
   - What's unclear: Whether the Phase description "consolidate into a single shared module" means create a third location or accept the two-file split with a sync test.
   - Recommendation: The planner should interpret "consolidate" as "add a test that asserts both files produce identical output" since true single-source is not possible with the current toolchain constraints. This satisfies the quality intent without breaking the build.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

Note: There is no `test` script in `package.json` scripts block. Use `npx vitest run` directly from the `worrylesssuperagent/` directory.

### Phase Requirements -> Test Map

Phase 9 has no new requirements — all items are quality/maintenance. Existing tests validate behavior after changes:

| Item | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| 09-01: dead code removal | ConversationalOnboarding compiles without processing/complete steps | TypeScript compile | `npx tsc --noEmit` | N/A (no dedicated test) |
| 09-02: sanitize sync | sanitizeWorkspaceContent filters all 12 patterns | unit | `npx vitest run src/__tests__/sanitize.test.ts` | YES |
| 09-03: step label fix | AgentTeamSelector shows correct step number | manual visual | N/A | N/A |
| 09-03: Realtime subscription | useTeamData re-fetches on INSERT to user_agents | unit (todo stub) | `npx vitest run src/__tests__/useTeamData.test.ts` | YES (stubs) |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/useTeamData.test.ts` — existing stubs for `useTeamData` describe block need to be filled in (or left as todo; they do not block passing). The `getHeartbeatStatus` tests in the same file already pass.

No new test files need to be created. The existing sanitize.test.ts already provides the primary regression guard for 09-02.

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of `ConversationalOnboarding.tsx` — confirmed `handleComplete` has exactly one occurrence (definition, line 669) and zero call sites
- Direct source code inspection of `src/lib/sanitize.ts` and `supabase/functions/_shared/sanitize.ts` — confirmed byte-for-byte identical logic (12 patterns, same replacement)
- Direct source code inspection of `AgentTeamSelector.tsx` — confirmed hardcoded "Step 11 of 11" on lines 169 and 193
- Direct source code inspection of `useTeamData.ts` — confirmed no Realtime subscription present; only one-time fetch in useEffect
- Direct source code inspection of `useNotifications.ts` — confirmed Realtime pattern (channel, postgres_changes, removeChannel) used in project
- `vitest.config.ts` — confirmed `supabase/**` is excluded from vitest

### Secondary (MEDIUM confidence)
- Supabase Realtime `postgres_changes` API: pattern confirmed by project's own `useNotifications.ts` usage; Supabase JS v2 documented behavior

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Dead code identification: HIGH — confirmed by grep; handleComplete has zero call sites
- sanitize duplicate analysis: HIGH — files are identical, confirmed by direct read
- Step label correction: HIGH — counted nextStep() array entries directly
- Realtime subscription pattern: HIGH — copied from existing useNotifications.ts in project
- Test infrastructure: HIGH — vitest.config.ts and package.json confirmed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain; no moving external dependencies)
