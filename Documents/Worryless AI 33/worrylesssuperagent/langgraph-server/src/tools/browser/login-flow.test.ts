import { describe, it, expect, vi } from "vitest";

// Mock browser-manager to avoid real Playwright calls
vi.mock("./browser-manager.js", () => ({
  checkSessionValid: vi.fn().mockResolvedValue({
    platform: "instagram",
    valid: false,
    lastChecked: new Date().toISOString(),
  }),
}));

describe("login-flow", () => {
  it("detectLoginRequired returns needsLogin=true when session is invalid", async () => {
    const { detectLoginRequired } = await import("./login-flow.js");
    const result = await detectLoginRequired("user-1", "instagram");
    expect(result.needsLogin).toBe(true);
    expect(result.platform).toBe("instagram");
    expect(result.loginUrl).toContain("instagram.com");
    expect(result.instructions).toBeTruthy();
  });

  it("getLoginGuidance returns static guidance for each platform", async () => {
    const { getLoginGuidance } = await import("./login-flow.js");
    const platforms = ["instagram", "linkedin", "x", "tiktok"] as const;
    for (const platform of platforms) {
      const guidance = getLoginGuidance(platform);
      expect(guidance.loginUrl).toBeTruthy();
      expect(guidance.instructions).toBeTruthy();
    }
  });

  it("getAllPlatformStatus returns guidance for all 4 platforms", async () => {
    const { getAllPlatformStatus } = await import("./login-flow.js");
    const results = await getAllPlatformStatus("user-1");
    expect(results).toHaveLength(4);
    const platforms = results.map((r) => r.platform);
    expect(platforms).toContain("instagram");
    expect(platforms).toContain("linkedin");
    expect(platforms).toContain("x");
    expect(platforms).toContain("tiktok");
  });
});
