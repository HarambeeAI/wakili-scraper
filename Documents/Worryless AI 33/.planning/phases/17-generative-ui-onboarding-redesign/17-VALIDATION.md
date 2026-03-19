---
phase: 17
slug: generative-ui-onboarding-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 (frontend jsdom) + vitest ^4.1.0 (LangGraph server) |
| **Config file** | `worrylesssuperagent/vitest.config.ts` (frontend), langgraph-server uses inline config |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run src/__tests__/` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run src/__tests__/`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | GUI-08 | unit | `cd worrylesssuperagent/langgraph-server && npx vitest run src/__tests__/sse-stream.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | GUI-09 | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/useAgentChat.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | GUI-02 | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/GenerativeUIRenderer.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | GUI-06 | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/HITLApprovalCard.test.ts` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | ONB-01 | unit (jsdom) | `cd worrylesssuperagent && npx vitest run src/__tests__/BusinessStageSelector.test.ts` | ❌ W0 | ⬜ pending |
| 17-03-02 | 03 | 2 | ONB-06 | manual-only | n/a — SQL migration | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `worrylesssuperagent/langgraph-server/src/__tests__/sse-stream.test.ts` — stubs for GUI-08
- [ ] `worrylesssuperagent/src/__tests__/useAgentChat.test.ts` — stubs for GUI-09
- [ ] `worrylesssuperagent/src/__tests__/GenerativeUIRenderer.test.ts` — stubs for GUI-02
- [ ] `worrylesssuperagent/src/__tests__/HITLApprovalCard.test.ts` — stubs for GUI-06
- [ ] `worrylesssuperagent/src/__tests__/BusinessStageSelector.test.ts` — stubs for ONB-01
- [ ] `npm install @tanstack/react-table` — required for data table components

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `profiles.business_stage` migration adds column with CHECK constraint | ONB-06 | SQL migration — verify in Supabase dashboard | Run migration, query `information_schema.columns` for `business_stage` on `profiles` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
