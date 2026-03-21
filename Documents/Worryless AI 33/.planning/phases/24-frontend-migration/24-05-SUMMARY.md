---
phase: 24
plan: 05
subsystem: frontend
tags: [migration, supabase-removal, docker, nginx, railway, deployment]
dependency_graph:
  requires: [24-01, 24-02, 24-03, 24-04]
  provides: [supabase-free-frontend, nginx-container, railway-deploy-config]
  affects: [frontend-deployment, railway-build-pipeline]
tech_stack:
  added: [nginx:1.27-alpine, node:20-alpine, multi-stage-docker]
  patterns: [dockerfile-multistage-build, spa-nginx-fallback, railway-dockerfile-builder, vite-build-args]
key_files:
  created:
    - worrylesssuperagent/Dockerfile
    - worrylesssuperagent/nginx.conf
    - worrylesssuperagent/railway.toml
    - worrylesssuperagent/.env.example
  modified:
    - worrylesssuperagent/package.json
    - worrylesssuperagent/package-lock.json
decisions:
  - VITE_ env vars declared as ARG in Dockerfile (baked at build time, not runtime)
  - Multi-stage build keeps final image small (Nginx only, no Node.js in prod image)
  - railway.toml dockerfilePath is relative to service root (Dockerfile not worrylesssuperagent/Dockerfile)
  - nginx.conf uses separate location blocks for /assets/ (immutable 1y) vs index.html (no-cache)
metrics:
  duration: ~15 minutes
  completed: "2026-03-21"
  tasks: 2
  files: 6
---

# Phase 24 Plan 05: Supabase Final Cleanup + Railway Container Summary

Complete Supabase removal with @supabase/supabase-js deleted from package.json and src/integrations/supabase/ directory purged, plus multi-stage Nginx Dockerfile, nginx.conf with SPA fallback, and railway.toml for one-command Railway deployment.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Delete supabase files, remove package dep, document env vars | 135b35c | package.json, package-lock.json, .env.example |
| 2 | Create Dockerfile, nginx.conf, railway.toml | 713bef8 | Dockerfile, nginx.conf, railway.toml |

## What Was Done

### Task 1: Supabase Final Cleanup

- Deleted `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts`
- Removed `src/integrations/supabase/` directory entirely
- Removed `@supabase/supabase-js: ^2.86.0` from `package.json` dependencies
- Ran `npm install` to update `package-lock.json`
- Created `.env.example` documenting all required VITE_ variables: `VITE_API_URL`, `VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `VITE_LOGTO_API_RESOURCE`, `VITE_LANGGRAPH_URL`, `VITE_VAPID_PUBLIC_KEY`
- Confirmed `useLangGraphFlag.ts` already deleted in Plan 03

**Remaining comment-only mentions of "supabase" in source** (acceptable per plan):
- `src/components/agents/AccountantAgent.tsx` — inline comment documenting the inlined Json type
- `src/lib/heartbeatParser.ts` — JSDoc comment about Deno re-export
- `src/lib/sanitize.ts` — JSDoc comment about file location

**Test files** that still `vi.mock("@/integrations/supabase/client")` are pre-existing broken tests (failing before this plan because the hooks they test were migrated in Plan 04 to use `useAuth` from Logto, which requires `<LogtoProvider>` context not present in tests). These are out-of-scope pre-existing issues.

### Task 2: Railway Container Setup

**Dockerfile** — Multi-stage build:
- Stage 1 (`node:20-alpine`): `npm ci`, `COPY . .`, 6 `ARG VITE_*` declarations, `npm run build`
- Stage 2 (`nginx:1.27-alpine`): copies `/app/dist` and `nginx.conf`, exposes port 80

**nginx.conf** — SPA-optimized configuration:
- `try_files $uri $uri/ /index.html` for SPA client-side routing fallback
- Gzip compression for text/css/js/json/svg
- `/assets/` location: `Cache-Control: public, immutable` with 1-year expiry (content-hashed filenames)
- `index.html`: `Cache-Control: no-cache, no-store, must-revalidate` (always fresh)

**railway.toml** — Railway deployment config:
- `builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"` (relative to service root)
- Health check on `/` with 30s timeout
- `ON_FAILURE` restart policy, max 3 retries

## Verification

TypeScript check: `npx tsc --noEmit` — **PASSED** (zero errors)

```
grep -rc "supabase" worrylesssuperagent/src/ --include="*.ts" --include="*.tsx"
→ Only comment-only mentions remain (3 files, no import statements)

grep "@supabase/supabase-js" worrylesssuperagent/package.json
→ (empty — removed)

test -f worrylesssuperagent/src/integrations/supabase/client.ts
→ false (deleted)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced in this plan. Pre-existing stubs from Plan 04 (API routes not yet created):
- `/api/upload` multipart endpoint (AccountantAgent, ChatInterface)
- `/api/social-posts`, `/api/agent-assets` (MarketerAgent)
- `/api/integrations`, `/api/email-summaries`, `/api/calendar-events` (PersonalAssistantAgent)

## Checkpoint Pending

Awaiting human verification:
1. `npx tsc --noEmit` — passes (confirmed above, zero errors)
2. `npx vite build` — human to run and confirm no errors
3. Supabase references check
4. Docker image build (optional)

## Self-Check: PASSED

- Task 1 commit 135b35c: exists
- Task 2 commit 713bef8: exists
- `src/integrations/supabase/client.ts`: deleted (confirmed)
- `@supabase/supabase-js` in package.json: removed (confirmed)
- Dockerfile exists with correct content: confirmed
- nginx.conf exists with try_files and gzip: confirmed
- railway.toml exists with DOCKERFILE builder: confirmed
- .env.example documents all VITE_ variables: confirmed
- TypeScript: zero errors
