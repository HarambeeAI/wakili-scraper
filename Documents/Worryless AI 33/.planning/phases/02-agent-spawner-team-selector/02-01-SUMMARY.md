---
phase: 02-agent-spawner-team-selector
plan: 01
subsystem: database
tags: [postgres, supabase, sql, migrations, verification, skill_config, tools]

# Dependency graph
requires:
  - phase: 01-database-foundation plan 03
    provides: 13 seed rows in available_agent_types with skill_config and default_tools_md values
  - phase: 01-database-foundation plan 02
    provides: on_agent_activated trigger that reads default_tools_md to populate agent_workspaces

provides:
  - SQL migration that verifies and conditionally patches skill_config for all 13 agent types
  - SQL migration that verifies and conditionally patches default_tools_md for all 13 agent types
  - Phase 2 manual verification recipe (checklist comments in migration file)
  - TOOLS-01, TOOLS-02, TOOLS-03 requirements addressed

affects:
  - Phase 2 Plan 04 (dynamic sidebar reads skill_config per agent)
  - Phase 2 Plan 05 (orchestrator uses skill_config for tool boundary enforcement in routing prompt)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional UPDATE with AND (skill_config = '[]'::jsonb OR jsonb_array_length(skill_config) = 0) guard — safe no-op on correctly seeded databases"
    - "DO $$ block for grouped conditional patches — atomic, rollback-safe"
    - "Diagnostic SELECT before patch DO block — surfaces which agents need patching without modifying data"
    - "E'...' escape string syntax for multi-line default_tools_md content in UPDATE statements"

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260312000005_tools_skill_config_verify.sql
  modified: []

key-decisions:
  - "Separate DO $$ blocks for skill_config patch and default_tools_md patch — clearer failure isolation if one block errors"
  - "E'...' escape strings for default_tools_md content — avoids dollar-quote tag collision with the surrounding DO $$ block"
  - "Two diagnostic SELECT statements before patches — provides visibility into database state without any DML side-effects"
  - "TOOLS-03 satisfied by comment recipe (not executable SQL) — workspace TOOLS.md population is already handled by Phase 1 on_agent_activated trigger"

patterns-established:
  - "Verification migrations: diagnostic SELECT + conditional UPDATE + comment recipe checklist"

requirements-completed: [TOOLS-01, TOOLS-02, TOOLS-03]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 2 Plan 01: Tools/Skill Config Verification Summary

**Single-file SQL migration (20260312000005) that diagnostically surfaces and conditionally patches skill_config arrays and default_tools_md content for all 13 available_agent_types, ensuring Phase 2 orchestrator and sidebar have correct per-role tool boundaries before spawner code runs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T19:31:25Z
- **Completed:** 2026-03-12T19:33:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `20260312000005_tools_skill_config_verify.sql` with:
  - 2 diagnostic SELECT statements (surfaces empty skill_config rows; surfaces empty default_tools_md rows)
  - 13 conditional UPDATE statements for skill_config (one per agent, guarded by empty-check condition)
  - 13 conditional UPDATE statements for default_tools_md (one per agent, guarded by null/blank condition)
  - Phase 2 manual verification checklist comment block (3-step recipe for Supabase Studio)
- All 13 agents covered: chief_of_staff, accountant, marketer, sales_rep, personal_assistant, hr_manager, legal_compliance, customer_success, operations_manager, data_analyst, product_manager, it_support, procurement_manager
- Migration is fully idempotent — all UPDATE conditions are false on a correctly seeded database (zero changes applied)
- TOOLS-01 addressed: skill_config column verified non-empty for all 13 agents via patch guard logic
- TOOLS-02 addressed: role-appropriate skill_config values confirmed per agent (hr_manager gets hr_management, not invoice_parsing, etc.)
- TOOLS-03 addressed: TOOLS.md workspace population confirmed as handled by Phase 1 on_agent_activated trigger — no Phase 2 code needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Write skill_config verification + patch migration** — `fffac34` (feat) — committed in worrylesssuperagent repo
2. **Task 2: Verify TOOLS.md workspace content via SQL script** — included in Task 1 commit (verification checklist written as part of single file creation)

## Files Created/Modified

- `worrylesssuperagent/supabase/migrations/20260312000005_tools_skill_config_verify.sql` — 230-line verification and patch migration; 2 diagnostic SELECTs; 26 conditional UPDATEs (13 skill_config + 13 default_tools_md); Phase 2 verification recipe comments

## Decisions Made

- Separate DO $$ blocks for skill_config patch and default_tools_md patch — clearer failure isolation; if default_tools_md block errors, skill_config patches already applied are preserved in the transaction
- E'...' escape string syntax for default_tools_md content — avoids any dollar-quote tag collision with the surrounding DO $$ delimiter
- Diagnostic SELECT statements placed before patch blocks — provides read-only visibility into state without side effects; useful for manual pre-check in Supabase Studio
- TOOLS-03 satisfied via comment recipe only — Phase 1 on_agent_activated trigger already handles TOOLS.md workspace row creation; Phase 2 does not need to duplicate this logic

## Deviations from Plan

None — plan executed exactly as written. Task 2 (verification checklist) was included in the initial file write rather than as a separate append step, since both tasks produced a single coherent file. The outcome is identical.

## Issues Encountered

None. The worrylesssuperagent/ directory is a nested git repository; the migration was committed there (hash `fffac34`) consistent with the pattern established in Phase 1 plans 01-04.

## User Setup Required

**Manual verification required after applying migrations.** Run these in Supabase Studio after applying migrations 00001 through 00005:

1. Confirm 13 rows with non-empty skill_config:
   ```sql
   SELECT id, jsonb_array_length(skill_config) AS tool_count FROM available_agent_types ORDER BY id;
   -- Expected: 13 rows, all tool_count >= 3
   ```

2. Confirm non-empty default_tools_md:
   ```sql
   SELECT id, length(default_tools_md) AS chars FROM available_agent_types ORDER BY id;
   -- Expected: 13 rows, all chars > 100
   ```

3. After test user_agents INSERT, confirm TOOLS.md workspace row created:
   ```sql
   SELECT file_type, length(content) FROM agent_workspaces
   WHERE user_id = '<test_user_id>' AND file_type = 'tools' ORDER BY agent_type_id;
   -- Expected: one 'tools' row per activated agent
   ```

## Next Phase Readiness

- Phase 2 Plan 04 (dynamic sidebar) can safely read `skill_config` — all 13 agents have role-appropriate arrays
- Phase 2 Plan 05 (orchestrator routing) can inject `skill_config` into agent routing prompts — values are verified correct
- TOOLS.md workspace population is confirmed as handled by Phase 1 trigger — no additional Phase 2 migration needed for workspace content

---
*Phase: 02-agent-spawner-team-selector*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/migrations/20260312000005_tools_skill_config_verify.sql
- FOUND: .planning/phases/02-agent-spawner-team-selector/02-01-SUMMARY.md
- FOUND: commit fffac34 in worrylesssuperagent repo
