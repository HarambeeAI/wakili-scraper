import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockQuery = vi.fn();
vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({ query: (...args: any[]) => mockQuery(...args) }),
}));

import { schedulePost, manageContentLibrary } from "./schedule-tools.js";

describe("schedule-tools", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("schedulePost inserts into social_posts with scheduled status and returns ID", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "post-789" }] });
    const id = await schedulePost("user-1", "instagram", "Hello world", "2026-03-25T10:00:00Z");
    expect(id).toBe("post-789");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO public.social_posts"),
      expect.arrayContaining(["user-1", "instagram", "Hello world"]),
    );
  });

  it("schedulePost passes imageUrl when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "post-790" }] });
    await schedulePost("user-1", "linkedin", "Content", "2026-03-25T10:00:00Z", "https://img.example.com/pic.png");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["https://img.example.com/pic.png"]),
    );
  });

  it("schedulePost passes null imageUrl when not provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "post-791" }] });
    await schedulePost("user-1", "x", "Tweet", "2026-03-25T10:00:00Z");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ["user-1", "x", "Tweet", null, "2026-03-25T10:00:00Z"],
    );
  });

  it("manageContentLibrary returns assets filtered by user", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "a-1", asset_type: "image", title: "Logo", content: "base64...", metadata: {}, created_at: "2026-03-19" },
      ],
    });
    const assets = await manageContentLibrary("user-1");
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe("a-1");
    expect(assets[0].assetType).toBe("image");
  });

  it("manageContentLibrary filters by query and assetType", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await manageContentLibrary("user-1", "logo", "image");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ILIKE"),
      expect.arrayContaining(["user-1", "image", "%logo%"]),
    );
  });

  it("manageContentLibrary truncates content to 200 chars", async () => {
    const longContent = "x".repeat(500);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "a-2", asset_type: "text", title: "Long", content: longContent, metadata: {}, created_at: "2026-03-19" },
      ],
    });
    const assets = await manageContentLibrary("user-1");
    expect(assets[0].content.length).toBe(200);
  });
});
