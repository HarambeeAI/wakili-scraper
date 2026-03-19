// Marketer tool type contracts — used by all tool files in this directory.

// ── Request Classification ────────────────────────────────────────
export interface MarketerClassification {
  isGeneratePost: boolean;
  isGenerateImage: boolean;
  isEditImage: boolean;
  isSchedulePost: boolean;
  isPublishPost: boolean;
  isFetchAnalytics: boolean;
  isAnalyzePerformance: boolean;
  isContentCalendar: boolean;
  isBrandMentions: boolean;
  isCompetitorAnalysis: boolean;
  isTrendingTopics: boolean;
  isContentLibrary: boolean;
}

// ── Platform Types ────────────────────────────────────────────────
export type SocialPlatform = "instagram" | "linkedin" | "x" | "tiktok";

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

// ── Tool Input/Output Types ───────────────────────────────────────
export interface SocialPost {
  id: string;
  userId: string;
  platform: string;
  content: string;
  imageUrl: string | null;
  scheduledAt: string | null;
  status: PostStatus;
  likes: number;
  comments: number;
  reach: number;
  createdAt: string;
}

export interface BrandImageResult {
  assetId: string;
  base64Data: string;
  mimeType: string;
  title: string;
  aspectRatio: string;
}

export interface ImageEditResult {
  assetId: string;
  base64Data: string;
  mimeType: string;
  title: string;
}

export interface PostAnalytics {
  postId: string;
  platform: string;
  likes: number;
  comments: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  scrapedAt: string;
}

export interface PerformanceAnalysis {
  topPosts: Array<{ postId: string; platform: string; engagementRate: number; whyWorked: string }>;
  bottomPosts: Array<{ postId: string; platform: string; engagementRate: number; whyFailed: string }>;
  overallInsights: string;
  recommendations: string[];
}

export interface ContentCalendarEntry {
  postId: string;
  platform: string;
  content: string;
  scheduledAt: string;
  contentPillar: string;
}

export interface CompetitorProfile {
  name: string;
  platform: string;
  followerCount: string;
  postFrequency: string;
  topContentThemes: string[];
  engagementPattern: string;
  strengths: string[];
  weaknesses: string[];
}

export interface TrendingTopic {
  topic: string;
  platform: string;
  volume: string;
  relevanceScore: number;
  suggestedAngle: string;
}

export interface BrandMention {
  source: string;
  url: string;
  snippet: string;
  sentiment: "positive" | "neutral" | "negative";
  foundAt: string;
}

export interface ContentAsset {
  id: string;
  assetType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── DB Row Types ──────────────────────────────────────────────────
export interface SocialPostRow {
  id: string;
  user_id: string;
  platform: string;
  content: string;
  image_url: string | null;
  scheduled_at: string | null;
  status: string;
  likes: number;
  comments: number;
  reach: number;
  created_at: string;
}

export interface AgentAssetRow {
  id: string;
  user_id: string;
  agent_type: string;
  asset_type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Browser Types ─────────────────────────────────────────────────
export interface SessionStatus {
  platform: SocialPlatform;
  valid: boolean;
  lastChecked: string;
}

export interface LoginGuidance {
  platform: SocialPlatform;
  loginUrl: string;
  instructions: string;
  needsLogin: boolean;
}
