---
phase: 14
slug: marketer-persistent-browser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) + Vitest (if test files created) |
| **Config file** | `worrylesssuperagent/langgraph-server/tsconfig.json` |
| **Quick run command** | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| **Full suite command** | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **After every plan wave:** Run `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | BROWSER-01 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | BROWSER-02 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | BROWSER-03 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | BROWSER-04 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | BROWSER-05 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | MKT-01 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | MKT-02 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 2 | MKT-03 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-04 | 02 | 2 | MKT-04 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-05 | 02 | 2 | MKT-08 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-06 | 02 | 2 | MKT-12 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | MKT-05 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | MKT-06 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-03 | 03 | 2 | MKT-07 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-04 | 03 | 2 | MKT-09 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-05 | 03 | 2 | MKT-10 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-06 | 03 | 2 | MKT-11 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 3 | MKT-* | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tools/browser/` directory — browser manager + login flow
- [ ] `src/tools/marketer/` directory — all Marketer tool files
- [ ] `src/tools/marketer/types.ts` — type contracts
- [ ] `src/tools/browser/types.ts` — browser type contracts
- [ ] `npm install playwright @google/genai` in langgraph-server
- [ ] Export pattern from base-agent.ts (already done in Phase 13)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real social login persists | BROWSER-02, BROWSER-03 | Requires actual social media credentials | Log in via Playwright browser, close, relaunch, verify session |
| Post published to real platform | MKT-05 | Requires live browser + social account | Schedule post, approve HITL, verify on platform |
| Real analytics scraped | MKT-06 | Requires logged-in session | Fetch analytics, verify numbers match platform dashboard |
| Session expiry detection | BROWSER-04 | Requires expired cookie state | Wait for session to expire or clear cookies, run health check |
| Competitor scraping | MKT-10 | Requires live browser | Run analyze_competitor with known competitor URL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
