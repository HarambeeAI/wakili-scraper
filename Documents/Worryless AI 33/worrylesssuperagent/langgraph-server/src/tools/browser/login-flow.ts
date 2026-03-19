import { checkSessionValid } from "./browser-manager.js";
import type { SocialPlatform, LoginGuidance } from "../marketer/types.js";

const PLATFORM_LOGIN_URLS: Record<SocialPlatform, string> = {
  instagram: "https://www.instagram.com/accounts/login/",
  linkedin: "https://www.linkedin.com/login",
  x: "https://x.com/i/flow/login",
  tiktok: "https://www.tiktok.com/login",
};

const PLATFORM_INSTRUCTIONS: Record<SocialPlatform, string> = {
  instagram:
    "Open the Instagram login page, enter your credentials, and complete any 2FA prompts. Once logged in, your session will be saved automatically for future use.",
  linkedin:
    "Open the LinkedIn login page and sign in with your credentials. Your session will persist for the Marketer to post and analyze on your behalf.",
  x:
    "Open the X (Twitter) login page and sign in. Complete any verification steps. Your session will be saved for posting and analytics.",
  tiktok:
    "Open the TikTok login page and sign in with your preferred method. Your session will be saved for content publishing.",
};

/**
 * BROWSER-02: Detects whether a first-run login is needed for a platform.
 * Returns guidance with login URL and instructions if session is not valid.
 */
export async function detectLoginRequired(
  userId: string,
  platform: SocialPlatform,
): Promise<LoginGuidance> {
  const session = await checkSessionValid(userId, platform);

  return {
    platform,
    loginUrl: PLATFORM_LOGIN_URLS[platform],
    instructions: PLATFORM_INSTRUCTIONS[platform],
    needsLogin: !session.valid,
  };
}

/**
 * Returns login guidance for all platforms at once.
 * Used by the BrowserSessionPanel to show all session statuses.
 */
export async function getAllPlatformStatus(
  userId: string,
): Promise<LoginGuidance[]> {
  const platforms: SocialPlatform[] = ["instagram", "linkedin", "x", "tiktok"];
  const results = await Promise.allSettled(
    platforms.map((p) => detectLoginRequired(userId, p)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          platform: platforms[i],
          loginUrl: PLATFORM_LOGIN_URLS[platforms[i]],
          instructions: PLATFORM_INSTRUCTIONS[platforms[i]],
          needsLogin: true, // Assume login needed if check failed
        },
  );
}

/**
 * Returns static login guidance without checking session.
 * Useful when you already know the session status from checkSessionValid.
 */
export function getLoginGuidance(platform: SocialPlatform): {
  loginUrl: string;
  instructions: string;
} {
  return {
    loginUrl: PLATFORM_LOGIN_URLS[platform],
    instructions: PLATFORM_INSTRUCTIONS[platform],
  };
}
