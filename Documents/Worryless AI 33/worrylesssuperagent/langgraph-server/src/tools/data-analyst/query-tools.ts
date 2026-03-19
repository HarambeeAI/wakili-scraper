// query-tools.ts — Cross-functional query + KPI aggregation tools (OPS-06)
// Uses pre-defined safe SQL templates only — never LLM-generated SQL.

import { getPool } from "../shared/db.js";
import type { QueryResult, KPISummary } from "./types.js";

// Pre-defined safe query templates — LLM selects from these, never generates raw SQL
export const QUERY_TEMPLATES: Record<string, string> = {
  revenue_by_month: `SELECT date_trunc('month', date) AS month, SUM(amount) AS total FROM public.transactions WHERE user_id = $1 AND type = 'income' GROUP BY 1 ORDER BY 1`,
  expenses_by_category: `SELECT category, SUM(amount) AS total FROM public.transactions WHERE user_id = $1 AND type = 'expense' GROUP BY 1 ORDER BY 2 DESC`,
  leads_by_status: `SELECT status, COUNT(*) AS count, COALESCE(SUM(deal_value), 0) AS total_value FROM public.leads WHERE user_id = $1 GROUP BY 1`,
  invoice_summary: `SELECT status, COUNT(*) AS count, SUM(amount) AS total FROM public.invoices WHERE user_id = $1 GROUP BY 1`,
  posts_by_platform: `SELECT platform, COUNT(*) AS count, AVG(engagement_likes) AS avg_likes FROM public.social_posts WHERE user_id = $1 GROUP BY 1`,
  support_ticket_summary: `SELECT status, priority, COUNT(*) AS count FROM public.support_tickets WHERE user_id = $1 GROUP BY 1, 2`,
  project_status: `SELECT status, COUNT(*) AS count FROM public.projects WHERE user_id = $1 GROUP BY 1`,
};

// OPS-06: Run a pre-defined cross-functional query by name
export async function crossFunctionalQuery(
  userId: string,
  queryType: string,
): Promise<QueryResult & { message: string; error?: string }> {
  const sql = QUERY_TEMPLATES[queryType];
  if (!sql) {
    const availableTypes = Object.keys(QUERY_TEMPLATES).join(", ");
    return {
      queryType,
      data: [],
      rowCount: 0,
      error: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
      message: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
    };
  }

  const db = getPool();
  const { rows } = await db.query<Record<string, unknown>>(sql, [userId]);

  if (rows.length === 0) {
    return {
      queryType,
      data: [],
      rowCount: 0,
      message: `Query returned no results for "${queryType}".`,
    };
  }

  return {
    queryType,
    data: rows,
    rowCount: rows.length,
    message: `Query complete: ${rows.length} row(s) returned for "${queryType}".`,
  };
}

// OPS-06: Aggregate KPIs across multiple data sources in one call
export async function kpiAggregation(userId: string): Promise<KPISummary & { message: string }> {
  const db = getPool();

  // Run relevant templates concurrently
  const [revenueResult, leadsResult, invoiceResult, ticketResult, projectResult] =
    await Promise.all([
      db
        .query<{ total: string }>(QUERY_TEMPLATES.revenue_by_month, [userId])
        .then((r) => r.rows)
        .catch(() => [] as Array<{ total: string }>),
      db
        .query<{ status: string; count: string }>(QUERY_TEMPLATES.leads_by_status, [userId])
        .then((r) => r.rows)
        .catch(() => [] as Array<{ status: string; count: string }>),
      db
        .query<{ status: string; count: string; total: string }>(QUERY_TEMPLATES.invoice_summary, [userId])
        .then((r) => r.rows)
        .catch(() => [] as Array<{ status: string; count: string; total: string }>),
      db
        .query<{ status: string; count: string }>(QUERY_TEMPLATES.support_ticket_summary, [userId])
        .then((r) => r.rows)
        .catch(() => [] as Array<{ status: string; count: string }>),
      db
        .query<{ status: string; count: string }>(QUERY_TEMPLATES.project_status, [userId])
        .then((r) => r.rows)
        .catch(() => [] as Array<{ status: string; count: string }>),
    ]);

  // Derive KPIs
  const totalRevenue = revenueResult.reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);

  const totalLeads = leadsResult.reduce((sum, r) => sum + parseInt(r.count ?? "0", 10), 0);
  const closedWon = leadsResult
    .filter((r) => r.status === "closed_won")
    .reduce((sum, r) => sum + parseInt(r.count ?? "0", 10), 0);
  const conversionRate = totalLeads > 0 ? (closedWon / totalLeads) * 100 : 0;

  const paidInvoices = invoiceResult.filter((r) => r.status === "paid");
  const paidCount = paidInvoices.reduce((sum, r) => sum + parseInt(r.count ?? "0", 10), 0);
  const paidTotal = paidInvoices.reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);
  const avgInvoiceValue = paidCount > 0 ? paidTotal / paidCount : 0;

  const openTickets = ticketResult
    .filter((r) => r.status === "open" || r.status === "in_progress")
    .reduce((sum, r) => sum + parseInt(r.count ?? "0", 10), 0);

  const activeProjects = projectResult
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + parseInt(r.count ?? "0", 10), 0);

  const metrics: KPISummary["metrics"] = [
    { name: "Total Revenue", value: totalRevenue, unit: "currency", trend: "flat", changePercent: 0 },
    { name: "Lead Conversion Rate", value: conversionRate, unit: "percent", trend: "flat", changePercent: 0 },
    { name: "Avg Invoice Value", value: avgInvoiceValue, unit: "currency", trend: "flat", changePercent: 0 },
    { name: "Open Tickets", value: openTickets, unit: "count", trend: "flat", changePercent: 0 },
    { name: "Active Projects", value: activeProjects, unit: "count", trend: "flat", changePercent: 0 },
  ];

  const dataSources = ["transactions", "leads", "invoices", "support_tickets", "projects"];

  return {
    metrics,
    dataSources,
    message: `KPI summary: ${metrics.length} metric(s) aggregated across ${dataSources.length} data source(s).`,
  };
}
