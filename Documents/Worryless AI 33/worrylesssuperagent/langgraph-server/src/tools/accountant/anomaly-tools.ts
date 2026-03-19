// anomaly-tools.ts — Statistical anomaly detection (ACCT-09)
// Uses IQR/z-score analysis to flag unusual transactions by category.

import { getPool } from "../shared/db.js";
import type { AnomalousTransaction } from "./types.js";

interface RawTransaction {
  id: string;
  amount: string;
  description: string | null;
  date: string;
  category: string;
}

// ACCT-09: Detect anomalous transactions using z-score statistical analysis per category
export async function detectAnomalousTransactions(
  userId: string,
): Promise<AnomalousTransaction[]> {
  const db = getPool();
  const result = await db.query<RawTransaction>(
    `SELECT id, amount, description, date::text, COALESCE(category, 'uncategorized') as category
     FROM public.transactions
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '90 days'
     ORDER BY date DESC`,
    [userId],
  );

  const transactions = result.rows;
  if (transactions.length === 0) return [];

  // Group by category
  const byCategory: Record<string, RawTransaction[]> = {};
  for (const tx of transactions) {
    if (!byCategory[tx.category]) byCategory[tx.category] = [];
    byCategory[tx.category].push(tx);
  }

  const anomalies: AnomalousTransaction[] = [];

  for (const [category, txs] of Object.entries(byCategory)) {
    if (txs.length < 2) continue; // Need at least 2 data points for meaningful stats

    const amounts = txs.map((tx) => parseFloat(tx.amount));
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue; // All amounts identical — no outliers possible

    for (const tx of txs) {
      const amount = parseFloat(tx.amount);
      const zScore = Math.abs(amount - mean) / stdDev;

      if (zScore > 2.0) {
        anomalies.push({
          id: tx.id,
          amount,
          description: tx.description ?? "",
          date: tx.date,
          category,
          reason: `Amount ${amount.toFixed(2)} is ${zScore.toFixed(1)} standard deviations from the ${category} average of ${mean.toFixed(2)}`,
          zScore,
        });
      }
    }
  }

  // Sort by z-score descending and return top 20
  anomalies.sort((a, b) => b.zScore - a.zScore);
  return anomalies.slice(0, 20);
}
