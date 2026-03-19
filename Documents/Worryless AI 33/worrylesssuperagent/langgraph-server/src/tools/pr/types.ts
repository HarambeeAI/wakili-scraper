// PR & Communications tool type contracts (OPS-04)

export interface PRClassification {
  isDraftPressRelease: boolean;
  isMonitorMedia: boolean;
  isTrackCoverage: boolean;
  isAnalyzeSentiment: boolean;
}

export interface PressCoverageRow {
  id: string;
  user_id: string;
  publication: string;
  journalist: string | null;
  title: string;
  url: string | null;
  coverage_date: string | null;
  reach: number | null;
  sentiment: "positive" | "neutral" | "negative";
  follow_up_status: string;
  created_at: string;
}

export interface MediaMention {
  source: string;
  url: string;
  snippet: string;
  sentiment: "positive" | "neutral" | "negative";
  foundAt: string;
}

export interface SentimentAnalysis {
  overallSentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  sources: string[];
}
