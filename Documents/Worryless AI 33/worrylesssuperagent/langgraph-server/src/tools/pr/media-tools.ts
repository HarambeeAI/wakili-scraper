// PR & Communications tools (OPS-04)
// Tools: draftPressRelease, monitorMedia, trackCoverage

import { HumanMessage } from "@langchain/core/messages";
import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { getPool } from "../shared/db.js";
import type { MediaMention } from "./types.js";

// ── Schema descriptions ─────────────────────────────────────────

const MEDIA_MENTION_SCHEMA = JSON.stringify({
  mentions: [
    {
      source: "string",
      url: "string",
      snippet: "string",
      sentiment: "positive | neutral | negative",
    },
  ],
});

// ── Firecrawl helper (same pattern as marketer/research-tools.ts) ─

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
    console.error(`[pr/media-tools] Firecrawl search failed: ${response.status}`);
    return [];
  }

  const data = (await response.json()) as {
    data?: Array<{ url: string; title: string; description: string }>;
  };
  return data.data ?? [];
}

// ── Tool 1: Draft Press Release ─────────────────────────────────

/**
 * OPS-04: Draft a professional press release.
 * Uses LLM with standard press release structure.
 */
export async function draftPressRelease(
  userId: string,
  topic: string,
  keyPoints: string[],
): Promise<{ pressRelease: string; message: string }> {
  const { content } = await callLLM(
    [
      new HumanMessage(
        `Write a press release about: "${topic}"\n\nKey points to include:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
      ),
    ],
    {
      systemPrompt:
        "Draft a professional press release. Include headline, dateline, body (inverted pyramid), quotes placeholder, and boilerplate.",
      temperature: 0.6,
      maxTokens: 1024,
    },
  );

  // Extract title from first line for message
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? topic;
  const title = firstLine.replace(/^#+\s*/, "").replace(/\*+/g, "").trim();

  return {
    pressRelease: content,
    message: `Press release drafted: "${title}"`,
  };
}

// ── Tool 2: Monitor Media ────────────────────────────────────────

/**
 * OPS-04: Monitor media mentions of the business using Firecrawl.
 * Classifies sentiment of each mention with LLM.
 */
export async function monitorMedia(
  userId: string,
  businessName: string,
): Promise<{ mentions: MediaMention[]; message: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[pr/media-tools] FIRECRAWL_API_KEY not set");
    return {
      mentions: [],
      message: `No media mentions found for "${businessName}".`,
    };
  }

  const query = `"${businessName}" mentions reviews news`;

  try {
    const results = await firecrawlSearch(query, apiKey, 10);

    if (results.length === 0) {
      return {
        mentions: [],
        message: `No media mentions found for "${businessName}".`,
      };
    }

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
          `Classify the sentiment of each media mention for "${businessName}":\n${JSON.stringify(mentionData)}`,
        ),
      ],
      MEDIA_MENTION_SCHEMA,
      {
        systemPrompt:
          "You are a sentiment analyst. For each mention, classify as positive, neutral, or negative based on the snippet content.",
        temperature: 0.3,
        maxTokens: 1024,
      },
    );

    const mentions: MediaMention[] = analyzed.mentions.map((m) => ({
      ...m,
      foundAt: new Date().toISOString(),
    }));

    const positiveCount = mentions.filter((m) => m.sentiment === "positive").length;
    const neutralCount = mentions.filter((m) => m.sentiment === "neutral").length;
    const negativeCount = mentions.filter((m) => m.sentiment === "negative").length;
    const sourceCount = new Set(mentions.map((m) => m.source)).size;

    return {
      mentions,
      message: `Found ${mentions.length} mention(s) across ${sourceCount} source(s). Sentiment: ${positiveCount} positive, ${neutralCount} neutral, ${negativeCount} negative.`,
    };
  } catch (err) {
    console.error("[pr/media-tools] monitorMedia failed:", err);
    return {
      mentions: [],
      message: `No media mentions found for "${businessName}".`,
    };
  }
}

// ── Tool 3: Track Coverage ───────────────────────────────────────

/**
 * OPS-04: Record press coverage in the database.
 * Inserts into public.press_coverage and returns the new ID.
 */
export async function trackCoverage(
  userId: string,
  publication: string,
  title: string,
  url?: string,
  journalist?: string,
  reach?: number,
  sentiment?: string,
): Promise<{ coverageId: string; message: string }> {
  const pool = getPool();

  const effectiveSentiment = sentiment ?? "neutral";

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.press_coverage
       (user_id, publication, title, url, journalist, reach, sentiment, follow_up_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id`,
    [userId, publication, title, url ?? null, journalist ?? null, reach ?? null, effectiveSentiment],
  );

  const coverageId = rows[0].id;

  return {
    coverageId,
    message: `Coverage tracked: "${title}" in ${publication}`,
  };
}
