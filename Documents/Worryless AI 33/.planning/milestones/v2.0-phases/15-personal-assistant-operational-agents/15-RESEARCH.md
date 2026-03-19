# Phase 15: Personal Assistant + Operational Agents - Research

**Researched:** 2026-03-19
**Domain:** Google Workspace APIs (Gmail, Calendar, Drive), operational agent tool patterns, new DB tables, COO routing with tools, RAG-grounded responses
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PA-01 | `read_emails` tool via Google Gmail API | `googleapis` 171.4.0 — `gmail.users.messages.list()` + `.get()` with OAuth2 refresh token from `integrations` table |
| PA-02 | `triage_inbox` tool categorizing by urgency/topic via LLM | `callLLMWithStructuredOutput` classifying emails into urgency (urgent/high/normal/low) + topic buckets; same pattern as accountant/marketer classification |
| PA-03 | `draft_email_response` tool matching user communication style | `callLLM` with system prompt injecting user style from memory namespace + email thread context |
| PA-04 | `send_email` tool via Gmail API (requires HITL) | `gmail.users.messages.send()` with `interruptForApproval` before API call; `send_email` already in HIGH_RISK_ACTIONS |
| PA-05 | `list_calendar_events` tool via Google Calendar API | `calendar.events.list()` with timeMin/timeMax filtering |
| PA-06 | `create_calendar_event` tool with availability check (requires HITL) | `calendar.freebusy.query()` + `calendar.events.insert()` with `sendUpdates: 'all'`; `create_calendar_event` already in HIGH_RISK_ACTIONS |
| PA-07 | `prepare_meeting_brief` tool synthesizing attendee info, history, agenda, docs | LLM synthesis over calendar event details + email history with attendees + RAG search for related docs |
| PA-08 | `search_drive` tool via Google Drive API | `drive.files.list()` with q parameter for fullText/name search |
| PA-09 | `detect_calendar_conflicts` tool with resolution suggestions | `calendar.events.list()` + overlap detection logic + LLM for resolution suggestions |
| PA-10 | `analyze_time_allocation` tool for meeting vs focus time breakdown | `calendar.events.list()` over time range + aggregation by type/attendee |
| OPS-01 | Customer Support: ticket CRUD, KB RAG search, health scoring, churn detection | New `support_tickets` table + `ragRetrieveByText` for KB search + LLM scoring |
| OPS-02 | Legal: contract review, contract calendar, regulatory monitoring, template drafting | New `contracts` table + LLM-based review/drafting + date-based calendar alerting |
| OPS-03 | HR: job posting, resume screening, candidate tracking, onboarding plans, performance reviews | New `candidates` table + `callLLMWithStructuredOutput` for screening/scoring |
| OPS-04 | PR: press release drafting, media monitoring, coverage tracking, sentiment analysis | New `press_coverage` table + Firecrawl search for mentions + LLM sentiment |
| OPS-05 | Procurement: supplier search, quote comparison, PO creation (requires HITL), vendor scoring | `create_purchase_order` already in HIGH_RISK_ACTIONS + Firecrawl for supplier search |
| OPS-06 | Data Analyst: cross-functional query, statistical analysis, anomaly detection, chart generation, KPI aggregation | Direct SQL queries across all business tables + z-score math + Recharts-compatible JSON |
| OPS-07 | Operations: project management, milestone tracking, bottleneck analysis, SOP drafting | New `projects` table + milestone sub-table + LLM for SOP generation |
</phase_requirements>

---

## Summary

Phase 15 is the largest tool-building phase in the project, adding real tool execution to 8 agents: the Personal Assistant (10 tools) and the 7 COO-routed operational agents (each with 3-6 tools). Every agent in this phase currently uses `createBaseAgentGraph` (readMemory -> llmNode -> writeMemory -> respond) and needs upgrading to the tools-aware graph topology (readMemory -> {agentType}Tools -> llmNode -> writeMemory -> respond) established in Phases 13-14 for the Accountant, Sales Rep, and Marketer.

The PA agent is the most complex because it requires a new external integration -- Google Workspace APIs (Gmail, Calendar, Drive) via the `googleapis` npm package. The existing `integrations` table already stores `access_token`, `refresh_token`, and `token_expires_at` for Google OAuth, and the existing `sync-gmail-calendar` Edge Function demonstrates the read pattern. The LangGraph server needs a Google OAuth client helper that reads tokens from the `integrations` table via the shared DB pool, refreshes expired tokens, and returns an authenticated `google.auth.OAuth2` client.

The 7 operational agents are individually simpler -- each needs 3-6 tools following the identical pattern from Phase 13-14. Four require new DB tables (`support_tickets`, `contracts`, `candidates`, `press_coverage`, `projects`). All use the same architecture: regex-based request classification, deterministic tool dispatch before LLM, results injected into `businessContext.{agent}ToolResults`.

**Primary recommendation:** Split into 5 plans: (1) DB migration for new tables + Google auth helper, (2) PA tools (Gmail + Calendar + Drive), (3) Customer Support + Legal + HR tools, (4) PR + Procurement + Data Analyst + Operations tools, (5) Graph rewrites for all 8 agents + barrel exports + classification tests. Follow the exact same topology, file naming, and test patterns from Phases 13-14.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | 171.4.0 | Gmail, Calendar, Drive API access | Official Google APIs client for Node.js; actively maintained; single package for all 3 APIs |
| `pg` | 8.13.0 | Database queries via shared pool | Already in project; used by all existing tools |
| `@langchain/langgraph` | 1.2.3 | StateGraph, Command, interrupt | Already in project; provides graph topology |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@google/genai` | 1.46.0 | LLM-based image processing (if needed by PR) | Already in project from Phase 14 |
| `playwright` | 1.58.2 | Web scraping for PR media monitoring | Already in project from Phase 14; reused for PR research |
| `csv-parse` | 6.2.0 | Any CSV data parsing | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` (monolith) | `@googleapis/gmail` + `@googleapis/calendar` + `@googleapis/drive` | Smaller bundles but 3 packages to manage; googleapis is simpler for multi-API use |
| Direct fetch to Google REST API | `googleapis` SDK | SDK handles auth refresh, pagination, error handling; raw fetch would duplicate this |

**Installation:**
```bash
cd worrylesssuperagent/langgraph-server && npm install googleapis
```

**Version verification:** googleapis@171.4.0 confirmed current via `npm view googleapis version` on 2026-03-19.

## Architecture Patterns

### Recommended Project Structure
```
langgraph-server/src/
  tools/
    pa/                          # Personal Assistant tools
      types.ts                   # PAClassification, EmailMessage, CalendarEvent, DriveFile, etc.
      google-auth.ts             # getGoogleClient(userId) — token read/refresh from integrations table
      email-tools.ts             # readEmails, triageInbox, draftEmailResponse, sendEmail
      calendar-tools.ts          # listCalendarEvents, createCalendarEvent, detectConflicts, analyzeTimeAllocation
      meeting-tools.ts           # prepareMeetingBrief (synthesizes calendar + email + drive)
      drive-tools.ts             # searchDrive
      index.ts                   # barrel exports
    customer-support/
      types.ts                   # CSClassification, SupportTicketRow, HealthScore, etc.
      ticket-tools.ts            # createTicket, listTickets, updateTicket, searchKB
      health-tools.ts            # scoreCustomerHealth, detectChurnRisk
      index.ts
    legal/
      types.ts                   # LegalClassification, ContractRow, etc.
      contract-tools.ts          # reviewContract, listContracts, draftTemplate
      compliance-tools.ts        # monitorRegulatory, contractCalendar
      index.ts
    hr/
      types.ts                   # HRClassification, CandidateRow, etc.
      recruiting-tools.ts        # createJobPosting, screenResume, trackCandidate
      people-tools.ts            # createOnboardingPlan, performanceReview
      index.ts
    pr/
      types.ts                   # PRClassification, PressCoverageRow, etc.
      media-tools.ts             # draftPressRelease, monitorMedia, trackCoverage
      sentiment-tools.ts         # analyzeSentiment
      index.ts
    procurement/
      types.ts                   # ProcClassification, SupplierRow, PurchaseOrderRow, etc.
      supplier-tools.ts          # searchSuppliers, compareQuotes, scoreVendor
      po-tools.ts                # createPurchaseOrder (HITL)
      index.ts
    data-analyst/
      types.ts                   # DAClassification, QueryResult, ChartData, etc.
      query-tools.ts             # crossFunctionalQuery, kpiAggregation
      analysis-tools.ts          # statisticalAnalysis, anomalyDetection, generateChart
      index.ts
    operations/
      types.ts                   # OpsClassification, ProjectRow, MilestoneRow, etc.
      project-tools.ts           # createProject, trackMilestones, analyzeBottlenecks
      process-tools.ts           # draftSOP, optimizeProcess
      index.ts
  agents/
    personal-assistant.ts        # Rewrite: add paTools node + PA_SYSTEM_PROMPT update
    customer-support.ts          # Rewrite: add csTools node
    legal-compliance.ts          # Rewrite: add legalTools node
    hr.ts                        # Rewrite: add hrTools node
    pr-comms.ts                  # Rewrite: add prTools node
    procurement.ts               # Rewrite: add procurementTools node
    data-analyst.ts              # Rewrite: add dataAnalystTools node
    operations.ts                # Rewrite: add opsTools node
```

### Pattern 1: Google Auth Helper (new for Phase 15)
**What:** Centralized Google OAuth2 client factory that reads tokens from `integrations` table and auto-refreshes
**When to use:** Every PA tool that calls a Google API
**Example:**
```typescript
// tools/pa/google-auth.ts
import { google } from "googleapis";
import { getPool } from "../shared/db.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function getGoogleClient(userId: string) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT access_token, refresh_token, token_expires_at
     FROM public.integrations
     WHERE user_id = $1 AND provider = 'google' AND is_active = true`,
    [userId]
  );
  if (rows.length === 0) {
    throw new Error("Google integration not connected. Please set up Google OAuth.");
  }
  const { access_token, refresh_token, token_expires_at } = rows[0];

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token,
    refresh_token,
    expiry_date: new Date(token_expires_at).getTime(),
  });

  // Auto-refresh handler: persist new tokens back to DB
  oauth2Client.on("tokens", async (tokens) => {
    const updates: string[] = [];
    const values: unknown[] = [userId];
    let paramIdx = 2;
    if (tokens.access_token) {
      updates.push(`access_token = $${paramIdx++}`);
      values.push(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.push(`refresh_token = $${paramIdx++}`);
      values.push(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.push(`token_expires_at = $${paramIdx++}`);
      values.push(new Date(tokens.expiry_date).toISOString());
    }
    if (updates.length > 0) {
      await db.query(
        `UPDATE public.integrations SET ${updates.join(", ")} WHERE user_id = $1 AND provider = 'google'`,
        values
      ).catch((err) => console.error("[google-auth] Token refresh persist failed:", err));
    }
  });

  return oauth2Client;
}
```

### Pattern 2: Agent Tools Node (established in Phases 13-14)
**What:** Deterministic data-gathering node that runs BEFORE the LLM and injects tool results into `businessContext`
**When to use:** Every agent that has tools
**Example:**
```typescript
// Same pattern as createAccountantToolsNode, createMarketerToolsNode, createSalesToolsNode
export function createPAToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content = typeof lastMessage.content === "string"
      ? lastMessage.content : JSON.stringify(lastMessage.content);

    const cls = classifyPARequest(content);
    const toolResults: Record<string, unknown> = {};

    if (cls.isReadEmails) {
      try { toolResults.emails = await readEmails(state.userId); }
      catch (err) { console.error("[pa-tools] readEmails failed:", err); }
    }
    // ... other classifications

    return {
      businessContext: {
        ...state.businessContext,
        paToolResults: toolResults,
      },
    };
  };
}
```

### Pattern 3: Operational Agent Graph Rewrite (same as Accountant/Marketer)
**What:** Upgrade from `createBaseAgentGraph` to custom `StateGraph` with tools node
**When to use:** All 7 COO-routed agents + PA
**Example:**
```typescript
// Before (Phase 11):
export function createCustomerSupportGraph(checkpointer?: PostgresSaver) {
  return createBaseAgentGraph({ agentType: AGENT_TYPES.CUSTOMER_SUPPORT, systemPrompt: CS_PROMPT }, checkpointer);
}

// After (Phase 15):
export function createCustomerSupportGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = { agentType: AGENT_TYPES.CUSTOMER_SUPPORT, systemPrompt: CS_PROMPT };
  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("csTools", createCSToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "csTools")
    .addEdge("csTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");
  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;
  return graph.compile(compileOpts);
}
```

### Anti-Patterns to Avoid
- **LLM-based tool dispatch:** Never use the LLM to decide which tool to call. Use regex heuristics (established pattern). LLM function calling adds latency and unreliability.
- **Calling Google APIs without token refresh:** Always use the `getGoogleClient` helper, never store raw tokens or skip the refresh listener.
- **Creating separate Google OAuth flows per tool:** One `google-auth.ts` module, one `getGoogleClient(userId)` call. Never duplicate auth logic.
- **Hardcoding SQL in each tool file:** Use the shared `getPool()` from `tools/shared/db.ts` consistently.
- **Using `any` type for tool results:** Define typed interfaces in `types.ts` for every tool input and output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google API auth + token refresh | Manual fetch + token management | `googleapis` OAuth2Client with `on("tokens")` | Handles refresh, retry, pagination, error codes automatically |
| Email MIME encoding for sending | Base64 MIME construction | `googleapis` `gmail.users.messages.send()` with raw format | Gmail API handles MIME encoding when given headers + body |
| Calendar availability detection | Manual event overlap algorithm | `calendar.freebusy.query()` | Google's API handles timezone math, recurring events, all-day events correctly |
| Full-text search on business docs | Custom search implementation | `ragRetrieveByText()` from existing `rag-retrieval.ts` | Already built in Phase 11 with PostgreSQL FTS |
| Z-score anomaly detection | Custom math | Reuse pattern from `anomaly-tools.ts` (Accountant) | Already proven; same formula applies to any numeric dataset |
| HITL approval flow | Custom interrupt logic | `interruptForApproval()` from `hitl/interrupt-handler.ts` | Already handles PA send_email, create_calendar_event, and create_purchase_order |

**Key insight:** This phase is 95% application of established patterns to new domains. The only genuinely new piece is the Google auth helper. Everything else follows the Phase 13-14 blueprint.

## Common Pitfalls

### Pitfall 1: Google OAuth Token Expiry During Long Operations
**What goes wrong:** Access tokens expire after 1 hour. A long-running PA invocation that reads email then creates a calendar event might fail midway.
**Why it happens:** The `googleapis` client does auto-refresh, but only if `refresh_token` is present and the `on("tokens")` handler persists updated tokens.
**How to avoid:** Always pass `refresh_token` to the OAuth2Client. Register the `on("tokens")` listener that writes back to `integrations` table. Test with expired tokens.
**Warning signs:** `401 Unauthorized` or `invalid_grant` errors from Google APIs.

### Pitfall 2: Missing Google Scopes
**What goes wrong:** User grants Gmail read but not send scope. Tool fails at runtime.
**Why it happens:** Google OAuth requires each scope to be explicitly requested during consent.
**How to avoid:** PA requires these scopes: `gmail.readonly`, `gmail.send`, `calendar.readonly`, `calendar.events`, `drive.readonly`. Validate scopes on first use and return helpful error if missing.
**Warning signs:** `403 Insufficient Permission` from Google API calls.

### Pitfall 3: COO Subgraph Node Factory Type Mismatch
**What goes wrong:** After upgrading operational agents from `createBaseAgentGraph` to custom graphs with tool nodes, the COO `opsFactories` type annotation breaks.
**Why it happens:** TypeScript narrows `StateGraph` generics on each `addNode()`. A graph with 5 nodes has a different type than one with 4 nodes.
**How to avoid:** Cast factory return type to `any` in the COO factories map (same pattern already used in `supervisor.ts` and `coo.ts`).
**Warning signs:** TypeScript compilation errors about incompatible graph types.

### Pitfall 4: DB Migration Order Dependency
**What goes wrong:** New tables reference each other or depend on existing columns that don't exist yet.
**Why it happens:** Migrations run in timestamp order; dependencies must be satisfied.
**How to avoid:** Put all new table creations in a single migration file. No cross-table foreign keys between new tables that could cause ordering issues.
**Warning signs:** `relation does not exist` errors during migration.

### Pitfall 5: RAG Search Returns No Results for Customer Support KB
**What goes wrong:** Customer Support KB RAG search returns empty because no documents have been embedded yet.
**Why it happens:** `document_embeddings` table exists but no ingestion pipeline populated it.
**How to avoid:** Use `ragRetrieveByText` (PostgreSQL FTS) as primary, not vector search. FTS works on any text content in the table without requiring embeddings. If no documents exist, the tool should return a clear "no knowledge base articles found" message, not fail silently.
**Warning signs:** Empty result sets from RAG queries.

### Pitfall 6: Data Analyst Cross-Functional Query SQL Injection
**What goes wrong:** If the Data Analyst tool constructs SQL from user input, SQL injection is possible.
**Why it happens:** LLM generates SQL from natural language, which may include unsafe constructs.
**How to avoid:** Use parameterized queries. For the cross-functional query tool, pre-define safe query templates (e.g., "revenue by month", "leads by status") and let the LLM select from them rather than generating arbitrary SQL. Never pass raw LLM output as SQL.
**Warning signs:** Queries that drop tables, read other users' data, or contain UNION attacks.

## Code Examples

### Gmail Read Emails
```typescript
// tools/pa/email-tools.ts
import { google } from "googleapis";
import { getGoogleClient } from "./google-auth.js";

export async function readEmails(userId: string, maxResults: number = 20) {
  const auth = await getGoogleClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "is:inbox",
  });

  if (!data.messages || data.messages.length === 0) {
    return { emails: [], count: 0 };
  }

  const emails = await Promise.all(
    data.messages.map(async (msg) => {
      const { data: detail } = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      const headers = detail.payload?.headers || [];
      return {
        id: detail.id,
        threadId: detail.threadId,
        subject: headers.find((h) => h.name === "Subject")?.value || "",
        from: headers.find((h) => h.name === "From")?.value || "",
        date: headers.find((h) => h.name === "Date")?.value || "",
        snippet: detail.snippet || "",
        labelIds: detail.labelIds || [],
      };
    })
  );

  return { emails, count: emails.length };
}
```

### Calendar FreeBusy Check + Event Creation
```typescript
// tools/pa/calendar-tools.ts
import { google } from "googleapis";
import { getGoogleClient } from "./google-auth.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";

export async function createCalendarEvent(
  userId: string,
  agentType: string,
  eventDetails: {
    summary: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    description?: string;
    location?: string;
  }
) {
  const auth = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  // Check availability first
  const { data: freeBusy } = await calendar.freebusy.query({
    requestBody: {
      timeMin: eventDetails.startTime,
      timeMax: eventDetails.endTime,
      items: [{ id: "primary" }],
    },
  });

  const busySlots = freeBusy.calendars?.primary?.busy || [];
  if (busySlots.length > 0) {
    return {
      conflict: true,
      busySlots,
      message: `Conflict detected: you have ${busySlots.length} event(s) during this time.`,
    };
  }

  // HITL: require approval before creating event
  const approval = interruptForApproval({
    action: "create_calendar_event",
    agentType: agentType as any,
    description: `Create calendar event: "${eventDetails.summary}" from ${eventDetails.startTime} to ${eventDetails.endTime}`,
    payload: eventDetails,
  });

  if (!approval.approved) {
    return { created: false, message: "Event creation cancelled by user." };
  }

  const { data: event } = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: eventDetails.summary,
      description: eventDetails.description,
      location: eventDetails.location,
      start: { dateTime: eventDetails.startTime },
      end: { dateTime: eventDetails.endTime },
      attendees: eventDetails.attendees?.map((email) => ({ email })),
    },
  });

  return { created: true, eventId: event.id, htmlLink: event.htmlLink };
}
```

### Customer Support KB RAG Search
```typescript
// tools/customer-support/ticket-tools.ts
import { ragRetrieveByText } from "../../tools/rag-retrieval.js";
import { callLLM } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";

export async function searchKBAndDraftResponse(userId: string, query: string) {
  // Search knowledge base using existing RAG infrastructure
  const docs = await ragRetrieveByText(userId, query, 5, "customer_support");

  if (docs.length === 0) {
    return {
      kbResults: [],
      draftResponse: null,
      message: "No knowledge base articles found. Please add business documentation to enable grounded responses.",
    };
  }

  // Draft response grounded in KB results
  const kbContext = docs.map((d) => `[${d.source}]: ${d.content}`).join("\n\n");
  const result = await callLLM(
    [new HumanMessage(`Customer query: ${query}\n\nKnowledge base context:\n${kbContext}\n\nDraft a helpful, specific response grounded in the knowledge base articles above.`)],
    { systemPrompt: "You are a customer support agent. Draft a response that directly addresses the query using only information from the knowledge base. Cite sources.", temperature: 0.5 }
  );

  return {
    kbResults: docs.map((d) => ({ source: d.source, content: d.content.slice(0, 200), similarity: d.similarity })),
    draftResponse: result.content,
  };
}
```

### Data Analyst Cross-Functional Query
```typescript
// tools/data-analyst/query-tools.ts
import { getPool } from "../shared/db.js";

// Pre-defined safe query templates — LLM selects from these, never generates raw SQL
const QUERY_TEMPLATES: Record<string, string> = {
  revenue_by_month: `SELECT date_trunc('month', date) AS month, SUM(amount) AS total FROM public.transactions WHERE user_id = $1 AND type = 'income' GROUP BY 1 ORDER BY 1`,
  expenses_by_category: `SELECT category, SUM(amount) AS total FROM public.transactions WHERE user_id = $1 AND type = 'expense' GROUP BY 1 ORDER BY 2 DESC`,
  leads_by_status: `SELECT status, COUNT(*) AS count, COALESCE(SUM(deal_value), 0) AS total_value FROM public.leads WHERE user_id = $1 GROUP BY 1`,
  invoice_summary: `SELECT status, COUNT(*) AS count, SUM(amount) AS total FROM public.invoices WHERE user_id = $1 GROUP BY 1`,
  posts_by_platform: `SELECT platform, COUNT(*) AS count, AVG(engagement_likes) AS avg_likes FROM public.social_posts WHERE user_id = $1 GROUP BY 1`,
  support_ticket_summary: `SELECT status, priority, COUNT(*) AS count FROM public.support_tickets WHERE user_id = $1 GROUP BY 1, 2`,
  project_status: `SELECT status, COUNT(*) AS count FROM public.projects WHERE user_id = $1 GROUP BY 1`,
};

export async function crossFunctionalQuery(userId: string, queryType: string) {
  const sql = QUERY_TEMPLATES[queryType];
  if (!sql) {
    return { error: `Unknown query type: ${queryType}. Available: ${Object.keys(QUERY_TEMPLATES).join(", ")}` };
  }
  const db = getPool();
  const { rows } = await db.query(sql, [userId]);
  return { queryType, data: rows, rowCount: rows.length };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-API Google packages (`@googleapis/gmail` etc.) | Monolith `googleapis` package | Still current — monolith recommended for multi-API apps | Single import, shared auth, consistent API |
| LLM function-calling for tool dispatch | Regex-based deterministic classification | Established in Phase 13 | Faster, no extra LLM call, more predictable |
| Custom email sending libraries (nodemailer) | `googleapis` Gmail API `messages.send()` | Gmail API v1 | No SMTP config, uses OAuth2, consistent with read |

**Deprecated/outdated:**
- `node-gmail-api` npm package: Last updated 8 years ago. Do not use.
- `google-calendar` npm package: Last updated 11 years ago. Do not use.
- Direct SMTP with nodemailer for Gmail: Requires "less secure app access" which Google deprecated. Use Gmail API via OAuth2.

## New Database Tables Required

### Migration: `20260320000001_ops_agent_tables.sql`

```sql
-- Phase 15: Operational agent tables

-- OPS-01: Support tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  category TEXT,
  resolution TEXT,
  health_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ
);

-- OPS-02: Contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  contract_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'active', 'expired', 'terminated')),
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  value DECIMAL(12, 2),
  key_terms JSONB DEFAULT '{}',
  risk_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-03: Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT NOT NULL,
  status TEXT DEFAULT 'applied' CHECK (status IN ('prospecting', 'applied', 'screened', 'interview', 'offer', 'hired', 'rejected')),
  resume_text TEXT,
  skills_score INTEGER,
  experience_score INTEGER,
  culture_score INTEGER,
  overall_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-04: Press coverage
CREATE TABLE public.press_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  publication TEXT NOT NULL,
  journalist TEXT,
  title TEXT NOT NULL,
  url TEXT,
  coverage_date DATE,
  reach INTEGER,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  follow_up_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-07: Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- OPS-07: Project milestones (child table)
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies (user can CRUD own rows)
CREATE POLICY "Users manage own support_tickets" ON public.support_tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own contracts" ON public.contracts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own candidates" ON public.candidates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own press_coverage" ON public.press_coverage FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own milestones" ON public.project_milestones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_milestones.project_id AND user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id, status);
CREATE INDEX idx_contracts_user ON public.contracts (user_id, status);
CREATE INDEX idx_contracts_renewal ON public.contracts (user_id, renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX idx_candidates_user ON public.candidates (user_id, position, status);
CREATE INDEX idx_press_coverage_user ON public.press_coverage (user_id, coverage_date DESC);
CREATE INDEX idx_projects_user ON public.projects (user_id, status);
CREATE INDEX idx_milestones_project ON public.project_milestones (project_id, status);

-- Triggers
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## Google OAuth Scopes Required

The PA agent requires the following Google OAuth2 scopes:
```
https://www.googleapis.com/auth/gmail.readonly     # PA-01, PA-02
https://www.googleapis.com/auth/gmail.send          # PA-04
https://www.googleapis.com/auth/calendar.readonly   # PA-05, PA-09, PA-10
https://www.googleapis.com/auth/calendar.events     # PA-06
https://www.googleapis.com/auth/drive.readonly      # PA-08
```

These scopes must be requested during the Google OAuth consent flow (handled in Phase 17 onboarding). For Phase 15, tools should check for scope availability and return descriptive errors when scopes are missing.

## HITL Actions in This Phase

| Agent | Action | Constant | Already Registered? |
|-------|--------|----------|---------------------|
| Personal Assistant | Send email | `send_email` | Yes (in HIGH_RISK_ACTIONS) |
| Personal Assistant | Create calendar event | `create_calendar_event` | Yes (in HIGH_RISK_ACTIONS) |
| Procurement | Create purchase order | `create_purchase_order` | Yes (in HIGH_RISK_ACTIONS) |

No new HITL action types need to be added. All three are already in the `HIGH_RISK_ACTIONS` array in `hitl/interrupt-handler.ts`.

## Open Questions

1. **Google Cloud Project Setup**
   - What we know: The PA requires a Google Cloud project with Gmail, Calendar, and Drive APIs enabled. STATE.md notes "Google OAuth for PA requires Google Cloud project setup and consent screen approval before Phase 15."
   - What's unclear: Whether a Google Cloud project already exists for this app. The `integrations` table and `sync-gmail-calendar` Edge Function suggest one was partially set up.
   - Recommendation: Tool code should work regardless -- it reads tokens from the `integrations` table. The Google Cloud project setup is an infrastructure/deployment concern, not a code concern. Tools should return clear "Google integration not connected" errors when tokens are missing.

2. **Procurement Supplier Search Data Source**
   - What we know: OPS-05 requires supplier search and quote comparison.
   - What's unclear: No external API (like Apify for leads) is specified for supplier discovery.
   - Recommendation: Use Firecrawl web search (same as Marketer research tools) for supplier discovery. Quote comparison is a structured LLM task on user-provided data. This mirrors the pattern from `monitorBrandMentions` and `searchTrendingTopics`.

3. **Data Analyst SQL Safety**
   - What we know: OPS-06 requires cross-functional queries across all business tables.
   - What's unclear: Whether the LLM should generate arbitrary SQL or select from templates.
   - Recommendation: Pre-defined query templates only (shown in code examples above). Never pass LLM-generated SQL directly. This is a security-critical decision.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose langgraph-server/src/tools/{agent}` |
| Full suite command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PA-01 | readEmails returns structured email list | unit | `npx vitest run langgraph-server/src/tools/pa/email-tools.test.ts -x` | Wave 0 |
| PA-02 | triageInbox categorizes emails by urgency/topic | unit | `npx vitest run langgraph-server/src/tools/pa/email-tools.test.ts -x` | Wave 0 |
| PA-03 | draftEmailResponse returns styled draft | unit | `npx vitest run langgraph-server/src/tools/pa/email-tools.test.ts -x` | Wave 0 |
| PA-04 | sendEmail calls interruptForApproval before Gmail API | unit | `npx vitest run langgraph-server/src/tools/pa/email-tools.test.ts -x` | Wave 0 |
| PA-05 | listCalendarEvents returns filtered events | unit | `npx vitest run langgraph-server/src/tools/pa/calendar-tools.test.ts -x` | Wave 0 |
| PA-06 | createCalendarEvent checks freeBusy + HITL | unit | `npx vitest run langgraph-server/src/tools/pa/calendar-tools.test.ts -x` | Wave 0 |
| PA-07 | prepareMeetingBrief synthesizes multi-source data | unit | `npx vitest run langgraph-server/src/tools/pa/meeting-tools.test.ts -x` | Wave 0 |
| PA-08 | searchDrive returns file list | unit | `npx vitest run langgraph-server/src/tools/pa/drive-tools.test.ts -x` | Wave 0 |
| PA-09 | detectCalendarConflicts finds overlaps | unit | `npx vitest run langgraph-server/src/tools/pa/calendar-tools.test.ts -x` | Wave 0 |
| PA-10 | analyzeTimeAllocation returns meeting/focus breakdown | unit | `npx vitest run langgraph-server/src/tools/pa/calendar-tools.test.ts -x` | Wave 0 |
| OPS-01 | CS ticket CRUD + KB RAG search | unit | `npx vitest run langgraph-server/src/tools/customer-support/*.test.ts -x` | Wave 0 |
| OPS-02 | Legal contract review + template draft | unit | `npx vitest run langgraph-server/src/tools/legal/*.test.ts -x` | Wave 0 |
| OPS-03 | HR candidate screening + onboarding | unit | `npx vitest run langgraph-server/src/tools/hr/*.test.ts -x` | Wave 0 |
| OPS-04 | PR press release + media monitoring | unit | `npx vitest run langgraph-server/src/tools/pr/*.test.ts -x` | Wave 0 |
| OPS-05 | Procurement supplier search + PO HITL | unit | `npx vitest run langgraph-server/src/tools/procurement/*.test.ts -x` | Wave 0 |
| OPS-06 | Data Analyst cross-functional query | unit | `npx vitest run langgraph-server/src/tools/data-analyst/*.test.ts -x` | Wave 0 |
| OPS-07 | Operations project + milestone CRUD | unit | `npx vitest run langgraph-server/src/tools/operations/*.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run --reporter=verbose langgraph-server/src/tools/{relevant-dir}`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] All test files listed above -- Wave 0
- [ ] Mock for `googleapis` -- shared mock factory for Gmail/Calendar/Drive in test files
- [ ] Mock for `getGoogleClient` -- test helper returning mock OAuth2 client

## Sources

### Primary (HIGH confidence)
- Project codebase: `langgraph-server/src/agents/*.ts`, `tools/accountant/`, `tools/sales/`, `tools/marketer/` -- established patterns
- `hitl/interrupt-handler.ts` -- HITL actions already registered
- `supabase/migrations/20251204060048_*.sql` -- existing `integrations` table schema
- `supabase/functions/sync-gmail-calendar/index.ts` -- existing Google integration read pattern

### Secondary (MEDIUM confidence)
- [googleapis npm](https://www.npmjs.com/package/googleapis) -- v171.4.0 confirmed via `npm view`
- [Google Gmail API quickstart](https://developers.google.com/gmail/api/quickstart/nodejs) -- official Node.js integration guide
- [Google Calendar freebusy query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) -- official API reference
- [Supabase Google OAuth docs](https://supabase.com/docs/guides/auth/social-login/auth-google) -- token storage patterns

### Tertiary (LOW confidence)
- None. All findings verified with official sources or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `googleapis` is the only serious option for Google API access in Node.js; version confirmed
- Architecture: HIGH -- follows identical patterns from Phases 13-14 that are already working in production
- Pitfalls: HIGH -- identified from actual codebase patterns and Google API documentation
- New DB tables: HIGH -- follow exact conventions from existing migrations
- Google auth: MEDIUM -- token refresh pattern standard but untested in this codebase; `integrations` table already exists

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain; Google APIs change slowly)
