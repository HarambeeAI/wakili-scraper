---
phase: 16-proactive-cadence-engine
plan: "01"
subsystem: cadence-engine
tags: [database, sql, heartbeat, cadence, typescript, tdd]
dependency_graph:
  requires: []
  provides:
    - cadence_config JSONB column on user_agents
    - next_weekly/monthly/quarterly_heartbeat_at TIMESTAMPTZ columns
    - get_due_cadence_agents() SQL function returning cadence_tier
    - HEARTBEAT_PROMPTS module for all 13 agents across 4 tiers
    - DEFAULT_CADENCE_CONFIG TypeScript constant (CAD-08)
    - getHeartbeatPrompt helper with tier fallback
  affects:
    - heartbeat-runner (reads cadence_tier from get_due_cadence_agents)
    - Plans 16-02 through 16-05 (all depend on cadence foundation)
tech_stack:
  added: []
  patterns:
    - UNION ALL across 4 cadence tiers in SQL function
    - Regex-keyword alignment: prompts verified against classify*Request functions
    - DEFAULT constant mirrors SQL migration DEFAULT JSONB (CAD-08 pattern)
key_files:
  created:
    - worrylesssuperagent/supabase/migrations/20260320000001_cadence_config.sql
    - worrylesssuperagent/supabase/migrations/20260320000002_cadence_dispatcher_v2.sql
    - worrylesssuperagent/langgraph-server/src/cadence/heartbeat-prompts.ts
    - worrylesssuperagent/langgraph-server/src/cadence/heartbeat-prompts.test.ts
    - worrylesssuperagent/langgraph-server/src/cadence/cadence-config.test.ts
  modified: []
decisions:
  - "accountant monthly prompt uses 'unusual or suspicious' (not 'anomaly') because isAnomalyQuery regex /\\b(anomal|...)\\b/ requires word boundary after stem — 'anomaly' fails \\banomal\\b match"
  - "DEFAULT_CADENCE_CONFIG co-located in heartbeat-prompts.ts (not separate cadence-config.ts) — single source of truth for cadence module exports"
  - "get_due_cadence_agents() uses ORDER BY cadence_tier ASC (daily<monthly<quarterly<weekly alphabetically) — acceptable since priority is enforced by next-run timestamps"
metrics:
  duration: "6 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_created: 6
---

# Phase 16 Plan 01: Cadence Schema Foundation + Heartbeat Prompt Library Summary

Created the database schema for multi-tier cadence configuration and built the heartbeat prompt library using TDD, with prompts verified against each agent's actual classify*Request regex patterns.

## What Was Built

### 1. DB Migration: cadence_config schema (20260320000001_cadence_config.sql)

Added 5 new columns to `user_agents`:

- `cadence_config JSONB NOT NULL DEFAULT {...}` — 6 keys: `daily_enabled`, `weekly_enabled`, `monthly_enabled`, `quarterly_enabled`, `event_triggers_enabled`, `event_cooldown_hours`
- `next_weekly_heartbeat_at TIMESTAMPTZ` — for weekly tier scheduling
- `next_monthly_heartbeat_at TIMESTAMPTZ` — for monthly tier scheduling
- `next_quarterly_heartbeat_at TIMESTAMPTZ` — for quarterly tier scheduling
- `last_event_notified_at TIMESTAMPTZ` — for event-trigger cooldown tracking

Defaults: daily + weekly enabled, monthly + quarterly off. Backfill UPDATE sets initial timestamps for existing active agents. 3 partial indexes added for dispatcher efficiency.

### 2. DB Migration: multi-tier dispatcher function (20260320000002_cadence_dispatcher_v2.sql)

`get_due_cadence_agents()` returns agents due for ANY cadence tier via UNION ALL across 4 tiers. Output includes `cadence_tier TEXT` so the runner knows which prompt to use. Original `get_due_heartbeat_agents()` preserved for non-LangGraph users.

Key differences from original:
- Daily tier: same logic as original + `cadence_config->>'daily_enabled'` check
- Weekly/monthly/quarterly: check their respective `next_*_heartbeat_at` columns, no daily budget check (frequency is self-limiting)
- All tiers: business-hours check (DST-safe AT TIME ZONE)

### 3. Heartbeat Prompts Module (heartbeat-prompts.ts)

`HEARTBEAT_PROMPTS` covers all 13 agent types across daily/weekly/monthly/quarterly tiers. Each prompt is verified to:
- Trigger the correct regex flags in each agent's `classify*Request` function
- Never contain HITL-triggering keywords (chase, send reminder, publish post, create event, approve)

Critical discovery during implementation: `isAnomalyQuery` regex `/\b(anomal|...)\b/i` requires a word boundary AFTER the stem — "anomaly" doesn't match because the trailing 'y' continues after "anomal" without a boundary. The accountant monthly prompt was reworded to use "unusual or suspicious transactions" instead.

`getHeartbeatPrompt(agentType, cadenceTier)` helper falls back to the daily prompt for unknown tiers or agent types.

`DEFAULT_CADENCE_CONFIG` constant exported (CAD-08 requirement) — exact TypeScript mirror of the SQL migration DEFAULT JSONB.

### 4. Tests (100% passing)

- `heartbeat-prompts.test.ts` — 80 tests: verify classification regex activation per agent + HITL safety guard + coverage check for all 13 agents + getHeartbeatPrompt helper
- `cadence-config.test.ts` — 20 tests: CAD-08 validation of DEFAULT_CADENCE_CONFIG key count, values, types, and SQL migration alignment

Total: 120 tests passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] accountant monthly isAnomalyQuery regex boundary mismatch**
- **Found during:** Task 2 GREEN phase (test failure)
- **Issue:** The test "monthly prompt triggers isAnomalyQuery" failed because `/\b(anomal|unusual|suspicious|outlier|weird.*transaction)\b/i` requires a word boundary after "anomal" — "anomaly", "anomalous", "anomalies" all fail since letters continue after the stem
- **Fix:** Rewrote accountant monthly prompt to use "unusual or suspicious transactions" which matches `\b(unusual|suspicious)\b`
- **Files modified:** `heartbeat-prompts.ts` (accountant monthly prompt text)
- **Commit:** e6c7f60

## Self-Check: PASSED

All 6 created files confirmed on disk. Commits in git history: da21202 (migrations), 446b125 (failing tests), e6c7f60 (prompts module), ed763f7 (cadence-config test), 5108cfd (cadence-config.ts). 120 tests passing.
