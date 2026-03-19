// Pipeline analysis and revenue forecast tools — SALES-10, SALES-11
// Provides deal counts by stage, conversion rates, and 30/60/90-day revenue projections.

import { getPool } from "../shared/db.js";
import type { PipelineAnalysis, PipelineStageRow, RevenueForcast } from "./types.js";

// Stage-weighted probability of closing (used for weighted pipeline calculation)
const STAGE_WEIGHTS: Record<string, number> = {
  prospecting: 0.05,
  contacted: 0.10,
  responded: 0.20,
  qualified: 0.40,
  proposal: 0.60,
  converted: 1.0,
  closed_won: 1.0,
};

/**
 * SALES-10: Analyze the pipeline — deal counts by stage, conversion rate, total value.
 */
export async function analyzePipeline(userId: string): Promise<PipelineAnalysis> {
  const pool = getPool();

  // Deal counts, scores, and values by stage
  const stageResult = await pool.query<{
    status: string;
    deal_count: number;
    total_score: number;
    total_deal_value: string | null;
    avg_days_in_stage: string | null;
  }>(
    `SELECT
       status,
       COUNT(*)::int AS deal_count,
       COALESCE(SUM(score), 0)::int AS total_score,
       SUM(deal_value) AS total_deal_value,
       AVG(EXTRACT(epoch FROM (NOW() - updated_at)) / 86400)::numeric(10,1) AS avg_days_in_stage
     FROM public.leads
     WHERE user_id = $1
     GROUP BY status`,
    [userId],
  );

  // Historical conversion rate (last 90 days)
  const conversionResult = await pool.query<{
    converted: number;
    total: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('converted', 'closed_won'))::int AS converted,
       COUNT(*)::int AS total
     FROM public.leads
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'`,
    [userId],
  );

  const byStage: PipelineStageRow[] = stageResult.rows.map((row) => ({
    status: row.status,
    deal_count: row.deal_count,
    total_score: row.total_score,
    total_deal_value: row.total_deal_value != null ? parseFloat(row.total_deal_value) : null,
    avg_days_in_stage: row.avg_days_in_stage != null ? parseFloat(row.avg_days_in_stage) : 0,
  }));

  const totalDeals = byStage.reduce((sum, s) => sum + s.deal_count, 0);
  const totalValue = byStage.reduce(
    (sum, s) => sum + (s.total_deal_value ?? 0),
    0,
  );

  const { converted, total } = conversionResult.rows[0] ?? { converted: 0, total: 0 };
  const conversionRate = total > 0 ? converted / total : 0;

  return { byStage, conversionRate, totalDeals, totalValue };
}

/**
 * SALES-11: Forecast 30/60/90-day revenue from weighted pipeline + historical monthly revenue.
 */
export async function forecastRevenue(userId: string): Promise<RevenueForcast> {
  const pool = getPool();

  const pipeline = await analyzePipeline(userId);

  // Weighted pipeline: sum of (deal_value * stage_weight) for all open deals
  let weightedPipeline = 0;
  for (const stage of pipeline.byStage) {
    const weight = STAGE_WEIGHTS[stage.status] ?? 0;
    const stageValue = stage.total_deal_value ?? 0;
    weightedPipeline += stageValue * weight;
  }

  // Historical average monthly revenue (last 3 months of closed deals)
  const histResult = await pool.query<{ avg_monthly: string | null }>(
    `SELECT AVG(monthly_revenue) AS avg_monthly FROM (
       SELECT date_trunc('month', updated_at) AS month, SUM(deal_value) AS monthly_revenue
       FROM public.leads
       WHERE user_id = $1
         AND status IN ('converted', 'closed_won')
         AND updated_at >= NOW() - INTERVAL '3 months'
       GROUP BY 1
     ) sub`,
    [userId],
  );

  const avgMonthly = histResult.rows[0]?.avg_monthly != null
    ? parseFloat(histResult.rows[0].avg_monthly)
    : 0;

  const projected30d = weightedPipeline * 0.33 + avgMonthly;
  const projected60d = weightedPipeline * 0.55 + avgMonthly * 2;
  const projected90d = weightedPipeline * 0.80 + avgMonthly * 3;

  return {
    projected30d,
    projected60d,
    projected90d,
    weightedPipeline,
    historicalConversionRate: pipeline.conversionRate,
  };
}
