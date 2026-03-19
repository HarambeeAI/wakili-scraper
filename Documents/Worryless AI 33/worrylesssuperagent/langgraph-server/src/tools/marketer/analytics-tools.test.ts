import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockQuery = vi.fn();
vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({ query: (...args: any[]) => mockQuery(...args) }),
}));

// Mock browser-manager -- mocks self-contained (no outer object refs in factory)
const mockEvaluate = vi.fn().mockResolvedValue({ likes: 42, comments: 5, reach: 1000 });
const mockPageClose = vi.fn().mockResolvedValue(undefined);

vi.mock("../browser/browser-manager.js", () => ({
  getPage: vi.fn().mockImplementation(() =>
    Promise.resolve({
      evaluate: (...a: any[]) => mockEvaluate(...a),
      close: () => mockPageClose(),
    }),
  ),
}));

// Mock LLM client
vi.mock("../../llm/client.js", () => ({
  callLLMWithStructuredOutput: vi.fn().mockResolvedValue({
    data: {
      topPosts: [{ postId: "p-1", platform: "instagram", engagementRate: 8.5, whyWorked: "Strong hook" }],
      bottomPosts: [{ postId: "p-2", platform: "x", engagementRate: 0.5, whyFailed: "No CTA" }],
      overallInsights: "Instagram outperforms X for your audience.",
      recommendations: ["Post more on Instagram", "Add CTAs to X posts"],
    },
    tokensUsed: 500,
  }),
}));

import { fetchPostAnalytics, analyzePostPerformance } from "./analytics-tools.js";

describe("analytics-tools", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockEvaluate.mockReset().mockResolvedValue({ likes: 42, comments: 5, reach: 1000 });
    mockPageClose.mockReset().mockResolvedValue(undefined);
  });

  it("fetchPostAnalytics returns stored metrics when no postId given", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "p-1", platform: "instagram", likes: 100, comments: 10, reach: 2000, created_at: "2026-03-19" },
      ],
    });
    const analytics = await fetchPostAnalytics("user-1");
    expect(analytics).toHaveLength(1);
    expect(analytics[0].postId).toBe("p-1");
    expect(analytics[0].likes).toBe(100);
    expect(analytics[0].engagementRate).toBeCloseTo(5.5, 1);
  });

  it("fetchPostAnalytics returns empty when post not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const analytics = await fetchPostAnalytics("user-1", "nonexistent");
    expect(analytics).toHaveLength(0);
  });

  it("fetchPostAnalytics scrapes and updates DB when postId given", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "instagram", content: "Test" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const analytics = await fetchPostAnalytics("user-1", "p-1");
    expect(analytics).toHaveLength(1);
    expect(analytics[0].likes).toBe(42);
    expect(mockPageClose).toHaveBeenCalled();
  });

  it("analyzePostPerformance returns empty analysis when no posts", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const analysis = await analyzePostPerformance("user-1");
    expect(analysis.topPosts).toHaveLength(0);
    expect(analysis.overallInsights).toContain("No published posts");
  });

  it("analyzePostPerformance calls LLM with post data when posts exist", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "p-1", platform: "instagram", content: "Test post", likes: 50, comments: 5, reach: 1000, created_at: "2026-03-19" },
      ],
    });
    const analysis = await analyzePostPerformance("user-1");
    expect(analysis.topPosts).toHaveLength(1);
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });
});
