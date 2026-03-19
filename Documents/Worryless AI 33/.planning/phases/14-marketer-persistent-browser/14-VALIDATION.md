---
phase: 14
slug: marketer-persistent-browser
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + TypeScript compiler (tsc --noEmit) |
| **Config file** | `worrylesssuperagent/vitest.config.ts` + `worrylesssuperagent/langgraph-server/tsconfig.json` |
| **Quick run command** | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit && cd .. && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd worrylesssuperagent && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` + `npx vitest run <relevant-test-file>`
- **After every plan wave:** Run `cd worrylesssuperagent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|-----------|-------------------|-----------|--------|
| 14-01-01 | 01 | 1 | BROWSER-01..05 | tsc + deps check | `npx tsc --noEmit` + dep check | N/A (config task) | pending |
| 14-01-02 | 01 | 1 | BROWSER-01..05 | unit (mocked Playwright) | `npx vitest run src/tools/browser/browser-manager.test.ts src/tools/browser/login-flow.test.ts` | Plan 01 creates | pending |
| 14-02-01 | 02 | 2 | MKT-01, MKT-08 | unit (mocked LLM + DB) | `npx vitest run src/tools/marketer/content-tools.test.ts` | Plan 02 creates | pending |
| 14-02-02 | 02 | 2 | MKT-02, MKT-03 | unit (mocked Gemini + DB) | `npx vitest run src/tools/marketer/image-tools.test.ts` | Plan 02 creates | pending |
| 14-03-01 | 03 | 2 | MKT-04, MKT-12 | unit (mocked DB) | `npx vitest run src/tools/marketer/schedule-tools.test.ts` | Plan 03 creates | pending |
| 14-03-02 | 03 | 2 | MKT-05, MKT-07 | unit (mocked HITL + Playwright + LLM) | `npx vitest run src/tools/marketer/publish-tools.test.ts src/tools/marketer/analytics-tools.test.ts` | Plan 03 creates | pending |
| 14-04-01 | 04 | 2 | MKT-09, MKT-10, MKT-11 | unit (mocked Firecrawl + Playwright) | `npx vitest run src/tools/marketer/research-tools.test.ts` | Plan 04 creates | pending |
| 14-05-01 | 05 | 3 | MKT-* (barrel) | tsc type check | `npx tsc --noEmit` | N/A (barrel only) | pending |
| 14-05-02 | 05 | 3 | MKT-* (graph + classification) | unit (classification regex) | `npx vitest run src/agents/marketer.test.ts` | Plan 05 creates | pending |

*Status: pending · green · red · flaky*

---

## Test Files Created Per Plan

| Plan | Test Files | Covers |
|------|-----------|--------|
| 01 | `browser-manager.test.ts`, `login-flow.test.ts` | BROWSER-01, BROWSER-02, BROWSER-04, BROWSER-05 |
| 02 | `content-tools.test.ts`, `image-tools.test.ts` | MKT-01, MKT-02, MKT-03, MKT-08 |
| 03 | `schedule-tools.test.ts`, `publish-tools.test.ts`, `analytics-tools.test.ts` | MKT-04, MKT-05, MKT-07, MKT-12 |
| 04 | `research-tools.test.ts` | MKT-09, MKT-10, MKT-11 |
| 05 | `marketer.test.ts` | All MKT-* (classification regex coverage) |

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

- [x] All tasks have `<automated>` verify with behavioral tests
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 test files created alongside implementation in each plan
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
