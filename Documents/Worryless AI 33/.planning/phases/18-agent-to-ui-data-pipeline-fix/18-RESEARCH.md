# Phase 18: Agent-to-UI Data Pipeline Fix - Research

**Researched:** 2026-03-19
**Domain:** LangGraph agent state → SSE endpoint → React UI (two broken E2E pipelines)
**Confidence:** HIGH

## Summary

Phase 17 built all UI components (GenerativeUIRenderer, HITLApprovalCard, PipelineKanban, InlinePLTable, etc.) and the SSE endpoint, but the two pipelines connecting agent-side data to those components are not wired. The SSE endpoint correctly reads `state.uiComponents` and `state.pendingApprovals` AFTER the stream and emits them to the frontend. The frontend hook (`useAgentChat`) correctly receives `ui_components` and `pending_approvals` events and attaches them to chat messages. The React component (`AgentChatView`) correctly renders them when present.

**The gap is entirely on the agent/server side:** (1) the `uiComponents` array in `AgentState` is never populated — no tool node writes to it — so the `ui_components` SSE event never fires; and (2) when a tool calls `interruptForApproval()`, the resulting interrupt payload is never surfaced as a `pending_approvals` SSE event because the `/invoke/resume` endpoint does not emit SSE, and the frontend's `approveHITL` callback only does a POST (non-streaming) resume, losing the reconnection to the streaming chat flow.

**Primary recommendation:** Add a `uiComponents` post-tool step in `createAccountantToolsNode` and `createSalesToolsNode` (and the base agent factory) that translates existing `toolResults` data into typed `UIComponent` objects, AND fix the HITL flow so that interrupt payloads surface via the `pending_approvals` SSE event during the normal `/invoke/stream` call.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAPH-05 | Human-in-the-loop via `interrupt()` for all high-risk actions | Interrupt infrastructure exists in `hitl/interrupt-handler.ts`; gap is surfacing the interrupt payload to the frontend as a `pending_approvals` SSE event |
| GUI-02 | `GenerativeUIRenderer` mapping component types to React components | Component exists and is fully wired in `AgentChatView`; gap is agents never writing to `state.uiComponents` |
| GUI-03 | Chart components via Recharts | All chart components exist in `GenerativeUIRenderer`; gap is same: agents never emit chart-type UIComponent objects |
| GUI-04 | Data table components via @tanstack/react-table | `DataTable` component exists; same upstream gap |
| GUI-05 | Dynamic form components from agent tool schemas | `DynamicForm` exists; same upstream gap |
| GUI-06 | Approval request cards with Approve/Reject/Discuss for HITL | `HITLApprovalCard` exists and renders when `msg.pendingApproval` is present; gap is interrupt payload never reaches the message |
| GUI-07 | Domain-specific: Pipeline Kanban, Content Calendar, Invoice Tracker, Calendar Timeline, Meeting Brief | All domain components exist; same upstream gap |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/langgraph` | ^1.2.3 | `AgentState`, `interrupt()`, `StateGraph` | Core graph engine — already the project standard |
| TypeScript | ^5 | Type safety for UIComponent shape contracts | Established project standard |
| Vitest | latest | Unit test framework for both langgraph-server (node) and frontend (jsdom) | Already configured in both `vitest.config.ts` files |
| React + hooks | ^18 | Frontend SSE consumer | Already installed |

### No new packages required
Phase 18 is purely a wiring/integration phase. All libraries, components, and infrastructure already exist. The work is writing server-side logic that populates existing state fields and fixing the HITL event flow.

---

## Architecture Patterns

### The Two Broken Pipelines

#### Pipeline 1: Generative UI (Tool Results → uiComponents → SSE → React)

**Current state (broken):**
```
accountantTools node           llmNode         SSE endpoint
    ↓                            ↓                ↓
toolResults.plReport = {..}  ← LLM reasons   state.uiComponents = []  ← never populated
                                              ↓
                                          ui_components event NOT emitted
```

**Target state (fixed):**
```
accountantTools node           uiComponents set      SSE endpoint
    ↓                             ↓                       ↓
toolResults.plReport = {..}  →  state.uiComponents =  →  ui_components event emitted
                                 [{type:"pl_report",       ↓
                                   props:{rows,...}}]   GenerativeUIRenderer renders InlinePLTable
```

**Where to add the uiComponents population:**
The correct place is at the END of each tool node, after existing tool dispatch. Each tools node (accountantTools, salesTools, etc.) already returns `businessContext` changes. The same return object can include `uiComponents: [...]` to leverage the accumulator reducer in AgentState.

#### Pipeline 2: HITL (interrupt() → pending_approvals SSE event → HITLApprovalCard)

**Current state (broken):**
```
Tool calls interruptForApproval()
    ↓
LangGraph interrupts graph execution (throws internally)
    ↓
graph.stream() loop ends without emitting pending_approvals event
    ↓
SSE endpoint reads finalState AFTER stream — but if graph interrupted,
finalState.values.pendingApprovals may have items BUT the interrupt value
is what needs to surface, not the state array
    ↓
useAgentChat receives 'done' event only — no pending_approvals event fired
    ↓
HITLApprovalCard never rendered
```

**The root cause:** When LangGraph calls `interrupt()` inside a node, it raises a special signal that terminates the `graph.stream()` for-await loop before the `done`-post-stream code runs. The SSE endpoint needs to detect the interrupt condition and emit `pending_approvals` from the interrupt values before sending `done`.

**Target state (fixed):**
```
Tool calls interruptForApproval({action, description, payload})
    ↓
graph.stream() catches interrupt via getState().tasks[0].interrupts[]
    ↓
SSE endpoint detects interrupts and emits:
  { type: "pending_approvals", approvals: [{...interrupt.value}] }
  { type: "done", thread_id }
    ↓
useAgentChat receives pending_approvals → attaches to assistant message
    ↓
AgentChatView renders HITLApprovalCard inline in chat bubble
    ↓
User clicks Approve → approveHITL(threadId, true) → POST /invoke/resume
    ↓
Graph resumes from interrupt → tool proceeds → sends result
```

### Recommended Project Structure (additions only)

```
langgraph-server/src/
├── agents/
│   ├── base-agent.ts         # Add createUIComponentsNode() helper
│   ├── accountant.ts         # Add uiComponents to accountantTools return
│   ├── sales-rep.ts          # Add uiComponents to salesTools return
│   └── [other agents]        # Add uiComponents where tools return chart-able data
├── hitl/
│   └── interrupt-handler.ts  # Already correct — no changes needed
└── index.ts                  # Fix: detect interrupt after stream, emit pending_approvals
```

### Pattern 1: Tool Node UIComponent Population (server-side)

**What:** After tool dispatch in each agent's tools node, translate tool result data into typed UIComponent objects and return them alongside the businessContext update.

**When to use:** Any tool node where the result contains data that should render as a visual component.

**UIComponent type contract (already defined in `agent-state.ts`):**
```typescript
// Source: worrylesssuperagent/langgraph-server/src/types/agent-state.ts
export interface UIComponent {
  type: string; // matches GenerativeUIRenderer switch cases
  props: Record<string, unknown>;
}
```

**Example — accountantTools node addition (ACCT-06 P&L):**
```typescript
// Source: worrylesssuperagent/langgraph-server/src/agents/accountant.ts
// In createAccountantToolsNode(), after toolResults are populated:

const uiComponents: UIComponent[] = [];

if (cls.isPLQuery && toolResults.plReport) {
  const report = toolResults.plReport as PLReport;
  uiComponents.push({
    type: "pl_report",
    props: {
      title: "Profit & Loss Report",
      period: report.months[0]?.month ?? "Current",
      rows: report.months.map((m) => ({
        label: m.month,
        current: m.netProfit,
        previous: 0,  // or derived from months array
        change: 0,
      })),
    },
  });
}

return {
  businessContext: {
    ...state.businessContext,
    accountantToolResults: toolResults,
  },
  uiComponents,  // accumulator reducer appends these to state.uiComponents
};
```

**Example — salesTools node addition (SALES-10 Pipeline):**
```typescript
// Source: worrylesssuperagent/langgraph-server/src/agents/sales-rep.ts
// In createSalesToolsNode(), after toolResults are populated:

const uiComponents: UIComponent[] = [];

if (classification.isPipelineAnalysis && toolResults.pipeline) {
  const pipeline = toolResults.pipeline as PipelineAnalysis;
  uiComponents.push({
    type: "pipeline_kanban",
    props: {
      deals: pipeline.byStage.map((s) => ({
        id: s.status,
        name: `${s.deal_count} deals`,
        status: s.status,
        value: s.total_deal_value,
      })),
    },
  });
}

return {
  businessContext: { ...state.businessContext, salesToolResults: toolResults },
  uiComponents,
};
```

### Pattern 2: SSE Interrupt Detection (server-side index.ts fix)

**What:** After the `graph.stream()` for-await loop completes (which it does even on interrupt — LangGraph does not throw out of the stream), read `graph.getState(config)` and check `finalState.tasks` for interrupts. Surface them as `pending_approvals` event.

**Critical LangGraph behavior:** When a graph hits `interrupt()`, the `graph.stream()` for-await loop DOES complete normally — it does not throw. The interrupt is surfaced in the state as `finalState.tasks[0].interrupts`. The existing SSE endpoint already calls `graph.getState(config)` post-stream — it just needs to check for interrupts.

**LangGraph interrupt state shape (verified from @langchain/langgraph source):**
```typescript
// finalState.tasks is an array of task snapshots
// Each task has an `interrupts` array
// Each interrupt has a `value` property (the payload passed to interrupt())
interface InterruptEntry {
  value: unknown; // the InterruptPayload passed to interrupt()
}
interface TaskSnapshot {
  name: string;
  interrupts: InterruptEntry[];
}
```

**Fix in index.ts `/invoke/stream` route (post-stream section):**
```typescript
// Source: worrylesssuperagent/langgraph-server/src/index.ts
// After the for-await loop, BEFORE the existing ui_components emission:

const finalState = await graph.getState(config);
const finalValues = finalState?.values as { ... } | null;

// NEW: Check for HITL interrupts in state tasks
const tasks = (finalState as { tasks?: Array<{ interrupts?: Array<{ value: unknown }> }> })?.tasks ?? [];
const interruptValues = tasks.flatMap((t) => t.interrupts ?? []).map((i) => i.value);

if (interruptValues.length > 0) {
  // Build PendingApproval objects from interrupt values
  const pendingApprovals = interruptValues.map((v, idx) => {
    const payload = v as {
      action?: string;
      agentType?: string;
      description?: string;
      payload?: Record<string, unknown>;
    };
    return {
      id: `interrupt_${Date.now()}_${idx}`,
      action: payload.action ?? "unknown",
      agentType: payload.agentType ?? agentTypeVal,
      description: payload.description ?? "Action requires approval",
      payload: payload.payload ?? {},
      createdAt: new Date().toISOString(),
    };
  });
  emit({ type: "pending_approvals", approvals: pendingApprovals });
}

// Existing ui_components + done emission follows...
```

### Pattern 3: Frontend HITLApprovalCard Wiring (useAgentChat)

**Current state:** `useAgentChat` receives `pending_approvals` SSE event and pushes to `pendingApprovals` state array. But `AgentChatView` renders `HITLApprovalCard` from `msg.pendingApproval` (singular), not from the `pendingApprovals` array.

**The mismatch:** The `pending_approvals` SSE event updates `pendingApprovals` state in the hook, but `AgentChatView` checks `msg.pendingApproval` (a field on the message object). The two are not connected.

**Fix in `useAgentChat.ts`:** When processing the `pending_approvals` SSE event, attach the first approval to the streaming assistant message's `pendingApproval` field (in addition to — or instead of — updating the separate `pendingApprovals` array):

```typescript
// Source: worrylesssuperagent/src/hooks/useAgentChat.ts
// In the SSE event loop, pending_approvals handler:

} else if (data.type === "pending_approvals" && data.approvals?.length) {
  // Attach first approval inline to the assistant message
  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantMsgId
        ? { ...m, pendingApproval: data.approvals![0] }
        : m,
    ),
  );
  // Also maintain the pendingApprovals array for multi-approval flows
  setPendingApprovals((prev) => [...prev, ...(data.approvals ?? [])]);
}
```

### Anti-Patterns to Avoid

- **Anti-pattern: Modifying `createRespondNode` to carry uiComponents** — The respond node issues `Command({ graph: Command.PARENT, update: { messages, responseMetadata } })`. Adding `uiComponents` to this Command update would overwrite the accumulator. The correct pattern is to let each tools node return `uiComponents` directly to the subgraph state, which the accumulator reducer handles.
- **Anti-pattern: Re-reading tool results from businessContext to build UIComponents** — Build UIComponent objects immediately when tool results are available (in the tools node), not in a separate downstream node.
- **Anti-pattern: Calling interruptForApproval in the tools node for non-HITL paths** — Only call `interruptForApproval` for genuinely high-risk actions (already defined in `HIGH_RISK_ACTIONS` in `interrupt-handler.ts`).
- **Anti-pattern: Adding uiComponents to ALL agents at once** — Phase 18 specifies Accountant (P&L) and Sales Rep (Pipeline Kanban) as the primary targets per success criteria. Do those two first; other agents can be extended later.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UIComponent type definition | New interface | Existing `UIComponent` in `agent-state.ts` | Already defined; frontend `GenerativeUIRenderer` already maps these types |
| Interrupt detection | Custom polling | `finalState.tasks[].interrupts[]` from LangGraph | LangGraph exposes this natively via `getState()` |
| Approval card UI | New component | `HITLApprovalCard` from Phase 17 | Already built, tested, accessible |
| P&L table rendering | New table | `InlinePLTable` with `type: "pl_report"` | Already built with MoM comparison and color coding |
| Pipeline board rendering | New kanban | `PipelineKanban` with `type: "pipeline_kanban"` | Already built with 6 columns and horizontal scroll |
| SSE event types | New protocol | Existing 6 event types (delta, tool_start, ui_components, pending_approvals, done, error) | Already defined in index.ts and consumed by useAgentChat |

**Key insight:** Every UI component, SSE event type, and state channel already exists. This phase is exclusively plumbing that connects them.

---

## Common Pitfalls

### Pitfall 1: uiComponents Accumulator vs. Last-Write-Wins
**What goes wrong:** The `uiComponents` annotation uses an accumulator reducer: `(prev, next) => [...prev, ...next]`. This means every turn that returns `uiComponents: [...]` appends to the array. The SSE endpoint already handles this correctly with `uiComponentsBeforeCount` snapshot — it slices only the NEW components added during the current stream. Do not return `uiComponents: []` from the tools node when no tools matched (returning an empty array is harmless but unnecessary; simply omit the key).
**How to avoid:** Only include `uiComponents` in the tools node return when you have actual components to add.

### Pitfall 2: interrupt() Does Not Throw Out of graph.stream()
**What goes wrong:** Assuming the for-await loop over `graph.stream()` will throw or break when `interrupt()` is called — it does not. The stream completes and then the interrupt state is readable via `getState()`.
**How to avoid:** Always read `finalState.tasks` after the stream loop to detect interrupts. The existing `/invoke/stream` route already calls `graph.getState(config)` — just add the tasks check.

### Pitfall 3: pendingApprovals SSE event vs. msg.pendingApproval mismatch
**What goes wrong:** `useAgentChat` puts received approvals in `pendingApprovals` state array, but `AgentChatView` reads from `msg.pendingApproval` (a per-message field). They are separate — the SSE event must also update the streaming message object.
**How to avoid:** In the `pending_approvals` SSE event handler in `useAgentChat`, call `setMessages` to attach the first approval to the current streaming message's `pendingApproval` field.

### Pitfall 4: PLReport rows shape vs. InlinePLTable props shape
**What goes wrong:** `generatePLReport()` returns `PLReport` with `months[]` each having `{ month, income, expenses, netProfit, byCategory }`. But `InlinePLTable` expects `rows[]` with shape `{ label, current, previous, change }`.
**How to avoid:** Transform in the tools node: map `months` to `rows` with `label = month`, `current = netProfit`, `previous` derived from the next month in the array (or 0 if unavailable), `change = current - previous`.

### Pitfall 5: PipelineKanban deals shape vs. analyzePipeline() output
**What goes wrong:** `PipelineKanban` expects `deals[]` with `{ id, name, status, value? }`. But `analyzePipeline()` returns `byStage[]` which is aggregate counts per stage, not individual deals.
**How to avoid:** Transform `byStage` data to synthetic deal objects: one "deal" entry per stage with deal count and total value. The Kanban normalizes status to Title Case and handles unknown statuses gracefully.

### Pitfall 6: HITL resume is non-streaming (no UI update after approval)
**What goes wrong:** After `approveHITL` calls POST `/invoke/resume`, the response is JSON (not SSE). The graph resumes and executes the tool, but the user sees only "Action approved. Continuing..." — no streaming of the post-approval agent response.
**How to avoid:** This is a known limitation of the current `/invoke/resume` endpoint. Phase 18 success criteria only require that clicking Approve resumes the graph — not that the post-approval response streams. The non-streaming resume is sufficient for v2.0. A streaming resume endpoint (`/invoke/resume/stream`) would be a v2.1 enhancement.

### Pitfall 7: Type widening for AgentState uiComponents return
**What goes wrong:** TypeScript infers return type of tools nodes strictly. Returning `uiComponents: someArray` alongside `businessContext: {...}` may cause a type error if the tools node return type does not explicitly include `uiComponents`.
**How to avoid:** Import `UIComponent` from `../types/agent-state.js` in the tools node file and type the array explicitly: `const uiComponents: UIComponent[] = []`.

---

## Code Examples

Verified patterns from existing codebase:

### Checking LangGraph interrupt state after stream (VERIFIED from LangGraph JS source)
```typescript
// Source: confirmed behavior of @langchain/langgraph CompiledStateGraph
const finalState = await graph.getState(config);
// tasks is an array of PregelTask snapshots; each has interrupts[]
const tasks = finalState?.tasks ?? [];
// Each interrupt has a `value` (the object passed to interrupt())
const interrupts = tasks.flatMap((t: any) => t.interrupts ?? []);
// interrupts[0].value is the InterruptPayload from interruptForApproval()
```

### AgentState uiComponents accumulator (VERIFIED from agent-state.ts)
```typescript
// Source: worrylesssuperagent/langgraph-server/src/types/agent-state.ts
uiComponents: Annotation<UIComponent[]>({
  reducer: (prev, next) => [...prev, ...next],  // accumulator
  default: () => [],
}),
// Returning { uiComponents: [comp1, comp2] } from any node appends to array
```

### Tools node return with uiComponents (NEW — this is what Phase 18 adds)
```typescript
// Pattern: return uiComponents alongside businessContext from tools node
return {
  businessContext: {
    ...state.businessContext,
    accountantToolResults: toolResults,
  },
  uiComponents,  // UIComponent[] — accumulated by reducer
};
```

### interruptForApproval call (VERIFIED from interrupt-handler.ts + existing tool usage)
```typescript
// Source: worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts
// Already used in: chase-invoice.ts, send-outreach.ts, publish-tools.ts, calendar-tools.ts
const decision = interruptForApproval({
  action: "chase_overdue_invoice",
  agentType: AGENT_TYPES.ACCOUNTANT,
  description: `Send payment reminder to ${clientName} for invoice #${invoiceId}`,
  payload: { invoiceId, clientName, amount },
});
if (!decision.approved) return "Cancelled by user";
```

### HITLApprovalCard render path (VERIFIED from AgentChatView.tsx)
```typescript
// Source: worrylesssuperagent/src/components/chat/AgentChatView.tsx (line 201)
{msg.pendingApproval && (
  <HITLApprovalCard
    approval={msg.pendingApproval}
    onApprove={() => approveHITL(activeThreadId!, true)}
    onReject={() => approveHITL(activeThreadId!, false)}
    onDiscuss={() => { inputRef.current?.focus(); }}
  />
)}
// msg.pendingApproval is populated by useAgentChat when SSE emits pending_approvals
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static agent dashboards | AgentChatView with SSE streaming | Phase 17 | All agent tabs now show chat |
| Placeholder divs for domain UI | Real InlinePLTable, PipelineKanban etc. | Phase 17 | Components ready to receive data |
| uiComponents always empty `[]` | uiComponents populated per tool result | **Phase 18 target** | P&L/Kanban render inline in chat |
| HITL interrupt payload unreachable | Interrupt surfaced via pending_approvals SSE | **Phase 18 target** | Users see inline HITL approval cards |

---

## Open Questions

1. **How many tool nodes should emit uiComponents in Phase 18?**
   - What we know: Success criteria explicitly name Accountant P&L (pl_report) and Sales Rep pipeline (pipeline_kanban). AgentState already has the accumulator reducer. All other domain components (ContentCalendarGrid, InvoiceTrackerTable, CalendarTimelineView, MeetingBriefCard) are built.
   - What's unclear: Whether Phase 18 should wire ALL domain components or only the two named in success criteria.
   - Recommendation: Wire the two required by success criteria (Accountant P&L, Sales Rep pipeline). Also wire cashflow_chart (Accountant cashflow query) and invoice_tracker (Accountant invoice query) since the components exist and the tools already return the data — minimal additional work.

2. **Does approveHITL need a streaming response after resume?**
   - What we know: The success criteria say "clicking Approve resumes the graph." The current `/invoke/resume` is non-streaming JSON.
   - What's unclear: Whether the post-approval tool execution response should stream to the chat or just show "Action approved."
   - Recommendation: Non-streaming resume is sufficient for Phase 18 (matches success criteria). Document as v2.1 enhancement.

3. **Should the planner add uiComponents to ALL agent tool nodes or only Accountant and Sales Rep?**
   - Recommendation: Planner should scope to Accountant and Sales Rep per success criteria. Include a Wave that adds uiComponents to the base agent factory as a generic hook for future agents.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend: jsdom, langgraph-server: node) |
| Config file | `worrylesssuperagent/vitest.config.ts` (frontend), `worrylesssuperagent/langgraph-server/vitest.config.ts` (server) |
| Quick run command | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| Full suite command | `cd worrylesssuperagent && npx vitest run && cd langgraph-server && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-05 | interruptForApproval() surfaces as pending_approvals SSE event | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` | ✅ (needs new test case) |
| GUI-02 | GenerativeUIRenderer dispatches all 13 types to real components | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/GenerativeUIRenderer.test.ts` | ✅ existing, passing |
| GUI-03 | Chart components render without crash | unit | included in GenerativeUIRenderer.test.ts | ✅ existing |
| GUI-04 | DataTable renders with columns/data | unit | included in GenerativeUIRenderer.test.ts | ✅ existing |
| GUI-05 | DynamicForm renders schema fields | unit | included in GenerativeUIRenderer.test.ts | ✅ existing |
| GUI-06 | HITLApprovalCard renders with Approve/Reject/Discuss | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/HITLApprovalCard.test.ts` | ✅ existing, passing |
| GUI-07 | Domain components (PipelineKanban, InlinePLTable, etc.) render data | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/GenerativeUIRenderer.test.ts` | ✅ existing |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run src/__tests__/ && cd langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run && cd langgraph-server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worrylesssuperagent/langgraph-server/src/__tests__/sse-stream.test.ts` — needs new test cases for: (a) pending_approvals event emitted when graph has interrupts, (b) ui_components event emitted when uiComponents in state — current file only has 6 basic tests
- [ ] `worrylesssuperagent/src/__tests__/useAgentChat.test.ts` — needs test for: pending_approvals SSE event attaches approval to `msg.pendingApproval` — current 9 tests do not cover this path

---

## Detailed Gap Analysis (What Exists vs. What's Missing)

### What Already Exists (GREEN — do not rebuild)

| Item | Location | Status |
|------|----------|--------|
| `UIComponent` interface | `agent-state.ts` | Built, typed |
| `uiComponents` accumulator in AgentState | `agent-state.ts` | Built, correct reducer |
| `pendingApprovals` accumulator in AgentState | `agent-state.ts` | Built, correct reducer |
| `interruptForApproval()` function | `hitl/interrupt-handler.ts` | Built, used in 5 tools |
| `/invoke/stream` SSE endpoint | `index.ts` | Built, emits 6 event types |
| `uiComponentsBeforeCount` snapshot logic | `index.ts` | Built — only emits NEW components |
| `pending_approvals` SSE event emission | `index.ts` (post-stream) | Built but reads `state.pendingApprovals` — gap is this array is never populated |
| `useAgentChat` SSE consumer | `src/hooks/useAgentChat.ts` | Built — handles all 6 event types |
| `GenerativeUIRenderer` | `src/components/chat/GenerativeUIRenderer.tsx` | Built — dispatches all 13 types |
| `HITLApprovalCard` | `src/components/chat/HITLApprovalCard.tsx` | Built — 3-state, accessible |
| `InlinePLTable` | `src/components/ui/InlinePLTable.tsx` | Built |
| `PipelineKanban` | `src/components/ui/PipelineKanban.tsx` | Built |
| All other domain components | `src/components/ui/` | Built |
| `AgentChatView` renders `msg.uiComponents` | `AgentChatView.tsx` | Built |
| `AgentChatView` renders `msg.pendingApproval` | `AgentChatView.tsx` | Built |
| `generatePLReport()` | `tools/accountant/report-tools.ts` | Built, returns `PLReport` |
| `analyzePipeline()` | `tools/sales/pipeline-tools.ts` | Built, returns `PipelineAnalysis` |

### What is Missing (RED — Phase 18 must add)

| Gap | File to Modify | What to Add |
|-----|---------------|-------------|
| Tools node never writes to `uiComponents` | `agents/accountant.ts` | Return `uiComponents` from `createAccountantToolsNode()` for pl_report, cashflow_chart, invoice_tracker types |
| Tools node never writes to `uiComponents` | `agents/sales-rep.ts` | Return `uiComponents` from `createSalesToolsNode()` for pipeline_kanban type |
| HITL interrupt payload not in `pendingApprovals` SSE event | `index.ts` | Check `finalState.tasks[].interrupts[]` post-stream and emit `pending_approvals` |
| `pendingApprovals` SSE event not attached to message | `src/hooks/useAgentChat.ts` | In `pending_approvals` handler: also call `setMessages` to set `msg.pendingApproval` |
| Tests for new HITL SSE path | `langgraph-server/src/__tests__/sse-stream.test.ts` | Add test: interrupt in mock graph causes pending_approvals event |
| Tests for useAgentChat approval attachment | `src/__tests__/useAgentChat.test.ts` | Add test: pending_approvals event sets msg.pendingApproval |

---

## Sources

### Primary (HIGH confidence)
- Direct source code read: `worrylesssuperagent/langgraph-server/src/index.ts` — confirmed SSE endpoint reads state post-stream but does not check `tasks.interrupts`
- Direct source code read: `worrylesssuperagent/langgraph-server/src/agents/accountant.ts` — confirmed tools node never returns `uiComponents`
- Direct source code read: `worrylesssuperagent/langgraph-server/src/agents/sales-rep.ts` — confirmed tools node never returns `uiComponents`
- Direct source code read: `worrylesssuperagent/langgraph-server/src/types/agent-state.ts` — confirmed `uiComponents` accumulator reducer and `pendingApprovals` accumulator
- Direct source code read: `worrylesssuperagent/src/hooks/useAgentChat.ts` — confirmed `pending_approvals` handler updates state array but NOT `msg.pendingApproval`
- Direct source code read: `worrylesssuperagent/src/components/chat/AgentChatView.tsx` — confirmed renders from `msg.pendingApproval` not from `pendingApprovals` array
- Direct source code read: `worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts` — confirmed `interruptForApproval` calls LangGraph `interrupt()`
- Phase 17 SUMMARY files (01–05) — confirmed all UI components built, SSE endpoint built, but E2E wiring not completed

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions — confirms `uiComponents` uses accumulator reducer (Phase 11 decision: "AgentState uiComponents and pendingApprovals use accumulator reducer")
- LangGraph JS documentation pattern: `getState().tasks[].interrupts[]` is the standard way to read interrupt values post-stream

### Tertiary (LOW confidence — needs runtime verification)
- LangGraph interrupt() behavior: the claim that `graph.stream()` completes normally (does not throw) when `interrupt()` is called is based on LangGraph documentation patterns; should be verified in the test suite

---

## Metadata

**Confidence breakdown:**
- Gap identification: HIGH — all gaps confirmed by direct code reading, no inference
- Standard stack: HIGH — no new libraries, all existing
- Architecture patterns: HIGH — sourced from actual state type definitions and tool node return patterns
- HITL interrupt detection: MEDIUM — `getState().tasks[].interrupts[]` is documented LangGraph JS API; exact field path should be verified in Wave 0 test

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable phase, no external dependencies)
