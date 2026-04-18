export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "facebook"
  | "x"
  | "youtube";

export type ContentFormat = "image_post" | "carousel" | "reel" | "video" | "story" | "text_post";

export type PostStatus = "planned" | "generating" | "ready" | "approved" | "published" | "failed";

export type MediaType = "image" | "video";

export type MediaStatus = "pending" | "generating" | "completed" | "failed";

export interface WizardOption {
  value: string;
  label: string;
  recommended?: boolean;
  description?: string;
}

export interface WizardQuestion {
  id: string;
  question: string;
  type: "multi_select" | "single_select" | "text" | "frequency_grid";
  options?: WizardOption[];
  platforms?: SocialPlatform[];
  frequencyOptions?: WizardOption[];
  required?: boolean;
}

export interface WizardAnswers {
  platforms: SocialPlatform[];
  frequency: Record<SocialPlatform, string>;
  contentGoals?: string;
  additionalContext?: string;
}

export interface CalendarPost {
  id: string;
  organizationId: string;
  platform: SocialPlatform;
  contentFormat: ContentFormat;
  scheduledDate: string;
  scheduledTime: string;
  caption: string;
  hashtags: string[];
  contentPillar: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  mediaStatus: MediaStatus;
  mediaPrompt: string | null;
  status: PostStatus;
  weekNumber: number;
  dayOfWeek: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCalendar {
  id: string;
  organizationId: string;
  platforms: SocialPlatform[];
  frequency: Record<SocialPlatform, string>;
  totalWeeks: number;
  contentPillars: string[];
  status: "draft" | "approved" | "active";
  createdAt: string;
}

export interface QuestionCardData {
  questions: WizardQuestion[];
  wizardId: string;
}

export interface CalendarPreviewData {
  calendarId: string;
  posts: CalendarPost[];
  platforms: SocialPlatform[];
  weekCount: number;
}

export interface ContentPreviewData {
  postId: string;
  mediaUrl: string;
  mediaType: MediaType;
  caption: string;
  platform: SocialPlatform;
}
