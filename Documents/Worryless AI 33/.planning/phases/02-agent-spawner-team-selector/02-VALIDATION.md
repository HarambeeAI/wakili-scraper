---
phase: 2
slug: agent-spawner-team-selector
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no test config files in project |
| **Config file** | None — Wave 0 installs Deno test for edge functions |
| **Quick run command** | `deno test supabase/functions/spawn-agent-team/` |
| **Full suite command** | `deno test supabase/functions/spawn-agent-team/ && deno test supabase/functions/orchestrator/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Manual browser review in dev environment
- **After every plan wave:** SQL queries in Supabase Studio to verify DB state + full Deno test suite
- **Before `/gsd:verify-work`:** Full suite must be green + manual walkthrough of onboarding Step 12
- **Max feedback latency:** ~30 seconds (SQL queries + manual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | TOOLS-01, TOOLS-02 | integration | `SELECT id FROM available_agent_types WHERE skill_config IS NULL OR skill_config = '[]'::jsonb` | ✅ Via Supabase Studio | ⬜ pending |
| 2-01-02 | 01 | 1 | TOOLS-03 | integration | SQL verify TOOLS.md exists per agent | ✅ Via Supabase Studio | ⬜ pending |
| 2-02-01 | 02 | 1 | SPAWN-01, SPAWN-02 | unit | `deno test supabase/functions/spawn-agent-team/` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | SPAWN-02 | unit | Catalog ID filtering logic test | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | SPAWN-03, SPAWN-04 | manual | Onboarding Step 12 renders after validator_sales | — | ⬜ pending |
| 2-03-02 | 03 | 2 | SPAWN-05, SPAWN-07 | integration | `SELECT * FROM user_agents WHERE user_id = '{test_user}'` | ✅ Via Supabase Studio | ⬜ pending |
| 2-03-03 | 03 | 2 | SPAWN-06 | manual | Briefing animation 2-3s visible before dashboard loads | — | ⬜ pending |
| 2-04-01 | 04 | 2 | TOOLS-04 | manual | HR agent cannot trigger invoice functions via orchestrator | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/spawn-agent-team/spawn.test.ts` — unit tests for catalog ID filtering (SPAWN-02)
- [ ] Deno test runner available in project (verify with `deno --version`)

*No React test framework needed for Phase 2 — UI verification is manual.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step 12 renders after validator_sales completes | SPAWN-03 | UI state transition — no test framework | Complete onboarding to step 11, click Continue, verify Step 12 appears |
| Default agents pre-checked + locked | SPAWN-04 | UI checkbox state | Open Step 12, verify 4 agents have locked checkboxes, 1+ recommended pre-checked |
| Accept Suggested Team activates agents | SPAWN-05 | End-to-end user flow | Click Accept, verify agents appear in sidebar |
| Briefing animation duration | SPAWN-06 | Visual timing | Observe 2–3 second briefing screen before dashboard renders |
| Orchestrator tool boundary enforcement | TOOLS-04 | LLM routing logic | Send HR-context task, verify invoice edge function is not called |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
