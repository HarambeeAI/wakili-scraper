import type { CalendarAgentStateType } from "../calendar-state";
import { db } from "@/lib/db";
import { calendarPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateImage, getAspectRatio } from "@/lib/kie/image";
import { generateVideo, getVideoAspectRatio } from "@/lib/kie/video";
import {
  buildImageGenerationPrompt,
  buildVideoGenerationPrompt,
} from "../prompts/content-prompts";

function extractBrandColors(guidelines: string): string[] {
  const hexMatches = guidelines.match(/#[0-9A-Fa-f]{6}/g) || [];
  return [...new Set(hexMatches)].slice(0, 5);
}

function extractBrandPersonality(guidelines: string): string {
  const personalityMatch = guidelines.match(/personality[:\s]*([^\n]+)/i);
  return personalityMatch?.[1]?.trim() || "professional and approachable";
}

function extractBusinessType(profile: string): string {
  const categoryMatch = profile.match(/category[:\s]*([^\n]+)/i);
  return categoryMatch?.[1]?.trim() || "business";
}

function extractBusinessName(profile: string): string {
  const nameMatch = profile.match(/^#\s*(.+)/m);
  return nameMatch?.[1]?.trim() || "the company";
}

export async function generateContentBatch(
  state: CalendarAgentStateType,
): Promise<Partial<CalendarAgentStateType>> {
  if (!state.calendarApproved || !state.calendarPosts.length) return {};

  const week1Posts = state.calendarPosts.filter((p) => p.weekNumber === 1);
  if (week1Posts.length === 0) return {};

  const brandColors = extractBrandColors(state.brandGuidelines);
  const brandPersonality = extractBrandPersonality(state.brandGuidelines);
  const businessType = extractBusinessType(state.businessProfile);
  const businessName = extractBusinessName(state.businessProfile);

  state.emitEvent("message", {
    role: "agent",
    content: `Now I'm creating the visuals for your first week's content -- ${week1Posts.length} posts coming up! This may take a few minutes as I generate custom images and videos for each post.`,
  });

  let generated = 0;

  for (const post of week1Posts) {
    try {
      await db
        .update(calendarPosts)
        .set({ mediaStatus: "generating", status: "generating" })
        .where(eq(calendarPosts.id, post.id));

      const isVideo = ["reel", "video", "story"].includes(post.contentFormat);
      let mediaUrl: string;

      if (isVideo) {
        const prompt = buildVideoGenerationPrompt({
          caption: post.caption,
          platform: post.platform,
          contentPillar: post.contentPillar,
          brandPersonality,
          businessName,
          businessType,
          mediaDescription: post.mediaPrompt || post.caption,
        });

        mediaUrl = await generateVideo({
          prompt,
          aspectRatio: getVideoAspectRatio(post.platform),
          duration: 5,
        });
      } else {
        const prompt = buildImageGenerationPrompt({
          caption: post.caption,
          platform: post.platform,
          contentPillar: post.contentPillar,
          contentFormat: post.contentFormat,
          brandColors,
          brandFonts: [],
          brandPersonality,
          businessName,
          businessType,
          mediaDescription: post.mediaPrompt || post.caption,
        });

        mediaUrl = await generateImage({
          prompt,
          aspectRatio: getAspectRatio(post.platform, post.contentFormat),
        });
      }

      await db
        .update(calendarPosts)
        .set({
          mediaUrl,
          mediaType: isVideo ? "video" : "image",
          mediaStatus: "completed",
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(calendarPosts.id, post.id));

      generated++;

      state.emitEvent("content_preview", {
        postId: post.id,
        mediaUrl,
        mediaType: isVideo ? "video" : "image",
        caption: post.caption.slice(0, 100) + (post.caption.length > 100 ? "..." : ""),
        platform: post.platform,
      });

      state.emitEvent("status", {
        task: "generate_content",
        message: `Generated ${generated}/${week1Posts.length} posts`,
      });
    } catch (err) {
      console.error(`Failed to generate content for post ${post.id}:`, err);
      await db
        .update(calendarPosts)
        .set({ mediaStatus: "failed", status: "failed", updatedAt: new Date() })
        .where(eq(calendarPosts.id, post.id));
    }
  }

  state.emitEvent("message", {
    role: "agent",
    content: `Done! I've generated ${generated} pieces of content for your first week. You can review each one in the calendar and make any adjustments. The remaining 3 weeks of content can be generated when you're ready.\n\nHead to the **Calendar** tab to see your full plan and manage your posts.`,
  });

  return { generatedContentCount: generated };
}
