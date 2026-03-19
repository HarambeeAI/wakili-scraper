---
phase: 13
slug: accountant-sales-rep-agent-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) |
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
| 13-01-01 | 01 | 1 | ACCT-01 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | ACCT-02 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | ACCT-03 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | ACCT-04 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 1 | ACCT-05 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-06 | 01 | 1 | ACCT-06 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-07 | 01 | 1 | ACCT-07 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-08 | 01 | 1 | ACCT-08 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-09 | 01 | 1 | ACCT-09 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-10 | 01 | 1 | ACCT-10 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-11 | 01 | 1 | ACCT-11 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-01-12 | 01 | 1 | ACCT-12 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | SALES-01 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | SALES-02 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 1 | SALES-03 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 1 | SALES-04 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-05 | 02 | 1 | SALES-05 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-06 | 02 | 1 | SALES-06 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-07 | 02 | 1 | SALES-07 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-08 | 02 | 1 | SALES-08 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-09 | 02 | 1 | SALES-09 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-10 | 02 | 1 | SALES-10 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-11 | 02 | 1 | SALES-11 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-12 | 02 | 1 | SALES-12 | tsc type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tools/accountant/` directory — all Accountant tool files
- [ ] `src/tools/sales/` directory — all Sales Rep tool files
- [ ] `src/tools/accountant/index.ts` — barrel export
- [ ] `src/tools/sales/index.ts` — barrel export
- [ ] `supabase/migrations/20260319000003_acct_sales_schema.sql` — ENUM extension + columns
- [ ] Export `createLLMNode` and `createRespondNode` from `src/agents/base-agent.ts`
- [ ] `npm install csv-parse pdf-parse && npm install --save-dev @types/pdf-parse`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Receipt photo → structured data | ACCT-04 | Requires actual image upload + Lovable AI Gateway | Upload test receipt image, verify JSON output has vendor/amount/date |
| Apify lead generation | SALES-01 | Requires live Apify API key + network call | Run generate_leads with test query, verify leads inserted in DB |
| Firecrawl prospect research | SALES-03 | Requires live Firecrawl API key + network call | Call research_prospect with known company URL, verify ProspectResearch output |
| HITL approval flow | ACCT-10, SALES-05 | Requires running LangGraph graph with interrupt | Invoke accountant with "chase overdue invoice", verify graph pauses for approval |
| Resend email delivery | SALES-05 | Requires live Resend API key | After HITL approval, verify email appears in Resend dashboard |
| Resend webhook tracking | SALES-06 | Requires webhook endpoint + email open event | Send test email, open it, verify outreach_emails updated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
