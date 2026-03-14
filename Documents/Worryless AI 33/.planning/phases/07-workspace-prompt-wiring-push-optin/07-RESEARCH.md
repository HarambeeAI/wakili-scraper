# Phase 7: Workspace Prompt Wiring + Push Opt-In — Research

**Researched:** 2026-03-13
**Domain:** LLM system prompt injection (Deno edge functions) + Web Push API (browser + service worker)
**Confidence:** HIGH

---

## Summary

Phase 7 has two independent workstreams. The first wires `buildWorkspacePrompt()` into every production AI call path so agents receive their 6-file workspace context in the mandated injection order (IDENTITY → SOUL → SOPs → TOOLS → MEMORY, with HEARTBEAT appended on heartbeat runs). The second surfaces a push notification opt-in to users at two moments: onboarding completion and the first dashboard load for existing users who never saw the onboarding prompt.

The function `buildWorkspacePrompt()` already exists in `src/lib/buildWorkspacePrompt.ts` and its unit tests pass. The hook `usePushSubscription` already exists in `src/hooks/usePushSubscription.ts` and is already wired into SettingsPage. The service worker `public/sw.js` is already in place. Neither has been connected to the actual production call paths or user-facing opt-in moments yet — that is the entirety of the gap this phase closes.

**Primary recommendation:** For WS-07, create a Deno-compatible mirror of `buildWorkspacePrompt` in `supabase/functions/_shared/`, fetch all workspace files in one SELECT per agent, then replace each call site's hand-rolled system prompt with the combined output. For NOTIF-03, add a `PushOptInBanner` component that calls `usePushSubscription().subscribe()` and mount it in `handleTeamAccept` (onboarding) and in the Dashboard's post-onboarding `useEffect` (existing users), using `localStorage` to suppress re-display after one interaction.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-07 | All AI calls that use workspace content inject files in the order: IDENTITY → SOUL → SOPs → TOOLS → MEMORY (HEARTBEAT only on heartbeat runs) | buildWorkspacePrompt() exists and is tested. Orchestrator and chat-with-agent have no workspace injection at all. heartbeat-runner only injects HEARTBEAT.md. A shared Deno module + one SELECT per call site will satisfy this. |
| NOTIF-03 | "Urgent" heartbeat findings trigger a push notification via native Web Push API + VAPID (no third-party service) | heartbeat-runner already sends VAPID push on urgent. The gap is the opt-in UI: usePushSubscription hook exists, sw.js exists, VITE_VAPID_PUBLIC_KEY env var is referenced. The missing piece is surfacing the subscribe() call at onboarding and first dashboard load. |
</phase_requirements>

---

## Standard Stack

### Core (already in codebase — no new installs)

| Library / API | Location | Purpose | Notes |
|--------------|----------|---------|-------|
| `buildWorkspacePrompt` | `src/lib/buildWorkspacePrompt.ts` | Assembles 6-file workspace into ordered system prompt block | Already unit-tested. Needs Deno mirror in `_shared/`. |
| `sanitizeWorkspaceContent` | `supabase/functions/_shared/sanitize.ts` | Strips prompt injection patterns before LLM injection | Already imported by heartbeat-runner. Orchestrator must also use it. |
| `usePushSubscription` | `src/hooks/usePushSubscription.ts` | Registers service worker, requests permission, upserts to `push_subscriptions` | Wired only into SettingsPage. Must also be wired at onboarding + dashboard first-load. |
| Web Push API (native) | Browser / `public/sw.js` | Receives VAPID push notifications | sw.js already handles `push` events. No third-party SDK on the frontend. |
| `jsr:@negrel/webpush` | `supabase/functions/heartbeat-runner/index.ts` | Sends VAPID push from edge function | Already in heartbeat-runner. No change needed. |
| Vitest + jsdom | `worrylesssuperagent/vitest.config.ts` | Unit test runner | `supabase/` dir excluded. Tests live in `src/__tests__/`. |

### New Deno Module Required

| File to Create | Purpose |
|---------------|---------|
| `supabase/functions/_shared/buildWorkspacePrompt.ts` | Deno-compatible copy of `src/lib/buildWorkspacePrompt.ts` (verbatim mirror pattern established in Phase 3 for sanitize.ts) |

**Installation:** No new npm/Deno packages needed.

---

## Architecture Patterns

### Pattern 1: Mirror pattern for shared Deno modules

Previous phases established that code shared between Deno edge functions and the Vite/React frontend must be duplicated as verbatim mirrors. `sanitize.ts` and `heartbeatParser.ts` are the precedent.

- `src/lib/buildWorkspacePrompt.ts` — consumed by Vitest tests (already exists)
- `supabase/functions/_shared/buildWorkspacePrompt.ts` — consumed by edge functions (must be created)

Both files must stay identical. No import aliasing or dynamic loading between the two environments.

```typescript
// supabase/functions/_shared/buildWorkspacePrompt.ts
// Verbatim mirror of src/lib/buildWorkspacePrompt.ts
// Keep in sync manually — vitest.config.ts excludes supabase/ dir

export type WorkspaceFileType = 'IDENTITY' | 'SOUL' | 'SOPs' | 'MEMORY' | 'HEARTBEAT' | 'TOOLS';

export function buildWorkspacePrompt(
  files: Record<WorkspaceFileType, string>,
  isHeartbeat = false
): string {
  const sections: string[] = [
    `## IDENTITY\n${files.IDENTITY}`,
    `## SOUL\n${files.SOUL}`,
    `## SOPs\n${files['SOPs']}`,
    `## TOOLS\n${files.TOOLS}`,
    `## MEMORY\n${files.MEMORY}`,
  ];
  if (isHeartbeat) {
    sections.push(`## HEARTBEAT\n${files.HEARTBEAT}`);
  }
  return sections.join('\n\n---\n\n');
}
```

### Pattern 2: Workspace fetch helper in orchestrator

The orchestrator must fetch all 5 non-heartbeat workspace files for the relevant agent in a single SELECT, then pass the result to `buildWorkspacePrompt`. The agent key must map to an `agent_type_id` in `agent_workspaces`.

```typescript
// Deno edge function pattern — one query, all files for one agent
async function fetchAgentWorkspace(
  userId: string,
  agentTypeId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from('agent_workspaces')
    .select('file_type, content')
    .eq('user_id', userId)
    .eq('agent_type_id', agentTypeId);

  const files: Record<string, string> = {
    IDENTITY: '', SOUL: '', SOPs: '', TOOLS: '', MEMORY: '', HEARTBEAT: ''
  };
  for (const row of data ?? []) {
    files[row.file_type as string] = sanitizeWorkspaceContent(row.content ?? '');
  }
  return files;
}
```

### Pattern 3: Injection position in orchestrator system prompt

The orchestrator's current system prompt is a static string `orchestratorSystemPrompt`. `buildWorkspacePrompt()` output replaces the `businessKnowledge` injection point, but must sit AFTER the business knowledge block and be labelled as the Chief of Staff workspace context.

The injection order (from WS-07):
1. IDENTITY
2. SOUL
3. SOPs
4. TOOLS
5. MEMORY
6. HEARTBEAT (heartbeat runs only)

In the orchestrator, the Chief of Staff agent type ID is `chief_of_staff`. Workspace injection should use `agentTypeId = 'chief_of_staff'` for orchestrator-level calls, and each specialist's own ID when `executeSpecialist` is called for delegation.

### Pattern 4: `chat-with-agent` function gap

`chat-with-agent/index.ts` contains its own static `agentConfigs` record with hardcoded system prompts. It does not accept a `userId` from the request body (it is stateless). To add workspace injection it must:

1. Accept `userId` in the request body
2. Create a service-role Supabase client internally (same pattern as orchestrator)
3. Fetch workspace files and call `buildWorkspacePrompt`
4. Prepend the workspace block to the existing `systemPrompt`

This is a non-breaking change: if `userId` is absent, fall back to hardcoded prompts.

### Pattern 5: Push opt-in banner — onboarding path

The onboarding `handleTeamAccept` function in `ConversationalOnboarding.tsx` calls `onComplete()` after setting `onboarding_completed = true`. The opt-in prompt should be rendered as a step between `briefing` completion and `onComplete()` — OR as a modal that appears at the `complete` step render, which is simpler and avoids changing the step machine.

The recommended approach: add a `push_opt_in` step immediately after `briefing`, before `onComplete()` is called. This step renders a simple card with "Enable push notifications for urgent agent alerts" + Accept / Skip buttons.

Alternative (simpler): trigger `usePushSubscription().subscribe()` automatically at the end of `handleTeamAccept`, trusting the browser permission dialog to do the work. This is simpler but gives less context to the user. The plan should use the step-based approach for transparency.

### Pattern 6: Push opt-in banner — existing users (first dashboard load)

Dashboard.tsx already has a `useEffect` that runs after `user` is resolved and onboarding is confirmed complete. A second effect should:

1. Check `localStorage.getItem('push_opt_in_shown')` — if already shown, skip
2. Check `Notification.permission` — if already `granted`, skip (already subscribed)
3. If neither condition is met, show a dismissable banner in the dashboard overview
4. On user action (accept or dismiss), write `localStorage.setItem('push_opt_in_shown', '1')`

This avoids showing the banner to users who already opted in via Settings or onboarding.

### Anti-Patterns to Avoid

- **Injecting workspace AFTER business knowledge:** IDENTITY → SOUL → SOPs → TOOLS → MEMORY is the WS-07 mandated order. The business knowledge block is a separate supplemental section, not part of this order.
- **Calling `buildWorkspacePrompt()` from the frontend:** The function lives on the server (edge function) for security. Workspace content is sanitized server-side before LLM injection. The browser-side copy is only for unit testing.
- **Requesting push permission on page load without user gesture:** Browsers block `Notification.requestPermission()` unless triggered by a user gesture (click). The opt-in button must call `subscribe()`, not an auto-trigger on mount.
- **Showing push opt-in to users who denied permission:** `Notification.permission === 'denied'` means the browser will silently ignore future requests. The opt-in UI should check for this and hide itself.
- **Using `push_opt_in_shown` localStorage key without checking subscription state:** Always check existing subscription first (`pushManager.getSubscription()`). If a subscription exists, mark as shown and skip the banner.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workspace file assembly | Custom string concatenation in orchestrator | `buildWorkspacePrompt()` from `_shared/` | Order is already tested; custom concat will drift from WS-07 spec |
| Prompt injection sanitization | New filter patterns | `sanitizeWorkspaceContent` from `_shared/sanitize.ts` | Identical pattern list to what Phase 3 established |
| Push subscription registration | Custom PushManager calls | `usePushSubscription().subscribe()` | urlBase64ToUint8Array and error handling already implemented |
| Service worker | New sw.js | Existing `public/sw.js` | Already handles `push` event with showNotification |
| VAPID push delivery | New delivery code | Existing heartbeat-runner VAPID block | Already wired to `push_subscriptions` table |

---

## Common Pitfalls

### Pitfall 1: file_type case mismatch

`agent_workspaces.file_type` column stores values using the exact case from the `WorkspaceFileType` union: `'IDENTITY'`, `'SOUL'`, `'SOPs'`, `'MEMORY'`, `'HEARTBEAT'`, `'TOOLS'`. The lowercase column key pattern (`default_identity_md`) used in `useAgentWorkspace.handleReset` is different — that refers to columns in `available_agent_types`, not values in `agent_workspaces`.

**How to avoid:** When querying `agent_workspaces.file_type`, use the exact casing from `WorkspaceFileType`.

### Pitfall 2: orchestrator agent key vs agent_type_id

The orchestrator's `baseAgentPrompts` record uses keys like `accountant`, `marketer`, `sales_rep`, `personal_assistant`. These happen to match `agent_type_id` values in `user_agents` and `agent_workspaces`. The Chief of Staff orchestrator itself uses the key `chief_of_staff`. Always verify the key matches the DB ID before fetching workspace.

### Pitfall 3: Workspace rows may not exist for all agents

Not every activated user has workspace rows for every file type. If a user was onboarded before the workspace auto-population trigger existed, some rows may be missing. The fetch helper must handle missing rows gracefully by defaulting to empty strings — `buildWorkspacePrompt` will still produce valid output with empty sections.

**How to avoid:** Initialise the `files` object with empty strings for all 6 keys before the loop, as shown in Pattern 2 above.

### Pitfall 4: userId missing in orchestrator request

The orchestrator receives `userId` from the request body (not JWT). If `userId` is absent, `fetchBusinessKnowledge` is skipped. The same guard applies to workspace fetching — if `userId` is absent, skip workspace fetch and fall back to base prompts. This is already the pattern for `businessKnowledge`.

### Pitfall 5: urlBase64ToUint8Array and applicationServerKey

The VAPID public key from `import.meta.env.VITE_VAPID_PUBLIC_KEY` is URL-safe base64. It must be converted to `Uint8Array` before being passed to `pushManager.subscribe()`. This conversion is already implemented in `usePushSubscription.ts`. Do not bypass or re-implement it.

### Pitfall 6: Notification.permission check in banner

If `Notification.permission === 'denied'`, hide the opt-in banner entirely — do not show a disabled button. Showing a disabled "blocked by browser" state is confusing for non-technical users.

### Pitfall 7: push_subscriptions upsert conflict key

The existing upsert in `usePushSubscription` uses `onConflict: 'user_id,endpoint'`. The `push_subscriptions` table must have a unique constraint on `(user_id, endpoint)`. This was established in Phase 5 when heartbeat-runner was built. Verify this constraint exists before running the opt-in flow.

### Pitfall 8: heartbeat-runner already injects HEARTBEAT.md — avoid double injection

The heartbeat-runner currently fetches only `HEARTBEAT.md` and builds its own system prompt. WS-07 requires it also inject IDENTITY → SOUL → SOPs → TOOLS → MEMORY. This means heartbeat-runner must be updated to fetch all 6 files and call `buildWorkspacePrompt(files, true)` so HEARTBEAT appears last. The current heartbeat-runner hand-rolls the prompt — that needs to be replaced, not extended.

---

## Code Examples

### Workspace fetch + inject in Deno (orchestrator pattern)

```typescript
// Source: inferred from heartbeat-runner pattern + buildWorkspacePrompt API
import { buildWorkspacePrompt } from '../_shared/buildWorkspacePrompt.ts';
import { sanitizeWorkspaceContent } from '../_shared/sanitize.ts';

async function fetchAndBuildWorkspacePrompt(
  userId: string,
  agentTypeId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  isHeartbeat = false
): Promise<string> {
  const { data } = await supabaseAdmin
    .from('agent_workspaces')
    .select('file_type, content')
    .eq('user_id', userId)
    .eq('agent_type_id', agentTypeId);

  const files = {
    IDENTITY: '', SOUL: '', 'SOPs': '', TOOLS: '', MEMORY: '', HEARTBEAT: ''
  };
  for (const row of data ?? []) {
    files[row.file_type as keyof typeof files] =
      sanitizeWorkspaceContent(row.content ?? '');
  }
  return buildWorkspacePrompt(files, isHeartbeat);
}
```

### Push opt-in banner (React)

```typescript
// Source: usePushSubscription hook API + existing Settings pattern
import { usePushSubscription } from '@/hooks/usePushSubscription';

function PushOptInBanner({ userId, onDismiss }: { userId: string; onDismiss: () => void }) {
  const { isSubscribed, isLoading, subscribe } = usePushSubscription(userId);

  // Don't show if push not supported or permission denied
  if (!('PushManager' in window) || Notification.permission === 'denied') {
    return null;
  }
  if (isSubscribed) {
    onDismiss(); // already subscribed — auto-dismiss
    return null;
  }

  return (
    <div className="...banner styles...">
      <p>Enable push notifications to receive urgent alerts from your AI agents.</p>
      <Button onClick={async () => { await subscribe(); onDismiss(); }} disabled={isLoading}>
        Enable notifications
      </Button>
      <Button variant="ghost" onClick={onDismiss}>Skip</Button>
    </div>
  );
}
```

### First-load check in Dashboard.tsx

```typescript
// After onboarding confirmed complete, check if push prompt needed
useEffect(() => {
  if (!user || showOnboarding) return;
  if (!('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;
  if (localStorage.getItem('push_opt_in_shown')) return;

  navigator.serviceWorker.ready
    .then(reg => reg.pushManager.getSubscription())
    .then(sub => {
      if (!sub) setShowPushOptIn(true); // not yet subscribed
    })
    .catch(() => {}); // HTTP dev env — ignore
}, [user, showOnboarding]);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hard-coded agent system prompts per call site | `buildWorkspacePrompt()` centralises injection order | WS-07 compliance; user workspace edits now affect live AI behaviour |
| heartbeat-runner injects only HEARTBEAT.md | All 6 files injected via `buildWorkspacePrompt(files, true)` | Agent identity and SOPs now present on heartbeat runs |
| Push opt-in only accessible in Settings | Opt-in surfaced at onboarding completion and first dashboard load | Dramatically increases push subscription rate |

---

## Open Questions

1. **Does the orchestrator need workspace injection per specialist agent or only for the Chief of Staff?**
   - What we know: `executeSpecialist` calls `buildAgentPrompt(agentKey, businessKnowledge)` which fetches tool boundaries from `available_agent_types`. It does NOT fetch `agent_workspaces`.
   - What's unclear: Should the specialist delegation calls also inject that specialist's workspace files?
   - Recommendation: Yes, per WS-07 ("all AI calls that use workspace content"). Plan 07-01 should wire workspace injection for both the orchestrator prompt (Chief of Staff) and specialist calls. This means `executeSpecialist` needs `userId` passed through.

2. **Should the push opt-in step be a full onboarding step or a modal at the `complete` step?**
   - What we know: The step machine in `ConversationalOnboarding.tsx` already has 12 steps ending in `briefing` → `onComplete()`. Adding a `push_opt_in` step between `briefing` and calling `onComplete()` is clean.
   - What's unclear: Product preference for step vs modal.
   - Recommendation: Add as a lightweight step (no progress bar increment) since the onboarding machine already has the infrastructure. Avoids the modal-above-briefing-animation complexity.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (jsdom environment) |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-07 | `buildWorkspacePrompt` produces IDENTITY→SOUL→SOPs→TOOLS→MEMORY order | unit | `npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | Already exists and passing |
| WS-07 | `buildWorkspacePrompt` appends HEARTBEAT when isHeartbeat=true | unit | `npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | Already exists and passing |
| WS-07 | Deno `_shared/buildWorkspacePrompt.ts` is identical to src copy | manual (file diff) | `diff worrylesssuperagent/src/lib/buildWorkspacePrompt.ts worrylesssuperagent/supabase/functions/_shared/buildWorkspacePrompt.ts` | Wave 0 gap |
| NOTIF-03 | `usePushSubscription.subscribe()` upserts to push_subscriptions | unit (it.todo) | `npx vitest run src/__tests__/usePushSubscription.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/buildWorkspacePrompt.test.ts`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/usePushSubscription.test.ts` — covers NOTIF-03 opt-in subscribe path (it.todo stubs acceptable for Wave 0)
- [ ] `supabase/functions/_shared/buildWorkspacePrompt.ts` — Deno mirror of src/lib copy (needed by Plans 07-01 and 07-02)

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/lib/buildWorkspacePrompt.ts`, `src/__tests__/buildWorkspacePrompt.test.ts`
- Direct codebase inspection — `supabase/functions/orchestrator/index.ts` (lines 1–1050+)
- Direct codebase inspection — `supabase/functions/heartbeat-runner/index.ts`
- Direct codebase inspection — `supabase/functions/chat-with-agent/index.ts`
- Direct codebase inspection — `src/hooks/usePushSubscription.ts`
- Direct codebase inspection — `public/sw.js`
- Direct codebase inspection — `src/components/onboarding/ConversationalOnboarding.tsx`
- Direct codebase inspection — `src/pages/Dashboard.tsx`
- Project STATE.md decisions — mirror pattern, supabase/ vitest exclusion, `cast as any` for untyped tables

### Secondary (MEDIUM confidence)

- Pattern inference from Phase 3 + Phase 6 precedent: `_shared/sanitize.ts` is the established mirror pattern for shared Deno/browser code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is in the existing codebase; no new dependencies
- Architecture: HIGH — mirror pattern, injection order, and push API usage are all established precedents in this codebase
- Pitfalls: HIGH — drawn from actual codebase state (file_type casing, userId routing, missing rows)

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack; only invalidated by major schema changes)
