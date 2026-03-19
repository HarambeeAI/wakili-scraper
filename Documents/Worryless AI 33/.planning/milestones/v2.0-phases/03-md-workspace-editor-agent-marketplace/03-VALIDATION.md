---
phase: 3
slug: md-workspace-editor-agent-marketplace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (none detected — Wave 0 installs) |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | WS-04 | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | WS-05 | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts -t "reset to defaults"` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | WS-06 | unit | `npx vitest run src/__tests__/sanitize.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | WS-07 | unit | `npx vitest run src/__tests__/buildWorkspacePrompt.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | WS-02 | smoke | visual inspection | ❌ manual | ⬜ pending |
| 3-02-02 | 02 | 1 | WS-04 | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts -t "fires after 2s"` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | WS-01 | smoke | visual inspection | ❌ manual | ⬜ pending |
| 3-03-02 | 03 | 1 | WS-03 | smoke | visual inspection — MEMORY tab read-only | ❌ manual | ⬜ pending |
| 3-03-03 | 03 | 1 | WS-05 | unit | `npx vitest run src/__tests__/useWorkspaceAutoSave.test.ts -t "reset to defaults"` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | MKT-01 | smoke | visual inspection — marketplace entry points visible | ❌ manual | ⬜ pending |
| 3-04-02 | 04 | 2 | MKT-02 | smoke | visual inspection — 12 catalog types listed | ❌ manual | ⬜ pending |
| 3-04-03 | 04 | 2 | MKT-03 | integration | manual / Supabase local | ❌ manual | ⬜ pending |
| 3-04-04 | 04 | 2 | MKT-04 | integration | manual / Supabase local | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `src/__tests__/sanitize.test.ts` — stubs for WS-06; tests client-side mirror of sanitize.ts
- [ ] `src/__tests__/useWorkspaceAutoSave.test.ts` — stubs for WS-04, WS-05; mocks Supabase client
- [ ] `src/__tests__/buildWorkspacePrompt.test.ts` — stubs for WS-07; pure function, no mocks needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CodeMirror mounts and accepts text input | WS-02 | UI rendering — no test renderer for CM6 | Open agent panel → Workspace tab → type in any editable tab |
| 6 sub-tabs render for any agent | WS-01 | UI structure — visual confirmation | Open any agent settings → count sub-tabs: IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS |
| MEMORY tab is read-only | WS-03 | UI behavior — no automated assertion | Click MEMORY tab → attempt to type → confirm no cursor appears |
| activateAgent inserts user_agents row | MKT-03 | Requires live Supabase — no local DB mock | Click Add to Team → verify agent appears in sidebar immediately |
| deactivateAgent sets is_active=false, preserves workspaces | MKT-04 | Requires live Supabase | Deactivate agent → verify sidebar removal → re-activate → verify workspace data intact |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
