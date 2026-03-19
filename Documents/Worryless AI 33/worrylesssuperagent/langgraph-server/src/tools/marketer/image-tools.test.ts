import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google/genai — use a class so `new GoogleGenAI(...)` works
vi.mock("@google/genai", () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                data: "base64-mock-image-data",
                mimeType: "image/png",
              },
            }],
          },
        }],
      }),
    };
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

// Mock DB
vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("SELECT")) {
        return Promise.resolve({
          rows: [{ content: "base64-original", title: "Original image", metadata: { mimeType: "image/png" } }],
        });
      }
      return Promise.resolve({ rows: [{ id: "asset-456" }] });
    }),
  }),
}));

describe("image-tools", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.clearAllMocks();
  });

  it("generateBrandImage returns BrandImageResult with base64 data", async () => {
    const { generateBrandImage } = await import("./image-tools.js");
    const result = await generateBrandImage("user-1", "A professional banner for tech startup");
    expect(result.assetId).toBe("asset-456");
    expect(result.base64Data).toBe("base64-mock-image-data");
    expect(result.mimeType).toBe("image/png");
    expect(result.title).toContain("Brand image:");
    expect(result.aspectRatio).toBe("1:1");
  });

  it("generateBrandImage accepts custom aspect ratio", async () => {
    const { generateBrandImage } = await import("./image-tools.js");
    const result = await generateBrandImage("user-1", "Wide banner", "16:9");
    expect(result.aspectRatio).toBe("16:9");
  });

  it("editImage fetches base image from DB and returns edited result", async () => {
    const { editImage } = await import("./image-tools.js");
    const result = await editImage("user-1", "asset-123", "Add company logo in top right");
    expect(result.assetId).toBe("asset-456");
    expect(result.base64Data).toBe("base64-mock-image-data");
    expect(result.title).toContain("Edited:");
  });
});
