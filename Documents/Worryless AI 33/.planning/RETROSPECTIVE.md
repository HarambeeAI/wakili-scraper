# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Agent Intelligence Layer

**Shipped:** 2026-03-20
**Phases:** 9 | **Plans:** 43

### What Was Built
- LangGraph multi-agent server with 13-agent hierarchical graph (CoS → 5 specialists + COO → 7 ops agents)
- 65+ real tool implementations across all agent roles (financial, marketing, sales, PA, operational)
- Playwright persistent browser for Marketer social media operations (publish, scrape analytics, research competitors)
- Proactive cadence engine: pg_cron → pgmq → full LangGraph graph execution on daily/weekly/monthly/quarterly schedules
- Chat-first generative UI with SSE streaming, inline components (P&L tables, kanbans, charts, forms, approval cards)
- Business-stage-aware onboarding redesign ending with real CoS briefing

### What Worked
- Wave-based parallel plan execution — Wave 1 plans (independent) ran in parallel, Wave 2 (dependent) ran after, maximizing throughput
- Research-before-planning pattern consistently prevented shallow implementations — researcher agents identified exact code gaps before planner wrote tasks
- Plan checker revision loop caught GUI-04 and GUI-05 coverage gaps before execution, saving a full verification cycle
- Gap closure phase (18) as a clean pattern: milestone audit → identify broken E2E flows → targeted fix phase

### What Was Inefficient
- 10 of 18 phases lack VERIFICATION.md — verifier was disabled in config, reducing confidence in phase-level quality
- Some summary frontmatter fields (one_liner, task_count, requirements_completed) were not consistently populated by executors
- Phase 18 could have been avoided if Phase 17 planner had checked that tool nodes populate uiComponents — the gap was a planning oversight, not a code problem

### Patterns Established
- Agent tool pattern: classify request → execute matching tool → write memory → build uiComponents → respond
- Spread-only-if-nonempty pattern for state accumulator channels (prevents empty arrays in state)
- SSE event protocol: 6 event types (token, tool_start, tool_end, ui_components, pending_approvals, done)
- HITL interrupt detection: check `finalState.tasks[].interrupts[]` not `state.pendingApprovals`

### Key Lessons
1. E2E data pipeline verification should be part of every UI phase plan — building components and building the data path to them are separate concerns that must both be planned
2. Milestone audit before completion catches integration gaps that phase-level verification misses — always run it
3. The cost of verbose, concrete plans (with exact code blocks) is far less than the cost of re-doing shallow execution

### Cost Observations
- Model mix: ~30% opus (planning, revision), ~70% sonnet (research, execution, verification)
- Notable: Parallel Wave 1 execution (3 agents) completed in the time of the slowest agent, not 3x sequential

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 9 | 39 | Foundation: DB, UI, heartbeats, verifications, cleanup |
| v2.0 | 9 | 43 | Intelligence: LangGraph, tools, cadence, generative UI, pipeline fix |

### Top Lessons (Verified Across Milestones)

1. Gap closure phases are a healthy pattern — catching integration issues post-milestone-audit and fixing them in a targeted phase is cheaper than trying to get everything perfect in the first pass
2. Research agents consistently improve plan quality — phases with research had fewer verification failures than those without
