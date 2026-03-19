// Data Analyst tool type contracts (OPS-06)

export interface DAClassification {
  isCrossFunctionalQuery: boolean;
  isStatisticalAnalysis: boolean;
  isAnomalyDetection: boolean;
  isGenerateChart: boolean;
  isKPIAggregation: boolean;
}

export interface QueryResult {
  queryType: string;
  data: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface ChartData {
  chartType: "bar" | "line" | "pie" | "area";
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  title: string;
}

export interface AnomalyResult {
  description: string;
  zScore: number;
  value: number;
  expectedRange: { low: number; high: number };
  dataset: string;
}

export interface KPISummary {
  metrics: Array<{ name: string; value: number; unit: string; trend: "up" | "down" | "flat"; changePercent: number }>;
  dataSources: string[];
}
