# Phase 3: MD Workspace Editor + Agent Marketplace — Research

**Researched:** 2026-03-13
**Domain:** CodeMirror 6 markdown editor, React debounce auto-save, Supabase RLS, agent panel UI architecture
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WS-01 | Each agent's settings panel includes a Workspace tab with 6 sub-tabs (IDENTITY / SOUL / SOPs / MEMORY / HEARTBEAT / TOOLS) | Radix Tabs (already in repo as `@radix-ui/react-tabs`) renders sub-tabs inside a Sheet/Dialog panel; pattern is additive on GenericAgentPanel |
| WS-02 | IDENTITY, SOUL, SOPs, HEARTBEAT, and TOOLS files are user-editable via CodeMirror 6 markdown editor (lazy-loaded) | CodeMirror 6 + `@codemirror/lang-markdown` + React wrapper — dynamic import + React.lazy covers lazy-load requirement |
| WS-03 | MEMORY.md is read-only in the UI — shows a count of entries the agent has written | Read-only textarea or CodeMirror with `editable(false)` extension; count derived from `\n---\n` separator pattern or line count |
| WS-04 | Workspace edits auto-save with 2-second debounce — no explicit save button | useRef setTimeout pattern or `use-debounce` library; Supabase `.update()` on `agent_workspaces` with unique constraint (user_id, agent_type_id, file_type) |
| WS-05 | Each editable workspace file has a "Reset to defaults" action with confirmation dialog | AlertDialog (already in repo as `@radix-ui/react-alert-dialog`); reads `default_{file}_md` from `available_agent_types` catalog; re-saves via debounce flush |
| WS-06 | Server-side sanitization strips prompt injection patterns from workspace content before LLM injection | `sanitize.ts` already exists in `supabase/functions/_shared/sanitize.ts`; call on write edge function or inline before Supabase update |
| WS-07 | All AI calls inject workspace files in order: IDENTITY → SOUL → SOPs → TOOLS → MEMORY (HEARTBEAT only on heartbeat runs) | Ordering is a convention enforced in prompt-builder utility; no library needed — document the required array order |
| MKT-01 | Dashboard has "Add Agent" entry point in sidebar and Team org view that opens the Agent Marketplace panel | Sheet component (already in repo as `vaul` drawer or Radix Dialog); sidebar already accepts `onViewChange` — add "marketplace" view ID |
| MKT-02 | Marketplace displays all 12 catalog agent types with role title, description, key skills, and Add/Active state | Query `available_agent_types` (already GRANT SELECT to authenticated); filter current `user_agents` to derive active set |
| MKT-03 | Adding an agent creates a `user_agents` row, triggers workspace auto-population, and immediately shows agent in sidebar | INSERT into `user_agents` (trigger auto-populates workspaces per Phase 1); call `fetchUserAgents()` after insert; existing sidebar is DB-driven |
| MKT-04 | Users can deactivate an agent (with confirmation); deactivated agents retain workspace data but stop heartbeating and disappear from navigation | UPDATE `user_agents` SET `is_active = false`; dashboard already filters `is_active = true` in `fetchUserAgents()`; workspace rows are preserved |
</phase_requirements>

---

## Summary

Phase 3 is a pure frontend + Supabase-query phase. All database tables, triggers, RLS policies, and the sanitization module required by this phase are already deployed from Phase 1. The work is: (1) build a CodeMirror 6 markdown editor component that is lazy-loaded and wired to `agent_workspaces` with 2-second debounce auto-save, (2) surface that editor inside a Workspace tab inside the agent settings panel, and (3) build an Agent Marketplace panel that drives agent activation/deactivation. No new edge functions, no new migrations, and no new DB schema are needed for Phase 3.

The existing codebase already has all required UI primitives: Radix Tabs, Radix AlertDialog, Radix Dialog/Sheet, Supabase client, TanStack React Query (optional for caching), and Lucide icons. The only new library is CodeMirror 6 (core + markdown language package + basic setup). The sidebar is already DB-driven from Phase 2 — adding an agent from the marketplace immediately reflects because `fetchUserAgents()` already exists and just needs to be called after any `user_agents` mutation.

The one blocker flagged in STATE.md ("HEARTBEAT.md checklist grammar must be defined before building the format validator") is resolvable within this phase's research: HEARTBEAT.md is edited via the same CodeMirror editor as other files — no special format validator is needed in Phase 3. Format validation of HEARTBEAT.md content is a Phase 4 concern (the heartbeat runner validates it server-side). The editor for Phase 3 is a plain markdown editor; the planner does not need to build a grammar validator.

**Primary recommendation:** Add `@codemirror/state`, `@codemirror/view`, `@codemirror/basic-setup`, and `@codemirror/lang-markdown` via npm. Wrap them in a `MarkdownEditor` component loaded via `React.lazy`. Wire auto-save with a `useRef` debounce timer that calls Supabase `upsert` on `agent_workspaces`. Everything else uses existing stack.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@codemirror/state` | ^6.x | CodeMirror state management | Required peer dep for CM6 |
| `@codemirror/view` | ^6.x | CodeMirror editor view | Required peer dep for CM6 |
| `@codemirror/basic-setup` | ^6.x | Sensible defaults (line numbers, key bindings, history) | One-import baseline setup |
| `@codemirror/lang-markdown` | ^6.x | Markdown syntax highlighting | Spec'd in WS-02 |
| `@radix-ui/react-tabs` | already in repo | 6 sub-tabs per agent panel | Already installed |
| `@radix-ui/react-alert-dialog` | already in repo | "Reset to defaults" confirmation | Already installed |
| `@supabase/supabase-js` | ^2.86.0 (already) | DB reads and writes | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@codemirror/theme-one-dark` | ^6.x | Dark theme | If dark mode is desired; optional |
| `use-debounce` | ^10.x | Debounce hook | Alternative to manual useRef timer; either works |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CodeMirror 6 | Monaco Editor | Monaco is 2MB+, CodeMirror 6 tree-shakes to ~80KB for markdown; CM6 is the correct choice given WS-02 explicitly names it |
| CodeMirror 6 | `react-markdown` (display only) | Display-only — does not satisfy the edit requirement |
| Manual useRef debounce | `use-debounce` library | `use-debounce` adds clarity; manual `useRef(setTimeout)` avoids a dep. Either is fine — prefer manual to keep deps minimal |

**Installation:**
```bash
npm install @codemirror/state @codemirror/view @codemirror/basic-setup @codemirror/lang-markdown
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── agents/
│   │   ├── GenericAgentPanel.tsx          # EXISTS — add Workspace tab here
│   │   ├── AgentSettingsPanel.tsx         # NEW — sheet/dialog wrapper with tabs
│   │   └── workspace/
│   │       ├── WorkspaceTabs.tsx          # NEW — 6 sub-tabs, tab routing
│   │       ├── WorkspaceEditor.tsx        # NEW — CodeMirror wrapper, auto-save
│   │       ├── WorkspaceEditorLazy.tsx    # NEW — React.lazy boundary
│   │       └── MemoryTab.tsx             # NEW — read-only + entry count
│   └── marketplace/
│       ├── AgentMarketplace.tsx           # NEW — full panel component
│       └── AgentMarketplaceCard.tsx       # NEW — card with Active/Add button
├── hooks/
│   ├── useAgentWorkspace.ts              # NEW — fetch + save + reset logic
│   └── useAgentMarketplace.ts            # NEW — all 12 types + active set
```

### Pattern 1: CodeMirror 6 React Wrapper
**What:** Controlled CodeMirror 6 instance in a React component using `useEffect` to sync value changes
**When to use:** Any editable workspace tab (IDENTITY, SOUL, SOPs, HEARTBEAT, TOOLS)
**Example:**
```typescript
// Source: CodeMirror 6 official docs — https://codemirror.net/docs/guide/
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "@codemirror/basic-setup";
import { markdown } from "@codemirror/lang-markdown";

interface WorkspaceEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  readOnly?: boolean;
}

export function WorkspaceEditor({ value, onChange, readOnly = false }: WorkspaceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorView.editable.of(!readOnly),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => view.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount once — value sync via transaction below

  // Sync external value changes (e.g., after reset) without re-mounting
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="h-full min-h-[300px] text-sm" />;
}
```

### Pattern 2: Lazy Loading the Editor
**What:** `React.lazy` + `Suspense` so CodeMirror is not in the initial bundle
**When to use:** Workspace tab first render — load only when user opens the tab
**Example:**
```typescript
// WorkspaceEditorLazy.tsx
import { lazy, Suspense } from "react";

const WorkspaceEditor = lazy(() =>
  import("./WorkspaceEditor").then((m) => ({ default: m.WorkspaceEditor }))
);

export function WorkspaceEditorLazy(props: WorkspaceEditorProps) {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading editor...</div>}>
      <WorkspaceEditor {...props} />
    </Suspense>
  );
}
```

### Pattern 3: 2-Second Debounce Auto-Save Hook
**What:** `useRef` timer approach — clears and resets on each keystroke; fires Supabase update on silence
**When to use:** Every `onChange` from the workspace editor
**Example:**
```typescript
// useAgentWorkspace.ts
import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeWorkspaceContent } from "@/lib/sanitize"; // mirror of _shared/sanitize.ts

const DEBOUNCE_MS = 2000;

export function useWorkspaceAutoSave(userId: string, agentTypeId: string, fileType: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (content: string) => {
    const sanitized = sanitizeWorkspaceContent(content);
    await supabase
      .from("agent_workspaces")
      .update({ content: sanitized, updated_by: "user" })
      .eq("user_id", userId)
      .eq("agent_type_id", agentTypeId)
      .eq("file_type", fileType);
  }, [userId, agentTypeId, fileType]);

  const scheduleAutoSave = useCallback((content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(content), DEBOUNCE_MS);
  }, [save]);

  // Flush immediately on panel close (useEffect cleanup)
  const flushSave = useCallback((content: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return save(content);
  }, [save]);

  return { scheduleAutoSave, flushSave };
}
```

### Pattern 4: Reset to Defaults
**What:** Fetch `default_{file_type}_md` from `available_agent_types`, overwrite `agent_workspaces` content, sync editor
**When to use:** User clicks "Reset to defaults" and confirms
**Example:**
```typescript
const handleReset = async () => {
  const { data } = await supabase
    .from("available_agent_types")
    .select(`default_${fileType.toLowerCase()}_md`)
    .eq("id", agentTypeId)
    .single();

  const defaultContent = data?.[`default_${fileType.toLowerCase()}_md`] ?? "";
  setContent(defaultContent);        // triggers editor sync
  await flushSave(defaultContent);   // immediate save, no debounce wait
};
```

### Pattern 5: Agent Marketplace — Derive Active State
**What:** Single query for all 12 catalog types + user's active agent_type_ids; derive "Active" vs "Add" state in UI
**When to use:** Marketplace panel mount
**Example:**
```typescript
// useAgentMarketplace.ts
export function useAgentMarketplace(userId: string) {
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const [{ data: types }, { data: userAgents }] = await Promise.all([
        supabase.from("available_agent_types").select("id, display_name, description, skill_config"),
        supabase.from("user_agents").select("agent_type_id").eq("user_id", userId).eq("is_active", true),
      ]);
      setCatalog(types ?? []);
      setActiveIds(new Set((userAgents ?? []).map((a) => a.agent_type_id)));
    };
    load();
  }, [userId]);

  const activateAgent = async (agentTypeId: string) => {
    await supabase.from("user_agents").insert({ user_id: userId, agent_type_id: agentTypeId });
    setActiveIds((prev) => new Set([...prev, agentTypeId]));
  };

  const deactivateAgent = async (agentTypeId: string) => {
    await supabase.from("user_agents").update({ is_active: false })
      .eq("user_id", userId).eq("agent_type_id", agentTypeId);
    setActiveIds((prev) => { const next = new Set(prev); next.delete(agentTypeId); return next; });
  };

  return { catalog, activeIds, activateAgent, deactivateAgent };
}
```

### Anti-Patterns to Avoid
- **Re-mounting CodeMirror on every value change:** Causes cursor jump and losing undo history. Mount once; sync via `view.dispatch()` transaction instead (see Pattern 1 above).
- **Saving unsanitized content directly:** Always run `sanitizeWorkspaceContent()` before the Supabase `update`. The `_shared/sanitize.ts` already exists for edge functions; mirror it client-side in `src/lib/sanitize.ts`.
- **Opening the agent settings panel and destroying the editor state on tab switch:** Keep a single `content` state per workspace file; switching tabs should not re-fetch (use a record keyed by file_type or lazy-load on tab activation with `unmount={false}` on the Tabs component).
- **Inserting duplicate user_agents rows:** The DB has a UNIQUE constraint on `(user_id, agent_type_id)` — a duplicate insert will throw. Always check `activeIds` before offering the "Add to Team" button, and handle `23505` Postgres error gracefully.
- **Showing deactivated agents in the sidebar:** `fetchUserAgents()` already filters `is_active = true`. Calling it after deactivation is sufficient — no separate UI state needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown editor with undo, bracket matching, line wrapping | Custom `<textarea>` with manual event listeners | CodeMirror 6 (`@codemirror/basic-setup`) | CM6 handles undo history, accessibility, mobile keyboards, large text perf, and cursor edge cases |
| Confirmation dialog | Custom modal with DOM overlay | `@radix-ui/react-alert-dialog` (already installed) | Focus trap, keyboard escape, ARIA labels already handled |
| Tab navigation between 6 sub-tabs | Custom click-state tab switcher | `@radix-ui/react-tabs` (already installed) | Keyboard navigation, ARIA tabpanel roles, correct focus management |
| Preventing prompt injection | Manual string replace | `sanitizeWorkspaceContent()` from `_shared/sanitize.ts` (Phase 1) | Already written and tested; mirror it client-side |
| Popover/sheet for Marketplace | Custom positioned div | Radix Dialog or `vaul` Drawer (both already in repo) | Stack-safe stacking context, focus trap, scroll locking |

**Key insight:** The hardest part of Phase 3 is CodeMirror state management (mount-once, sync-by-transaction, cleanup-on-unmount). Everything else is wiring existing Radix components to Supabase queries.

---

## Common Pitfalls

### Pitfall 1: CodeMirror Cursor Jump on Re-mount
**What goes wrong:** If the component unmounts/remounts on every re-render (e.g., because it's inside a conditional or the parent re-renders), the cursor resets to position 0 after every keystroke.
**Why it happens:** React destroys and recreates the DOM node; CodeMirror loses its selection state.
**How to avoid:** Wrap in `React.memo` or use `useRef` to mount once. Never put `value` in the `useEffect` dependency array that mounts the editor — only sync external changes via dispatch transactions.
**Warning signs:** User reports "cursor keeps jumping to start of file."

### Pitfall 2: Race Condition Between Debounce and Panel Close
**What goes wrong:** User edits content, immediately closes the panel, and the pending debounce timer fires after the component unmounts — save succeeds but the save is attributed to a stale component.
**Why it happens:** `setTimeout` callback holds closure over state that has since been unmounted.
**How to avoid:** `flushSave()` in the `useEffect` cleanup function so panel close always triggers an immediate save before unmount.
**Warning signs:** Edits made right before closing panel disappear on next open.

### Pitfall 3: Supabase Type Safety for `file_type` ENUM
**What goes wrong:** TypeScript may not know `file_type` is a `workspace_file_type` ENUM; passing the wrong string silently fails or throws a 400 from Supabase.
**Why it happens:** The generated types in `types.ts` may not yet include `agent_workspaces` if the type file was generated before Phase 1 migrations ran against the local Supabase instance.
**How to avoid:** Declare a `WorkspaceFileType = 'IDENTITY' | 'SOUL' | 'SOPs' | 'MEMORY' | 'HEARTBEAT' | 'TOOLS'` union type in a local types file and use it consistently. Regenerate `types.ts` after confirming migrations ran.
**Warning signs:** TypeScript shows `agent_workspaces` table not found in generated types.

### Pitfall 4: `available_agent_types` Missing from types.ts
**What goes wrong:** `supabase.from("available_agent_types")` is not typed — all columns return `any`.
**Why it happens:** The `types.ts` file was generated before the Phase 1 migrations ran against the connected Supabase project. Confirmed: `agent_workspaces` and `available_agent_types` are not present in the current `types.ts` snapshot.
**How to avoid:** Run `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts` after confirming Phase 1 migrations are applied to the remote project. Until then, cast with `as any` and add a code comment.
**Warning signs:** TypeScript error "Property 'agent_workspaces' does not exist on type '...'"

### Pitfall 5: "Add Agent" Creating Duplicate user_agents Row
**What goes wrong:** User double-clicks "Add to Team" before the first request resolves; two INSERTs race to the DB; the second hits the UNIQUE constraint and throws.
**Why it happens:** No loading state on the button during the async insert.
**How to avoid:** Disable the "Add to Team" button immediately on first click (optimistic `activeIds` update + `isLoading` flag) and handle the `23505` Postgres error gracefully with a toast.
**Warning signs:** Console error "duplicate key value violates unique constraint user_agents_user_id_agent_type_id_key".

### Pitfall 6: Deactivation Removing Workspace Data
**What goes wrong:** Developer uses DELETE instead of `UPDATE is_active = false`, permanently destroying workspace customizations.
**Why it happens:** MKT-04 says "disappear from navigation" — could be interpreted as delete.
**How to avoid:** Always `UPDATE user_agents SET is_active = false`. Never DELETE a `user_agents` row in Phase 3. Workspace rows in `agent_workspaces` are never touched during deactivation.
**Warning signs:** User reactivates an agent and finds all their custom workspace content gone.

---

## Code Examples

Verified patterns from official sources and project codebase:

### Fetching a Single Workspace File
```typescript
// Pattern used in project: supabase.from().select().eq().single()
const { data, error } = await supabase
  .from("agent_workspaces")
  .select("content, updated_at")
  .eq("user_id", userId)
  .eq("agent_type_id", agentTypeId)
  .eq("file_type", fileType)  // e.g., "IDENTITY"
  .single();
```

### Updating a Workspace File (Debounce Target)
```typescript
await supabase
  .from("agent_workspaces")
  .update({ content: sanitized, updated_by: "user" })
  .eq("user_id", userId)
  .eq("agent_type_id", agentTypeId)
  .eq("file_type", fileType);
```

### Activating an Agent from Marketplace
```typescript
// Trigger will auto-create 6 agent_workspaces rows (Phase 1 trigger)
const { error } = await supabase
  .from("user_agents")
  .insert({ user_id: userId, agent_type_id: agentTypeId });

if (!error) {
  await fetchUserAgents(currentUser); // dashboard sidebar refreshes
}
```

### Deactivating an Agent
```typescript
await supabase
  .from("user_agents")
  .update({ is_active: false })
  .eq("user_id", userId)
  .eq("agent_type_id", agentTypeId);

await fetchUserAgents(currentUser); // sidebar updates immediately
```

### Fetching Default Content for Reset
```typescript
// Column name pattern: default_{file_type_lower}_md
const columnKey = `default_${fileType.toLowerCase()}_md` as const;
const { data } = await supabase
  .from("available_agent_types")
  .select(columnKey)
  .eq("id", agentTypeId)
  .single();
const defaultContent = (data as Record<string, string>)?.[columnKey] ?? "";
```

### Workspace Injection Order (WS-07)
```typescript
// Always construct agent system prompt in this order:
function buildWorkspacePrompt(files: Record<WorkspaceFileType, string>, isHeartbeat = false): string {
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monaco Editor for in-browser editing | CodeMirror 6 for in-browser markdown editing | 2020–2022 shift in ecosystem | CM6 is 5–10x smaller for markdown-only use cases; better mobile support |
| `React.useState` + `useEffect` for debounce | `useRef` timer pattern (or `use-debounce` hook) | Standard since React 16.8 | Avoids stale closure; timer ID stable across renders |
| Global settings panel for all agent config | Per-agent panel with workspace tabs | This project's design | Workspace files are per-agent-per-user; settings must be scoped to selected agent |

**Deprecated/outdated:**
- CodeMirror 5: old API, not what WS-02 specifies. Use CM6 (`@codemirror/state`, `@codemirror/view`).
- `react-codemirror2`: CM5 wrapper, abandoned. Do NOT use.
- `@uiw/react-codemirror`: Popular CM6 wrapper — valid option but adds abstraction; direct CM6 is lighter and gives full control over extension composition.

---

## Open Questions

1. **Which component surface hosts the Workspace tab?**
   - What we know: `GenericAgentPanel` exists and renders each non-default agent. The 5 default agents (chief_of_staff, personal_assistant, accountant, marketer, sales_rep) have dedicated components (`AccountantAgent.tsx`, etc.).
   - What's unclear: Should the Workspace tab be added inside `GenericAgentPanel` directly, or should all agents (including the 5 legacy ones) get a unified `AgentSettingsPanel` sheet that any agent can open?
   - Recommendation: Add a "Settings / Workspace" button to `GenericAgentPanel` that opens a Sheet (`vaul` or Radix Dialog) containing the WorkspaceTabs. The 5 legacy agents can be left as-is for now or given the same sheet via a shared hook. This avoids rewriting 5 components.

2. **Where does "Add Agent" entry point live in the sidebar?**
   - What we know: MKT-01 says "in sidebar under AI Team section and in the Team org view." The sidebar is `DashboardSidebar.tsx` with a `SidebarGroup` labeled "AI Agents."
   - What's unclear: Is it a persistent menu item at the bottom of the AI Agents group, or a floating button?
   - Recommendation: Add a `SidebarMenuItem` with a `Plus` icon and "Add Agent" label at the bottom of the "AI Agents" group, calling `onViewChange("marketplace")`. The planner should define the `marketplace` view ID in `Dashboard.tsx` renderContent.

3. **HEARTBEAT.md grammar format — needed for editor?**
   - What we know: STATE.md flags "HEARTBEAT.md checklist grammar must be defined before building the format validator." The heartbeat runner (Phase 4) reads HEARTBEAT.md and evaluates it.
   - What's unclear: Does Phase 3 need to validate or enforce HEARTBEAT.md format in the editor?
   - Recommendation: No — the Phase 3 editor is a plain markdown editor for all 6 files, including HEARTBEAT. Format validation is Phase 4's concern. The planner should NOT include a grammar validator in Phase 3 plans.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test/ directory found in the project |
| Config file | None — Wave 0 must create vitest.config.ts |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-04 | debounce fires save after 2s of no changes | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts -t "fires after 2s"` | ❌ Wave 0 |
| WS-05 | reset writes default content and flushes save | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts -t "reset to defaults"` | ❌ Wave 0 |
| WS-06 | sanitizer strips injection patterns | unit | `npx vitest run src/__tests__/sanitize.test.ts -t "strips injection"` | ❌ Wave 0 |
| WS-07 | buildWorkspacePrompt orders files correctly | unit | `npx vitest run src/__tests__/buildWorkspacePrompt.test.ts -t "injection order"` | ❌ Wave 0 |
| MKT-03 | activateAgent inserts user_agents row | integration | manual / Supabase local | ❌ manual |
| MKT-04 | deactivateAgent sets is_active=false, preserves workspaces | integration | manual / Supabase local | ❌ manual |
| WS-01 | 6 sub-tabs render for any agent | smoke | visual inspection | ❌ manual |
| WS-02 | CodeMirror mounts and accepts text input | smoke | visual inspection | ❌ manual |
| WS-03 | MEMORY tab is read-only | smoke | visual inspection | ❌ manual |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/sanitize.test.ts` — covers WS-06; test the client-side mirror of sanitize.ts
- [ ] `src/__tests__/useWorkspaceAutoSave.test.ts` — covers WS-04, WS-05; mock Supabase client
- [ ] `src/__tests__/buildWorkspacePrompt.test.ts` — covers WS-07; pure function, no mocks needed
- [ ] `vitest.config.ts` — framework install required; `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `worrylesssuperagent/src/`, `supabase/migrations/`, `supabase/functions/_shared/sanitize.ts`
- `worrylesssuperagent/package.json` — confirmed installed libraries and versions
- `supabase/migrations/20260312000001_create_agent_tables.sql` — confirmed schema: `agent_workspaces`, `user_agents`, `available_agent_types` with exact column names
- `.planning/REQUIREMENTS.md` — confirmed exact requirement text for WS-01..07, MKT-01..04
- `.planning/STATE.md` — confirmed decisions and HEARTBEAT.md grammar concern

### Secondary (MEDIUM confidence)
- CodeMirror 6 official documentation — https://codemirror.net/docs/guide/ — mount-once pattern, EditorView.dispatch for external value sync
- Radix UI Tabs documentation — https://www.radix-ui.com/primitives/docs/components/tabs — confirmed `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` API
- Phase 2 SUMMARY docs (02-04-SUMMARY.md) — confirmed `GenericAgentPanel` pattern, `fetchUserAgents`, `agent:${id}` routing

### Tertiary (LOW confidence)
- General ecosystem knowledge on `use-debounce` package — verify version and API before use; manual `useRef` pattern is safer

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CodeMirror 6 explicitly named in WS-02; all other libs confirmed present in package.json
- Architecture: HIGH — existing code patterns from Phases 1–2 directly dictate structure; GenericAgentPanel, fetchUserAgents, sidebar routing all confirmed by reading source files
- Pitfalls: HIGH — CodeMirror mount-once gotcha is well-documented; duplicate insert and deactivation-vs-delete pitfalls derived from direct schema inspection
- DB schema: HIGH — migration SQL files read directly; table names, column names, UNIQUE constraints confirmed

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (30 days; stack is stable)
