// MKT-01 + MKT-08: Content generation tools for Marketer agent
// generateSocialPost — platform-specific social post content
// createContentCalendar — structured content calendar with DB persistence

import { HumanMessage } from "@langchain/core/messages";
import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { getPool } from "../shared/db.js";
import type { SocialPlatform, ContentCalendarEntry } from "./types.js";

const PLATFORM_PROMPTS: Record<SocialPlatform, string> = {
  instagram: `You are a social media copywriter. Generate an Instagram caption.
Rules:
- Hook the reader in the first line (question, bold statement, or curiosity gap)
- Provide value, tell a story, or share an insight in the body
- End with a clear CTA (comment, save, share, link in bio)
- 150-300 words total
- After the main content, add a blank line then 5-7 relevant hashtags, each prefixed with #, one per line`,
  x: `You are a social media copywriter. Generate a tweet for X (Twitter).
Rules:
- Maximum 280 characters including hashtags
- Punchy, conversation-starting format
- Include 1-3 hashtags inline within the text
- No line breaks — single paragraph`,
  linkedin: `You are a social media copywriter. Generate a LinkedIn post.
Rules:
- Professional, story-driven narrative
- Open with a hook line followed by a line break
- Thought leadership angle — share genuine insight or experience
- 200-400 words
- End with a question to drive comments
- After the main content, add a blank line then 3-5 hashtags, one per line`,
  tiktok: `You are a social media copywriter. Generate a TikTok caption.
Rules:
- Casual, trend-aligned tone
- Hook in the very first sentence
- 50-150 words
- End with 3-5 trending/relevant hashtags inline`,
};

/**
 * MKT-01: Generates a platform-specific social media post using callLLM.
 * Extracts hashtags from the generated content automatically.
 */
export async function generateSocialPost(
  userId: string,
  platform: SocialPlatform,
  topic: string,
  tone?: string,
): Promise<{ content: string; hashtags: string[]; platform: string }> {
  const systemPrompt = PLATFORM_PROMPTS[platform] +
    (tone ? `\n\nTone: ${tone}` : "") +
    `\n\nThe business context and audience will be provided in the user message.`;

  const result = await callLLM(
    [new HumanMessage(`Create a ${platform} post about: ${topic}`)],
    { systemPrompt, temperature: 0.8, maxTokens: 1024 },
  );

  // Extract hashtags from content
  const hashtagRegex = /#[\w]+/g;
  const hashtags = result.content.match(hashtagRegex) || [];

  return { content: result.content, hashtags, platform };
}

/**
 * MKT-08: Creates a content calendar for the specified duration and persists
 * each entry to public.social_posts as draft status.
 *
 * Uses callLLMWithStructuredOutput with a JSON schema description string
 * (not Zod — matches the actual LLM client API).
 */
export async function createContentCalendar(
  userId: string,
  durationDays: number = 7,
  pillars: string[] = ["educational", "promotional", "behind-the-scenes"],
  platforms: SocialPlatform[] = ["instagram", "linkedin"],
): Promise<ContentCalendarEntry[]> {
  const startDate = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a content strategist. Create a ${durationDays}-day content calendar.
Rules:
- Distribute posts evenly across platforms: ${platforms.join(", ")}
- Cover content pillars: ${pillars.join(", ")}
- Space posts 1-2 days apart per platform (no same-day doubles on one platform)
- Each entry needs: platform, content (brief 1-sentence description), scheduledDate (ISO format starting from ${startDate}), contentPillar, postType
- Aim for ${Math.ceil(durationDays / 2)} total posts`;

  const schemaDescription = `{
  "entries": [
    {
      "platform": "string (one of: ${platforms.join(", ")})",
      "content": "string (1-sentence post description)",
      "scheduledDate": "string (ISO date, e.g. 2026-03-20)",
      "contentPillar": "string (one of: ${pillars.join(", ")})",
      "postType": "string (e.g. educational, promotional, engagement)"
    }
  ]
}`;

  const { data } = await callLLMWithStructuredOutput<{
    entries: Array<{
      platform: string;
      content: string;
      scheduledDate: string;
      contentPillar: string;
      postType: string;
    }>;
  }>(
    [new HumanMessage(`Create a ${durationDays}-day content calendar for platforms: ${platforms.join(", ")}. Content pillars: ${pillars.join(", ")}.`)],
    schemaDescription,
    { systemPrompt, temperature: 0.7, maxTokens: 2048 },
  );

  const db = getPool();
  const entries: ContentCalendarEntry[] = [];

  for (const entry of data.entries) {
    const scheduledAt = new Date(entry.scheduledDate + "T10:00:00Z").toISOString();
    const res = await db.query<{ id: string }>(
      `INSERT INTO public.social_posts (user_id, platform, content, scheduled_at, status)
       VALUES ($1, $2, $3, $4, 'draft')
       RETURNING id`,
      [userId, entry.platform, entry.content, scheduledAt],
    );
    entries.push({
      postId: res.rows[0].id,
      platform: entry.platform,
      content: entry.content,
      scheduledAt,
      contentPillar: entry.contentPillar,
    });
  }

  return entries;
}
