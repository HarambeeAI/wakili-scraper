// PR & Communications sentiment tool (OPS-04)
// Tool: analyzeSentiment

import { getPool } from "../shared/db.js";
import type { SentimentAnalysis } from "./types.js";

// ── Tool 4: Analyze Sentiment ────────────────────────────────────

/**
 * OPS-04: Analyze overall media sentiment from tracked press coverage.
 * Aggregates sentiment counts and calculates a score from -1 to +1.
 */
export async function analyzeSentiment(
  userId: string,
): Promise<SentimentAnalysis> {
  const pool = getPool();

  const { rows } = await pool.query<{ sentiment: string; count: string }>(
    `SELECT sentiment, COUNT(*) AS count
       FROM public.press_coverage
      WHERE user_id = $1
      GROUP BY sentiment`,
    [userId],
  );

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  for (const row of rows) {
    const n = parseInt(row.count, 10);
    if (row.sentiment === "positive") positiveCount = n;
    else if (row.sentiment === "neutral") neutralCount = n;
    else if (row.sentiment === "negative") negativeCount = n;
  }

  const total = positiveCount + neutralCount + negativeCount;

  // Score: +1 = all positive, -1 = all negative, 0 = neutral or no data
  const sentimentScore =
    total === 0 ? 0 : (positiveCount - negativeCount) / total;

  let overallSentiment: "positive" | "neutral" | "negative" = "neutral";
  if (sentimentScore > 0.2) overallSentiment = "positive";
  else if (sentimentScore < -0.2) overallSentiment = "negative";

  // Fetch source URLs for the sources field
  const { rows: sourceRows } = await pool.query<{ url: string }>(
    `SELECT DISTINCT url FROM public.press_coverage
      WHERE user_id = $1 AND url IS NOT NULL
      LIMIT 20`,
    [userId],
  );
  const sources = sourceRows.map((r) => r.url);

  const roundedScore = Math.round(sentimentScore * 100) / 100;

  const result: SentimentAnalysis = {
    overallSentiment,
    sentimentScore: roundedScore,
    positiveCount,
    neutralCount,
    negativeCount,
    sources,
  };

  // message is included for agent output display (UI-SPEC)
  (result as SentimentAnalysis & { message: string }).message =
    `Overall sentiment: ${overallSentiment} (${roundedScore})`;

  return result;
}
