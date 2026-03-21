---
phase: 24-frontend-migration
plan: 01
subsystem: api-layer
tags: [api-client, crud-routes, express, frontend-migration]
dependency_graph:
  requires: [phase-22-api-server, phase-21-logto-auth]
  provides: [api-ts-client, profiles-route, notifications-route, team-data-route, tasks-route, artifacts-route, user-agents-route, agent-types-route, workspaces-route]
  affects: [frontend-hooks, api-server-index]
tech_stack:
  added: []
  patterns: [dynamic-SET-clause, upsert-on-first-access, express-requesthandler-pattern]
key_files:
  created:
    - worrylesssuperagent/src/lib/api.ts
    - api-server/src/routes/profiles.ts
    - api-server/src/routes/notifications.ts
    - api-server/src/routes/teamData.ts
    - api-server/src/routes/tasks.ts
    - api-server/src/routes/artifacts.ts
    - api-server/src/routes/userAgents.ts
    - api-server/src/routes/agentTypes.ts
    - api-server/src/routes/workspaces.ts
  modified:
    - api-server/src/index.ts
decisions:
  - "api.ts receives token as parameter (not fetched internally) — keeps utility free of hook dependencies"
  - "profiles GET does upsert-on-first-access: INSERT ON CONFLICT DO NOTHING then re-SELECT if no row found"
  - "PATCH /api/user-agents/:id uses agent_type_id as the identifier (not a UUID primary key)"
  - "CORS methods expanded to include PATCH to support frontend PATCH requests"
  - "agentTypes route still reads userId from auth (auth middleware already applied globally) but does not use it in query — auth enforced by global middleware"
metrics:
  duration_seconds: 217
  tasks_completed: 2
  files_created: 10
  files_modified: 1
  completed_date: "2026-03-21"
---

# Phase 24 Plan 01: API Client and CRUD Routes Summary

**One-liner:** Centralized fetch wrapper `api.ts` with Bearer token injection plus 8 Express CRUD route files covering profiles, notifications, team data, tasks, artifacts, user agents, agent types, and workspaces.

## What Was Built

### Task 1: Frontend api.ts Client

`worrylesssuperagent/src/lib/api.ts` — typed fetch wrapper with:
- `BASE_URL` from `import.meta.env.VITE_API_URL` with `console.error` guard for missing env
- Generic `request<T>()` function: method, path, body, options (token, signal)
- Bearer token injection via `options.token` (token passed by callers, not fetched internally)
- 204 No Content handling returns `undefined as T`
- Exported `api` object: `get`, `post`, `patch`, `delete` methods

### Task 2: 8 CRUD Route Files + Updated index.ts

All routes follow the existing pattern: `import type { RequestHandler } from 'express'`, `(req as AuthedRequest).auth!.userId`, `pool.query(...)`.

| Route File | Endpoints |
|-----------|-----------|
| `profiles.ts` | GET/PATCH /api/profiles/me (with upsert-on-first-access) |
| `notifications.ts` | GET /api/notifications, PATCH /:id, POST /mark-all-read |
| `teamData.ts` | GET /api/team-data (user_agents JOIN available_agent_types + heartbeat subqueries) |
| `tasks.ts` | GET/POST/PATCH/:id/DELETE/:id /api/tasks |
| `artifacts.ts` | GET/POST/DELETE/:id /api/artifacts |
| `userAgents.ts` | GET/POST/PATCH/:id + heartbeat and cadence config sub-routes |
| `agentTypes.ts` | GET /api/agent-types |
| `workspaces.ts` | GET/PATCH /api/workspaces/:agentTypeId/:fileType |

`api-server/src/index.ts` updated:
- CORS `methods` expanded to include `"PATCH"`
- 24 new route registrations added after existing Phase 22 routes

## Commits

- `df07f37` — feat(24-01): create centralized frontend api.ts client
- `87ebb9a` — feat(24-01): add 8 CRUD route files and register in api-server

## Verification

- `api-server`: `npx tsc --noEmit` — 0 errors
- `worrylesssuperagent`: `npx tsc --noEmit` — 0 errors
- All 8 route files contain `(req as AuthedRequest).auth!.userId` and `pool.query`
- `api-server/src/index.ts` contains `"PATCH"` in CORS methods and all 24 new route registrations

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all routes implement real SQL queries against the Railway PostgreSQL database.

## Self-Check: PASSED

- `worrylesssuperagent/src/lib/api.ts` exists: FOUND
- `api-server/src/routes/profiles.ts` exists: FOUND
- `api-server/src/routes/notifications.ts` exists: FOUND
- `api-server/src/routes/teamData.ts` exists: FOUND
- `api-server/src/routes/tasks.ts` exists: FOUND
- `api-server/src/routes/artifacts.ts` exists: FOUND
- `api-server/src/routes/userAgents.ts` exists: FOUND
- `api-server/src/routes/agentTypes.ts` exists: FOUND
- `api-server/src/routes/workspaces.ts` exists: FOUND
- Commit `df07f37` exists: FOUND
- Commit `87ebb9a` exists: FOUND
