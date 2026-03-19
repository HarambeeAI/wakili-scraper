// MKT-09, MKT-10, MKT-11: Research and monitoring tools for Marketer agent.
// Brand mention monitoring (Firecrawl), competitor analysis (Playwright), trending topic discovery (Firecrawl).

import { HumanMessage } from "@langchain/core/messages";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { getPage } from "../browser/browser-manager.js";
import type {
  BrandMention,
  CompetitorProfile,
  TrendingTopic,
  SocialPlatform,
} from "./types.js";

// ── Schema descriptions for structured LLM output ───────────────

const MENTION_SCHEMA = JSON.stringify({
  mentions: [
    {
      source: "string",
      url: "string",
      snippet: "string",
      sentiment: "positive | neutral | negative",
    },
  ],
});

const TOPIC_SCHEMA = JSON.stringify({
  topics: [
    {
      topic: "string",
      platform: "string",
      volume: "string (e.g. High, Medium, Low)",
      relevanceScore: "number 0-10",
      suggestedAngle: "string",
    },
  ],
});

const COMPETITOR_SCHEMA = JSON.stringify({
  name: "string",
  platform: "string",
  followerCount: "string",
  postFrequency: "string",
  topContentThemes: ["string"],
  engagementPattern: "string",
  strengths: ["string"],
  weaknesses: ["string"],
});

// ── Firecrawl helper ─────────────────────────────────────────────

async function firecrawlSearch(
  query: string,
  apiKey: string,
  limit = 10,
): Promise<Array<{ url: string; title: string; description: string }>> {
  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    console.error(
      `[research-tools] Firecrawl search failed: ${response.status}`,
    );
    return [];
  }

  const data = (await response.json()) as {
    data?: Array<{ url: string; title: string; description: string }>;
  };
  return data.data ?? [];
}

// ── Tool 1: Monitor Brand Mentions (MKT-09) ─────────────────────

/**
 * MKT-09: Monitor brand mentions across the web.
 * Uses Firecrawl search API (same pattern as Sales Rep's researchProspect).
 */
export async function monitorBrandMentions(
  userId: string,
  businessName: string,
  domain?: string,
): Promise<BrandMention[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[research-tools] FIRECRAWL_API_KEY not set");
    return [];
  }

  const query = domain
    ? `"${businessName}" OR site:${domain} -inurl:${domain}`
    : `"${businessName}" mentions reviews`;

  try {
    const results = await firecrawlSearch(query, apiKey, 10);
    if (results.length === 0) return [];

    const mentionData = results.map((r) => ({
      source: r.title || r.url,
      url: r.url,
      snippet: r.description || "",
    }));

    const { data: analyzed } = await callLLMWithStructuredOutput<{
      mentions: Array<{
        source: string;
        url: string;
        snippet: string;
        sentiment: "positive" | "neutral" | "negative";
      }>;
    }>(
      [
        new HumanMessage(
          `Classify the sentiment of each brand mention for "${businessName}":\n${JSON.stringify(mentionData)}`,
        ),
      ],
      MENTION_SCHEMA,
      {
        systemPrompt:
          "You are a sentiment analyst. For each mention, classify as positive, neutral, or negative based on the snippet content.",
        temperature: 0.3,
        maxTokens: 1024,
      },
    );

    return analyzed.mentions.map((m) => ({
      ...m,
      foundAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[research-tools] monitorBrandMentions failed:", err);
    return [];
  }
}

// ── Tool 2: Search Trending Topics (MKT-11) ─────────────────────

/**
 * MKT-11: Search for trending topics in the user's industry.
 * Uses Firecrawl to find trending content, then LLM to score relevance and suggest angles.
 */
export async function searchTrendingTopics(
  userId: string,
  industry: string,
  platforms: SocialPlatform[] = ["instagram", "linkedin"],
): Promise<TrendingTopic[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[research-tools] FIRECRAWL_API_KEY not set");
    return [];
  }

  try {
    const query = `trending topics ${industry} social media ${new Date().getFullYear()}`;
    const results = await firecrawlSearch(query, apiKey, 10);
    if (results.length === 0) return [];

    const { data: result } = await callLLMWithStructuredOutput<{
      topics: TrendingTopic[];
    }>(
      [
        new HumanMessage(
          `Based on these search results, identify 5-8 trending topics relevant to the ${industry} industry for social media (${platforms.join(", ")}):\n${JSON.stringify(results.map((d) => ({ title: d.title, snippet: d.description })))}`,
        ),
      ],
      TOPIC_SCHEMA,
      {
        systemPrompt: `You are a social media trend analyst. Identify trending topics and rate their relevance (0-10) for the ${industry} industry. For each topic, suggest a specific content angle the business could use. Set platform to the best-fit platform from: ${platforms.join(", ")}.`,
        temperature: 0.5,
        maxTokens: 1024,
      },
    );

    return result.topics;
  } catch (err) {
    console.error("[research-tools] searchTrendingTopics failed:", err);
    return [];
  }
}

// ── Tool 3: Analyze Competitor (MKT-10) ──────────────────────────

/**
 * MKT-10: Analyze a competitor's social media profile via Playwright browser.
 * BROWSER-05: Uses shared browser context for competitor scraping.
 */
export async function analyzeCompetitor(
  userId: string,
  competitorUrl: string,
  platform: SocialPlatform,
): Promise<CompetitorProfile> {
  const page = await getPage(userId);

  try {
    await page.goto(competitorUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Extract visible profile data from the page
    // String expression avoids TS DOM lib requirement — runs in Playwright browser context
    const pageContent = (await page.evaluate(`(() => {
      const getMeta = (name) =>
        document.querySelector('meta[name="' + name + '"]')?.getAttribute('content') || '';
      return {
        title: document.title,
        description: getMeta('description'),
        bodyText: document.body.innerText.slice(0, 3000),
      };
    })()`)) as { title: string; description: string; bodyText: string };

    // Use LLM to structure the competitor analysis
    const { data: profile } =
      await callLLMWithStructuredOutput<CompetitorProfile>(
        [
          new HumanMessage(
            `Analyze this competitor's social media profile on ${platform}.\n\nPage title: ${pageContent.title}\nDescription: ${pageContent.description}\nVisible content:\n${pageContent.bodyText}`,
          ),
        ],
        COMPETITOR_SCHEMA,
        {
          systemPrompt:
            "You are a competitive intelligence analyst. Extract and structure the competitor's social media profile information. If specific metrics aren't visible, provide reasonable estimates based on context clues. Note their content themes, posting frequency, engagement patterns, and strategic strengths/weaknesses.",
          temperature: 0.4,
          maxTokens: 1024,
        },
      );

    return profile;
  } catch (err) {
    console.error(
      `[research-tools] analyzeCompetitor failed for ${competitorUrl}:`,
      err,
    );
    return {
      name: "Unknown",
      platform,
      followerCount: "Unknown",
      postFrequency: "Unknown",
      topContentThemes: [],
      engagementPattern:
        "Could not analyze — page may require login or is blocking automated access.",
      strengths: [],
      weaknesses: [],
    };
  } finally {
    await page.close();
  }
}
