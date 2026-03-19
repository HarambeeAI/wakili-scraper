import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const { mockLLM, mockPage, mockFetch } = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({
      title: "Competitor Corp - Instagram",
      description: "Leading provider of X",
      bodyText:
        "10K followers. Posts daily. Content about tech and innovation.",
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockLLM = vi.fn().mockResolvedValue({
    data: { mentions: [] },
    tokensUsed: 0,
  });

  const mockFetch = vi.fn();

  return { mockLLM, mockPage, mockFetch };
});

// Install fetch mock
global.fetch = mockFetch;

vi.mock("../../llm/client.js", () => ({
  callLLMWithStructuredOutput: mockLLM,
}));

vi.mock("../browser/browser-manager.js", () => ({
  getPage: vi.fn().mockResolvedValue(mockPage),
}));

// Import functions under test
import {
  monitorBrandMentions,
  searchTrendingTopics,
  analyzeCompetitor,
} from "./research-tools.js";

describe("research-tools", () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    mockFetch.mockReset();
    mockLLM.mockClear();
    mockPage.goto.mockClear();
    mockPage.evaluate.mockClear();
    mockPage.close.mockClear();
  });

  it("monitorBrandMentions returns mentions with sentiment", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              url: "https://techcrunch.com/article",
              title: "TechCrunch",
              description: "Great product launch",
            },
          ],
        }),
    });

    mockLLM.mockResolvedValueOnce({
      data: {
        mentions: [
          {
            source: "TechCrunch",
            url: "https://techcrunch.com/article",
            snippet: "Great product launch",
            sentiment: "positive",
          },
        ],
      },
      tokensUsed: 100,
    });

    const mentions = await monitorBrandMentions("user-1", "Worryless AI");

    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions[0].sentiment).toBe("positive");
    expect(mentions[0].foundAt).toBeDefined();
  });

  it("monitorBrandMentions returns empty array when FIRECRAWL_API_KEY missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;

    const mentions = await monitorBrandMentions("user-1", "Test Corp");
    expect(mentions).toEqual([]);
  });

  it("monitorBrandMentions builds domain-aware query when domain provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const mentions = await monitorBrandMentions(
      "user-1",
      "TestCo",
      "testco.com",
    );
    expect(mentions).toEqual([]);

    // Verify the search query includes domain exclusion
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.query).toContain("testco.com");
  });

  it("searchTrendingTopics returns trending topics with relevance scores", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              title: "AI Trends 2026",
              description: "Top AI automation trends",
              url: "https://example.com",
            },
          ],
        }),
    });

    mockLLM.mockResolvedValueOnce({
      data: {
        topics: [
          {
            topic: "AI Automation",
            platform: "linkedin",
            volume: "High",
            relevanceScore: 8.5,
            suggestedAngle: "Case study",
          },
        ],
      },
      tokensUsed: 100,
    });

    const topics = await searchTrendingTopics("user-1", "technology");

    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].relevanceScore).toBe(8.5);
    expect(topics[0].platform).toBe("linkedin");
  });

  it("searchTrendingTopics returns empty when FIRECRAWL_API_KEY missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;

    const topics = await searchTrendingTopics("user-1", "tech");
    expect(topics).toEqual([]);
  });

  it("analyzeCompetitor returns structured CompetitorProfile", async () => {
    mockLLM.mockResolvedValueOnce({
      data: {
        name: "Competitor Corp",
        platform: "instagram",
        followerCount: "10K",
        postFrequency: "Daily",
        topContentThemes: ["tech", "innovation"],
        engagementPattern: "High engagement on carousel posts",
        strengths: ["Consistent posting"],
        weaknesses: ["Limited video content"],
      },
      tokensUsed: 120,
    });

    const profile = await analyzeCompetitor(
      "user-1",
      "https://instagram.com/competitor",
      "instagram",
    );

    expect(profile.name).toBe("Competitor Corp");
    expect(profile.topContentThemes).toEqual(["tech", "innovation"]);
    expect(profile.strengths.length).toBeGreaterThan(0);
  });

  it("analyzeCompetitor closes page in finally block", async () => {
    mockLLM.mockResolvedValueOnce({
      data: {
        name: "Test",
        platform: "instagram",
        followerCount: "1K",
        postFrequency: "Weekly",
        topContentThemes: [],
        engagementPattern: "Low",
        strengths: [],
        weaknesses: [],
      },
      tokensUsed: 80,
    });

    await analyzeCompetitor(
      "user-1",
      "https://instagram.com/test",
      "instagram",
    );

    expect(mockPage.close).toHaveBeenCalled();
  });

  it("analyzeCompetitor returns fallback profile on error", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("Timeout"));

    const profile = await analyzeCompetitor(
      "user-1",
      "https://instagram.com/blocked",
      "instagram",
    );

    expect(profile.name).toBe("Unknown");
    expect(profile.platform).toBe("instagram");
    expect(profile.engagementPattern).toContain("Could not analyze");
    // Page should still be closed even on error
    expect(mockPage.close).toHaveBeenCalled();
  });
});
