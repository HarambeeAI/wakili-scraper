// analysis-tools.ts — Statistical analysis, anomaly detection, chart generation (OPS-06)
// Reuses z-score pattern from accountant/anomaly-tools.ts for consistency.

import { getPool } from "../shared/db.js";
import { QUERY_TEMPLATES } from "./query-tools.js";
import type { AnomalyResult, ChartData } from "./types.js";

// OPS-06: Run statistical analysis on any supported query type
export async function statisticalAnalysis(
  userId: string,
  queryType: string,
): Promise<{
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
  message: string;
  error?: string;
}> {
  const sql = QUERY_TEMPLATES[queryType];
  if (!sql) {
    const availableTypes = Object.keys(QUERY_TEMPLATES).join(", ");
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      count: 0,
      error: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
      message: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
    };
  }

  const db = getPool();
  const { rows } = await db.query<Record<string, unknown>>(sql, [userId]);

  if (rows.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      count: 0,
      message: `No data found for "${queryType}".`,
    };
  }

  // Extract the first purely-numeric column value from each row
  // Uses strict Number() check to avoid parsing date strings like "2026-01" as 2026
  function isPureNumericStat(v: unknown): boolean {
    const s = String(v).trim();
    return s !== "" && !isNaN(Number(s)) && isFinite(Number(s));
  }

  const numericValues: number[] = rows.flatMap((row) => {
    const values = Object.values(row);
    for (const v of values) {
      if (isPureNumericStat(v)) return [Number(v)];
    }
    return [];
  });

  if (numericValues.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      count: rows.length,
      message: `No numeric values found in "${queryType}" results.`,
    };
  }

  const sorted = [...numericValues].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / count;
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
  const variance =
    sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  const min = sorted[0];
  const max = sorted[count - 1];

  return {
    mean,
    median,
    stdDev,
    min,
    max,
    count,
    message: `Statistical analysis for "${queryType}": mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, stdDev=${stdDev.toFixed(2)} across ${count} data point(s).`,
  };
}

// OPS-06: Detect anomalies using z-score analysis (same pattern as accountant anomaly-tools.ts)
export async function anomalyDetection(
  userId: string,
  queryType: string,
): Promise<{ anomalies: AnomalyResult[]; message: string; error?: string }> {
  const sql = QUERY_TEMPLATES[queryType];
  if (!sql) {
    const availableTypes = Object.keys(QUERY_TEMPLATES).join(", ");
    return {
      anomalies: [],
      error: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
      message: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
    };
  }

  const db = getPool();
  const { rows } = await db.query<Record<string, unknown>>(sql, [userId]);

  if (rows.length < 2) {
    return {
      anomalies: [],
      message: `No anomalies detected in ${queryType}. Insufficient data points (need at least 2).`,
    };
  }

  // Extract label + numeric value from each row
  // Only treat a value as numeric if the full string representation is a valid finite number
  function isPureNumeric(v: unknown): boolean {
    const s = String(v).trim();
    return s !== "" && !isNaN(Number(s)) && isFinite(Number(s));
  }

  type RowEntry = { label: string; value: number };
  const entries: RowEntry[] = [];
  for (const row of rows) {
    const rowEntries = Object.entries(row);
    let label = "";
    let numericValue: number | null = null;

    for (const [, v] of rowEntries) {
      if (numericValue === null && isPureNumeric(v)) {
        numericValue = Number(v);
      } else if (label === "" && !isPureNumeric(v)) {
        label = String(v);
      }
    }

    if (numericValue !== null) {
      entries.push({
        label: label || `row_${entries.length}`,
        value: numericValue,
      });
    }
  }

  if (entries.length < 2) {
    return {
      anomalies: [],
      message: `No anomalies detected in ${queryType}.`,
    };
  }

  // Z-score calculation (same as anomaly-tools.ts in accountant)
  const values = entries.map((e) => e.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return {
      anomalies: [],
      message: `No anomalies detected in ${queryType}. All values are identical.`,
    };
  }

  const anomalies: AnomalyResult[] = [];
  const twoSigmaLow = mean - 2 * stdDev;
  const twoSigmaHigh = mean + 2 * stdDev;

  for (const entry of entries) {
    const zScore = Math.abs(entry.value - mean) / stdDev;
    if (zScore > 2.0) {
      const description = `${entry.label}: value ${entry.value.toFixed(2)} deviates significantly from mean ${mean.toFixed(2)}`;
      anomalies.push({
        description: `Anomaly detected: ${description} (z-score: ${zScore.toFixed(2)})`,
        zScore,
        value: entry.value,
        expectedRange: { low: twoSigmaLow, high: twoSigmaHigh },
        dataset: queryType,
      });
    }
  }

  anomalies.sort((a, b) => b.zScore - a.zScore);

  if (anomalies.length === 0) {
    return {
      anomalies: [],
      message: `No anomalies detected in ${queryType}.`,
    };
  }

  return {
    anomalies,
    message: `${anomalies.length} anomaly/anomalies detected in ${queryType} using z-score analysis.`,
  };
}

// OPS-06: Generate Recharts-compatible chart data from a query result
export async function generateChart(
  userId: string,
  queryType: string,
  chartType: "bar" | "line" | "pie" | "area",
): Promise<ChartData & { message: string; error?: string }> {
  const sql = QUERY_TEMPLATES[queryType];
  if (!sql) {
    const availableTypes = Object.keys(QUERY_TEMPLATES).join(", ");
    return {
      chartType,
      data: [],
      xKey: "",
      yKey: "",
      title: queryType,
      error: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
      message: `Unknown query type: "${queryType}". Available: ${availableTypes}`,
    };
  }

  const db = getPool();
  const { rows } = await db.query<Record<string, unknown>>(sql, [userId]);

  if (rows.length === 0) {
    return {
      chartType,
      data: [],
      xKey: "",
      yKey: "",
      title: queryType,
      message: `No data found for "${queryType}".`,
    };
  }

  // Auto-detect xKey (first non-numeric column) and yKey (first numeric column)
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  let xKey = keys[0];
  let yKey = keys[1] ?? keys[0];

  for (const key of keys) {
    const val = firstRow[key];
    const n = parseFloat(String(val));
    if (!isNaN(n) && yKey === keys[1]) {
      yKey = key;
    } else if (isNaN(n) && xKey === keys[0]) {
      xKey = key;
    }
  }

  // Format data as Recharts-compatible: string/number values only
  const chartData = rows.map((row) => {
    const entry: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(row)) {
      const n = parseFloat(String(v));
      entry[k] = isNaN(n) ? String(v) : n;
    }
    return entry;
  });

  const title = queryType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    chartType,
    data: chartData,
    xKey,
    yKey,
    title,
    message: `Chart data prepared: ${chartType} with ${chartData.length} data point(s).`,
  };
}
