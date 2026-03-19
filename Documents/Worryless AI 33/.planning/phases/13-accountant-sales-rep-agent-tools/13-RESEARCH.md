# Phase 13: Accountant + Sales Rep Agent Tools - Research

**Researched:** 2026-03-19
**Domain:** LangGraph tool implementation, financial data processing, sales automation APIs
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACCT-01 | `create_invoice` and `list_invoices` tools for invoice CRUD | `public.invoices` table fully mapped; schema verified from migration files |
| ACCT-02 | `record_transaction` tool with LLM auto-categorization | `public.transactions` table exists; LLM categorization via `callLLM` + structured output |
| ACCT-03 | `parse_bank_statement` tool extracting transactions from CSV/PDF | `csv-parse` npm package for CSV; PDF needs `pdf-parse`; no new table required |
| ACCT-04 | `parse_receipt` tool using Gemini multimodal (photo to structured data) | Lovable AI Gateway passes base64 image as `content` array item — multimodal already supported |
| ACCT-05 | `calculate_cashflow_projection` tool projecting 30/60/90 days | Query `transactions` + `invoices`; pure computation, no new tables |
| ACCT-06 | `generate_pl_report` tool producing P&L with MoM comparison | Query `transactions` grouped by category and month; pure computation |
| ACCT-07 | `track_budget_vs_actual` tool comparing spending against targets | New `budget_targets` table needed; or store in LangGraph Store per-user namespace |
| ACCT-08 | `estimate_tax` tool calculating liability by jurisdiction | Pure LLM computation using transaction data + jurisdiction rules |
| ACCT-09 | `detect_anomalous_transaction` tool flagging outlier transactions | Statistical outlier detection (IQR or z-score) on transaction amounts by category |
| ACCT-10 | `chase_overdue_invoice` tool drafting reminder (requires HITL) | `interruptForApproval` from hitl module; drafts email via `callLLM`, sends via Resend |
| ACCT-11 | `forecast_runway` tool calculating months of cash remaining | Query `transactions` for burn rate; divide cash balance by monthly burn |
| ACCT-12 | `generate_invoice_pdf` tool using Nano Banana 2 / Gemini | Lovable AI Gateway with Gemini model; return PDF or structured HTML; store URL in `agent_assets` |
| SALES-01 | `generate_leads` tool via Apify (developer-provided key) | Apify API call pattern already proven in `generate-leads` Edge Function; port to LangGraph tool |
| SALES-02 | `enrich_lead_data` tool via web search | Lovable AI Gateway + Firecrawl scrape; store enriched data in `leads.notes` / Store |
| SALES-03 | `research_prospect` tool via Firecrawl + web search | Firecrawl REST API (`/v1/scrape`) already proven in `crawl-business-website` Edge Function |
| SALES-04 | `compose_outreach` tool with personalization | `callLLM` with prospect research + business context; returns draft email |
| SALES-05 | `send_outreach` tool via Resend (requires HITL) | `interruptForApproval` before Resend API call; pattern proven in Edge Functions |
| SALES-06 | `track_email_engagement` tool via Resend webhooks | Requires Resend webhook endpoint; engagement stored in `outreach_emails` table |
| SALES-07 | `update_deal_status` tool moving leads through pipeline | UPDATE on `public.leads.status` (lead_status ENUM already has all pipeline stages) |
| SALES-08 | `schedule_follow_up` tool with optimal timing | Write to `agent_tasks` table with `next_run_at`; timing logic from memory/history |
| SALES-09 | `create_proposal` tool generating sales proposals | `callLLM` with structured output; store in `agent_assets` table |
| SALES-10 | `analyze_pipeline` tool for velocity and conversion rates | Query `leads` grouped by status + time in stage; statistical aggregation |
| SALES-11 | `forecast_revenue` tool projecting from pipeline + historical rates | Query `leads` by stage + historical conversion rates from closed leads |
| SALES-12 | `detect_stale_deals` tool flagging stuck deals | Query `leads` WHERE `updated_at < NOW() - interval X` per stage threshold |
</phase_requirements>

---

## Summary

Phase 13 wires real tool implementations into the Accountant and Sales Rep agent subgraphs, transforming them from conversational placeholders into operational agents that execute against live Supabase data and third-party APIs. Both agents share the same base graph topology (`createBaseAgentGraph`) but Phase 13 replaces each agent's factory to insert a tool-execution node before the LLM respond node — mirroring the `cosTools` node pattern established in Phase 12.

The Accountant agent operates entirely on existing Supabase tables (`invoices`, `transactions`) with one new table needed for budget targets (ACCT-07). PDF parsing requires a new npm dependency (`pdf-parse`). The multimodal receipt parsing (ACCT-04) uses the existing Lovable AI Gateway — Gemini 3 Flash Preview supports vision via base64-encoded images. High-risk actions (ACCT-10 `chase_overdue_invoice`) use the established `interruptForApproval` HITL pattern.

The Sales Rep agent introduces three external API dependencies already proven in v1 Edge Functions: Apify (leads), Firecrawl (research), and Resend (email). The API key handling pattern follows the existing project approach: keys are stored as Railway environment variables on the LangGraph server (not Supabase Vault for this server), read via `process.env`. All external API call patterns (Apify REST, Firecrawl REST, Resend REST) are already implemented in the v1 Edge Functions and can be ported directly to the LangGraph server tool modules.

**Primary recommendation:** Implement tools as typed async functions in `src/tools/accountant/` and `src/tools/sales/` directories, wired into tool-execution nodes that sit between `readMemory` and `llmNode` in each agent subgraph. Follow the `cosTools` deterministic dispatch pattern — agent node classifies request type, calls relevant tools, injects results into state for LLM synthesis.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | `^8.13.0` | Direct Supabase PostgreSQL queries | Phase 10 baseline; all Supabase queries use this |
| `@langchain/langgraph` | `^1.2.3` | Graph execution, interrupt() for HITL | Phase 11 baseline |
| `@langchain/core` | `^1.1.33` | Message types | Phase 11 baseline |
| `zod` | `^3.25.32` | Input validation for tool schemas | Already in package.json |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `csv-parse` | `^5.6.0` | CSV bank statement parsing | Streaming CSV parser; handles RFC 4180 edge cases; most reliable in Node.js ecosystem |
| `pdf-parse` | `^1.1.1` | PDF bank statement text extraction | Pure JS, no native binaries, works in Railway Node.js environment |

**Version verified 2026-03-19:**
- `csv-parse`: 5.6.0 (latest stable)
- `pdf-parse`: 1.1.1 (latest stable — slow-moving, mature)

**Installation:**
```bash
cd worrylesssuperagent/langgraph-server
npm install csv-parse pdf-parse
npm install --save-dev @types/pdf-parse
```

### External APIs (no npm package needed — use fetch directly)
| API | Auth | Used For | Key Source |
|-----|------|---------|-----------|
| Apify REST API | `APIFY_API_TOKEN` env var | Lead generation | `process.env.APIFY_API_TOKEN` (Railway) |
| Firecrawl REST API | `FIRECRAWL_API_KEY` env var | Prospect/lead research | `process.env.FIRECRAWL_API_KEY` (Railway) |
| Resend REST API | `RESEND_API_KEY` env var | Outreach email sending | `process.env.RESEND_API_KEY` (Railway) |
| Lovable AI Gateway | `LOVABLE_API_KEY` env var (existing) | Multimodal receipt parsing, LLM composition | Already in `src/llm/client.ts` |

**CRITICAL:** The v1 Supabase Edge Functions use `Deno.env.get("APIFY_API_TOKEN")`. The LangGraph server uses `process.env.APIFY_API_TOKEN`. These are the SAME keys but accessed via Node.js `process.env` — must be set as Railway environment variables.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdf-parse` (npm) | Lovable AI Gateway multimodal | AI parsing is slower, less reliable for tables — pdf-parse extracts text first, then LLM structures it |
| Fetch-based Apify calls | `apify-client` npm (2.22.2) | apify-client adds 350KB dependency; direct fetch matches v1 Edge Function pattern exactly |
| `csv-parse` | Manual CSV splitting | csv-parse handles quoted fields, multiline values, encodings — hand-rolling CSV is a bug factory |

---

## Architecture Patterns

### Recommended Project Structure for Phase 13

```
worrylesssuperagent/langgraph-server/src/
├── tools/
│   ├── cos/                      # EXISTS (Phase 12)
│   ├── rag-retrieval.ts          # EXISTS (Phase 11)
│   ├── accountant/               # NEW — Accountant tools
│   │   ├── invoice-tools.ts      # ACCT-01: create_invoice, list_invoices
│   │   ├── transaction-tools.ts  # ACCT-02: record_transaction (+ categorization)
│   │   ├── parse-bank-statement.ts  # ACCT-03
│   │   ├── parse-receipt.ts      # ACCT-04 (multimodal)
│   │   ├── cashflow-tools.ts     # ACCT-05, ACCT-11 (projection + runway)
│   │   ├── report-tools.ts       # ACCT-06, ACCT-07 (P&L + budget vs actual)
│   │   ├── tax-tools.ts          # ACCT-08
│   │   ├── anomaly-tools.ts      # ACCT-09
│   │   ├── chase-invoice.ts      # ACCT-10 (HITL)
│   │   ├── invoice-pdf.ts        # ACCT-12
│   │   └── index.ts              # barrel export
│   └── sales/                    # NEW — Sales Rep tools
│       ├── generate-leads.ts     # SALES-01 (Apify)
│       ├── enrich-lead.ts        # SALES-02 (web search)
│       ├── research-prospect.ts  # SALES-03 (Firecrawl)
│       ├── compose-outreach.ts   # SALES-04
│       ├── send-outreach.ts      # SALES-05 (HITL)
│       ├── email-engagement.ts   # SALES-06 (Resend webhooks)
│       ├── deal-tools.ts         # SALES-07, SALES-08, SALES-12
│       ├── proposal-tools.ts     # SALES-09
│       ├── pipeline-tools.ts     # SALES-10, SALES-11
│       └── index.ts              # barrel export
├── agents/
│   ├── base-agent.ts             # EXISTS (Phase 12) — no modification needed
│   ├── accountant.ts             # MODIFY — replace createBaseAgentGraph with tool-wired graph
│   └── sales-rep.ts              # MODIFY — replace createBaseAgentGraph with tool-wired graph
supabase/migrations/
└── 20260319000003_acct_sales_tables.sql  # NEW — budget_targets + outreach_emails columns
```

### Pattern 1: Agent Tool Node (mirrors cosTools pattern from Phase 12)

Each agent gets a tool-execution node that runs before `llmNode`. Request classification is deterministic (keyword heuristics), not LLM function-calling. Tool results are injected into `businessContext` for LLM synthesis.

```typescript
// agents/accountant.ts
import { StateGraph } from "@langchain/langgraph";
import { AgentState } from "../types/agent-state.js";
import { createBaseAgentGraph } from "./base-agent.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";

// Tool node: runs BEFORE llmNode
function createAccountantToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content = typeof lastMessage.content === "string"
      ? lastMessage.content : JSON.stringify(lastMessage.content);

    const classification = classifyAccountantRequest(content);
    const toolResults: Record<string, unknown> = {};

    if (classification.isInvoiceQuery) {
      toolResults.invoices = await listInvoices(state.userId);
    }
    if (classification.isCashflowQuery) {
      toolResults.cashflow = await calculateCashflowProjection(state.userId);
      toolResults.runway = await forecastRunway(state.userId);
    }
    if (classification.isPLQuery) {
      toolResults.plReport = await generatePLReport(state.userId);
    }
    // ... etc.

    return {
      businessContext: {
        ...state.businessContext,
        accountantToolResults: toolResults,
      },
    };
  };
}

// Graph topology:
// __start__ -> readMemory -> accountantTools -> llmNode -> writeMemory -> respond
export function createAccountantGraph(checkpointer?: PostgresSaver) {
  // NOT createBaseAgentGraph — we need the tool node injected
  const config = {
    agentType: AGENT_TYPES.ACCOUNTANT,
    systemPrompt: ACCOUNTANT_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("accountantTools", createAccountantToolsNode())
    .addNode("llmNode", createLLMNode(config))        // imported from base-agent.ts
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "accountantTools")
    .addEdge("accountantTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;
  return graph.compile(compileOpts);
}
```

**IMPORTANT:** `createLLMNode` and `createRespondNode` are currently unexported from `base-agent.ts`. Phase 13 either:
1. Exports them from `base-agent.ts` (preferred — minimal change)
2. Or inlines the logic in each agent (more duplication)

Recommendation: Export `createLLMNode` and `createRespondNode` from `base-agent.ts` as named exports.

### Pattern 2: HITL Tool Call (interruptForApproval)

For ACCT-10 (`chase_overdue_invoice`) and SALES-05 (`send_outreach`):

```typescript
// tools/accountant/chase-invoice.ts
// Source: src/hitl/interrupt-handler.ts (established Phase 11)
import { interruptForApproval } from "../../hitl/interrupt-handler.js";
import type { AgentTypeId } from "../../types/agent-types.js";

export interface ChaseInvoiceInput {
  invoiceId: string;
  vendorName: string;
  amount: number;
  daysOverdue: number;
  userId: string;
  agentType: AgentTypeId;
}

export async function chaseOverdueInvoice(input: ChaseInvoiceInput): Promise<string> {
  // 1. Draft the email content
  const draftResult = await callLLM(/* draft message */);

  // 2. HITL interrupt — pauses graph, surfaces to client
  const decision = interruptForApproval({
    action: "chase_overdue_invoice",
    agentType: input.agentType,
    description: `Send payment reminder to ${input.vendorName} for invoice of $${input.amount} (${input.daysOverdue} days overdue)`,
    payload: { invoiceId: input.invoiceId, emailDraft: draftResult.content },
  });

  if (!decision.approved) {
    return "Invoice chase cancelled by user.";
  }

  // 3. Send via Resend after approval
  await sendResendEmail(/* ... */);
  return `Payment reminder sent to ${input.vendorName}.`;
}
```

**CRITICAL:** `interruptForApproval` calls LangGraph's `interrupt()` which throws a special signal to pause the graph. This function MUST be called directly inside a graph node function — NOT inside a regular async function called outside of a node. The tool function is called from within the agent's tool-execution node.

The HIGH_RISK_ACTIONS list in `interrupt-handler.ts` already includes `"chase_overdue_invoice"` and `"send_outreach"` — no modifications needed.

### Pattern 3: Apify REST API (port from Edge Function)

The v1 `generate-leads` Edge Function contains the full Apify integration. Port the core fetch call to `tools/sales/generate-leads.ts`:

```typescript
// tools/sales/generate-leads.ts
// Pattern: direct fetch, same as v1 supabase/functions/generate-leads/index.ts

export interface GenerateLeadsInput {
  userId: string;
  query: string;
  location?: string;
  industry?: string;
  jobTitle?: string;
  fetchCount?: number;
}

export async function generateLeads(input: GenerateLeadsInput): Promise<Lead[]> {
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const apifyInput: Record<string, unknown> = {
    fetch_count: Math.min(input.fetchCount ?? 20, 100),
  };
  if (input.query) apifyInput.company_keywords = [input.query];
  if (input.jobTitle) apifyInput.contact_job_title = [input.jobTitle];
  if (input.location) apifyInput.contact_location = [input.location.toLowerCase()];
  if (input.industry) apifyInput.company_industry = [input.industry.toLowerCase()];

  const apifyUrl = `https://api.apify.com/v2/acts/code_crafter~leads-finder/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apifyInput),
  });

  if (!response.ok) throw new Error(`Apify API error: ${response.status}`);
  const data: ApifyLead[] = await response.json();

  // Transform and upsert to leads table
  return await upsertLeads(input.userId, data);
}
```

### Pattern 4: Firecrawl REST API (port from Edge Function)

```typescript
// tools/sales/research-prospect.ts
// Pattern: direct fetch, same as v1 supabase/functions/crawl-business-website/index.ts

export async function researchProspect(url: string, userId: string): Promise<ProspectResearch> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

  const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!scrapeResponse.ok) throw new Error(`Firecrawl error: ${scrapeResponse.status}`);
  const scrapeData = await scrapeResponse.json();
  const pageContent = scrapeData.data?.markdown ?? "";

  // LLM synthesis of scraped content into prospect brief
  const brief = await callLLMWithStructuredOutput<ProspectResearch>(
    [new HumanMessage(`Research this prospect website:\n\n${pageContent.slice(0, 15000)}`)],
    PROSPECT_SCHEMA,
    { systemPrompt: "You are a sales research analyst. Extract key prospect information.", temperature: 0.2 }
  );

  return brief.data;
}
```

### Pattern 5: Resend Email (port from Edge Function)

```typescript
// tools/sales/send-outreach.ts
// Pattern: direct fetch, same as v1 send-test-email Edge Function

async function sendResendEmail(to: string, subject: string, html: string): Promise<string> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Worryless AI Team <myteam@worryless.ai>",
      to: [to],
      subject,
      html,
    }),
  });

  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok) throw new Error(result.message ?? "Resend send failed");
  return result.id ?? "sent";
}
```

### Pattern 6: Multimodal Receipt Parsing (ACCT-04)

The Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) is OpenAI-compatible and uses Gemini 3 Flash Preview, which supports vision. Pass base64-encoded image as a content array item:

```typescript
// tools/accountant/parse-receipt.ts

export async function parseReceipt(
  base64Image: string,
  mimeType: string,  // e.g., "image/jpeg", "image/png"
  userId: string
): Promise<ParsedReceipt> {
  const apiKey = process.env.LOVABLE_API_KEY;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: "text",
              text: "Extract all transaction details from this receipt. Return JSON with: vendor, amount, currency, date (YYYY-MM-DD), category (food/transport/office/utilities/other), line_items[].",
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as ParsedReceipt;
}
```

**IMPORTANT:** The existing `callLLM` in `src/llm/client.ts` converts all message content to strings (`JSON.stringify(msg.content)`). It CANNOT pass multimodal content arrays. The receipt parsing tool must make its own fetch call directly to the Lovable AI Gateway — do not attempt to route multimodal calls through `callLLM`.

### Pattern 7: CSV Bank Statement Parsing (ACCT-03)

```typescript
// tools/accountant/parse-bank-statement.ts
import { parse } from "csv-parse/sync";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export async function parseBankStatementCSV(csvContent: string): Promise<ParsedTransaction[]> {
  const records = parse(csvContent, {
    columns: true,  // use first row as column headers
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  // LLM-assisted column mapping (column names vary by bank)
  const sampleRow = records[0];
  const columnMapping = await callLLMWithStructuredOutput<{
    dateColumn: string;
    descriptionColumn: string;
    amountColumn: string;
    creditColumn?: string;
    debitColumn?: string;
  }>(
    [new HumanMessage(`Map these CSV columns to transaction fields: ${JSON.stringify(Object.keys(sampleRow))}\nSample row: ${JSON.stringify(sampleRow)}`)],
    `{"dateColumn": "string", "descriptionColumn": "string", "amountColumn": "string or null", "creditColumn": "string or null", "debitColumn": "string or null"}`,
    { temperature: 0.1 }
  );

  return records.map(row => ({
    date: row[columnMapping.data.dateColumn] ?? "",
    description: row[columnMapping.data.descriptionColumn] ?? "",
    amount: parseFloat(row[columnMapping.data.amountColumn ?? ""] ?? "0"),
    type: "expense" as const,  // refined in record_transaction LLM step
  }));
}
```

### Pattern 8: Budget Targets (ACCT-07)

Budget targets can be stored in one of two ways:
1. **New `budget_targets` table** — cleaner, queryable, allows UI management
2. **LangGraph Store** under `userId:agent_memory:accountant:budget_targets` — simpler, no migration

**Recommendation:** Use the LangGraph Store for budget targets in Phase 13. This avoids a migration. If Phase 17 generative UI needs to display budgets in a table, the data can be migrated then. Use `putStore`/`getStore` with key `"budget_targets"`.

### Anti-Patterns to Avoid

- **Using `callLLM` for multimodal content:** `callLLM` stringifies all message content. Bypass it for ACCT-04 and use a direct fetch to the gateway.
- **LangChain Tool objects:** Project uses plain typed async functions. Do not introduce `@langchain/tools` or `DynamicTool`.
- **Blocking on HITL interrupt:** `interruptForApproval` must be called inside a graph node. If called from a regular async function outside a node, the interrupt signal won't propagate correctly.
- **Apify synchronous endpoint for large fetches:** The `run-sync-get-dataset-items` endpoint works for up to ~100 leads but may timeout for larger requests. Cap at 100 per the v1 Edge Function.
- **Parsing PDFs with pdfjs-dist:** `pdfjs-dist` (5.5.x) requires a canvas dependency for server-side use. Use `pdf-parse` (1.1.1) instead — no native binaries, pure Node.js, works in Railway.
- **Resend sender address:** Must use `myteam@worryless.ai` — the domain is already verified in Resend (per v1 Edge Functions). Using any other address will fail.
- **Querying `leads.status` as string:** The `lead_status` ENUM is `('prospecting', 'contacted', 'responded', 'qualified', 'converted', 'lost')`. Maps to SALES-07 pipeline stages. Note: the SALES-07 requirement says stages include "Closed Won" and "Closed Lost" — map these to `'converted'` and `'lost'` respectively.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Manual string splitting | `csv-parse` | Handles quoted fields, multiline values, different encodings, BOM |
| PDF text extraction | PDF byte parsing | `pdf-parse` | Pure JS, zero native deps, handles most real-world bank PDFs |
| Apify integration | `apify-client` npm package | Direct fetch to REST API | The v1 Edge Function already proves the REST pattern works; no new dependency needed |
| Email sending | Custom SMTP | Resend REST API (existing pattern) | Already configured, domain verified, sending from `myteam@worryless.ai` |
| Statistical outlier detection (ACCT-09) | Custom ML model | Simple IQR or z-score on pg query results | Adequate for transaction anomaly detection at SMB scale |
| Runway calculation (ACCT-11) | Complex financial modeling | Average monthly burn × cash balance | Simple heuristic; sufficient for SMB cashflow; LLM can add nuance in response |
| Sales pipeline velocity | Custom analytics DB | PostgreSQL aggregate queries on `leads` table | `avg(updated_at - created_at)` grouped by status gives adequate velocity; no separate analytics store needed |

**Key insight:** Both agent tool sets access data that already exists in Supabase. The goal is query-and-synthesize, not build-new-systems. All complex "intelligence" lives in the LLM synthesis step — the tools just provide structured data retrieval.

---

## Common Pitfalls

### Pitfall 1: interruptForApproval Called Outside Node Context
**What goes wrong:** `interrupt()` inside `interruptForApproval` throws a LangGraph `Interrupt` signal. If called outside a graph node (e.g., in a standalone utility function called before the graph runs), the signal is not caught by the graph runtime and causes an unhandled exception.
**Why it happens:** Developers treat `interruptForApproval` as a regular utility function and call it from tools that are themselves called outside graph execution.
**How to avoid:** HITL tools (`chaseOverdueInvoice`, `sendOutreach`) must only be invoked from within a graph node callback. The tool-execution node calls them; the node is added to the StateGraph.
**Warning signs:** `Error: interrupt is not being called from within a node` or unhandled exceptions during tool calls.

### Pitfall 2: callLLM Breaks Multimodal Content
**What goes wrong:** Receipt image is passed through `callLLM`, which converts `content` arrays to JSON strings. The gateway receives a string like `[{"type":"image_url",...}]` instead of the content array format — the model sees text, not an image.
**Why it happens:** `messagesToOpenAI` in `llm/client.ts` does `JSON.stringify(msg.content)` for non-string content.
**How to avoid:** For ACCT-04, bypass `callLLM` and make a direct fetch call to the Lovable AI Gateway. Document this in the tool file with a comment.
**Warning signs:** `parse_receipt` returns empty or nonsensical output; no error thrown.

### Pitfall 3: lead_status ENUM Mismatch with Requirements
**What goes wrong:** SALES-07 requirement mentions stages "Prospecting → Contacted → Responded → Qualified → Proposal → Closed Won / Closed Lost". The DB ENUM is `('prospecting', 'contacted', 'responded', 'qualified', 'converted', 'lost')`. "Proposal" and "Closed Won" are not in the ENUM.
**Why it happens:** v1 schema has fewer pipeline stages than v2 requirements.
**How to avoid:** Either (a) add a Supabase migration to extend `lead_status` ENUM with `'proposal'` and `'closed_won'`, or (b) map "Proposal" to `'qualified'` and "Closed Won" to `'converted'`. Option (a) is cleaner.
**Warning signs:** `invalid input value for enum lead_status: "proposal"` PostgreSQL error.

### Pitfall 4: Apify Token Timeout on Large Queries
**What goes wrong:** Apify `run-sync-get-dataset-items` endpoint waits up to 5 minutes for the actor to complete. Large queries (100+ leads) can cause Railway request timeout (default 30-60 seconds for LangGraph endpoint).
**Why it happens:** Sync endpoint blocks until actor finishes. The v1 Edge Function works because Supabase Edge Functions have a longer timeout than the standard web request.
**How to avoid:** Cap `fetch_count` at 20-30 for the LangGraph tool (stricter than v1's 100). Document that large batches should use the v1 Edge Function directly.
**Warning signs:** `fetch` call hanging with no response; Railway 504 Gateway Timeout.

### Pitfall 5: pdf-parse Returns Empty String for Scanned PDFs
**What goes wrong:** `pdf-parse` only extracts text from text-layer PDFs. Scanned bank statements (image PDFs) return empty text.
**Why it happens:** `pdf-parse` does not perform OCR — it reads embedded text only.
**How to avoid:** After `pdf-parse`, check if extracted text is empty or minimal (<100 chars). If so, fall back to sending the PDF as a base64 image to Gemini multimodal (same path as ACCT-04) for OCR-based extraction. Document this fallback in the tool.
**Warning signs:** `parse_bank_statement` returns 0 transactions for legitimate PDFs.

### Pitfall 6: Resend Rate Limits on Outreach Batches
**What goes wrong:** SALES-05 sends multiple outreach emails in a batch; Resend free tier allows 100 emails/day. Batch send without rate limiting causes `429 Too Many Requests`.
**Why it happens:** Tool doesn't implement send rate limiting.
**How to avoid:** SALES-05 sends ONE email per HITL approval (not batch). For batch sending, implement a delay between sends. Document this constraint.
**Warning signs:** `Resend API error: 429` on second email send.

### Pitfall 7: Missing ENUM Values for lead_status Pipeline Stages
**What goes wrong:** `update_deal_status` tool (SALES-07) tries to set status to `'proposal'` or `'closed_won'`, gets a PostgreSQL error.
**Why it happens:** The original `lead_status` ENUM in migration `20251204060048_*.sql` only has 6 values; "Proposal" and "Closed Won" were not planned in v1.
**How to avoid:** Phase 13 migration extends the ENUM or renames the column to TEXT. Extend via `ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal'; ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_won'; ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_lost';` (note: PostgreSQL ENUM `ALTER TYPE ADD VALUE` cannot be rolled back in a transaction — must run outside explicit BEGIN).
**Warning signs:** PostgreSQL error on any `UPDATE leads SET status = 'proposal'`.

---

## Code Examples

### Invoice CRUD Tools (ACCT-01)
```typescript
// Source: src/tools/accountant/invoice-tools.ts (new file)
import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 10 });
  return pool;
}

export interface CreateInvoiceInput {
  userId: string;
  vendorName: string;
  amount: number;
  currency?: string;
  dueDate?: string;
  description?: string;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.invoices (user_id, vendor_name, amount, currency, due_date, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [input.userId, input.vendorName, input.amount, input.currency ?? "USD", input.dueDate ?? null, input.description ?? null]
  );
  return result.rows[0].id;
}

export async function listInvoices(userId: string, status?: string): Promise<InvoiceRow[]> {
  const db = getPool();
  const result = await db.query<InvoiceRow>(
    `SELECT id, vendor_name, amount, currency, due_date, status, description, created_at
     FROM public.invoices
     WHERE user_id = $1
     ${status ? "AND status = $2" : ""}
     ORDER BY created_at DESC
     LIMIT 50`,
    status ? [userId, status] : [userId]
  );
  return result.rows;
}
```

### P&L Report (ACCT-06)
```typescript
// Source: src/tools/accountant/report-tools.ts (new file)
export async function generatePLReport(userId: string): Promise<PLReport> {
  const db = getPool();

  // Group transactions by category and month for MoM comparison
  const result = await db.query<PLRow>(
    `SELECT
       date_trunc('month', date) AS month,
       type,
       category,
       SUM(amount) AS total
     FROM public.transactions
     WHERE user_id = $1
       AND date >= NOW() - INTERVAL '3 months'
     GROUP BY 1, 2, 3
     ORDER BY 1 DESC`,
    [userId]
  );

  // Also get outstanding invoices as receivables
  const invoiceResult = await db.query<InvoiceSummaryRow>(
    `SELECT status, COUNT(*) as count, SUM(amount) AS total
     FROM public.invoices
     WHERE user_id = $1
     GROUP BY status`,
    [userId]
  );

  return buildPLReport(result.rows, invoiceResult.rows);
}
```

### Pipeline Analysis (SALES-10)
```typescript
// Source: src/tools/sales/pipeline-tools.ts (new file)
export async function analyzePipeline(userId: string): Promise<PipelineAnalysis> {
  const db = getPool();

  // Deal count and value by stage
  const stageResult = await db.query<StageRow>(
    `SELECT
       status,
       COUNT(*) as deal_count,
       SUM(score) as total_score,
       AVG(EXTRACT(epoch FROM (updated_at - created_at)) / 86400) as avg_days_in_stage
     FROM public.leads
     WHERE user_id = $1
     GROUP BY status`,
    [userId]
  );

  // Historical conversion rate: contacts that converted
  const conversionResult = await db.query<{ converted: number; total: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'converted') as converted,
       COUNT(*) as total
     FROM public.leads
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'`,
    [userId]
  );

  return {
    byStage: stageResult.rows,
    conversionRate: conversionResult.rows[0].total > 0
      ? conversionResult.rows[0].converted / conversionResult.rows[0].total
      : 0,
  };
}
```

### Stale Deal Detection (SALES-12)
```typescript
// Source: src/tools/sales/deal-tools.ts (new file)
// Stale thresholds by stage (days without update)
const STALE_THRESHOLDS: Record<string, number> = {
  prospecting: 7,
  contacted: 5,
  responded: 5,
  qualified: 14,
  proposal: 10,
  converted: 999,  // not stale
  lost: 999,
};

export async function detectStaleDeals(userId: string): Promise<StaleDeal[]> {
  const db = getPool();
  const result = await db.query<LeadRow>(
    `SELECT id, company_name, contact_name, status, score, updated_at
     FROM public.leads
     WHERE user_id = $1
       AND status NOT IN ('converted', 'lost')
       AND updated_at < NOW() - INTERVAL '5 days'
     ORDER BY updated_at ASC
     LIMIT 20`,
    [userId]
  );

  return result.rows
    .filter(row => {
      const threshold = STALE_THRESHOLDS[row.status] ?? 7;
      const daysSinceUpdate = (Date.now() - new Date(row.updated_at).getTime()) / 86400000;
      return daysSinceUpdate > threshold;
    })
    .map(row => ({
      ...row,
      daysSinceUpdate: Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86400000),
    }));
}
```

---

## Existing Schema: What Phase 13 Tools Query

### `public.invoices` — ACCT-01, ACCT-06, ACCT-10, ACCT-11, ACCT-12
```
id              UUID PK
user_id         UUID FK → auth.users
vendor_name     TEXT
amount          DECIMAL(12,2)
currency        TEXT DEFAULT 'USD'
due_date        DATE
status          invoice_status ENUM ('pending', 'paid', 'overdue', 'cancelled')
description     TEXT
source_email_id TEXT
image_url       TEXT  -- added in later migration for Phase 12 invoice PDF
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `public.transactions` — ACCT-02, ACCT-05, ACCT-06, ACCT-08, ACCT-09, ACCT-11
```
id          UUID PK
user_id     UUID FK → auth.users
type        TEXT CHECK (type IN ('income', 'expense'))
amount      DECIMAL(12,2)
category    TEXT  -- free text, LLM-categorized
description TEXT
date        DATE
invoice_id  UUID FK → invoices (nullable)
created_at  TIMESTAMPTZ
```

**Note:** No `updated_at` on `transactions` — it's an append-only ledger. No UPDATE needed.

### `public.leads` — SALES-01 through SALES-12
```
id           UUID PK
user_id      UUID FK → auth.users
company_name TEXT
contact_name TEXT
email        TEXT
phone        TEXT
website      TEXT
industry     TEXT
company_size TEXT
location     TEXT
status       lead_status ENUM ('prospecting','contacted','responded','qualified','converted','lost')
             -- NEEDS EXTENSION: add 'proposal', 'closed_won', 'closed_lost' values
score        INTEGER DEFAULT 0
notes        TEXT  -- used for enriched data, LinkedIn URLs, research brief
source       TEXT  -- 'apify_leads_finder', 'manual', etc.
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

### `public.outreach_emails` — SALES-04, SALES-05, SALES-06
```
id         UUID PK
user_id    UUID FK → auth.users
lead_id    UUID FK → leads
subject    TEXT
body       TEXT
sent_at    TIMESTAMPTZ
opened_at  TIMESTAMPTZ  -- set by webhook (SALES-06)
replied_at TIMESTAMPTZ  -- set by webhook (SALES-06)
created_at TIMESTAMPTZ
```
**Missing column:** `resend_email_id TEXT` — needed for webhook correlation (SALES-06). Add in Phase 13 migration.

### `public.agent_assets` — ACCT-12, SALES-09
```
id              UUID PK
user_id         UUID FK
agent_type      TEXT
asset_type      TEXT ('image','document','email','post')
title           TEXT
content         TEXT
file_url        TEXT
metadata        JSONB
related_lead_id UUID FK → leads
created_at      TIMESTAMPTZ
```
Used to store invoice PDFs (ACCT-12) and sales proposals (SALES-09).

---

## Database Migrations Required

Phase 13 needs one migration file:

```sql
-- 20260319000003_acct_sales_schema.sql

-- 1. Extend lead_status ENUM for full pipeline stages
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block on PostgreSQL
-- Supabase migrations run each statement individually, so this is safe.
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_won';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed_lost';

-- 2. Add resend_email_id to outreach_emails for webhook correlation (SALES-06)
ALTER TABLE public.outreach_emails
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count  INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outreach_resend_id
  ON public.outreach_emails (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- 3. Add follow_up_scheduled_at to leads for SALES-08
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deal_value DECIMAL(12,2);

-- 4. Add indexes for pipeline analysis queries (SALES-10, SALES-11, SALES-12)
CREATE INDEX IF NOT EXISTS idx_leads_status_updated
  ON public.leads (user_id, status, updated_at DESC);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agent answers conversationally only | Agent executes real tool calls | Phase 13 | First operational agent capability |
| Edge Function for Apify (Deno) | LangGraph tool (Node.js) | Phase 13 | Unified execution in one server |
| Hardcoded v1 lead pipeline stages | Extended ENUM with full B2B pipeline | Phase 13 | Matches SALES-07 requirements |
| callLLM only for text | Direct gateway fetch for multimodal | Phase 13 | Enables receipt parsing (ACCT-04) |

**Deprecated/outdated:**
- `supabase/functions/generate-leads/`: The v1 Edge Function still works but the LangGraph tool in Phase 13 is the canonical implementation for agent-invoked lead generation.
- `supabase/functions/crawl-business-website/`: Same — v1 version for onboarding; Phase 13 `research_prospect` tool is for sales research.

---

## Open Questions

1. **Budget targets storage (ACCT-07)**
   - What we know: No `budget_targets` table exists. LangGraph Store can hold arbitrary JSONB per user/agent.
   - What's unclear: Does Phase 17 generative UI need budget targets to be in a queryable Supabase table?
   - Recommendation: Use LangGraph Store for Phase 13. Key: `"budget_targets"`, Value: `{ [category]: { monthly: number, annual: number } }`. Migrate to Supabase table in Phase 17 if needed.

2. **Resend webhook for email engagement (SALES-06)**
   - What we know: Resend supports webhooks for email.opened, email.clicked, email.bounced events. Webhooks require a public HTTPS endpoint.
   - What's unclear: Should the webhook endpoint be a new Supabase Edge Function or a new route on the LangGraph Railway server?
   - Recommendation: New Supabase Edge Function (`handle-email-webhook`) — it has a stable public URL and direct Supabase DB access. The LangGraph server URL is behind the Edge Function proxy, not directly public. Mark SALES-06 as webhook-dependent; the tool itself reads from `outreach_emails` (which the webhook updates).

3. **Invoice PDF generation format (ACCT-12)**
   - What we know: Requirements say "Nano Banana 2 (Gemini 3.1 Flash Image)" for invoice PDF generation. STATE.md decision: "Nano Banana 2 (Gemini 3.1 Flash Image) for brand-consistent image generation".
   - What's unclear: The Lovable AI Gateway model is `google/gemini-3-flash-preview`. How does "Nano Banana 2" map to the gateway? Is it a different model endpoint?
   - Recommendation: Until confirmed, generate invoice as structured HTML (via LLM) and store as text in `agent_assets`. Mark ACCT-12 as "HTML invoice generation" pending clarification on the Nano Banana 2 / image generation model endpoint.

4. **Apify sync endpoint timeout in Railway**
   - What we know: Apify `run-sync-get-dataset-items` blocks until completion; v1 Edge Function uses it for up to 100 leads.
   - What's unclear: Railway request timeout for LangGraph `/invoke` calls vs Supabase Edge Function timeout.
   - Recommendation: Cap `generate_leads` at 20 leads maximum in the LangGraph tool. Large batch generation remains in the v1 Edge Function. If timeout is an issue, switch to Apify async API (start run → poll for results) with a reasonable poll timeout.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc --noEmit) — primary correctness check |
| Config file | `worrylesssuperagent/langgraph-server/tsconfig.json` |
| Quick run command | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |
| Full suite command | `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` |

No Jest/Vitest test suite in the project. Integration testing is manual via Railway deployment.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCT-01 | `createInvoice` / `listInvoices` return correct types | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-02 | `recordTransaction` with LLM categorization returns category string | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-03 | `parseBankStatementCSV` returns `ParsedTransaction[]` from CSV string | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-04 | `parseReceipt` calls gateway with image_url content array | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-05 | `calculateCashflowProjection` returns 30/60/90-day objects | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-06 | `generatePLReport` groups by month and category | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-07 | `trackBudgetVsActual` reads from Store + transactions | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-08 | `estimateTax` returns structured tax estimate | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-09 | `detectAnomalousTransactions` returns flagged transactions array | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-10 | `chaseOverdueInvoice` calls `interruptForApproval` before Resend | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-11 | `forecastRunway` returns months remaining as number | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| ACCT-12 | `generateInvoicePDF` stores result in `agent_assets` | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-01 | `generateLeads` calls Apify API and upserts to `leads` table | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-02 | `enrichLeadData` updates `leads.notes` with research data | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-03 | `researchProspect` calls Firecrawl `/v1/scrape` and returns ProspectResearch | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-04 | `composeOutreach` returns subject + body strings | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-05 | `sendOutreach` calls `interruptForApproval` before Resend | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-06 | `trackEmailEngagement` reads `outreach_emails` by resend_email_id | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-07 | `updateDealStatus` validates status is in lead_status ENUM values | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-08 | `scheduleFollowUp` writes to `agent_tasks` with `next_run_at` | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-09 | `createProposal` stores in `agent_assets` with `asset_type='document'` | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-10 | `analyzePipeline` returns deal counts and conversion rate | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-11 | `forecastRevenue` returns projected revenue from pipeline | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |
| SALES-12 | `detectStaleDeals` returns leads array with daysSinceUpdate | tsc type check | `npx tsc --noEmit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit`
- **Per wave merge:** `cd worrylesssuperagent/langgraph-server && npx tsc --noEmit` (zero errors required)
- **Phase gate:** Zero tsc errors + manual smoke test via `/invoke` with financial query (must return structured data, not placeholder text)

### Wave 0 Gaps
- [ ] `src/tools/accountant/` directory — all 10 Accountant tool files
- [ ] `src/tools/sales/` directory — all 9 Sales Rep tool files
- [ ] `src/tools/accountant/index.ts` — barrel export
- [ ] `src/tools/sales/index.ts` — barrel export
- [ ] `supabase/migrations/20260319000003_acct_sales_schema.sql` — ENUM extension + columns
- [ ] Export `createLLMNode` and `createRespondNode` from `src/agents/base-agent.ts`
- [ ] Framework install: `npm install csv-parse pdf-parse && npm install --save-dev @types/pdf-parse` in `worrylesssuperagent/langgraph-server/`

---

## Sources

### Primary (HIGH confidence)
- `worrylesssuperagent/supabase/migrations/20251204060048_*.sql` — exact `invoices`, `transactions`, `leads`, `outreach_emails` table schemas
- `worrylesssuperagent/supabase/functions/generate-leads/index.ts` — proven Apify API call pattern, field mapping, location validation
- `worrylesssuperagent/supabase/functions/crawl-business-website/index.ts` — proven Firecrawl `/v1/scrape` call pattern
- `worrylesssuperagent/supabase/functions/send-test-email/index.ts` — proven Resend API pattern + sender address
- `worrylesssuperagent/langgraph-server/src/hitl/interrupt-handler.ts` — HITL interrupt pattern, HIGH_RISK_ACTIONS list
- `worrylesssuperagent/langgraph-server/src/agents/base-agent.ts` — graph node pattern, `createLLMNode` internals
- `worrylesssuperagent/langgraph-server/src/agents/chief-of-staff.ts` — tool-node pattern to replicate for ACCT/SALES
- `worrylesssuperagent/langgraph-server/src/llm/client.ts` — `callLLM` internals confirming multimodal bypass needed
- `worrylesssuperagent/langgraph-server/package.json` — existing dependencies
- npm registry: `csv-parse@5.6.0`, `pdf-parse@1.1.1` (verified 2026-03-19)

### Secondary (MEDIUM confidence)
- STATE.md Accumulated Context — API key strategy (developer-provided, Railway env vars)
- STATE.md decision: "Nano Banana 2 (Gemini 3.1 Flash Image) for brand-consistent image generation" — ACCT-12 model choice still unresolved (see Open Questions)

### Tertiary (LOW confidence — unverified)
- Apify sync endpoint timeout behavior under Railway — stated from v1 Edge Function experience; Railway timeout limits not confirmed. Flag for validation during testing.
- Resend webhook endpoint recommendation (Supabase Edge Function vs Railway route) — architectural recommendation, not verified against Resend webhook documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies verified; new packages version-checked against npm registry
- Architecture patterns: HIGH — derived directly from Phase 12 cosTools pattern (same codebase)
- Database schema: HIGH — verified from migration SQL files; all table/column names confirmed
- External API patterns: HIGH — all three APIs (Apify, Firecrawl, Resend) have proven implementations in v1 Edge Functions
- HITL pattern: HIGH — `interruptForApproval` verified from `hitl/interrupt-handler.ts`
- ACCT-12 (invoice PDF): LOW — "Nano Banana 2" model ID unclear; recommended fallback to HTML generation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — external API patterns are proven; library versions locked)
