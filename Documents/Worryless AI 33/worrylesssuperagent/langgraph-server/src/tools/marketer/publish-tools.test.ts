import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockQuery = vi.fn();
vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({ query: (...args: any[]) => mockQuery(...args) }),
}));

// Mock browser-manager -- mocks must be self-contained (no outer refs in factory)
const mockGoto = vi.fn().mockResolvedValue(undefined);
const mockWaitForSelector = vi.fn().mockResolvedValue(null);
const mock$ = vi.fn().mockResolvedValue(null);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCheckSessionValid = vi.fn().mockResolvedValue({ platform: "x", valid: true, lastChecked: "2026-03-19T00:00:00Z" });

vi.mock("../browser/browser-manager.js", () => ({
  checkSessionValid: (...args: any[]) => mockCheckSessionValid(...args),
  getPage: vi.fn().mockImplementation(() =>
    Promise.resolve({
      goto: (...a: any[]) => mockGoto(...a),
      waitForSelector: (...a: any[]) => mockWaitForSelector(...a),
      $: (...a: any[]) => mock$(...a),
      close: () => mockClose(),
    }),
  ),
}));

// Mock HITL
const mockInterrupt = vi.fn().mockReturnValue({ approved: true });
vi.mock("../../hitl/interrupt-handler.js", () => ({
  interruptForApproval: (...args: any[]) => mockInterrupt(...args),
}));

// Mock agent types
vi.mock("../../types/agent-types.js", () => ({
  AGENT_TYPES: { MARKETER: "marketer" },
}));

import { publishPost } from "./publish-tools.js";

describe("publish-tools", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGoto.mockReset().mockResolvedValue(undefined);
    mockWaitForSelector.mockReset().mockResolvedValue(null);
    mock$.mockReset().mockResolvedValue(null);
    mockClose.mockReset().mockResolvedValue(undefined);
    mockInterrupt.mockReset().mockReturnValue({ approved: true });
    mockCheckSessionValid.mockReset().mockResolvedValue({ platform: "x", valid: true, lastChecked: "2026-03-19T00:00:00Z" });
  });

  it("publishPost returns not found when post does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await publishPost("user-1", "nonexistent");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("publishPost returns session expired when session invalid", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "x", content: "Test tweet", image_url: null, status: "scheduled" }],
    });
    mockCheckSessionValid.mockResolvedValueOnce({ platform: "x", valid: false, lastChecked: "2026-03-19T00:00:00Z" });
    const result = await publishPost("user-1", "p-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("session has expired");
  });

  it("publishPost calls interruptForApproval before browser action", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "x", content: "Test tweet", image_url: null, status: "scheduled" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE status
    await publishPost("user-1", "p-1");
    expect(mockInterrupt).toHaveBeenCalledWith(
      expect.objectContaining({ action: "publish_post" }),
    );
  });

  it("publishPost returns cancellation when user denies approval", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "x", content: "Test", image_url: null, status: "scheduled" }],
    });
    mockInterrupt.mockReturnValueOnce({ approved: false });
    const result = await publishPost("user-1", "p-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("cancelled");
  });

  it("publishPost closes page in finally block", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "instagram", content: "Pic", image_url: null, status: "scheduled" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
    await publishPost("user-1", "p-1");
    expect(mockClose).toHaveBeenCalled();
  });

  it("publishPost updates status to published on success", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p-1", platform: "x", content: "Tweet", image_url: null, status: "scheduled" }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
    const result = await publishPost("user-1", "p-1");
    expect(result.success).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE public.social_posts SET status = 'published'"),
      ["p-1"],
    );
  });
});
