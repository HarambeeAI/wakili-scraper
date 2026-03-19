---
phase: 15
plan: 06
subsystem: agent-graphs
tags: [agents, langgraph, tool-wiring, classification, regex, personal-assistant, customer-support, legal, hr, pr, procurement, data-analyst, operations]
dependency_graph:
  requires: ["15-02", "15-03", "15-04", "15-05"]
  provides: ["all-8-agent-graphs-tool-wired"]
  affects: ["coo.ts", "supervisor.ts"]
tech_stack:
  added: []
  patterns:
    - "Tool-wired agent topology: readMemory -> {agent}Tools -> llmNode -> writeMemory -> respond"
    - "Regex classification for deterministic (zero-LLM-cost) request routing"
    - "businessContext.{agent}ToolResults injection pattern"
    - "needsInput signal for write operations requiring user-provided parameters"
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/agents/personal-assistant.test.ts
    - worrylesssuperagent/langgraph-server/src/agents/ops-classification.test.ts
  modified:
    - worrylesssuperagent/langgraph-server/src/agents/personal-assistant.ts
    - worrylesssuperagent/langgraph-server/src/agents/customer-support.ts
    - worrylesssuperagent/langgraph-server/src/agents/legal-compliance.ts
    - worrylesssuperagent/langgraph-server/src/agents/hr.ts
    - worrylesssuperagent/langgraph-server/src/agents/pr-comms.ts
    - worrylesssuperagent/langgraph-server/src/agents/procurement.ts
    - worrylesssuperagent/langgraph-server/src/agents/data-analyst.ts
    - worrylesssuperagent/langgraph-server/src/agents/operations.ts
    - worrylesssuperagent/langgraph-server/src/agents/coo.ts
decisions:
  - "Trailing \\b removed from plural regex patterns (anomal, supplier, project, conflict) — word boundary fails on 'anomalies', 'suppliers', 'projects'"
  - "coo.ts opsFactories widened to (cp?) => any — heterogeneous compiled graph topologies cannot share a typed factory signature after tool node rewrites"
metrics:
  duration: "~12 min"
  tasks_completed: 3
  files_modified: 9
  completed_date: "2026-03-19"
---

# Phase 15 Plan 06: Agent Graph Rewrites — Tool-Wired Topology Summary

All 8 agent graphs rewritten from createBaseAgentGraph wrappers to full tool-wired 5-node topology. 35 classification tests pass (11 PA + 24 ops). Full 171-test vitest suite passes.

## What Was Built

### Task 1: Personal Assistant Graph Rewrite + Classification Test

Rewrote `personal-assistant.ts` from a 2-line `createBaseAgentGraph` wrapper to a full tool-wired graph:

- **Graph topology**: `__start__ -> readMemory -> paTools -> llmNode -> writeMemory -> respond`
- **`classifyPARequest`**: 10 regex patterns covering email, calendar, drive, conflicts, and time allocation
- **`createPAToolsNode`**: Dispatches data-gathering tools (readEmails, triageInbox, listCalendarEvents, detectCalendarConflicts, analyzeTimeAllocation) automatically; signals needsInput for write operations (draftEmail, sendEmail, createEvent, meetingBrief, searchDrive)
- **Tool results**: Injected as `businessContext.paToolResults`
- **System prompt**: Updated to reflect real Google Workspace tools, removed "no tools yet" disclaimer
- **Test file**: `personal-assistant.test.ts` — 11 tests, all pass

### Task 2: CS, Legal, HR, PR Graph Rewrites

Rewrote 4 agent files. Each follows the identical 5-node pattern:

| Agent | Tools Node | Data-gathering Tools | Results Key |
|-------|-----------|---------------------|-------------|
| Customer Support | `csTools` | listTickets, detectChurnRisk | `csToolResults` |
| Legal Compliance | `legalTools` | listContracts, contractCalendar | `legalToolResults` |
| HR | `hrTools` | listCandidates | `hrToolResults` |
| PR Comms | `prTools` | analyzeSentiment | `prToolResults` |

Also fixed `coo.ts` — the `opsFactories` type and `createSubgraphNode` factory signature widened to `any` to handle heterogeneous compiled graph topologies after tool node rewrites added different node counts to each agent.

### Task 3: Procurement, Data Analyst, Operations Rewrites + All 7 Ops Tests

Rewrote 3 remaining agent files:

| Agent | Tools Node | Data-gathering Tools | Results Key |
|-------|-----------|---------------------|-------------|
| Procurement | `procurementTools` | (all needsInput) | `procurementToolResults` |
| Data Analyst | `daTools` | kpiAggregation | `daToolResults` |
| Operations | `opsTools` | listProjects, analyzeBottlenecks | `opsToolResults` |

Created `ops-classification.test.ts` — single file covering all 7 operational agents, 24 tests, all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plural word boundary regex failures**
- **Found during**: Task 1 (conflicts), Task 3 (anomalies, suppliers, projects)
- **Issue**: Trailing `\b` fails for plural forms — `\bconflict\b` does not match "conflicts" because 's' is a word character so no boundary exists between 't' and 's'
- **Fix**: Removed trailing `\b` from `isDetectConflicts`, `isAnomalyDetection`, `isSearchSuppliers`, and `isListProjects` patterns
- **Files modified**: `personal-assistant.ts`, `data-analyst.ts`, `procurement.ts`, `operations.ts`
- **Commits**: e6ddf0d (PA), bef3ee2 (ops)

**2. [Rule 3 - Blocking] coo.ts TypeScript type errors after graph rewrites**
- **Found during**: Task 2 TypeScript check
- **Issue**: `createSubgraphNode` and `opsFactories` were explicitly typed to `ReturnType<typeof createCustomerSupportGraph>`. After rewrites added new tool nodes, each graph has a different node count, making the types incompatible
- **Fix**: Widened `createSubgraphNode` factory parameter and `opsFactories` record value to `(cp?: PostgresSaver) => any` following the Phase 13-05 pattern
- **Files modified**: `coo.ts`
- **Commit**: 5f27946

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: 171 tests pass across 20 test files
- All 8 agent files use tool-wired topology: `readMemory -> {agent}Tools -> llmNode -> writeMemory -> respond`
- No agent file contains "You do NOT have tool access yet"
- All agents import from their respective `tools/{agent}/index.js` barrel

## Self-Check: PASSED

All created/modified files exist and all commits are present.
