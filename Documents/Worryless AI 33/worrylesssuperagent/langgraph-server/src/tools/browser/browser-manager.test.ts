import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock playwright before importing browser-manager
vi.mock("playwright", () => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue("https://www.instagram.com/accounts/activity/"),
    close: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({}),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: {
      launchPersistentContext: vi.fn().mockResolvedValue(mockContext),
    },
  };
});

describe("browser-manager", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getOrCreateContext returns a BrowserContext", async () => {
    const { getOrCreateContext } = await import("./browser-manager.js");
    const ctx = await getOrCreateContext("test-user-1");
    expect(ctx).toBeDefined();
    expect(ctx.newPage).toBeDefined();
  });

  it("checkSessionValid returns SessionStatus with valid=true when no login redirect", async () => {
    const { checkSessionValid } = await import("./browser-manager.js");
    const status = await checkSessionValid("test-user-2", "instagram");
    expect(status).toMatchObject({
      platform: "instagram",
      valid: true,
    });
    expect(status.lastChecked).toBeDefined();
  });

  it("checkSessionValid returns valid=false when URL contains login indicator", async () => {
    const playwright = await import("playwright");
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://www.instagram.com/accounts/login/?next=/accounts/activity/"),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockCtx = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(playwright.chromium.launchPersistentContext).mockResolvedValueOnce(mockCtx as any);

    const { checkSessionValid } = await import("./browser-manager.js");
    const status = await checkSessionValid("test-user-login-check", "instagram");
    expect(status.valid).toBe(false);
  });

  it("closeContext removes the context from the map", async () => {
    const { getOrCreateContext, closeContext } = await import("./browser-manager.js");
    await getOrCreateContext("test-user-close");
    await closeContext("test-user-close");
    // Should not throw — closing a non-existent context is a no-op
    await closeContext("test-user-close");
  });

  it("getPage returns a Page from the shared context", async () => {
    const { getPage } = await import("./browser-manager.js");
    const page = await getPage("test-user-page");
    expect(page).toBeDefined();
    expect(page.goto).toBeDefined();
  });
});
