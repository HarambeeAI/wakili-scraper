// MKT-06: Fetch post analytics + MKT-07: Analyze post performance with WHY reasoning
// BROWSER-05: Uses shared browser context for scraping

import { getPool } from "../shared/db.js";
import { getPage } from "../browser/browser-manager.js";
import { HumanMessage } from "@langchain/core/messages";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import type {
  PostAnalytics,
  PerformanceAnalysis,
  SocialPostRow,
} from "./types.js";

/**
 * MKT-06: Fetches post analytics. If postId specified, scrapes live data
 * via Playwright. Otherwise returns stored metrics from DB.
 * BROWSER-05: Uses shared browser context for scraping.
 */
export async function fetchPostAnalytics(
  userId: string,
  postId?: string,
): Promise<PostAnalytics[]> {
  const db = getPool();

  if (!postId) {
    // Return stored metrics for all published posts
    const result = await db.query<SocialPostRow>(
      `SELECT id, platform, likes, comments, reach, created_at
       FROM public.social_posts
       WHERE user_id = $1 AND status = 'published'
       ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );

    return result.rows.map((row) => ({
      postId: row.id,
      platform: row.platform,
      likes: row.likes || 0,
      comments: row.comments || 0,
      reach: row.reach || 0,
      impressions: 0,
      engagementRate:
        row.reach > 0 ? ((row.likes + row.comments) / row.reach) * 100 : 0,
      scrapedAt: new Date().toISOString(),
    }));
  }

  // Scrape specific post analytics via Playwright
  const postResult = await db.query<SocialPostRow>(
    `SELECT id, platform, content FROM public.social_posts WHERE id = $1 AND user_id = $2`,
    [postId, userId],
  );

  if (postResult.rows.length === 0) {
    return [];
  }

  const post = postResult.rows[0];
  const page = await getPage(userId);

  try {
    // Navigate to platform analytics page
    // Note: Platform-specific selectors -- may need updating as UIs change
    // String expression avoids TS DOM lib requirement -- runs in Playwright browser context
    const metrics = (await page.evaluate(`(() => {
      var getText = function(sel) {
        var el = document.querySelector(sel);
        return el ? el.textContent.trim() : "0";
      };
      return {
        likes: parseInt(getText('[aria-label*="like"]') || "0", 10) || 0,
        comments: parseInt(getText('[aria-label*="comment"]') || "0", 10) || 0,
        reach: 0
      };
    })()`)) as { likes: number; comments: number; reach: number };

    // Update DB with scraped metrics
    await db.query(
      `UPDATE public.social_posts SET likes = $1, comments = $2, reach = $3
       WHERE id = $4`,
      [metrics.likes, metrics.comments, metrics.reach, postId],
    );

    const engagementRate =
      metrics.reach > 0
        ? ((metrics.likes + metrics.comments) / metrics.reach) * 100
        : 0;

    return [
      {
        postId,
        platform: post.platform,
        likes: metrics.likes,
        comments: metrics.comments,
        reach: metrics.reach,
        impressions: 0,
        engagementRate,
        scrapedAt: new Date().toISOString(),
      },
    ];
  } catch (err) {
    console.error(`[analytics-tools] Scrape failed for post ${postId}:`, err);
    return [];
  } finally {
    await page.close();
  }
}

const PERFORMANCE_SCHEMA = `{
  "topPosts": [{ "postId": "string", "platform": "string", "engagementRate": number, "whyWorked": "string" }],
  "bottomPosts": [{ "postId": "string", "platform": "string", "engagementRate": number, "whyFailed": "string" }],
  "overallInsights": "string",
  "recommendations": ["string"]
}`;

/**
 * MKT-07: Analyzes post performance with WHY reasoning.
 * Compares metrics against averages and uses LLM to explain top/bottom performers.
 */
export async function analyzePostPerformance(
  userId: string,
): Promise<PerformanceAnalysis> {
  const db = getPool();
  const result = await db.query<SocialPostRow & { id: string }>(
    `SELECT id, platform, content, likes, comments, reach, created_at
     FROM public.social_posts
     WHERE user_id = $1 AND status = 'published'
     ORDER BY created_at DESC LIMIT 30`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      topPosts: [],
      bottomPosts: [],
      overallInsights: "No published posts found to analyze.",
      recommendations: [
        "Create and publish your first posts to start getting analytics.",
      ],
    };
  }

  // Calculate engagement rates
  const postsWithEngagement = result.rows.map((row) => ({
    postId: row.id,
    platform: row.platform,
    content: row.content.slice(0, 200),
    likes: row.likes || 0,
    comments: row.comments || 0,
    reach: row.reach || 0,
    engagementRate:
      row.reach > 0
        ? (((row.likes || 0) + (row.comments || 0)) / row.reach) * 100
        : 0,
    createdAt: row.created_at,
  }));

  const systemPrompt = `You are a social media analytics expert. Analyze these post performance metrics.
Identify the top 3 and bottom 3 performers. For each, explain WHY it performed well or poorly.
Consider: content topic, post timing, platform fit, hashtag usage, call-to-action effectiveness.
Provide overall insights and 3-5 actionable recommendations for improvement.`;

  const { data } = await callLLMWithStructuredOutput<PerformanceAnalysis>(
    [
      new HumanMessage(
        `Analyze these posts:\n${JSON.stringify(postsWithEngagement, null, 2)}`,
      ),
    ],
    PERFORMANCE_SCHEMA,
    { systemPrompt, temperature: 0.5, maxTokens: 2048 },
  );

  return data;
}
