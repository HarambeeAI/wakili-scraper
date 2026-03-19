---
phase: 11-agent-graph-topology-+-memory-foundation
plan: 01
subsystem: langgraph-server
tags: [langgraph, types, memory, llm-client, agent-state]
dependency_graph:
  requires: [10-02-SUMMARY.md, persistence/store.ts, persistence/checkpointer.ts]
  provides: [AgentState, AgentTypeId, callLLM, createReadMemoryNode, createWriteMemoryNode, readBusinessContext]
  affects: [11-02, 11-03, 11-04, 11-05]
tech_stack:
  added: []
  patterns: [LangGraph Annotation.Root, MessagesAnnotation.spec, OpenAI-compatible fetch, Store namespace prefix pattern]
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/types/agent-types.ts
    - worrylesssuperagent/langgraph-server/src/types/agent-state.ts
    - worrylesssuperagent/langgraph-server/src/llm/client.ts
    - worrylesssuperagent/langgraph-server/src/memory/read-memory.ts
    - worrylesssuperagent/langgraph-server/src/memory/write-memory.ts
    - worrylesssuperagent/langgraph-server/src/memory/business-context.ts
  modified:
    - worrylesssuperagent/langgraph-server/.env.example
decisions:
  - "LLM client uses direct fetch wrapper (not LangChain ChatModel) — simpler integration with Lovable AI Gateway's OpenAI-compatible endpoint"
  - "Store namespace uses colon-separated prefix string: userId:agent_memory:agentType — encodes LangGraph tuple namespace as flat string for existing store.ts pg queries"
  - "AgentState uiComponents and pendingApprovals use accumulator reducer ([...prev, ...next]) while all other channels use last-write-wins"
metrics:
  duration: "7 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_created: 6
  files_modified: 1
requirements_satisfied: [GRAPH-07, MEM-01, MEM-02, MEM-03, MEM-04]
---

# Phase 11 Plan 01: Agent Type Constants, State Schema, LLM Client & Memory Helpers Summary

Foundation type system, LLM client, and memory helpers for all 13 agent subgraphs using AgentState Annotation, direct-fetch Lovable AI Gateway wrapper, and Store-backed namespaced memory read/write lifecycle.

## What Was Built

### Task 1: Agent Type Constants + AgentState Annotation (commit 54e5658)

**`src/types/agent-types.ts`** — Defines all 13 agent type IDs as a TypeScript `as const` object matching the database seed exactly. Exports `AgentTypeId` union type, `COS_DIRECT_REPORTS` (5 specialists), `COO_REPORTS` (7 operational agents), `ALL_ROUTABLE_AGENTS`, and `AGENT_DISPLAY_NAMES`.

**`src/types/agent-state.ts`** — Defines the shared `AgentState = Annotation.Root(...)` with 8 channels:
- `messages` — inherited from `MessagesAnnotation.spec` (message list with append reducer)
- `userId` — last-write-wins string, injected by server route from proxy JWT
- `agentType` — which agent is currently executing
- `businessContext` — user's business profile data
- `uiComponents` — accumulating generative UI directives (Phase 17)
- `pendingApprovals` — accumulating HITL interrupt payloads
- `responseMetadata` — last agent execution metadata (type, display name, tokens, tool calls)
- `memoryContext` — loaded from Store before execution, written back after

### Task 2: LLM Client Wrapper (commit 9626a07)

**`src/llm/client.ts`** — Direct fetch wrapper (not LangChain ChatModel) targeting `https://ai.gateway.lovable.dev/v1/chat/completions` with model `google/gemini-3-flash-preview`. Two exports:

- `callLLM(messages, options)` — converts LangChain `BaseMessage[]` to OpenAI format, POSTs to gateway, returns `{ content: string, tokensUsed: number }`
- `callLLMWithStructuredOutput<T>(messages, schemaDescription, options)` — appends schema instruction to system prompt, parses JSON response, strips markdown fences, returns `{ data: T, tokensUsed: number }`

Auth via `process.env.LOVABLE_API_KEY`. Updated `.env.example` to uncomment the variable.

### Task 3: Memory Read/Write Helpers + Business Context (commit fcce52c)

**`src/memory/read-memory.ts`** — `createReadMemoryNode()` factory returns an async node function for use in agent subgraphs. On each execution: reads `userId:agent_memory:agentType` prefix from Store (per-agent memory) and `userId:business_context` prefix (shared business context), returns `memoryContext` state update.

**`src/memory/write-memory.ts`** — `createWriteMemoryNode()` factory returns an async node that iterates `memoryContext.agentMemory` entries and calls `putStore(prefix, key, value)` for each. Pure side-effect — returns `{}` (no state change).

**`src/memory/business-context.ts`** — `readBusinessContext(userId)` and `writeBusinessContext(userId, key, value)` helpers for direct use by Chief of Staff and onboarding flows outside of graph nodes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `response.json()` returning `unknown` type**
- **Found during:** Task 2
- **Issue:** TypeScript strict mode (`"strict": true` in tsconfig.json) flags `response.json()` return as `unknown`; plan code accessed `.choices?.[0]?.message?.content` without typing
- **Fix:** Added inline type assertion `as { choices?: Array<...>; usage?: ... }` on the `response.json()` call
- **Files modified:** `src/llm/client.ts`
- **Commit:** Included in 9626a07

## Success Criteria Verification

1. `tsc --noEmit` passes with zero errors — PASSED
2. AgentState has all 8 channels (messages + 7) — PASSED
3. All 13 agent type IDs match database seed — PASSED
4. `COS_DIRECT_REPORTS` = [accountant, marketer, sales_rep, personal_assistant, coo] — PASSED
5. `COO_REPORTS` = [customer_support, legal_compliance, hr, pr_comms, procurement, data_analyst, operations] — PASSED
6. LLM client targets `ai.gateway.lovable.dev` with `google/gemini-3-flash-preview` — PASSED
7. Memory read/write helpers use prefix format `userId:agent_memory:agentType` — PASSED

## Self-Check: PASSED

All 6 created files exist on disk and all 3 commits exist in git history.
