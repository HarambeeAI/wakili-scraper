// OPS-01: Customer health scoring and churn detection
// Queries public.support_tickets to compute engagement metrics.

import { getPool } from "../shared/db.js";
import type { ChurnRisk, HealthScore } from "./types.js";

/**
 * Score a customer's health (0-100) based on ticket frequency and resolution speed.
 * Fewer tickets + faster resolution = higher score.
 */
export async function scoreCustomerHealth(
  userId: string,
  customerName: string,
): Promise<HealthScore> {
  const db = getPool();
  const result = await db.query<{
    ticket_count: string;
    last_ticket: string | null;
    avg_resolution_seconds: string | null;
  }>(
    `SELECT
       COUNT(*) AS ticket_count,
       MAX(created_at) AS last_ticket,
       AVG(
         CASE WHEN resolved_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (resolved_at - created_at))
         END
       ) AS avg_resolution_seconds
     FROM public.support_tickets
     WHERE user_id = $1 AND customer_name = $2`,
    [userId, customerName],
  );

  const row = result.rows[0];
  const ticketCount = parseInt(row.ticket_count ?? "0", 10);
  const avgResolutionSeconds = row.avg_resolution_seconds
    ? parseFloat(row.avg_resolution_seconds)
    : null;

  // Score heuristic: start at 100, deduct for ticket frequency and slow resolution
  let score = 100;
  score -= Math.min(ticketCount * 5, 50); // up to -50 for tickets
  if (avgResolutionSeconds !== null) {
    const hoursToResolve = avgResolutionSeconds / 3600;
    score -= Math.min(Math.floor(hoursToResolve / 24) * 5, 30); // -5 per day, up to -30
  }
  score = Math.max(0, score);

  const avgResolutionHours =
    avgResolutionSeconds !== null ? Math.round(avgResolutionSeconds / 3600) : 0;

  let sentiment = "positive";
  if (score < 40) sentiment = "at-risk";
  else if (score < 70) sentiment = "neutral";

  return {
    customerName,
    score,
    factors: {
      ticketFrequency: ticketCount,
      avgResolutionTime: avgResolutionHours,
      sentiment,
    },
  };
}

/**
 * Detect customers with high ticket volume in the last 30 days — churn risk signals.
 * Flags customers with >= 3 tickets as medium risk, >= 5 as high risk.
 */
export async function detectChurnRisk(
  userId: string,
): Promise<{ risks: ChurnRisk[]; message: string }> {
  const db = getPool();
  const result = await db.query<{
    customer_name: string;
    ticket_count: string;
    last_ticket: string;
  }>(
    `SELECT
       customer_name,
       COUNT(*) AS ticket_count,
       MAX(created_at) AS last_ticket
     FROM public.support_tickets
     WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY customer_name
     HAVING COUNT(*) >= 3
     ORDER BY ticket_count DESC`,
    [userId],
  );

  if (result.rows.length === 0) {
    // Count total distinct customers for the empty message
    const countResult = await db.query<{ customer_count: string }>(
      `SELECT COUNT(DISTINCT customer_name) AS customer_count
       FROM public.support_tickets
       WHERE user_id = $1`,
      [userId],
    );
    const customerCount = parseInt(
      countResult.rows[0]?.customer_count ?? "0",
      10,
    );
    return {
      risks: [],
      message: `No churn risk indicators found across ${customerCount} customers.`,
    };
  }

  const risks: ChurnRisk[] = result.rows.map((row) => {
    const ticketCount = parseInt(row.ticket_count, 10);
    const riskLevel: "high" | "medium" = ticketCount >= 5 ? "high" : "medium";
    const reason =
      riskLevel === "high"
        ? `${ticketCount} tickets in the last 30 days`
        : `${ticketCount} tickets in the last 30 days`;

    return {
      customerName: row.customer_name,
      riskLevel,
      reason,
      ticketCount,
      lastTicketDate: row.last_ticket,
    };
  });

  const summary = risks
    .map(
      (r) => `Churn risk detected for ${r.customerName}: ${r.riskLevel} (${r.reason}).`,
    )
    .join(" ");

  return { risks, message: summary };
}
