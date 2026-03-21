---
phase: 23-scheduling-migration
plan: "01"
subsystem: langgraph-server
tags: [bullmq, redis, playwright, railway, infrastructure]
dependency_graph:
  requires: []
  provides: [redis-connection-factory, bullmq-deps, playwright-volume]
  affects: [23-02, 23-03]
tech_stack:
  added: [bullmq, ioredis, node-cron, web-push]
  patterns: [lazy-factory-pattern, tls-detection]
key_files:
  created:
    - worrylesssuperagent/langgraph-server/src/cadence/redis.ts
  modified:
    - worrylesssuperagent/langgraph-server/Dockerfile
    - worrylesssuperagent/langgraph-server/railway.toml
    - worrylesssuperagent/langgraph-server/package.json
decisions:
  - "createRedisConnection() is a factory (not singleton) — BullMQ requires separate IORedis instances for Queue vs Worker"
  - "TLS detection via rediss:// prefix — Railway Redis requires tls: {} or connections silently fail"
  - "Pre-existing test file TS errors in heartbeat-prompts.test.ts are out of scope (existed before this plan)"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-21"
  tasks_completed: 2
  files_modified: 4
---

# Phase 23 Plan 01: Infrastructure Setup — Playwright Volume + BullMQ Dependencies Summary

**One-liner:** BullMQ/ioredis/node-cron installed in LangGraph server with Railway Redis TLS connection factory and Playwright persistent volume via ENV + railway.toml volume mount.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Dockerfile and railway.toml for Playwright persistent volume | 0546320 | Dockerfile, railway.toml |
| 2 | Install BullMQ dependencies and create Redis connection factory | b7141c8 | package.json, package-lock.json, src/cadence/redis.ts |

## What Was Built

### Task 1: Playwright Persistent Volume

Updated `worrylesssuperagent/langgraph-server/Dockerfile` to set `ENV PLAYWRIGHT_BROWSERS_PATH=/playwright-data` before the `RUN npx -y playwright` install step. This causes Playwright to install Chromium into the Railway persistent volume path, surviving container restarts without re-downloading ~300 MB.

Updated `worrylesssuperagent/langgraph-server/railway.toml` to declare the matching volume:
```toml
[[volumes]]
mountPath = "/playwright-data"
```

### Task 2: BullMQ Dependencies + Redis Factory

Installed four production dependencies: `bullmq`, `ioredis`, `node-cron`, `web-push`. Installed `@types/node-cron` and `@types/web-push` as devDependencies.

Created `src/cadence/redis.ts` — IORedis connection factory following the same lazy-init pattern as `src/tools/shared/db.ts`. Key behaviors:
- Reads `REDIS_URL` from environment, throws if missing
- Detects `rediss://` scheme for TLS support (Railway Redis requires `tls: {}`)
- Sets `maxRetriesPerRequest: null` (BullMQ requirement)
- Sets `enableReadyCheck: false` (prevents startup delay)
- Returns a new IORedis instance per call — NOT a singleton (BullMQ requires separate connections for Queue vs Worker)

## Decisions Made

1. **Factory pattern over singleton** — BullMQ's Queue and Worker each require their own IORedis connection. Sharing a single instance causes worker registration failures.
2. **TLS detection by URL scheme** — `rediss://` indicates TLS; passing `tls: {}` is required for Railway Redis or connections silently fail to authenticate.

## Deviations from Plan

### Out-of-Scope Issues Discovered

Pre-existing TypeScript errors exist in `src/cadence/heartbeat-prompts.test.ts` (17 TS2345 errors: `string | undefined` not assignable to `string`). These existed before this plan (confirmed via `git stash` check) and are unrelated to the BullMQ or Redis changes. Not fixed per deviation scope rules.

Logged to: deferred-items — pre-existing test file strict-mode errors in heartbeat-prompts.test.ts.

### None Applied to Plan Tasks

Plan executed exactly as written for the in-scope files.

## Known Stubs

None — this plan adds infrastructure (deps + factory function). No data flows to UI.

## Self-Check: PASSED

- `worrylesssuperagent/langgraph-server/Dockerfile` — FOUND, contains `PLAYWRIGHT_BROWSERS_PATH=/playwright-data`
- `worrylesssuperagent/langgraph-server/railway.toml` — FOUND, contains `mountPath = "/playwright-data"`
- `worrylesssuperagent/langgraph-server/src/cadence/redis.ts` — FOUND, exports `createRedisConnection`
- `worrylesssuperagent/langgraph-server/package.json` — FOUND, contains bullmq, ioredis, node-cron, web-push
- Commit 0546320 — Task 1
- Commit b7141c8 — Task 2
