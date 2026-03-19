---
phase: 13-accountant-sales-rep-agent-tools
plan: 02
subsystem: api
tags: [typescript, postgresql, langgraph, csv-parse, pdf-parse, gemini, multimodal, financial-tools]

# Dependency graph
requires:
  - phase: 13-01
    provides: "shared DB pool (tools/shared/db.ts), accountant type contracts (types.ts), base-agent exports"
provides:
  - "ACCT-01: createInvoice + listInvoices — invoice CRUD against public.invoices"
  - "ACCT-02: recordTransaction with LLM auto-categorization into 14 categories"
  - "ACCT-03: parseBankStatementCSV (csv-parse + LLM column mapping) + parseBankStatementPDF (pdf-parse v2 + LLM extraction, empty-text fallback)"
  - "ACCT-04: parseReceipt via direct Lovable AI Gateway fetch with multimodal image_url content array"
  - "ACCT-05: calculateCashflowProjection — 30/60/90 day projections from 90-day transaction history + pending invoices"
  - "ACCT-06: generatePLReport — month-over-month P&L grouped by category + receivables breakdown"
affects: [13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: ["csv-parse ^6.2.0 (already installed)", "pdf-parse ^2.4.5 (v2 class-based API)", "@types/pdf-parse ^1.1.5"]
  patterns: ["direct gateway fetch for multimodal (bypasses callLLM's content stringification)", "LLM column mapping for bank CSV files with unknown schema", "pdf-parse v2 PDFParse class (not v1 pdfParse function)"]

key-files:
  created:
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/invoice-tools.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/transaction-tools.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/parse-bank-statement.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/parse-receipt.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/cashflow-tools.ts"
    - "worrylesssuperagent/langgraph-server/src/tools/accountant/report-tools.ts"
  modified: []

key-decisions:
  - "pdf-parse v2 (installed as ^2.4.5) uses PDFParse class with constructor options, not v1's pdfParse(buffer) function — plan referenced v1 API, auto-fixed to v2"
  - "parseBankStatementPDF returns empty array when text.length < 100 (scanned PDF) — caller must fall back to ACCT-04 multimodal path"
  - "parseReceipt bypasses callLLM entirely and uses direct fetch to ai.gateway.lovable.dev — callLLM stringifies content arrays breaking multimodal vision"
  - "recordTransaction LLM categorization uses callLLMWithStructuredOutput with temperature 0.1 — deterministic categorization into 14 standard categories"
  - "listInvoices uses two separate queries (with/without status filter) rather than dynamic SQL string concatenation — safer against injection, cleaner TypeScript types"

patterns-established:
  - "Multimodal bypass pattern: direct fetch to ai.gateway.lovable.dev when content arrays are needed (not callLLM)"
  - "LLM-assisted parsing pattern: csv-parse/pdf-parse for raw extraction, callLLMWithStructuredOutput for schema mapping"
  - "Empty-text fallback signal: return [] from parseBankStatementPDF when text < 100 chars, caller decides fallback strategy"

requirements-completed: [ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, ACCT-06]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 13 Plan 02: Accountant Core Tools Summary

**6 accountant tool files implementing invoice CRUD, LLM-categorized transaction recording, CSV/PDF bank statement parsing, multimodal receipt OCR, and 30/60/90-day cashflow projection + P&L report generation**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T05:00:01Z
- **Completed:** 2026-03-19T05:12:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- ACCT-01/02: Invoice CRUD + transaction recording wired to `public.invoices` and `public.transactions` via shared DB pool; LLM auto-categorizes uncategorized transactions
- ACCT-03: Bank statement parsing handles both CSV (any column schema, LLM maps columns) and PDF (text-layer extraction, empty-text signals scanned PDF)
- ACCT-04/05/06: Receipt multimodal parsing via direct gateway fetch, 30/60/90-day cashflow projection from live data, P&L report with month-over-month category breakdown + receivables summary

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice CRUD + Transaction recording + Bank statement parsing** - `5d98d62` (feat)
2. **Task 2: Receipt parsing + Cashflow projection + P&L report** - `7ebb698` (feat)

## Files Created/Modified

- `worrylesssuperagent/langgraph-server/src/tools/accountant/invoice-tools.ts` - createInvoice (INSERT) + listInvoices (SELECT with optional status filter) from public.invoices
- `worrylesssuperagent/langgraph-server/src/tools/accountant/transaction-tools.ts` - recordTransaction with LLM auto-categorization into 14 standard categories
- `worrylesssuperagent/langgraph-server/src/tools/accountant/parse-bank-statement.ts` - parseBankStatementCSV (csv-parse + LLM column mapping) + parseBankStatementPDF (pdf-parse v2 PDFParse class + LLM structuring, empty-text fallback)
- `worrylesssuperagent/langgraph-server/src/tools/accountant/parse-receipt.ts` - parseReceipt using direct fetch to Lovable AI Gateway with base64 image_url content array (bypasses callLLM)
- `worrylesssuperagent/langgraph-server/src/tools/accountant/cashflow-tools.ts` - calculateCashflowProjection returning 3 CashflowProjection objects (30d/60d/90d) from live transaction + invoice data
- `worrylesssuperagent/langgraph-server/src/tools/accountant/report-tools.ts` - generatePLReport with month-over-month income/expenses/netProfit by category + receivables breakdown

## Decisions Made

- pdf-parse was installed at v2.4.5 (not v1.1.1 referenced in research) — v2 uses `new PDFParse({ data: buffer })` class pattern; auto-fixed import to use named export `PDFParse`
- parseReceipt does NOT use callLLM — callLLM's `messagesToOpenAI()` stringifies content arrays, breaking the vision model's image_url format requirement
- Empty array return from parseBankStatementPDF when `text.length < 100` signals the caller to use multimodal fallback; this is documented in the function comment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdf-parse v2 has no default export — updated import to named PDFParse class**
- **Found during:** Task 1 (parse-bank-statement.ts TypeScript compile)
- **Issue:** Plan specified `import pdfParse from "pdf-parse"` (v1 API). Installed package is v2.4.5 which exports `{ PDFParse }` class, not a default function. TypeScript error: `Module has no default export`
- **Fix:** Changed import to `import { PDFParse } from "pdf-parse"` and updated usage to `new PDFParse({ data: pdfBuffer }).getText()` returning `textResult.text`
- **Files modified:** `src/tools/accountant/parse-bank-statement.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `5d98d62` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: pdf-parse v2 API mismatch)
**Impact on plan:** Essential fix — v2 API is the installed version. No scope change.

## Issues Encountered

None beyond the pdf-parse v2 API auto-fix.

## User Setup Required

None - no external service configuration required for these tools. They use:
- `DATABASE_URL` — already required by the shared DB pool
- `LOVABLE_API_KEY` — already required by `callLLM` and used directly by `parseReceipt`

## Next Phase Readiness

- All 6 ACCT-0x tool functions are exported and TypeScript-clean
- Tools are ready to be wired into the Accountant agent tool-execution node (Plan 13-03)
- parseBankStatementPDF empty-array fallback is documented — Plan 13-03 agent node must check for empty return and route to parseReceipt for scanned PDFs

---
*Phase: 13-accountant-sales-rep-agent-tools*
*Completed: 2026-03-19*
