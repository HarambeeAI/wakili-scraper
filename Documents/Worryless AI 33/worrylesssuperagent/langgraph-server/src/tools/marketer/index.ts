// Marketer tools — barrel export

// Content tools (MKT-01, MKT-08)
export { generateSocialPost, createContentCalendar } from "./content-tools.js";

// Image tools (MKT-02, MKT-03)
export { generateBrandImage, editImage } from "./image-tools.js";

// Schedule + content library tools (MKT-04, MKT-12)
export { schedulePost, manageContentLibrary } from "./schedule-tools.js";

// Publish tools (MKT-05)
export { publishPost } from "./publish-tools.js";

// Analytics tools (MKT-06, MKT-07)
export { fetchPostAnalytics, analyzePostPerformance } from "./analytics-tools.js";

// Research tools (MKT-09, MKT-10, MKT-11)
export { monitorBrandMentions, analyzeCompetitor, searchTrendingTopics } from "./research-tools.js";

// Type re-exports
export type {
  MarketerClassification,
  SocialPlatform,
  SocialPost,
  BrandImageResult,
  ImageEditResult,
  PostAnalytics,
  PerformanceAnalysis,
  ContentCalendarEntry,
  CompetitorProfile,
  TrendingTopic,
  BrandMention,
  ContentAsset,
  SessionStatus,
  LoginGuidance,
} from "./types.js";
