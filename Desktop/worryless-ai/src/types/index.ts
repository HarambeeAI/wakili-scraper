export type Service =
  | "social_media"
  | "seo"
  | "content_writing"
  | "email_marketing"
  | "paid_ads";

export interface OnboardingData {
  websiteUrl: string;
  selectedServices: Service[];
  connectedPlatforms: string[];
}

export type BrandFileType =
  | "business_profile"
  | "brand_guidelines"
  | "market_research"
  | "marketing_strategy";

export interface BrandFile {
  id: string;
  type: BrandFileType;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatMessageData {
  id: string;
  role: "agent" | "user" | "system";
  content: string;
  type:
    | "text"
    | "file_card"
    | "status"
    | "question_card"
    | "calendar_preview"
    | "content_preview";
  fileId?: string;
  file?: BrandFile;
  questionData?: import("./calendar").QuestionCardData;
  calendarPreviewData?: import("./calendar").CalendarPreviewData;
  contentPreviewData?: import("./calendar").ContentPreviewData;
  createdAt: string;
}

export type SSEEvent =
  | { event: "status"; data: { task: string; message: string } }
  | { event: "message"; data: { role: string; content: string } }
  | {
      event: "file_card";
      data: {
        fileId: string;
        type: BrandFileType;
        title: string;
        content: string;
      };
    }
  | { event: "complete"; data: { status: string; filesGenerated: number } }
  | { event: "error"; data: { message: string } }
  | { event: "question_card"; data: { questions: unknown[]; wizardId: string } }
  | {
      event: "calendar_preview";
      data: {
        calendarId: string;
        posts: unknown[];
        platforms: string[];
        weekCount: number;
      };
    }
  | {
      event: "content_preview";
      data: {
        postId: string;
        mediaUrl: string;
        mediaType: string;
        caption: string;
        platform: string;
      };
    }
  | { event: "start_calendar_wizard"; data: { organizationId: string } };
