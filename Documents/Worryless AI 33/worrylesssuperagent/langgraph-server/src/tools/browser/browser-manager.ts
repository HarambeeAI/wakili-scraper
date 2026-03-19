import { chromium, type BrowserContext } from "playwright";
import path from "path";
import type { SocialPlatform, SessionStatus } from "../marketer/types.js";

// Module-level singleton: one BrowserContext per userId
// Uses Promise-based guard to prevent concurrent launch races (Pitfall 2)
const contextMap = new Map<string, Promise<BrowserContext>>();

const BROWSER_DATA_ROOT = process.env.BROWSER_DATA_DIR || "/data/browser";

/**
 * Returns (or creates) a Playwright persistent browser context for the given user.
 * The userDataDir at `${BROWSER_DATA_ROOT}/${userId}` stores all cookies,
 * localStorage, IndexedDB — sessions survive process restarts if volume is mounted.
 *
 * BROWSER-01: Persistent browser context per user
 * BROWSER-03: Session persistence via userDataDir (automatic with launchPersistentContext)
 */
export async function getOrCreateContext(userId: string): Promise<BrowserContext> {
  const existing = contextMap.get(userId);
  if (existing) {
    try {
      return await existing;
    } catch {
      // Previous launch failed — clean up and retry
      contextMap.delete(userId);
    }
  }

  const contextPromise = (async () => {
    const userDataDir = path.join(BROWSER_DATA_ROOT, userId);
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    context.on("close", () => contextMap.delete(userId));
    return context;
  })();

  contextMap.set(userId, contextPromise);
  return contextPromise;
}

/**
 * Checks whether a social platform session is still valid for this user.
 * Navigates to a platform-specific URL and checks for login redirects.
 *
 * BROWSER-04: Session expiry detection
 */
export async function checkSessionValid(
  userId: string,
  platform: SocialPlatform,
): Promise<SessionStatus> {
  const context = await getOrCreateContext(userId);
  const page = await context.newPage();
  try {
    const checkUrls: Record<SocialPlatform, string> = {
      instagram: "https://www.instagram.com/accounts/activity/",
      linkedin: "https://www.linkedin.com/feed/",
      x: "https://x.com/home",
      tiktok: "https://www.tiktok.com/foryou",
    };

    await page.goto(checkUrls[platform], {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const url = page.url();
    const loginIndicators = ["login", "signin", "accounts/login", "challenge", "auth"];
    const isLoggedIn = !loginIndicators.some((indicator) => url.toLowerCase().includes(indicator));

    return {
      platform,
      valid: isLoggedIn,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[browser-manager] Session check failed for ${platform}:`, err);
    return {
      platform,
      valid: false,
      lastChecked: new Date().toISOString(),
    };
  } finally {
    await page.close();
  }
}

/**
 * Closes and removes a user's browser context.
 * Used for cleanup or when the user logs out.
 */
export async function closeContext(userId: string): Promise<void> {
  const existing = contextMap.get(userId);
  if (existing) {
    try {
      const ctx = await existing;
      await ctx.close();
    } catch {
      // Already closed or failed — just remove from map
    }
    contextMap.delete(userId);
  }
}

/**
 * BROWSER-05: Returns a new page from the shared browser context.
 * Every Playwright tool call should use this, then close the page in a finally block.
 */
export async function getPage(userId: string) {
  const context = await getOrCreateContext(userId);
  return context.newPage();
}
