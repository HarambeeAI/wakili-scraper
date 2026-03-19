import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const { mockCallLLM, mockCallLLMStructured, mockFetch, mockPool } = vi.hoisted(
  () => {
    const mockPool = {
      query: vi.fn(),
    };

    const mockCallLLM = vi.fn().mockResolvedValue({
      content: "FOR IMMEDIATE RELEASE\n\nHeadline: Test Press Release\n\nBody content here.",
      tokensUsed: 100,
    });

    const mockCallLLMStructured = vi.fn().mockResolvedValue({
      data: { mentions: [] },
      tokensUsed: 0,
    });

    const mockFetch = vi.fn();

    return { mockCallLLM, mockCallLLMStructured, mockFetch, mockPool };
  },
);

// Install fetch mock globally
global.fetch = mockFetch;

vi.mock("../../llm/client.js", () => ({
  callLLM: mockCallLLM,
  callLLMWithStructuredOutput: mockCallLLMStructured,
}));

vi.mock("../shared/db.js", () => ({
  getPool: () => mockPool,
}));

// Import after mocks
import { draftPressRelease, monitorMedia, trackCoverage } from "./media-tools.js";
import { analyzeSentiment } from "./sentiment-tools.js";

describe("pr/media-tools", () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    mockFetch.mockReset();
    mockCallLLM.mockClear();
    mockCallLLMStructured.mockClear();
    mockPool.query.mockReset();
  });

  // ── draftPressRelease ─────────────────────────────────────────

  describe("draftPressRelease", () => {
    it("calls callLLM and returns press release content", async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: "FOR IMMEDIATE RELEASE\n\nHeadline: AI Startup Launches\n\nBody.",
        tokensUsed: 150,
      });

      const result = await draftPressRelease("user-1", "AI Startup Launch", [
        "Raised $5M seed round",
        "100 beta users",
      ]);

      expect(mockCallLLM).toHaveBeenCalledOnce();
      expect(result.pressRelease).toContain("RELEASE");
      expect(result.message).toContain("Press release drafted");
    });

    it("includes topic in LLM prompt", async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: "Press release body",
        tokensUsed: 100,
      });

      await draftPressRelease("user-1", "New Product Launch", ["Key point 1"]);

      const callArgs = mockCallLLM.mock.calls[0][0];
      const messageContent = callArgs[0].content;
      expect(messageContent).toContain("New Product Launch");
    });
  });

  // ── monitorMedia ──────────────────────────────────────────────

  describe("monitorMedia", () => {
    it("returns empty with message when FIRECRAWL_API_KEY missing", async () => {
      delete process.env.FIRECRAWL_API_KEY;

      const result = await monitorMedia("user-1", "TestCorp");

      expect(result.mentions).toEqual([]);
      expect(result.message).toContain("No media mentions found");
      expect(result.message).toContain("TestCorp");
    });

    it("calls Firecrawl and classifies sentiment for mentions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                url: "https://techcrunch.com/article",
                title: "TechCrunch",
                description: "Great product launch by TestCorp",
              },
            ],
          }),
      });

      mockCallLLMStructured.mockResolvedValueOnce({
        data: {
          mentions: [
            {
              source: "TechCrunch",
              url: "https://techcrunch.com/article",
              snippet: "Great product launch by TestCorp",
              sentiment: "positive",
            },
          ],
        },
        tokensUsed: 100,
      });

      const result = await monitorMedia("user-1", "TestCorp");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockCallLLMStructured).toHaveBeenCalledOnce();
      expect(result.mentions.length).toBe(1);
      expect(result.mentions[0].sentiment).toBe("positive");
      expect(result.mentions[0].foundAt).toBeDefined();
      expect(result.message).toContain("1 mention(s)");
      expect(result.message).toContain("1 positive");
    });

    it("returns empty with message when Firecrawl returns no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await monitorMedia("user-1", "UnknownBrand");

      expect(result.mentions).toEqual([]);
      expect(result.message).toContain("No media mentions found");
    });

    it("returns empty on Firecrawl API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await monitorMedia("user-1", "ErrorBrand");

      expect(result.mentions).toEqual([]);
      expect(result.message).toContain("No media mentions found");
    });
  });

  // ── trackCoverage ─────────────────────────────────────────────

  describe("trackCoverage", () => {
    it("inserts into press_coverage and returns coverageId", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "cov-abc-123" }],
      });

      const result = await trackCoverage(
        "user-1",
        "TechCrunch",
        "Worryless AI Secures Funding",
        "https://techcrunch.com/article",
        "Jane Doe",
        50000,
        "positive",
      );

      expect(mockPool.query).toHaveBeenCalledOnce();
      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain("press_coverage");
      expect(query).toContain("RETURNING id");

      expect(result.coverageId).toBe("cov-abc-123");
      expect(result.message).toContain("Coverage tracked");
      expect(result.message).toContain("TechCrunch");
      expect(result.message).toContain("Worryless AI Secures Funding");
    });

    it("uses neutral sentiment when not provided", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "cov-xyz-789" }],
      });

      await trackCoverage("user-1", "Forbes", "About Us");

      const params = mockPool.query.mock.calls[0][1];
      expect(params[6]).toBe("neutral"); // sentiment defaults to neutral
    });
  });
});

// ── sentiment-tools ───────────────────────────────────────────────

describe("pr/sentiment-tools", () => {
  beforeEach(() => {
    mockPool.query.mockReset();
  });

  it("calculates positive sentiment score correctly", async () => {
    // First query: sentiment counts
    mockPool.query
      .mockResolvedValueOnce({
        rows: [
          { sentiment: "positive", count: "8" },
          { sentiment: "neutral", count: "2" },
          { sentiment: "negative", count: "0" },
        ],
      })
      // Second query: source URLs
      .mockResolvedValueOnce({
        rows: [{ url: "https://techcrunch.com" }],
      });

    const result = await analyzeSentiment("user-1");

    expect(result.positiveCount).toBe(8);
    expect(result.neutralCount).toBe(2);
    expect(result.negativeCount).toBe(0);
    expect(result.overallSentiment).toBe("positive");
    expect(result.sentimentScore).toBeGreaterThan(0.2);
  });

  it("returns neutral when no coverage data", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await analyzeSentiment("user-1");

    expect(result.overallSentiment).toBe("neutral");
    expect(result.sentimentScore).toBe(0);
    expect(result.positiveCount).toBe(0);
  });

  it("calculates negative sentiment when negatives dominate", async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [
          { sentiment: "negative", count: "7" },
          { sentiment: "neutral", count: "2" },
          { sentiment: "positive", count: "1" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await analyzeSentiment("user-1");

    expect(result.overallSentiment).toBe("negative");
    expect(result.sentimentScore).toBeLessThan(-0.2);
  });
});
