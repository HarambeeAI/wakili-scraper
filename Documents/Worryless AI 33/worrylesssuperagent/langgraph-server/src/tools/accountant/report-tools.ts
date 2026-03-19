// ACCT-06: P&L report generation — groups transactions by month and category
// with receivables summary from invoices. Covers last 3 months of data.

import { getPool } from "../shared/db.js";
import type { InvoiceSummaryRow, PLReport, PLRow } from "./types.js";

/**
 * Build a structured PLReport from raw DB rows.
 * Groups transaction rows by month; invoice rows provide receivables breakdown.
 */
function buildPLReport(
  txRows: PLRow[],
  invoiceRows: InvoiceSummaryRow[],
): PLReport {
  // Group transaction rows by month
  const monthMap = new Map<
    string,
    { income: number; expenses: number; byCategory: Record<string, number> }
  >();

  for (const row of txRows) {
    const month = row.month;
    if (!monthMap.has(month)) {
      monthMap.set(month, { income: 0, expenses: 0, byCategory: {} });
    }
    const entry = monthMap.get(month)!;
    const amount = Number(row.total) || 0;

    if (row.type === "income") {
      entry.income += amount;
    } else {
      entry.expenses += amount;
    }
    entry.byCategory[row.category] = (entry.byCategory[row.category] ?? 0) + amount;
  }

  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // descending
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      netProfit: data.income - data.expenses,
      byCategory: data.byCategory,
    }));

  // Receivables breakdown from invoice summary
  const receivables = { pending: 0, overdue: 0, paid: 0 };
  for (const row of invoiceRows) {
    const total = Number(row.total) || 0;
    if (row.status === "pending") receivables.pending = total;
    else if (row.status === "overdue") receivables.overdue = total;
    else if (row.status === "paid") receivables.paid = total;
  }

  return { months, receivables };
}

/**
 * Generate a P&L report for the last 3 months of transactions.
 * Includes month-over-month income/expense/netProfit and a receivables summary.
 */
export async function generatePLReport(userId: string): Promise<PLReport> {
  const db = getPool();

  // Query 1: Transaction totals by month, type, and category for last 3 months
  const txResult = await db.query<PLRow>(
    `SELECT
       to_char(date_trunc('month', date), 'YYYY-MM') AS month,
       type,
       COALESCE(category, 'uncategorized') as category,
       SUM(amount) AS total
     FROM public.transactions
     WHERE user_id = $1
       AND date >= NOW() - INTERVAL '3 months'
     GROUP BY 1, 2, 3
     ORDER BY 1 DESC`,
    [userId],
  );

  // Query 2: Invoice receivables summary grouped by status
  const invoiceResult = await db.query<InvoiceSummaryRow>(
    `SELECT status, COUNT(*)::int as count, COALESCE(SUM(amount), 0) AS total
     FROM public.invoices
     WHERE user_id = $1
     GROUP BY status`,
    [userId],
  );

  return buildPLReport(txResult.rows, invoiceResult.rows);
}
