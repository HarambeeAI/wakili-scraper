import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LLM client — matches actual signature: callLLMWithStructuredOutput returns { data, tokensUsed }
vi.mock("../../llm/client.js", () => ({
  callLLM: vi.fn().mockResolvedValue({
    content: "Great post about AI!\n\n#AI #Tech #Innovation",
    tokensUsed: 100,
  }),
  callLLMWithStructuredOutput: vi.fn().mockResolvedValue({
    data: {
      entries: [
        { platform: "instagram", content: "AI tips post", scheduledDate: "2026-03-20", contentPillar: "educational", postType: "educational" },
        { platform: "linkedin", content: "Thought leadership", scheduledDate: "2026-03-21", contentPillar: "promotional", postType: "promotional" },
      ],
    },
    tokensUsed: 200,
  }),
}));

// Mock DB
vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows: [{ id: "post-123" }] }),
  }),
}));

describe("content-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateSocialPost returns content with hashtags for each platform", async () => {
    const { generateSocialPost } = await import("./content-tools.js");
    const result = await generateSocialPost("user-1", "instagram", "AI in business");
    expect(result.content).toBeTruthy();
    expect(result.platform).toBe("instagram");
    expect(result.hashtags).toContain("#AI");
    expect(result.hashtags.length).toBeGreaterThan(0);
  });

  it("generateSocialPost accepts optional tone parameter", async () => {
    const { generateSocialPost } = await import("./content-tools.js");
    const result = await generateSocialPost("user-1", "x", "Startup advice", "witty");
    expect(result.content).toBeTruthy();
    expect(result.platform).toBe("x");
  });

  it("createContentCalendar returns array of ContentCalendarEntry with DB-assigned IDs", async () => {
    const { createContentCalendar } = await import("./content-tools.js");
    const entries = await createContentCalendar("user-1", 7, ["educational"], ["instagram", "linkedin"]);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].postId).toBe("post-123");
    expect(entries[0].platform).toBeTruthy();
    expect(entries[0].scheduledAt).toBeTruthy();
    expect(entries[0].contentPillar).toBeTruthy();
  });
});
