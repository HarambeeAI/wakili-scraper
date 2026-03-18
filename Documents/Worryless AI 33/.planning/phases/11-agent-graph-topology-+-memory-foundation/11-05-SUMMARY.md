---
phase: 11
plan: 05
subsystem: langgraph-server
tags: [hitl, rag, threads, supervisor, conversation-persistence]
dependency_graph:
  requires: [11-04, 10-01, 10-02]
  provides: [HITL-interrupt-pattern, thread-manager, rag-retrieval, supervisor-live-server]
  affects: [langgraph-server/src/index.ts, langgraph-server/src/hitl, langgraph-server/src/tools, langgraph-server/src/threads]
tech_stack:
  added: []
  patterns: [interrupt-resume, store-based-thread-index, pgvector-cosine-distance, pg-full-text-search]
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts
    - worrylesssuperagent/langgraph-server/src/tools/rag-retrieval.ts
    - worrylesssuperagent/langgraph-server/src/threads/manager.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/index.ts
decisions:
  - "Thread index stored in LangGraph Store (userId:thread_index prefix) because PostgresSaver has no native list-threads API"
  - "RAG retrieval provides both pgvector cosine similarity (Phase 12+) and PostgreSQL FTS fallback (available immediately)"
  - "interrupt() used synchronously inside node functions — LangGraph catches the GraphInterrupt and surfaces it to the caller"
  - "createSupervisorGraph replaces createEchoGraph in /invoke — echo graph no longer referenced in server"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_changed: 4
---

# Phase 11 Plan 05: HITL + Thread Manager + RAG + Supervisor Wiring Summary

**One-liner:** HITL interrupt handler, Store-backed thread manager, pgvector RAG tool, and supervisor graph wired into Express server routes replacing the echo graph.

## What Was Built

### Task 1: HITL Interrupt Handler + RAG Retrieval Tool

**`src/hitl/interrupt-handler.ts`**

Implements the LangGraph HITL interrupt pattern for high-risk actions:
- `HIGH_RISK_ACTIONS` constant list: `send_email`, `publish_post`, `create_purchase_order`, `chase_overdue_invoice`, `create_calendar_event`, `send_outreach`
- `interruptForApproval(payload)` — calls LangGraph `interrupt()` synchronously, pauses graph execution, surfaces payload to client
- `createInterruptNode(action)` — factory returning an async node function for `StateGraph.addNode()`, adds `PendingApproval` to state then interrupts
- `createResumeCommand(approved, feedback?)` — creates `Command({ resume: { approved, feedback } })` for the `/invoke/resume` route

**`src/tools/rag-retrieval.ts`**

RAG retrieval against `langgraph.document_embeddings` table (Phase 10 migration):
- `ragRetrieveByVector(userId, embedding, topK, agentType?)` — pgvector cosine distance (`<=>`) similarity search, orders by similarity descending
- `ragRetrieveByText(userId, query, topK, agentType?)` — PostgreSQL full-text search using `plainto_tsquery` / `ts_rank`, available without embedding model
- `ragRetrieve(userId, query, options)` — combined entry point: uses vector path if `embedding` provided, falls back to text search

### Task 2: Thread Manager + Updated Server Routes

**`src/threads/manager.ts`**

Conversation thread lifecycle management with Store-based index:
- `createThreadId(userId, agentType)` — generates `{userId}:{agentType}:{timestamp}` thread IDs
- `parseThreadId(threadId)` — extracts `userId`, `agentType`, `createdAt` from thread ID string
- `registerThread(userId, agentType, threadId)` — writes thread to `{userId}:thread_index` prefix in Store
- `listThreads(userId, agentType?)` — reads all entries from thread index prefix, optionally filtered by agent type
- `getThreadState(threadId)` — calls `checkpointer.getTuple()` to retrieve last checkpoint for a thread

**`src/index.ts` (updated)**

Server routes updated to use real supervisor graph with conversation persistence:
- `POST /invoke` — accepts `user_id` (required), `thread_id` (optional, creates new if absent), `agent_type`; uses `createSupervisorGraph`; registers new threads on first use; echo graph fully removed
- `POST /invoke/resume` — resumes interrupted graph via `Command({ resume: { approved, feedback } })`; requires `thread_id` and `approved` boolean
- `POST /threads` — creates a new thread and registers it without invoking the graph
- `GET /threads/:userId` — lists all threads for a user (optionally filtered by `?agent_type=`)
- `GET /threads/:userId/:threadId` — retrieves last checkpoint state for a thread
- `/health` and `/store` endpoints preserved unchanged

## Verification

```
npx tsc --noEmit → exit code 0, zero errors
```

All 9 success criteria from the plan pass:
1. tsc --noEmit zero errors — PASS
2. HITL exports interruptForApproval and createResumeCommand — PASS
3. RAG tool queries document_embeddings with vector + text search — PASS
4. Thread manager create/list/inspect with Store index — PASS
5. /invoke uses supervisor graph not echo graph — PASS
6. /invoke accepts user_id + thread_id — PASS
7. /invoke/resume handles HITL approval flow — PASS
8. /threads provides thread CRUD per user — PASS
9. /health and /store endpoints preserved — PASS

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `6b56117` | feat(11-05): add HITL interrupt handler and RAG retrieval tool |
| 2 | `8a033ed` | feat(11-05): thread manager + supervisor graph wired in server routes |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified present:
- worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts — FOUND
- worrylesssuperagent/langgraph-server/src/tools/rag-retrieval.ts — FOUND
- worrylesssuperagent/langgraph-server/src/threads/manager.ts — FOUND
- worrylesssuperagent/langgraph-server/src/index.ts — FOUND (modified)

Commits verified:
- 6b56117 — FOUND
- 8a033ed — FOUND
