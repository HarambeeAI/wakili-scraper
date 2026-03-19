---
phase: 11-agent-graph-topology-+-memory-foundation
plan: "03"
subsystem: langgraph-server
tags: [langgraph, agents, supervisor, routing, command, coo, operational-agents]

dependency_graph:
  requires:
    - phase: 11-01
      provides: AgentState, AgentTypeId, callLLM, callLLMWithStructuredOutput, createReadMemoryNode, createWriteMemoryNode
    - phase: 11-02
      provides: createBaseAgentGraph, BaseAgentConfig
  provides:
    - createCustomerSupportGraph
    - createLegalComplianceGraph
    - createHRGraph
    - createPRCommsGraph
    - createProcurementGraph
    - createDataAnalystGraph
    - createOperationsGraph
    - createCOOGraph (level-2 supervisor with LLM routing via Command objects)
  affects: [11-04, 11-05, chief-of-staff-graph, cos-routing]

tech-stack:
  added: []
  patterns:
    - "Operational agent subgraph pattern: createBaseAgentGraph with role-specific system prompt"
    - "COO level-2 supervisor: StateGraph with LLM router node returning Command({ goto: agentType })"
    - "Dynamic node registration via COO_REPORTS loop with any cast to bypass TypeScript generic narrowing"
    - "Invoke-delegate subgraph pattern: COO invokes each operational subgraph via graph.invoke(state)"

key-files:
  created:
    - worrylesssuperagent/langgraph-server/src/agents/customer-support.ts
    - worrylesssuperagent/langgraph-server/src/agents/legal-compliance.ts
    - worrylesssuperagent/langgraph-server/src/agents/hr.ts
    - worrylesssuperagent/langgraph-server/src/agents/pr-comms.ts
    - worrylesssuperagent/langgraph-server/src/agents/procurement.ts
    - worrylesssuperagent/langgraph-server/src/agents/data-analyst.ts
    - worrylesssuperagent/langgraph-server/src/agents/operations.ts
    - worrylesssuperagent/langgraph-server/src/agents/coo.ts
  modified: []

key-decisions:
  - "Invoke-delegate subgraph pattern used instead of passing compiled graph to addNode — avoids checkpointer conflicts between parent and child graphs"
  - "COO builder cast to `any` for dynamic node registration — TypeScript narrows StateGraph generics on each addNode call, making iterative string-key registration impossible without cast"
  - "COO_REPORTS used as routing validation list with AGENT_TYPES.OPERATIONS as fallback for unexpected LLM classification output"
  - "COO readMemory node included to load COO-level context, but operational agents re-read their own memory via base-agent flow"
  - "Temperature 0.1 for COO router — routing is deterministic classification, not creative generation"

patterns-established:
  - "Operational agent subgraph: import createBaseAgentGraph + AGENT_TYPES, define system prompt, export create{Agent}Graph(checkpointer?)"
  - "LLM router node: callLLMWithStructuredOutput with schema string, validate against COO_REPORTS, return Command({ goto: agentType })"
  - "System prompts end with 'You do NOT have tool access yet — respond conversationally' disclaimer for pre-tool phases"

requirements-completed: [GRAPH-04, GRAPH-06]

duration: 9min
completed: "2026-03-19"
---

# Phase 11 Plan 03: 7 Operational Agent Subgraphs + COO Level-2 Supervisor Summary

**7 operational agent subgraphs (Customer Support, Legal, HR, PR, Procurement, Data Analyst, Operations) plus COO supervisor using callLLMWithStructuredOutput routing via Command objects to delegate to the correct operational specialist**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-18T21:00:00Z
- **Completed:** 2026-03-18T21:08:54Z
- **Tasks:** 2
- **Files modified:** 8 created

## Accomplishments

- Created 7 operational agent subgraphs, each following the base-agent pattern with role-specific 15-25 line system prompts derived from V2_ARCHITECTURE.md
- Created COO level-2 supervisor StateGraph with LLM-driven routing: reads memory, classifies request via `callLLMWithStructuredOutput`, returns `Command({ goto: agentType })` to route to the correct operational agent
- All 7 operational agents registered as invoke-delegate nodes in the COO graph using the COO_REPORTS constant as the authoritative routing target list
- Zero TypeScript compile errors across all 8 new files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 7 operational agent subgraphs** - `c89d93d` (feat)
2. **Task 2: Create COO level-2 supervisor subgraph** - `5193d08` (feat)

**Plan metadata:** (docs commit — recorded below)

## Files Created/Modified

- `src/agents/customer-support.ts` - Customer Support agent: ticket management, KB RAG, customer health scoring, churn detection
- `src/agents/legal-compliance.ts` - Legal & Compliance agent: contract review, risk flagging, regulatory monitoring, template drafting
- `src/agents/hr.ts` - HR agent: hiring lifecycle, resume screening, onboarding plans, performance reviews
- `src/agents/pr-comms.ts` - PR & Comms agent: press releases, media monitoring, coverage tracking, brand sentiment
- `src/agents/procurement.ts` - Procurement agent: supplier search, quote comparison, PO creation with HITL, vendor scoring
- `src/agents/data-analyst.ts` - Data Analyst agent: cross-functional queries, anomaly detection (Z-score), chart-ready JSON, KPI aggregation
- `src/agents/operations.ts` - Operations agent: project management, milestone tracking, bottleneck analysis, SOP drafting
- `src/agents/coo.ts` - COO level-2 supervisor: LLM router node, 7 operational subgraph nodes, Command-based routing

## Decisions Made

- **Invoke-delegate over subgraph-as-node:** COO uses `graph.invoke(state)` pattern rather than passing a compiled graph to `addNode`. This avoids checkpointer conflicts where the parent would try to supply the subgraph's internal checkpointer.
- **`any` cast for dynamic registration:** LangGraph JS StateGraph narrows its generic type parameter on each `.addNode()` call. Iterating COO_REPORTS and calling `builder.addNode(agentType, ...)` with runtime string keys produces type incompatibilities. The cast to `any` is the idiomatic workaround used in dynamic graph construction scenarios.
- **Temperature 0.1 for router:** The COO router performs deterministic classification (route to one of 7 fixed targets), not creative reasoning. Low temperature reduces hallucination of invalid department names.
- **Operations as fallback:** When the LLM returns an unexpected department string not in COO_REPORTS, the router falls back to `operations` — the broadest operational scope that can handle most edge cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript generic narrowing on dynamic StateGraph node registration**
- **Found during:** Task 2 (COO supervisor creation)
- **Issue:** LangGraph JS `StateGraph` tracks registered node names as generic type parameters. Reassigning `builder` in a loop via `builder = builder.addNode(agentType, ...)` with `agentType: AgentTypeId` causes TypeScript to report type incompatibility because each `.addNode()` call creates a more-specific narrowed type.
- **Fix:** Cast the initial builder to `any` with a clear explanatory comment. This is the correct pattern for dynamic graph construction in LangGraph JS when node names are not statically known.
- **Files modified:** `src/agents/coo.ts`
- **Verification:** `tsc --noEmit` exits with code 0 after the fix
- **Committed in:** `5193d08` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required to achieve clean TypeScript compilation. The `any` cast is contained to a single local variable with explanatory comment. No behavior change.

## Issues Encountered

- `base-agent.ts` existed on disk (committed in 8c32664) but the 4 specialist agents from Plan 11-02 Task 2 (accountant, marketer, sales-rep, personal-assistant) were not found. Plan 11-03 does not import these files, so execution was not blocked. Those agents will be created when Plan 11-02 is re-run or completed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 operational agent subgraphs ready for Plan 11-04 (Chief of Staff root supervisor)
- COO graph exports `createCOOGraph(checkpointer?)` — CoS will import and register it as a subgraph node
- All files compile cleanly, ready for Chief of Staff to wire up the full routing topology
- Remaining concern: Plans 11-02 Task 2 (4 specialist agents) still need execution before Plan 11-04 attempts to import them

## Self-Check: PASSED

All 8 created files verified on disk. Both task commits (c89d93d, 5193d08) and metadata commit (5077d19) verified in git history. TypeScript compilation confirmed clean (0 errors).

---
*Phase: 11-agent-graph-topology-+-memory-foundation*
*Completed: 2026-03-19*
