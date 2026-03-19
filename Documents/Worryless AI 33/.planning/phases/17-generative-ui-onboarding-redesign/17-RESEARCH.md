# Phase 17: Generative UI + Onboarding Redesign - Research

**Researched:** 2026-03-19
**Domain:** React generative UI, SSE streaming, TanStack Table, Recharts, onboarding flow redesign
**Confidence:** HIGH

---

## Summary

Phase 17 is the frontend layer that connects the fully-built LangGraph backend (Phases 10–16) to the user. Every agent tab is replaced by a chat interface (`AgentChatView`) that renders dynamic inline components from `uiComponents[]` returned in AgentState. The key infrastructure — SSE proxy, HITL interrupt/resume, thread manager, AgentState with `uiComponents` and `pendingApprovals` accumulators — is fully built and working. This phase is primarily a frontend build.

The current `/invoke` endpoint on the LangGraph server returns JSON only (no streaming). Phase 17 requires adding a `/invoke/stream` endpoint that uses `graph.stream({ streamMode: "messages" })` to emit SSE events with text deltas and UI component directives. The frontend `useAgentChat` hook consumes this SSE stream and drives all rendering.

The onboarding flow in `ConversationalOnboarding.tsx` needs two new steps (`business_stage`, `integration_setup`) and a redesigned `briefing` step that shows a real CoS chat via `AgentChatView` instead of a spinner. A DB migration adds `business_stage TEXT` to the `profiles` table — this column does not currently exist.

**Primary recommendation:** Build in this order: (1) SSE streaming endpoint on LangGraph server, (2) `useAgentChat` hook, (3) `AgentChatView` + primitive subcomponents, (4) `GenerativeUIRenderer` + domain components, (5) HITL approval card, (6) thread sidebar, (7) onboarding steps. Each layer depends on the previous.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GUI-01 | `AgentChatView` replacing all static agent dashboards | AgentChatView component spec in UI-SPEC.md; Dashboard.tsx switch cases for accountant/marketer/sales/assistant are the replacement targets |
| GUI-02 | `GenerativeUIRenderer` mapping component types to React components | UIComponent interface already defined in agent-state.ts; 13-type dispatch table specified in UI-SPEC.md |
| GUI-03 | Chart components via Recharts (bar, line, pie, area, gauge, sparkline) | recharts ^2.15.4 already in package.json; shadcn chart component already installed |
| GUI-04 | Data table components via @tanstack/react-table | NOT yet in package.json; must `npm install @tanstack/react-table`; latest version 8.21.3 |
| GUI-05 | Dynamic form components from agent tool schemas | shadcn Form + react-hook-form already installed; schema passed as `props.schema` in UIComponent |
| GUI-06 | Approval request cards with Approve/Reject/Discuss for HITL | `interruptForApproval` + `/invoke/resume` endpoint exist; frontend needs HITLApprovalCard + resume call |
| GUI-07 | Domain-specific: Pipeline Kanban, Content Calendar, Invoice Tracker, Calendar Timeline, Meeting Brief | 5 bespoke components; no external library needed; tanstack table for table variants |
| GUI-08 | SSE streaming with text deltas + UI components + tool indicators | `/invoke` currently returns JSON only; need new `/invoke/stream` SSE endpoint using graph.stream() |
| GUI-09 | `useAgentChat` hook managing threads, streaming, UI, approvals | New hook; builds on useLangGraphFlag + getChatEndpoint patterns; manages ReadableStream via getReader() |
| GUI-10 | Thread list sidebar for past conversations per agent | `/threads/:userId?agent_type=` endpoint already implemented; frontend fetches and renders |
| ONB-01 | Business stage question: Starting / Running / Scaling | New `business_stage` step in onboarding; DB migration required for `profiles.business_stage` column |
| ONB-02 | Stage-specific follow-up questions | Follow-up copy varies by selected stage; no new DB columns needed |
| ONB-03 | Agent team recommendation via CoS LangGraph graph | `agent_team_selector` step already exists; "uses LangGraph CoS graph" means call `/invoke` to get CoS recommendation |
| ONB-04 | Integration setup: Google OAuth for PA, browser login for Marketer | New `integration_setup` step; Google OAuth wired in Phase 15; Marketer browser login wired in Phase 14 |
| ONB-05 | First real briefing from CoS as first chat message | Replace spinner `briefing` step with `AgentChatView` restricted to CoS thread; call `/invoke` with briefing message |
| ONB-06 | Business stage stored in profiles, shapes agent interactions | `profiles.business_stage` migration; pass to LangGraph via `businessContext` on every invoke |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^2.15.4 | Bar, Line, Pie, Area charts in chat | Already installed; shadcn chart wraps it |
| @tanstack/react-table | ^8.21.3 (latest) | Headless data tables (P&L, invoices, pipeline) | NOT installed yet; the only missing dep |
| react-markdown | ^10.1.0 | Render LLM markdown in chat bubbles | Already installed |
| tailwindcss-animate | ^1.0.7 | Message bubble enter, cursor pulse, sidebar slide | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn ScrollArea | installed | Chat message scroll container | All scrollable areas inside chat |
| shadcn Skeleton | installed | Loading state before stream starts | Pre-stream placeholder bubble |
| lucide-react | ^0.462.0 | Tool indicator icons, HITL warning icon | All icon usage |
| @radix-ui/react-radio-group | installed | BusinessStageSelector role="radiogroup" | ONB-01 option cards |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-table | ag-grid | ag-grid is massive (300KB+); tanstack is headless, ~15KB |
| recharts | victory / nivo | recharts is already installed and shadcn chart is built on it |
| tailwindcss-animate | framer-motion | UI-SPEC explicitly prohibits Framer Motion |

### Installation

```bash
# From worrylesssuperagent/
npm install @tanstack/react-table
```

No other new frontend dependencies needed — all others are already in package.json.

**Version verified:** `@tanstack/react-table` latest is 8.21.3 (npm registry, 2026-03-19).

---

## Architecture Patterns

### Recommended Project Structure

New files to create this phase:

```
src/
├── components/
│   ├── chat/
│   │   ├── AgentChatView.tsx          # GUI-01: full-page chat (replaces static dashboards)
│   │   ├── GenerativeUIRenderer.tsx   # GUI-02: type -> component dispatcher
│   │   ├── HITLApprovalCard.tsx       # GUI-06: inline approve/reject/discuss
│   │   ├── ToolIndicator.tsx          # GUI-08: streaming tool pill
│   │   ├── StreamingCursor.tsx        # GUI-08: SSE delta cursor
│   │   └── ThreadListSidebar.tsx      # GUI-10: past threads per agent
│   ├── ui/
│   │   ├── InlinePLTable.tsx          # GUI-07: P&L table (recharts + tanstack)
│   │   ├── PipelineKanban.tsx         # GUI-07: deal status columns
│   │   ├── ContentCalendarGrid.tsx    # GUI-07: weekly post grid
│   │   ├── InvoiceTrackerTable.tsx    # GUI-07: open/paid invoices
│   │   ├── CalendarTimelineView.tsx   # GUI-07: PA day-view events
│   │   └── MeetingBriefCard.tsx       # GUI-07: attendees + agenda + docs
│   └── onboarding/
│       ├── ConversationalOnboarding.tsx  # MODIFIED: add business_stage + integration_setup + briefing redesign
│       ├── BusinessStageSelector.tsx     # ONB-01: Starting/Running/Scaling 3-card selector
│       └── OnboardingProgressBar.tsx     # replaces numeric step label
├── hooks/
│   └── useAgentChat.ts               # GUI-09: thread + stream + UI + approvals
supabase/
└── migrations/
    └── 20260319000001_business_stage.sql  # ONB-06: ADD COLUMN business_stage TEXT to profiles
langgraph-server/src/
└── index.ts                          # MODIFIED: add POST /invoke/stream SSE endpoint
```

### Pattern 1: SSE Streaming Endpoint (GUI-08)

**What:** The LangGraph server exposes `POST /invoke/stream` using `graph.stream()` with `streamMode: "messages"`. The Express handler writes `text/event-stream` response with SSE events for text deltas, tool starts, UI components, and the final state.

**When to use:** Every user chat message — replaces the non-streaming `POST /invoke` for the chat UI.

**Example:**

```typescript
// Source: LangGraph JS streaming docs + project index.ts pattern
// POST /invoke/stream — SSE streaming endpoint
app.post("/invoke/stream", async (req, res) => {
  // ... validate message, user_id, thread_id, agent_type (same as /invoke) ...

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const config = { configurable: { thread_id: threadId } };

  try {
    const stream = await graph.stream(
      { messages: [new HumanMessage(message)], userId: user_id, agentType, isProactive: false },
      { ...config, streamMode: "messages" }
    );

    for await (const [messageChunk, metadata] of stream) {
      const content = messageChunk.content;
      if (typeof content === "string" && content) {
        // Text delta
        res.write(`data: ${JSON.stringify({ type: "delta", content })}\n\n`);
      }
      // On stream end, send final state (uiComponents, pendingApprovals, responseMetadata)
      // by subscribing to streamMode: "values" in parallel or emitting at graph end
    }

    // After stream: fetch final state to emit uiComponents and pendingApprovals
    const finalState = await graph.getState(config);
    const uiComponents = finalState.values?.uiComponents ?? [];
    const pendingApprovals = finalState.values?.pendingApprovals ?? [];
    const responseMetadata = finalState.values?.responseMetadata ?? null;

    if (uiComponents.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "ui_components", components: uiComponents })}\n\n`);
    }
    if (pendingApprovals.length > 0) {
      res.write(`data: ${JSON.stringify({ type: "pending_approvals", approvals: pendingApprovals })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: "done", metadata: responseMetadata, thread_id: threadId })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Unknown" })}\n\n`);
    res.end();
  }
});
```

**SSE event taxonomy (what the frontend hook consumes):**

| Event `type` | Payload | When emitted |
|-------------|---------|-------------|
| `delta` | `{ content: string }` | Each LLM token from `messageChunk.content` |
| `tool_start` | `{ tool_name: string }` | When LangGraph enters a tool node (via metadata.langgraph_node) |
| `ui_components` | `{ components: UIComponent[] }` | After stream ends, from finalState |
| `pending_approvals` | `{ approvals: PendingApproval[] }` | After stream ends, when HITL interrupt fired |
| `done` | `{ metadata, thread_id }` | Stream complete signal |
| `error` | `{ message: string }` | Stream failure |

**Key insight:** `graph.stream({ streamMode: "messages" })` yields `[messageChunk, metadata]` tuples. `metadata.langgraph_node` tells you which node is executing — use this to emit `tool_start` events for the ToolIndicator. After the for-await loop completes, call `graph.getState(config)` to read the final accumulated `uiComponents[]` and `pendingApprovals[]`.

### Pattern 2: `useAgentChat` Hook (GUI-09)

**What:** React hook encapsulating all chat state: messages array, active thread, streaming state, accumulated UI components, pending approvals.

**When to use:** Instantiated once per `AgentChatView` mount, passing `agentType` and `userId`.

```typescript
// Source: existing ChatInterface.tsx SSE reader pattern + useLangGraphFlag pattern
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  uiComponents?: UIComponent[];
  pendingApproval?: PendingApproval;
}

export function useAgentChat({ userId, agentType }: { userId: string; agentType: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const { useLangGraph } = useLangGraphFlag();

  const sendMessage = useCallback(async (text: string) => {
    // 1. Add user message optimistically
    // 2. POST to /invoke/stream (if useLangGraph) or /invoke (legacy)
    // 3. ReadableStream via getReader() — same pattern as existing ChatInterface.tsx
    // 4. Parse SSE events: delta -> append to streaming message, tool_start -> setActiveToolName
    // 5. On done event: finalise message, append uiComponents, handle pendingApprovals
    // 6. Register thread if new
  }, [userId, agentType, activeThreadId, useLangGraph]);

  const approveHITL = useCallback(async (threadId: string, approved: boolean, feedback?: string) => {
    // POST to /langgraph-proxy/invoke/resume with { thread_id, approved, feedback }
    // Then immediately resume streaming to get the continuation response
  }, []);

  // Load threads on mount
  useEffect(() => {
    // GET /langgraph-proxy/threads/:userId?agent_type=agentType
  }, [userId, agentType]);

  return { messages, threads, activeThreadId, setActiveThreadId, isStreaming, activeToolName, sendMessage, approveHITL };
}
```

### Pattern 3: `GenerativeUIRenderer` Dispatch (GUI-02)

**What:** Pure dispatcher component. Receives `UIComponent[]` from the message and renders the matching React component.

```typescript
// Source: UI-SPEC.md type mapping table
export function GenerativeUIRenderer({ components }: { components: UIComponent[] }) {
  return (
    <div className="mt-4 space-y-3">
      {components.map((comp, i) => {
        switch (comp.type) {
          case "pl_report": return <InlinePLTable key={i} {...comp.props} />;
          case "cashflow_chart": return <AreaChart key={i} {...comp.props} />;
          case "pipeline_kanban": return <PipelineKanban key={i} {...comp.props} />;
          case "data_table": return <DataTable key={i} {...comp.props} />;
          case "hitl_approval": return <HITLApprovalCard key={i} {...comp.props} />;
          // ... all 13 cases from UI-SPEC.md ...
          default: return null;
        }
      })}
    </div>
  );
}
```

### Pattern 4: TanStack Table v8 in Chat (GUI-04)

**What:** Headless table inside an assistant bubble. Max 8 rows visible, ScrollArea overflow.

```typescript
// Source: https://tanstack.com/table/v8/docs/framework/react/react-table
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { ScrollArea } from "@/components/ui/scroll-area";

function DataTable({ data, columns: colDefs }: { data: Record<string, unknown>[]; columns: ColDef[] }) {
  const columns = useMemo(() => colDefs.map(c => ({
    accessorKey: c.key,
    header: c.label,
  })), [colDefs]);

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <ScrollArea className="max-h-[280px]">  {/* 8 rows × 35px */}
      <table className="w-full text-sm">
        <thead>{table.getHeaderGroups().map(hg => ...)}</thead>
        <tbody>{table.getRowModel().rows.map(row => ...)}</tbody>
      </table>
    </ScrollArea>
  );
}
```

### Pattern 5: Dashboard Agent Tab Replacement (GUI-01)

**What:** In `Dashboard.tsx` `renderContent()`, replace the 4 static agent cases with `AgentChatView` instances keyed by agent type.

**Before (existing):**
```typescript
case "accountant": return <AccountantAgent />;
case "marketer": return <MarketerAgent />;
case "sales": return <SalesRepAgent />;
case "assistant": return <PersonalAssistantAgent />;
```

**After:**
```typescript
case "accountant":
case "marketer":
case "sales":
case "assistant":
  return <AgentChatView agentType={viewToAgentType[activeView]} userId={user.id} />;
```

The static components (`AccountantAgent`, `MarketerAgent`, `SalesRepAgent`, `PersonalAssistantAgent`) are **not deleted** — they remain as dead code until a future cleanup phase. This avoids risk.

### Pattern 6: DB Migration for `business_stage` (ONB-06)

`profiles.business_stage` does not exist yet (confirmed — no migration references it). Needs a new migration:

```sql
-- 20260319000001_business_stage.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_stage TEXT
  CHECK (business_stage IN ('starting', 'running', 'scaling'));

COMMENT ON COLUMN public.profiles.business_stage IS
  'Business maturity stage selected during onboarding. Values: starting, running, scaling. NULL = not yet set (pre-Phase 17 users).';
```

### Pattern 7: Onboarding Step Insertion

The `ConversationalOnboarding.tsx` step array is modified by inserting two new steps and modifying one existing step. The current `Step` type union and `nextStep()` array both need updating.

New step sequence (insert positions):
- After `"website"` (index 2) → insert `"business_stage"` (new, ONB-01/02)
- After `"agent_team_selector"` (index 11) → insert `"integration_setup"` (new, ONB-04)
- `"briefing"` step stays but its render is replaced with `AgentChatView` (ONB-05)

State additions needed in `ConversationalOnboarding`:
```typescript
const [businessStage, setBusinessStage] = useState<"starting" | "running" | "scaling" | "">("");
```

The `handleTeamAccept` Supabase update must include `business_stage: businessStage` in the profiles update.

### Anti-Patterns to Avoid

- **Deleting static agent components on day 1:** They are referenced in Dashboard.tsx. Replace the routing first, leave files in place.
- **Using graph.invoke() for streaming:** `graph.invoke()` awaits the full result — no SSE. Use `graph.stream({ streamMode: "messages" })`.
- **Reading uiComponents inside the messages stream:** `streamMode: "messages"` only streams message tokens. Read `uiComponents` from `graph.getState()` after the stream ends, or add `streamMode: ["messages", "values"]` and filter for value updates.
- **Emitting HITL approvals before stream ends:** The `pendingApprovals` accumulator in AgentState fills during graph execution. Read it from final state post-stream, same as `uiComponents`.
- **Nesting `AgentChatView` in `ConversationalOnboarding` briefing step without a userId prop:** The briefing step runs inside onboarding before the dashboard, so `userId` is available from `ConversationalOnboarding` props. Pass it down.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable/filterable tables | Custom table component | @tanstack/react-table | Handles column sorting, cell rendering, row models; ~10 lines vs 200+ |
| Chart rendering | Canvas drawing code | Recharts (already installed) | SSR-safe, React-native, already configured in project |
| SSE parsing in the hook | Manual byte-splitter | ReadableStreamDefaultReader + TextDecoder | Existing `ChatInterface.tsx` already has the correct `buffer.split("\n")` pattern — copy it verbatim |
| Markdown in chat | String sanitization + HTML | react-markdown (already installed) | XSS-safe, handles all CommonMark |
| Scroll-to-bottom | Vanilla DOM scrollTop | useEffect on messages length + scrollRef.current.scrollTop = scrollRef.current.scrollHeight | Existing ChatInterface.tsx has this exact pattern |

**Key insight:** The SSE reading pattern (ReadableStream reader, TextDecoder, buffer accumulation) is already production-proven in `ChatInterface.tsx`. The `useAgentChat` hook should transplant this exact pattern, not invent a new one.

---

## Common Pitfalls

### Pitfall 1: `uiComponents` is an Accumulator — It Grows Across Turns

**What goes wrong:** If you read `uiComponents` from AgentState after every turn without clearing it, the array contains ALL components from ALL past turns. Rendering them all causes duplicate charts.

**Why it happens:** The AgentState `uiComponents` reducer is `(prev, next) => [...prev, ...next]` — intentional for HITL multi-turn. But the frontend must only render the components added in the CURRENT turn.

**How to avoid:** In the `/invoke/stream` endpoint, after the stream loop, call `graph.getState()` to read the FULL accumulated array, but track the `message_count` before and after — or emit a snapshot per turn by clearing component tracking per SSE session. Simpler: store the length before invoke, take the slice `uiComponents.slice(prevLength)` in the frontend hook.

**Warning signs:** P&L table appears twice after second financial question.

### Pitfall 2: `graph.stream()` with `streamMode: "messages"` Emits ALL Messages, Including HumanMessage

**What goes wrong:** The for-await loop receives the user's own `HumanMessage` back as the first chunk. If you render it, the user message appears duplicated.

**Why it happens:** `streamMode: "messages"` streams all message state changes, including the input message being added.

**How to avoid:** Check `messageChunk instanceof AIMessage` (or check `messageChunk._getType() === "ai"`) before emitting delta events.

**Warning signs:** User sees their own message appear a second time in the assistant bubble.

### Pitfall 3: HITL Interrupt Causes `graph.stream()` to End Normally

**What goes wrong:** When `interrupt()` is called in the graph, the stream ends without an error. The frontend sees the `done` event but with no AI response text — just a pending approval.

**Why it happens:** `interrupt()` pauses execution at a checkpoint. From the stream's perspective, the graph reached a terminal state (the interrupt checkpoint). It's not an error.

**How to avoid:** The `/invoke/stream` endpoint must check for interrupt state: after the stream ends, call `graph.getState()` and check if `state.tasks` has any interrupted tasks. If yes, emit `{ type: "pending_approvals", ... }` from `pendingApprovals` in final state. The frontend renders the `HITLApprovalCard` on receiving this event.

**Warning signs:** User sees empty assistant bubble with no text and no approval card after a HITL action.

### Pitfall 4: `@tanstack/react-table` Columns Must Be Stable (useMemo)

**What goes wrong:** Column definitions re-created on every render cause infinite re-renders in `useReactTable`.

**Why it happens:** `useReactTable` uses reference equality for column definitions. A new array on every render triggers a table re-render cycle.

**How to avoid:** Always wrap column definitions in `useMemo`. This is documented but commonly missed.

**Warning signs:** React "too many re-renders" error when a DataTable is inside a chat bubble.

### Pitfall 5: `business_stage` Not Included in LangGraph `businessContext`

**What goes wrong:** The LangGraph agents have no knowledge of business stage even after ONB-06 is implemented, because the `/invoke` call doesn't pass it.

**Why it happens:** The LangGraph server reads `businessContext` from the request body, but the frontend hook only passes the basic business profile fields it already knows about.

**How to avoid:** The `useAgentChat` hook (or the `AgentChatView` component) must load `profiles.business_stage` from Supabase and include it in the request body as part of `businessContext`.

**Warning signs:** CoS briefing step produces generic advice that ignores stage context.

### Pitfall 6: The Briefing Step Must Not Re-trigger Onboarding Complete

**What goes wrong:** The redesigned `briefing` step calls `/invoke` to get the CoS briefing. If this call fails, the user is stuck in an infinite loop if error handling redirects back to `briefing`.

**Why it happens:** `handleTeamAccept` sets `onboarding_completed = true` in profiles before transitioning to `briefing`. If the briefing call fails, the user's profile says onboarding is complete but they never saw the briefing.

**How to avoid:** The briefing step must not block onboarding completion on the LangGraph call. The CoS briefing should be fire-and-forget — if it fails, the user proceeds to dashboard and sees an empty CoS thread. Onboarding `onComplete()` fires regardless of briefing success.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### SSE Reader Pattern (from existing ChatInterface.tsx)

```typescript
// Source: worrylesssuperagent/src/components/chat/ChatInterface.tsx lines 253-303
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        const data = JSON.parse(jsonStr);
        if (data.type === "delta") {
          // append to streaming message content
        } else if (data.type === "tool_start") {
          // update ToolIndicator
        } else if (data.type === "ui_components") {
          // attach to message
        } else if (data.type === "pending_approvals") {
          // render HITLApprovalCard
        } else if (data.type === "done") {
          // finalize message
        }
      } catch { /* ignore incomplete JSON */ }
    }
  }
}
```

### TanStack Table Minimal Pattern

```typescript
// Source: https://tanstack.com/table/v8/docs/framework/react/react-table
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table";

function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id}>{hg.headers.map(h => (
            <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
          ))}</tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>{row.getVisibleCells().map(cell => (
            <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
          ))}</tr>
        ))}
      </tbody>
    </table>
  );
}
```

### HITL Resume Call

```typescript
// Source: worrylesssuperagent/langgraph-server/src/index.ts — /invoke/resume endpoint
// Frontend equivalent inside useAgentChat.approveHITL():
const response = await fetch(`${supabaseUrl}/functions/v1/langgraph-proxy/invoke/resume`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({ thread_id: activeThreadId, approved, feedback }),
});
```

### Business Stage DB Migration

```sql
-- Source: project migration pattern (existing migrations in supabase/migrations/)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_stage TEXT
  CHECK (business_stage IN ('starting', 'running', 'scaling'));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static agent dashboards (AccountantAgent.tsx etc.) | Chat-first AgentChatView | Phase 17 | All agent interaction is now conversational |
| Non-streaming `/invoke` returns full JSON | `/invoke/stream` SSE endpoint yields tokens | Phase 17 | Users see real-time response building |
| Spinner `briefing` step in onboarding | AgentChatView with real CoS SSE stream | Phase 17 | First user experience is an actual agent conversation |
| No business stage awareness | `profiles.business_stage` + context injection | Phase 17 | Agent recommendations shaped by startup stage |

**Still current (do not change):**
- PostgresSaver checkpointer wires through `graph.stream()` identically to `graph.invoke()` — the checkpoint config is the same
- The `langgraph-proxy` Edge Function SSE passthrough is already working (lines 100-113) — no changes needed
- Thread management API (`/threads/:userId`) is already built and correct
- `useLangGraphFlag` + `getChatEndpoint` pattern should be reused in `useAgentChat`

---

## Open Questions

1. **Should `/invoke/stream` completely replace `/invoke`, or coexist?**
   - What we know: `/invoke` is used by the proactive runner and heartbeat cadence system (Phases 15-16) which do not need streaming
   - What's unclear: whether the proactive Deno functions would break if `/invoke` is changed
   - Recommendation: Add `/invoke/stream` as a new endpoint; leave `/invoke` unchanged for backward compatibility with the cadence runner

2. **How does the UI know which tool display name to show in ToolIndicator?**
   - What we know: `metadata.langgraph_node` in streamMode messages contains the LangGraph node name (e.g., "accountantTools", "cosTools")
   - What's unclear: the tool_display_name mapping from node name to human label is not defined anywhere
   - Recommendation: Maintain a `TOOL_DISPLAY_NAMES` map in the frontend that maps LangGraph node names to UI labels (e.g., `{ accountantTools: "Accountant", cosTools: "Chief of Staff" }`)

3. **Does `AgentTeamSelector` currently call LangGraph for ONB-03, or is it a static UI?**
   - What we know: `AgentTeamSelector.tsx` exists but its internal implementation wasn't read
   - What's unclear: whether it already calls the graph or shows static agent cards
   - Recommendation: Read `AgentTeamSelector.tsx` in Wave 0 before modifying; if it's static, leave it static (the requirement "uses LangGraph CoS graph" likely means the briefing call, not the team selector)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 (frontend) + vitest ^4.1.0 (LangGraph server) |
| Config file | `worrylesssuperagent/vitest.config.ts` (frontend), no separate config for langgraph-server |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GUI-08 | SSE streaming endpoint emits delta + done events | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` | ❌ Wave 0 |
| GUI-09 | `useAgentChat` accumulates streaming deltas into messages | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/useAgentChat.test.ts` | ❌ Wave 0 |
| GUI-06 | HITLApprovalCard renders Approve/Reject/Discuss; approve calls resume | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/HITLApprovalCard.test.ts` | ❌ Wave 0 |
| GUI-02 | GenerativeUIRenderer dispatches all 13 component types without crash | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/GenerativeUIRenderer.test.ts` | ❌ Wave 0 |
| ONB-01 | BusinessStageSelector renders 3 options; selection updates state | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/BusinessStageSelector.test.ts` | ❌ Wave 0 |
| ONB-06 | profiles.business_stage migration adds column with correct CHECK constraint | manual-only | n/a — SQL migration; verify in Supabase dashboard | n/a |

### Sampling Rate

- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `worrylesssuperagent/src/__tests__/useAgentChat.test.ts` — covers GUI-09 (streaming hook)
- [ ] `worrylesssuperagent/src/__tests__/HITLApprovalCard.test.ts` — covers GUI-06
- [ ] `worrylesssuperagent/src/__tests__/GenerativeUIRenderer.test.ts` — covers GUI-02
- [ ] `worrylesssuperagent/src/__tests__/BusinessStageSelector.test.ts` — covers ONB-01
- [ ] `worrylesssuperagent/langgraph-server/src/__tests__/sse-stream.test.ts` — covers GUI-08

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `worrylesssuperagent/langgraph-server/src/index.ts` — confirmed `/invoke` returns JSON, no SSE
- Existing codebase: `worrylesssuperagent/langgraph-server/src/types/agent-state.ts` — confirmed UIComponent + PendingApproval shapes
- Existing codebase: `worrylesssuperagent/src/components/chat/ChatInterface.tsx` — confirmed SSE reader pattern (lines 253-303)
- Existing codebase: `worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts` — confirmed interruptForApproval + createResumeCommand
- Existing codebase: `worrylesssuperagent/package.json` — confirmed recharts, react-markdown, tailwindcss-animate installed; @tanstack/react-table NOT installed
- Existing codebase: `worrylesssuperagent/supabase/migrations/` — confirmed `business_stage` column does not exist
- UI-SPEC.md (17-UI-SPEC.md) — authoritative design contract for all component specs
- npm registry: `@tanstack/react-table` latest = 8.21.3 (verified 2026-03-19)

### Secondary (MEDIUM confidence)

- [LangGraph JS Streaming Docs](https://docs.langchain.com/oss/javascript/langgraph/streaming) — `graph.stream({ streamMode: "messages" })` yields `[messageChunk, metadata]` tuples; `messageChunk.content` is the text delta
- [TanStack Table v8 React Docs](https://tanstack.com/table/v8/docs/framework/react/react-table) — `useReactTable`, `getCoreRowModel`, `flexRender` API confirmed; columns must be in `useMemo`

### Tertiary (LOW confidence)

- LangGraph `graph.getState()` post-stream for reading `uiComponents` — inferred from LangGraph checkpoint API; needs verification in project context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json confirmed; npm version verified
- Architecture: HIGH — built on fully-read existing codebase patterns
- SSE streaming: MEDIUM — LangGraph streaming API verified in docs; specific `uiComponents` post-stream read pattern is inferred (LOW for that sub-claim)
- Pitfalls: HIGH — most derived from reading actual existing code and known LangGraph behavior

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable dependencies; LangGraph JS minor versions may shift)
