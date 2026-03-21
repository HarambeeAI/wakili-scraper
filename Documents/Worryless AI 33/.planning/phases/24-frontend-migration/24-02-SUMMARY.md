---
phase: 24-frontend-migration
plan: 02
subsystem: api-layer, frontend-auth
tags: [crud-routes, logto-auth, express, frontend-migration, auth-guard]
dependency_graph:
  requires: [phase-24-01, phase-21-logto-auth]
  provides: [leads-route, social-posts-route, invoices-route, transactions-route, datasheets-route, outreach-emails-route, agent-assets-route, logto-auth-pages]
  affects: [frontend-hooks, api-server-index, Dashboard, Auth, DashboardHeader]
tech_stack:
  added: []
  patterns: [express-requesthandler-pattern, logto-isAuthenticated-guard, api-ts-client-usage]
key_files:
  created:
    - api-server/src/routes/leads.ts
    - api-server/src/routes/socialPosts.ts
    - api-server/src/routes/invoices.ts
    - api-server/src/routes/transactions.ts
    - api-server/src/routes/datasheets.ts
    - api-server/src/routes/outreachEmails.ts
    - api-server/src/routes/agentAssets.ts
  modified:
    - api-server/src/index.ts
    - worrylesssuperagent/src/pages/Auth.tsx
    - worrylesssuperagent/src/pages/Dashboard.tsx
    - worrylesssuperagent/src/components/dashboard/DashboardHeader.tsx
decisions:
  - "DashboardHeader props changed from user: User (supabase) to userId/userEmail strings — required to eliminate @supabase/supabase-js import from Dashboard.tsx without breaking the header"
  - "Dashboard.tsx fetchUserAgents now calls api.get('/api/user-agents') instead of supabase.from('user_agents') — uses same token from useAuth()"
  - "userEmail fetched from /api/profiles/me response since Logto does not expose email directly via isAuthenticated"
  - "FE-03 verified as pre-existing from Phase 21: LogtoProvider wraps app, /callback route and Callback.tsx already in place"
metrics:
  duration_seconds: 201
  tasks_completed: 2
  files_created: 7
  files_modified: 4
  completed_date: "2026-03-21"
---

# Phase 24 Plan 02: Agent CRUD Routes + Auth Migration Summary

**One-liner:** 7 agent-specific Express CRUD route files (leads, invoices, social posts, transactions, datasheets, outreach emails, agent assets) plus Auth.tsx rewritten as a Logto redirect and Dashboard.tsx migrated from supabase.auth to useLogto/useAuth.

## What Was Built

### Task 1: 7 Agent-Specific CRUD Route Files

All 7 route files follow the existing pattern (`import type { RequestHandler } from 'express'`, `(req as AuthedRequest).auth!.userId`, `pool.query(...)`).

| Route File | Endpoints |
|-----------|-----------|
| `leads.ts` | GET/POST/DELETE /api/leads |
| `socialPosts.ts` | GET/POST/DELETE /api/social-posts |
| `invoices.ts` | GET/POST/DELETE /api/invoices |
| `transactions.ts` | GET/POST /api/transactions (ordered by date) |
| `datasheets.ts` | GET/POST/DELETE /api/datasheets |
| `outreachEmails.ts` | GET/POST /api/outreach-emails |
| `agentAssets.ts` | GET /api/agent-assets with optional `?agent_type=` query param via COALESCE |

`api-server/src/index.ts` updated with 18 new route registrations (7 GET, 6 POST, 5 DELETE).

### Task 2: Auth.tsx and Dashboard.tsx Migrated to Logto

**Auth.tsx** — Complete rewrite:
- Removed all Supabase imports and custom sign-in/sign-up form (~170 lines → ~27 lines)
- Uses `useAuth().signIn()` to redirect to Logto hosted login UI
- If `isAuthenticated`, navigates to `/dashboard`
- Renders minimal "Redirecting to sign in..." loading state

**Dashboard.tsx** — Auth guard migration:
- Removed `import { supabase }` and `import { User } from "@supabase/supabase-js"`
- Added `useLogto().isAuthenticated` guard: navigates to `/auth` if not authenticated
- Added `useAuth()` for `userId`, `token`, `signOut`
- Replaced `supabase.auth.onAuthStateChange` with `useEffect` on `isAuthenticated`
- Replaced `supabase.from("profiles").select()` with `api.get("/api/profiles/me", { token })`
- Replaced `supabase.from("user_agents").select()` with `api.get("/api/user-agents", { token })`
- `userEmail` now fetched from profile response (Logto doesn't expose email via isAuthenticated)

**DashboardHeader.tsx** — Props updated (needed by Dashboard migration):
- Changed `user: User` prop to `userId: string | null, userEmail?: string | null`
- Replaced `supabase.auth.signOut()` with `useAuth().signOut()`

**FE-03 Verified:**
- `App.tsx` has `LogtoProvider` wrapping the router (pre-existing from Phase 21)
- `/callback` route registered in `App.tsx` (pre-existing from Phase 21)
- `Callback.tsx` exists and handles OIDC callback via `useHandleSignInCallback` (pre-existing from Phase 21)

## Commits

- `910db78` — feat(24-02): add 7 agent-specific CRUD route files and register in api-server
- `9c2d2ec` — feat(24-02): migrate Auth.tsx and Dashboard.tsx from Supabase to Logto

## Verification

- `api-server`: `npx tsc --noEmit` — 0 errors
- `worrylesssuperagent`: `npx tsc --noEmit` — 0 errors
- `grep -c "supabase" worrylesssuperagent/src/pages/Auth.tsx` → 0
- `grep -c "supabase" worrylesssuperagent/src/pages/Dashboard.tsx` → 0
- `grep -c "LogtoProvider" worrylesssuperagent/src/App.tsx` → 3 (FE-03)
- `grep -c "callback" worrylesssuperagent/src/App.tsx` → 1 (FE-03)
- All 7 route files contain `pool.query` and `(req as AuthedRequest).auth!.userId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated DashboardHeader props to decouple from @supabase/supabase-js**
- **Found during:** Task 2
- **Issue:** DashboardHeader accepted `user: User` from `@supabase/supabase-js`, making it impossible to remove the supabase import from Dashboard.tsx without breaking the header prop types
- **Fix:** Changed DashboardHeader props to `userId: string | null` and `userEmail?: string | null`; replaced `supabase.auth.signOut()` with `useAuth().signOut()`
- **Files modified:** `worrylesssuperagent/src/components/dashboard/DashboardHeader.tsx`
- **Commit:** `9c2d2ec`

## Known Stubs

None — all routes implement real SQL queries; auth pages redirect to real Logto hosted UI.

## Self-Check: PASSED

- `api-server/src/routes/leads.ts` exists: FOUND
- `api-server/src/routes/socialPosts.ts` exists: FOUND
- `api-server/src/routes/invoices.ts` exists: FOUND
- `api-server/src/routes/transactions.ts` exists: FOUND
- `api-server/src/routes/datasheets.ts` exists: FOUND
- `api-server/src/routes/outreachEmails.ts` exists: FOUND
- `api-server/src/routes/agentAssets.ts` exists: FOUND
- `worrylesssuperagent/src/pages/Auth.tsx` — no supabase: CONFIRMED
- `worrylesssuperagent/src/pages/Dashboard.tsx` — no supabase: CONFIRMED
- Commit `910db78` exists: FOUND
- Commit `9c2d2ec` exists: FOUND
