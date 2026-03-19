---
phase: 9
slug: tech-debt-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 |
| **Config file** | `worrylesssuperagent/vitest.config.ts` |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

Note: No `test` script in `package.json`. Use `npx vitest run` directly from `worrylesssuperagent/`.

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | quality | TypeScript compile | `cd worrylesssuperagent && npx tsc --noEmit` | N/A | ⬜ pending |
| 9-01-02 | 01 | 1 | quality | full suite | `cd worrylesssuperagent && npx vitest run` | N/A | ⬜ pending |
| 9-02-01 | 02 | 1 | quality | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/sanitize.test.ts` | ✅ | ⬜ pending |
| 9-02-02 | 02 | 1 | quality | full suite | `cd worrylesssuperagent && npx vitest run` | N/A | ⬜ pending |
| 9-03-01 | 03 | 1 | quality | manual visual | N/A — check step label in browser | N/A | ⬜ pending |
| 9-03-02 | 03 | 1 | quality | unit | `cd worrylesssuperagent && npx vitest run src/__tests__/useTeamData.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

The only gap is that `src/__tests__/useTeamData.test.ts` has stubs for the `useTeamData` describe block. These are existing stubs that do not block passing — they can be filled in as part of plan 09-03 or left as todos.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step label shows correct number | quality (SPAWN-03) | Hardcoded string in JSX | Load onboarding UI, navigate to AgentTeamSelector step, confirm label reads "Step 12 of 12" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
