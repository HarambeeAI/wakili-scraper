// ACCT-05: Cashflow projection — 30/60/90 day forecast from live transaction + invoice data.
// Queries public.transactions for monthly averages and public.invoices for pending receivables.

import { getPool } from "../shared/db.js";
import type { CashflowProjection } from "./types.js";

/**
 * Calculate 30/60/90 day cashflow projections for a user.
 * Uses 90-day transaction history to compute monthly income/expense averages,
 * then extrapolates forward. Pending invoices are included as projected income.
 */
export async function calculateCashflowProjection(
  userId: string,
): Promise<CashflowProjection[]> {
  const db = getPool();

  // Query 1: 90-day transaction totals grouped by type (income / expense)
  const txResult = await db.query<{ type: string; total: string }>(
    `SELECT type, SUM(amount) as total
     FROM public.transactions
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '90 days'
     GROUP BY type`,
    [userId],
  );

  // Query 2: Pending invoice total (projected receivables)
  const invoiceResult = await db.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM public.invoices
     WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  );

  // Query 3: Current cash position (all-time income minus expenses)
  const balanceResult = await db.query<{ cash_balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) as cash_balance
     FROM public.transactions
     WHERE user_id = $1`,
    [userId],
  );

  // Parse raw DB values
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of txResult.rows) {
    if (row.type === "income") totalIncome = parseFloat(row.total) || 0;
    if (row.type === "expense") totalExpenses = parseFloat(row.total) || 0;
  }

  const pendingInvoices = parseFloat(invoiceResult.rows[0]?.total ?? "0") || 0;
  const cashBalance = parseFloat(balanceResult.rows[0]?.cash_balance ?? "0") || 0;

  // Monthly averages over 3 months
  const avgMonthlyIncome = totalIncome / 3;
  const avgMonthlyExpenses = totalExpenses / 3;

  const projections: CashflowProjection[] = [
    {
      period: "30d",
      startingCash: cashBalance,
      projectedIncome: avgMonthlyIncome * 1,
      projectedExpenses: avgMonthlyExpenses * 1,
      projectedBalance: cashBalance + avgMonthlyIncome * 1 - avgMonthlyExpenses * 1,
      pendingInvoices,
    },
    {
      period: "60d",
      startingCash: cashBalance,
      projectedIncome: avgMonthlyIncome * 2,
      projectedExpenses: avgMonthlyExpenses * 2,
      projectedBalance: cashBalance + avgMonthlyIncome * 2 - avgMonthlyExpenses * 2,
      pendingInvoices,
    },
    {
      period: "90d",
      startingCash: cashBalance,
      projectedIncome: avgMonthlyIncome * 3,
      projectedExpenses: avgMonthlyExpenses * 3,
      projectedBalance: cashBalance + avgMonthlyIncome * 3 - avgMonthlyExpenses * 3,
      pendingInvoices,
    },
  ];

  return projections;
}
