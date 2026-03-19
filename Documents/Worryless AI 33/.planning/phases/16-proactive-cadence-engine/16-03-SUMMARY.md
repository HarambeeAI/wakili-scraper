---
phase: 16-proactive-cadence-engine
plan: "03"
subsystem: cadence-engine
tags: [database, sql, events, plpgsql, tdd]
dependency_graph:
  requires: [16-01]
  provides: [event-detector-sql, event-detector-ts, event-prompts]
  affects: [proactive-runner, heartbeat-jobs-queue]
tech_stack:
  - PostgreSQL (plpgsql function)
  - TypeScript (event-detector module)
  - Vitest (unit tests)
key_files:
  created:
    - worrylesssuperagent/supabase/migrations/20260320000003_event_detector.sql
    - worrylesssuperagent/langgraph-server/src/cadence/event-detector.ts
    - worrylesssuperagent/langgraph-server/src/cadence/event-detector.test.ts
  modified: []
---

# Plan 16-03 Summary: Event-Triggered Proactive Actions

## What was built
- **check_event_triggers() SQL function**: Detects 3 threshold business events and enqueues pgmq jobs with cadence_tier='event'
  - Overdue invoices (sent, past due within 7 days) → accountant agent
  - Stale deals (open leads, no activity 3+ days) → sales_rep agent
  - Expiring contracts (active, end_date within 7 days) → legal_advisor agent
- **Cooldown enforcement**: Uses last_event_notified_at + configurable event_cooldown_hours
- **pg_cron schedule**: Runs every 5 minutes (same frequency as cadence dispatcher)
- **event-detector.ts**: EVENT_TYPES, EVENT_PROMPTS, getEventPrompt() helper
- **21 tests passing**: Classification verification, HITL safety, agent mapping

## Deviations
- Contracts table uses `end_date` (not `expiry_date`) — adjusted SQL query accordingly
- Viral posts detector skipped (no engagement_count column on social_posts yet)

## Self-Check: PASSED
