---
phase: 01-database-foundation
plan: 03
subsystem: database
tags: [postgres, supabase, sql, migrations, seed-data]

# Dependency graph
requires:
  - phase: 01-database-foundation plan 01
    provides: available_agent_types table schema with 6 default_*_md columns
  - phase: 01-database-foundation plan 02
    provides: create_agent_workspace() trigger that reads default_*_md columns
provides:
  - 13 agent type seed rows in available_agent_types (chief_of_staff depth=0 + 12 specialists depth=1)
  - Complete markdown workspace templates for every agent role (identity, soul, sops, memory, heartbeat, tools)
affects:
  - Phase 2 onboarding (agent team selector reads this catalog)
  - Phase 3 workspace editor (default content seeded from these templates)
  - Phase 4 heartbeat system (heartbeat_md content consumed by heartbeat dispatcher)
  - Phase 5 morning briefing (chief_of_staff and specialist heartbeat templates define finding format)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dollar-quoted string literals with unique per-column tags ($chief_identity$...$chief_identity$) to safely embed markdown in SQL"
    - "Separate INSERT per agent (not multi-row VALUES) to allow per-agent dollar-quote tag namespacing"
    - "ON CONFLICT (id) DO NOTHING on all seed INSERTs for safe re-application idempotency"

key-files:
  created:
    - worrylesssuperagent/supabase/migrations/20260312000003_seed_agent_types.sql
  modified: []

key-decisions:
  - "Separate INSERT per agent rather than multi-row VALUES — avoids dollar-quote tag collision across 13 agents × 6 columns"
  - "Unique dollar-quote tag per column per agent (e.g., $chief_identity$ vs $acct_identity$) — prevents PostgreSQL parser ambiguity in large markdown strings"

patterns-established:
  - "Seed migrations: one INSERT per entity, ON CONFLICT DO NOTHING, dollar-quote per column with agent-prefixed tags"

requirements-completed: [DB-01, DB-03]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 1 Plan 03: Agent Types Seed Migration Summary

**13-row seed migration for available_agent_types: Chief of Staff orchestrator (depth=0) plus 12 domain specialists each with 6 complete role-specific markdown workspace templates**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T17:34:16Z
- **Completed:** 2026-03-12T17:40:05Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created 20260312000003_seed_agent_types.sql with 13 complete INSERT statements
- Every agent has non-empty content across all 6 markdown template columns (identity, soul, sops, memory, heartbeat, tools)
- Every HEARTBEAT.md template includes the required JSON response format block (`{"severity": "ok"}` / `{"severity": "urgent|headsup|digest", "finding": "..."}`)
- All dollar-quote tags are unique per column within each INSERT (no tag reuse that would confuse the PostgreSQL parser)
- ON CONFLICT (id) DO NOTHING on all 13 INSERTs — migration is safe to re-apply

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seed migration with full markdown content for all 13 agent types** - `572640d` (feat) — committed in worrylesssuperagent repo

**Plan metadata:** (docs commit below in .planning repo)

## Files Created/Modified
- `worrylesssuperagent/supabase/migrations/20260312000003_seed_agent_types.sql` — 1,446-line seed migration with 13 agent type INSERT statements; dollar-quoted markdown per column; ON CONFLICT DO NOTHING

## Decisions Made
- Separate INSERT per agent (not multi-row VALUES) to allow unique dollar-quote tag namespacing per agent — avoids PostgreSQL parser ambiguity when 78 dollar-quoted strings (13 agents × 6 columns) appear in one file
- Dollar-quote tags follow pattern `$<agent_abbr>_<column>$` (e.g., `$chief_identity$`, `$acct_soul$`) — readable, collision-free

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The worrylesssuperagent/ directory is a nested git repository; the migration was committed there (hash `572640d`) rather than the outer planning repo, consistent with the pattern established in plans 01-01 and 01-02.

## User Setup Required

None — no external service configuration required for this migration file creation. Migration must be applied to Supabase when infrastructure is available (see plan 01-01 for Supabase CLI apply instructions).

## Next Phase Readiness
- available_agent_types catalog is fully seeded — ready for Phase 2 onboarding agent team selector to read agent catalog
- All 6 default_*_md columns contain substantive content — workspace trigger (Plan 02) will produce useful defaults on first agent activation
- Heartbeat templates define the JSON response contract that Phase 4 dispatcher will parse

---
*Phase: 01-database-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: worrylesssuperagent/supabase/migrations/20260312000003_seed_agent_types.sql
- FOUND: .planning/phases/01-database-foundation/01-03-SUMMARY.md
- FOUND: commit 572640d in worrylesssuperagent repo
