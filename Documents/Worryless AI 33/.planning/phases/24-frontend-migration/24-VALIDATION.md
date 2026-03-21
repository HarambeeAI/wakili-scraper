---
phase: 24
slug: frontend-migration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | worrylesssuperagent/vitest.config.ts |
| **Quick run command** | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 24-01-01 | 01 | 1 | FE-01, FE-05 | build | `cd worrylesssuperagent && npx tsc --noEmit --strict src/lib/api.ts` | pending |
| 24-01-02 | 01 | 1 | FE-02 | build | `cd api-server && npx tsc --noEmit` | pending |
| 24-02-01 | 02 | 2 | FE-02 | build | `cd api-server && npx tsc --noEmit` | pending |
| 24-02-02 | 02 | 2 | FE-03 | grep | `grep -c "LogtoProvider" worrylesssuperagent/src/App.tsx && grep -c "supabase" worrylesssuperagent/src/pages/Auth.tsx worrylesssuperagent/src/pages/Dashboard.tsx` | pending |
| 24-03-01 | 03 | 3 | FE-01, FE-02 | grep | `grep -rc "supabase" worrylesssuperagent/src/hooks/ --include="*.ts" 2>&1` | pending |
| 24-03-02 | 03 | 3 | FE-04 | grep | `grep "VITE_API_URL" worrylesssuperagent/src/hooks/useAgentChat.ts` | pending |
| 24-04-01 | 04 | 4 | FE-01, FE-02 | grep | `grep -rc "supabase" worrylesssuperagent/src/components/ --include="*.tsx" 2>&1` | pending |
| 24-04-02 | 04 | 4 | FE-01 | grep | `grep -rc "supabase" worrylesssuperagent/src/components/agents/ --include="*.tsx" 2>&1` | pending |
| 24-05-01 | 05 | 5 | FE-01, FE-05 | grep+build | `grep -rc "supabase" worrylesssuperagent/src/ --include="*.ts" --include="*.tsx" 2>&1 \| grep -v ":0$"` | pending |
| 24-05-02 | 05 | 5 | RAIL-06, FE-06 | file | `test -f worrylesssuperagent/Dockerfile && test -f worrylesssuperagent/nginx.conf && test -f worrylesssuperagent/railway.toml && echo "All deployment files exist"` | pending |
| 24-05-03 | 05 | 5 | FE-06 | build | `cd worrylesssuperagent && npx vite build 2>&1 \| tail -5` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

No Wave 0 plan is needed. All verification relies on:
- Existing vitest test infrastructure (`worrylesssuperagent/vitest.config.ts`)
- TypeScript compilation (`tsc --noEmit`)
- grep-based import auditing (no supabase references)
- File existence checks for deployment artifacts

Test files in `src/__tests__/` (heartbeatParser, sanitize, etc.) are existing and unaffected by this migration.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logto sign-in redirect flow | FE-03 | Requires browser + Logto instance | Open app, click sign in, verify redirect to Logto, complete login, verify redirect to dashboard |
| Network tab shows no Supabase calls | FE-01 | Requires browser DevTools | Open dashboard, check network tab for any *.supabase.co requests |
| SSE streaming from Railway LangGraph | FE-04 | Requires live Railway deployment | Send agent message, verify SSE events from Railway URL in network tab |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No broken Wave 0 references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
