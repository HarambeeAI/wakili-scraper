// invoice-pdf.ts — Runway forecasting (ACCT-11) + HTML invoice generation (ACCT-12)

import { HumanMessage } from "@langchain/core/messages";
import { getPool } from "../shared/db.js";
import { callLLM } from "../../llm/client.js";
import type { RunwayForecast } from "./types.js";

// ACCT-11: Forecast cash runway from current burn rate
export async function forecastRunway(userId: string): Promise<RunwayForecast> {
  const db = getPool();

  // Query current cash balance (cumulative income minus expenses)
  const balanceResult = await db.query<{ cash_balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) as cash_balance
     FROM public.transactions WHERE user_id = $1`,
    [userId],
  );

  const cashBalance = parseFloat(balanceResult.rows[0]?.cash_balance ?? "0");

  // Query monthly averages for the last 3 months
  const avgResult = await db.query<{ type: string; avg_monthly: string }>(
    `SELECT type, AVG(monthly_total) as avg_monthly
     FROM (
       SELECT type, date_trunc('month', date) as month, SUM(amount) as monthly_total
       FROM public.transactions
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '3 months'
       GROUP BY type, date_trunc('month', date)
     ) sub
     GROUP BY type`,
    [userId],
  );

  let monthlyBurnRate = 0;
  let monthlyIncome = 0;
  for (const row of avgResult.rows) {
    if (row.type === "expense") monthlyBurnRate = parseFloat(row.avg_monthly ?? "0");
    else if (row.type === "income") monthlyIncome = parseFloat(row.avg_monthly ?? "0");
  }

  const netBurn = monthlyBurnRate - monthlyIncome;
  const runwayMonths = netBurn > 0 ? cashBalance / netBurn : 999;

  let status: RunwayForecast["status"];
  if (runwayMonths >= 6) status = "healthy";
  else if (runwayMonths >= 2) status = "warning";
  else status = "critical";

  return {
    cashBalance,
    monthlyBurnRate,
    monthlyIncome,
    netBurn,
    runwayMonths,
    status,
  };
}

interface InvoiceWithLineItems {
  id: string;
  vendor_name: string;
  vendor_email: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  line_items: unknown;
}

// ACCT-12: Generate structured HTML invoice and store it in agent_assets
export async function generateInvoiceHtml(
  userId: string,
  invoiceId: string,
): Promise<string> {
  const db = getPool();

  // Query invoice with related transaction line items
  const invoiceResult = await db.query<InvoiceWithLineItems>(
    `SELECT i.*, json_agg(t.*) as line_items
     FROM public.invoices i
     LEFT JOIN public.transactions t ON t.invoice_id = i.id
     WHERE i.id = $1 AND i.user_id = $2
     GROUP BY i.id`,
    [invoiceId, userId],
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }

  const invoice = invoiceResult.rows[0];

  // Generate HTML invoice via LLM
  const llmResult = await callLLM(
    [
      new HumanMessage(
        `Generate a professional HTML invoice for the following data:\n${JSON.stringify(invoice, null, 2)}`,
      ),
    ],
    {
      systemPrompt:
        "Generate a clean, professional HTML invoice. Use inline CSS. Include: company header, invoice number, date, vendor details, line items table, totals, payment terms.",
    },
  );

  const htmlContent = llmResult.content;

  // Store in agent_assets
  const assetResult = await db.query<{ id: string }>(
    `INSERT INTO public.agent_assets (user_id, agent_type, asset_type, title, content, metadata)
     VALUES ($1, 'accountant', 'document', $2, $3, $4)
     RETURNING id`,
    [
      userId,
      `Invoice ${invoiceId}`,
      htmlContent,
      JSON.stringify({
        invoiceId,
        generatedAt: new Date().toISOString(),
      }),
    ],
  );

  return assetResult.rows[0].id;
}
