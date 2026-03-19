// tax-tools.ts — Budget vs actual tracking (ACCT-07) + Tax estimation (ACCT-08)

import { HumanMessage } from "@langchain/core/messages";
import { getPool } from "../shared/db.js";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { getStore } from "../../persistence/store.js";
import type { BudgetComparison, BudgetTarget, TaxEstimate } from "./types.js";

// ACCT-07: Read budget targets from LangGraph Store, compare against actual transactions
export async function trackBudgetVsActual(
  userId: string,
): Promise<BudgetComparison[]> {
  const storeItem = await getStore(
    `${userId}:agent_memory:accountant`,
    "budget_targets",
  );
  if (!storeItem) {
    // User hasn't set budget targets yet
    return [];
  }

  const budgetTargets = storeItem.value as unknown as BudgetTarget[];
  if (!Array.isArray(budgetTargets) || budgetTargets.length === 0) {
    return [];
  }

  const db = getPool();
  const result = await db.query<{ category: string; total: string }>(
    `SELECT COALESCE(category, 'uncategorized') as category, SUM(amount) as total
     FROM public.transactions
     WHERE user_id = $1 AND type = 'expense'
       AND date >= date_trunc('month', CURRENT_DATE)
     GROUP BY 1`,
    [userId],
  );

  const actualByCategory: Record<string, number> = {};
  for (const row of result.rows) {
    actualByCategory[row.category] = parseFloat(row.total);
  }

  const comparisons: BudgetComparison[] = budgetTargets.map((target) => {
    const actual = actualByCategory[target.category] ?? 0;
    const variance = target.monthly - actual;
    const variancePct = target.monthly > 0 ? (actual / target.monthly) * 100 : 0;
    return {
      category: target.category,
      budgeted: target.monthly,
      actual,
      variance,
      variancePct,
    };
  });

  return comparisons;
}

// ACCT-08: Estimate tax liability using LLM with jurisdiction awareness
export async function estimateTax(
  userId: string,
  jurisdiction?: string,
): Promise<TaxEstimate> {
  const db = getPool();
  const result = await db.query<{ type: string; total: string }>(
    `SELECT type, SUM(amount) as total
     FROM public.transactions
     WHERE user_id = $1
       AND date >= date_trunc('year', CURRENT_DATE)
     GROUP BY type`,
    [userId],
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of result.rows) {
    if (row.type === "income") totalIncome = parseFloat(row.total);
    else if (row.type === "expense") totalExpenses = parseFloat(row.total);
  }

  const messages = [
    new HumanMessage(
      `Estimate tax liability for a business with the following financials:
- Total income (year-to-date): ${totalIncome.toFixed(2)}
- Total deductible expenses (year-to-date): ${totalExpenses.toFixed(2)}
- Jurisdiction: ${jurisdiction ?? "General / unspecified"}

Provide a tax estimate with all required fields.`,
    ),
  ];

  const schema = `{"totalIncome": number, "totalDeductions": number, "taxableIncome": number, "estimatedTax": number, "effectiveRate": number, "jurisdiction": "string", "disclaimer": "string"}`;

  const { data } = await callLLMWithStructuredOutput<TaxEstimate>(
    messages,
    schema,
    {
      systemPrompt:
        "You are a tax estimation assistant. Given the financial data, estimate tax liability. Always include a disclaimer that this is an estimate and professional tax advice is recommended.",
      temperature: 0.2,
    },
  );

  return data;
}
