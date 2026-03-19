---
phase: 17-generative-ui-onboarding-redesign
plan: "01"
subsystem: langgraph-streaming
tags: [sse, streaming, langgraph, react-hook, hitl, generative-ui]
dependency_graph:
  requires: []
  provides: [POST /invoke/stream SSE endpoint, useAgentChat React hook]
  affects: [ChatInterface, generative-ui-components, HITL-approval-flow]
tech_stack:
  added: [supertest (test), vitest.config.ts for langgraph-server]
  patterns:
    - SSE streaming with for-await over graph.stream()
    - messages streamMode with [BaseMessage, metadata] tuple chunks
    - AIMessage instanceof check to filter HumanMessage echoes
    - ReadableStream getReader() + TextDecoder + buffer split on \n for SSE parsing
    - business_stage fetched from profiles before POST to populate business_context
    - fire-and-forget registerThread .catch() pattern
    - NODE_ENV=test guard to skip server.listen during testing
    - app exported from index.ts for supertest import in tests
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/__tests__/sse-stream.test.ts
    - worrylesssuperagent/langgraph-server/vitest.config.ts
    - worrylesssuperagent/src/hooks/useAgentChat.ts
    - worrylesssuperagent/src/__tests__/useAgentChat.test.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/index.ts
    - worrylesssuperagent/langgraph-server/package.json
decisions:
  - "app exported from index.ts (not just started) — enables supertest to import express instance for testing without binding port"
  - "NODE_ENV=test guard on app.listen() — prevents port binding during test runs"
  - "vitest.config.ts added to langgraph-server with node environment — langgraph-server is Node.js, not jsdom"
  - "supertest installed in langgraph-server devDependencies — needed for HTTP-level SSE testing"
  - "uiComponentsBeforeCount snapshot before stream — ensures only NEW components emitted in ui_components event"
  - "business_context includes business_stage fetched from profiles table before each POST — meets ONB-06 requirement"
  - "Legacy non-streaming fallback in useAgentChat when useLangGraph flag is false — maintains backward compatibility"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  tests_added: 15
---

# Phase 17 Plan 01: SSE Streaming Endpoint + useAgentChat Hook Summary

**One-liner:** LangGraph SSE streaming endpoint emitting 6 event types plus React hook accumulating deltas, managing threads, passing business_context, and handling HITL resume.

## What Was Built

### Task 1: POST /invoke/stream SSE Endpoint

Added `POST /invoke/stream` to `worrylesssuperagent/langgraph-server/src/index.ts` between the existing `/invoke` and `/invoke/resume` routes.

The endpoint:
- Validates `message` (string) and `user_id` (string) — returns 400 on failure
- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Calls `graph.stream()` in `messages` streamMode
- In the for-await loop: filters HumanMessage echoes (only AIMessage content emits `delta` events), detects tool nodes via `langgraph_node` metadata for `tool_start` events
- After stream: reads `graph.getState(config)` to emit `ui_components` (new only, sliced by pre-stream count), `pending_approvals`, and `done`
- Wraps in try/catch — emits `error` event on failure

Also:
- Exported `app` from `index.ts` (was previously un-exported)
- Added `NODE_ENV !== "test"` guard on `app.listen()` so tests don't bind ports
- Added `AIMessage` to the `@langchain/core/messages` import
- Added `vitest.config.ts` with `environment: "node"` for langgraph-server
- Installed `supertest` and `@types/supertest` as devDependencies
- Original `/invoke` route unchanged

**Tests:** 6 passing in `src/__tests__/sse-stream.test.ts`

### Task 2: useAgentChat React Hook

Created `worrylesssuperagent/src/hooks/useAgentChat.ts` with:

**Exports:**
- `ChatMessage` interface (id, role, content, isStreaming, uiComponents, pendingApproval)
- `ThreadInfo` interface (thread_id, agent_type, created_at, title)
- `UIComponent` and `PendingApproval` inline type declarations
- `useAgentChat({ userId, agentType })` hook

**Hook behavior:**
- Loads threads on mount via `GET /langgraph-proxy/threads/:userId?agent_type=...`
- Loads thread state when `activeThreadId` changes
- `sendMessage`: optimistically adds user + assistant placeholder, fetches `business_stage` from profiles, POSTs to `/langgraph-proxy/invoke/stream`, reads SSE stream with `getReader()` + `TextDecoder`, handles all 6 event types
- `approveHITL`: POSTs to `/langgraph-proxy/invoke/resume` with `thread_id`, `approved`, `feedback`
- `startNewThread`: clears messages, activeThreadId, pendingApprovals
- Legacy fallback: when `useLangGraph` is false, uses `getChatEndpoint(false)` with non-streaming POST

**Tests:** 9 passing in `src/__tests__/useAgentChat.test.ts`

## Verification

- `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` — 6/6 pass
- `cd worrylesssuperagent && npx vitest run src/__tests__/useAgentChat.test.ts` — 9/9 pass
- `cd worrylesssuperagent && npx vitest run` — 36 test files pass (1 skipped), 397 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] app not exported from index.ts**
- **Found during:** Task 1
- **Issue:** Plan called for supertest to import the express app, but index.ts didn't export `app`
- **Fix:** Added `export const app = express()` and `NODE_ENV !== "test"` guard on `app.listen()`
- **Files modified:** `worrylesssuperagent/langgraph-server/src/index.ts`
- **Commit:** 8466ea5

**2. [Rule 3 - Blocking] No vitest.config.ts in langgraph-server**
- **Found during:** Task 1
- **Issue:** langgraph-server had no vitest config, tests would use wrong environment
- **Fix:** Created `vitest.config.ts` with `environment: "node"`
- **Files modified:** `worrylesssuperagent/langgraph-server/vitest.config.ts` (new)
- **Commit:** 8466ea5

**3. [Rule 3 - Blocking] supertest not installed**
- **Found during:** Task 1
- **Issue:** Plan required supertest for HTTP-level SSE testing; not in dependencies
- **Fix:** `npm install --save-dev supertest @types/supertest`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 8466ea5

## Self-Check: PASSED

All created files exist on disk. Both task commits (8466ea5, 2b79fd9) verified in git log.
