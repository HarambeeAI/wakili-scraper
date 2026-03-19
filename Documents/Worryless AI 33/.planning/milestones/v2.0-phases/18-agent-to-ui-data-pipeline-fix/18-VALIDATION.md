---
phase: 18
slug: agent-to-ui-data-pipeline-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend: jsdom, langgraph-server: node) |
| **Config file** | `worrylesssuperagent/vitest.config.ts` (frontend), `worrylesssuperagent/langgraph-server/vitest.config.ts` (server) |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run && cd langgraph-server && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run src/__tests__/ && cd langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run && cd langgraph-server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | GRAPH-05 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` | ✅ (needs new test case) | ⬜ pending |
| 18-01-02 | 01 | 0 | GUI-06 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/useAgentChat.test.ts` | ✅ (needs new test case) | ⬜ pending |
| 18-02-01 | 02 | 1 | GUI-02, GUI-07 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | GUI-02, GUI-07 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | GRAPH-05 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` | ✅ (needs new test case) | ⬜ pending |
| 18-03-02 | 03 | 2 | GUI-02 | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/useAgentChat.test.ts` | ✅ (needs new test case) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worrylesssuperagent/langgraph-server/src/__tests__/sse-stream.test.ts` — add test cases for: (a) pending_approvals event emitted when graph has interrupts, (b) ui_components event emitted when uiComponents in state
- [ ] `worrylesssuperagent/src/__tests__/useAgentChat.test.ts` — add test for: pending_approvals SSE event attaches approval to `msg.pendingApproval`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| InlinePLTable renders real financial data inline in chat | GUI-07 | Visual rendering verification | 1. Chat with Accountant, ask for P&L report 2. Verify inline table appears with months/revenue/expenses 3. Verify not just text narration |
| PipelineKanban renders deal stages inline in chat | GUI-07 | Visual rendering verification | 1. Chat with Sales Rep, ask for pipeline analysis 2. Verify kanban board appears with deal stages 3. Verify deals are in correct columns |
| HITLApprovalCard buttons work end-to-end | GRAPH-05 | Requires full graph execution | 1. Trigger agent action needing approval 2. Verify card appears with Approve/Reject/Discuss 3. Click Approve, verify graph resumes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
