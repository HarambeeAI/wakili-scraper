import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  selectedServices: jsonb("selected_services").$type<string[]>(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const brandFiles = pgTable("brand_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  type: text("type", {
    enum: [
      "business_profile",
      "brand_guidelines",
      "market_research",
      "marketing_strategy",
    ],
  }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  role: text("role", { enum: ["agent", "user", "system"] }).notNull(),
  content: text("content").notNull(),
  type: text("type", {
    enum: [
      "text",
      "file_card",
      "status",
      "question_card",
      "calendar_preview",
      "content_preview",
    ],
  }).notNull(),
  fileId: uuid("file_id").references(() => brandFiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  tasks: jsonb("tasks").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const contentCalendars = pgTable("content_calendars", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  platforms: jsonb("platforms").$type<string[]>().notNull(),
  frequency: jsonb("frequency").$type<Record<string, string>>().notNull(),
  totalWeeks: text("total_weeks").notNull().default("4"),
  contentPillars: jsonb("content_pillars").$type<string[]>().notNull(),
  status: text("status", {
    enum: ["draft", "approved", "active"],
  })
    .notNull()
    .default("draft"),
  wizardAnswers: jsonb("wizard_answers").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const calendarPosts = pgTable("calendar_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarId: uuid("calendar_id")
    .references(() => contentCalendars.id)
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  platform: text("platform", {
    enum: ["instagram", "tiktok", "linkedin", "facebook", "x", "youtube"],
  }).notNull(),
  contentFormat: text("content_format", {
    enum: ["image_post", "carousel", "reel", "video", "story", "text_post"],
  }).notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  caption: text("caption").notNull(),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  contentPillar: text("content_pillar").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type", { enum: ["image", "video"] }),
  mediaStatus: text("media_status", {
    enum: ["pending", "generating", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  mediaPrompt: text("media_prompt"),
  status: text("status", {
    enum: ["planned", "generating", "ready", "approved", "published", "failed"],
  })
    .notNull()
    .default("planned"),
  weekNumber: text("week_number").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
