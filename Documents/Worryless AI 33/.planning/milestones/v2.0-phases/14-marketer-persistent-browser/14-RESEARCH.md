# Phase 14: Marketer + Persistent Browser - Research

**Researched:** 2026-03-19
**Domain:** Playwright persistent browser sessions, Gemini Flash image generation, social media content tools, LangGraph agent tools pattern
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MKT-01 | `generate_social_post` tool for platform-specific content (IG, X, LinkedIn, TikTok) | LLM-powered via callLLM with platform-specific structured prompts; same pattern as composeOutreach |
| MKT-02 | `generate_brand_image` tool using Nano Banana 2 (Gemini 2.5 Flash Image) with brand colors, product photos, logo | @google/genai 1.46.0 + gemini-2.5-flash-image model; image stored in agent_assets |
| MKT-03 | `edit_image` tool for overlays, color adjustments, compositing | Gemini multimodal edit endpoint with base image + prompt; same @google/genai SDK |
| MKT-04 | `schedule_post` tool writing to social_posts table | social_posts table already exists with status/scheduled_at columns; simple DB INSERT |
| MKT-05 | `publish_post` tool via Playwright persistent browser (requires HITL) | launchPersistentContext + per-user userDataDir + interruptForApproval before browser action |
| MKT-06 | `fetch_post_analytics` tool scraping platform dashboards via Playwright | Playwright page.goto(dashboardUrl) + evaluate() to extract metrics from logged-in view |
| MKT-07 | `analyze_post_performance` tool comparing metrics with WHY analysis | LLM synthesis over analytics data in DB; callLLMWithStructuredOutput for structured result |
| MKT-08 | `create_content_calendar` tool generating weekly/monthly plan | LLM generation + DB writes to social_posts with scheduled_at populated |
| MKT-09 | `monitor_brand_mentions` tool scanning web for business name | Firecrawl /v1/search endpoint OR Playwright search scraping |
| MKT-10 | `analyze_competitor` tool browsing competitor profiles via Playwright | Playwright page.goto + evaluate() — same pattern as Sales researchProspect |
| MKT-11 | `search_trending_topics` tool for industry trend discovery | Firecrawl search or Playwright scrape of Google Trends / Reddit / X |
| MKT-12 | `manage_content_library` tool for searching and reusing past assets | Query agent_assets table with text search by asset_type + title |
| BROWSER-01 | Playwright persistent browser context per user for Marketer | launchPersistentContext(userDataDir) where userDataDir = `/data/browser/${userId}` |
| BROWSER-02 | User login flow via embedded browser iframe/popup | First-run detection: navigate to platform, check for login redirect, surface URL to user for manual login OR guide with automation assist |
| BROWSER-03 | Session persistence via cookies/localStorage saved to disk | launchPersistentContext writes cookies/localStorage to userDataDir automatically |
| BROWSER-04 | Session expiry detection with re-login notification | Navigate to protected page; check for login redirect or auth-wall selector; notify via heartbeat mechanism |
| BROWSER-05 | Browser-based operations: publish, analytics, competitor scraping | All three use same browser context instance; launch once, reuse across tool calls within session |
</phase_requirements>

---

## Summary

Phase 14 adds the Marketer agent's full tool suite plus the Playwright persistent browser infrastructure it depends on. The phase has two distinct halves: (1) the social content tools — which are mostly LLM-based with DB writes and follow the exact same pattern established in Phase 13 (Accountant + Sales Rep), and (2) the Playwright browser manager — which is new infrastructure that must be added to the LangGraph server and handles per-user session persistence, login flows, and session expiry detection.

The Marketer agent graph follows the same topology as the Accountant and Sales Rep: `readMemory -> marketerTools -> llmNode -> writeMemory -> respond`. The `marketerTools` node dispatches based on regex classification of the user's request and injects results into `state.businessContext.marketerToolResults`. The Playwright browser manager is a module-level singleton per process that lazily initializes browser contexts per user, keyed by `userId`. Browser contexts persist across tool calls within the same server process and across restarts via the userDataDir on disk.

**Primary recommendation:** Build the Playwright browser manager as a separate module (`tools/browser/browser-manager.ts`) that exposes `getOrCreateContext(userId)` and `checkSessionValid(userId, platform)`. All Playwright-dependent tools import from this module. The Gemini image generation uses `@google/genai` 1.46.0 with the `gemini-2.5-flash-image` model (Nano Banana 2). Image bytes are stored in `agent_assets` as base64 content or saved to a file path.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `playwright` | 1.58.2 (latest) | Browser automation, persistent contexts, scraping | Project decision: "Playwright persistent browser for Marketer" locked in STATE.md |
| `@google/genai` | 1.46.0 (latest) | Gemini image generation (Nano Banana 2) | Only official Google JS SDK for Gemini; supports gemini-2.5-flash-image |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@langchain/core` | ^1.1.33 (already installed) | Message types, LangGraph integration | Already in project |
| `pg` | ^8.13.0 (already installed) | PostgreSQL queries for social_posts, agent_assets | Already in project |
| `zod` | ^3.25.32 (already installed) | Input validation for tool parameters | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `playwright` | Puppeteer | Playwright was the locked decision; no change |
| `@google/genai` | `@ai-sdk/google` (Vercel AI SDK) | Project uses direct fetch for LLM gateway; @google/genai is the canonical SDK for Gemini image generation specifically |
| Playwright for brand mentions | Firecrawl /v1/search | Firecrawl already installed/used by Sales Rep; prefer it for URL-based searches that don't need a logged-in context |

**Installation (new packages only):**
```bash
npm install playwright @google/genai
```

**Install Chromium browser binaries in Dockerfile:**
```bash
npx playwright install chromium --with-deps
```

**Version verification:**
- `playwright`: 1.58.2 (verified via `npm view playwright version` on 2026-03-19)
- `@google/genai`: 1.46.0 (verified via `npm view @google/genai version` on 2026-03-19)

## Architecture Patterns

### Recommended Project Structure
```
langgraph-server/src/
├── agents/
│   └── marketer.ts              # createMarketerGraph() — replaces stub
├── tools/
│   └── marketer/
│       ├── types.ts             # MarketerClassification + all tool type contracts
│       ├── content-tools.ts     # MKT-01: generate_social_post, MKT-08: create_content_calendar
│       ├── image-tools.ts       # MKT-02: generate_brand_image, MKT-03: edit_image
│       ├── schedule-tools.ts    # MKT-04: schedule_post, MKT-12: manage_content_library
│       ├── publish-tools.ts     # MKT-05: publish_post (HITL + Playwright)
│       ├── analytics-tools.ts   # MKT-06: fetch_post_analytics, MKT-07: analyze_post_performance
│       ├── research-tools.ts    # MKT-09: monitor_brand_mentions, MKT-10: analyze_competitor, MKT-11: search_trending_topics
│       └── index.ts             # barrel export
└── tools/
    └── browser/
        ├── browser-manager.ts   # BROWSER-01/03/04: getOrCreateContext(), checkSessionValid()
        └── login-flow.ts        # BROWSER-02: first-run login detection + guidance
```

### Pattern 1: Playwright Browser Manager (Singleton per Process)
**What:** A module-level Map stores one `BrowserContext` per userId. `getOrCreateContext()` launches a persistent context on first call and returns the existing one on subsequent calls. The userDataDir is unique per user and lives on the Railway filesystem at `/data/browser/${userId}`.
**When to use:** Every Playwright-dependent tool (publish_post, fetch_post_analytics, analyze_competitor) calls this.

```typescript
// Source: Playwright docs + project pattern
import { chromium, BrowserContext } from "playwright";
import path from "path";

const contextMap = new Map<string, BrowserContext>();

export async function getOrCreateContext(userId: string): Promise<BrowserContext> {
  if (contextMap.has(userId)) {
    return contextMap.get(userId)!;
  }

  const userDataDir = path.join("/data/browser", userId);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    viewport: { width: 1280, height: 900 },
  });

  // Clean up on close so next call re-initializes
  context.on("close", () => contextMap.delete(userId));
  contextMap.set(userId, context);
  return context;
}
```

**Critical Docker args:** `--no-sandbox`, `--disable-setuid-sandbox` are mandatory when running as root in Docker/Railway.

### Pattern 2: Session Validity Check (BROWSER-04)
**What:** Navigate to a platform-specific "requires login" URL and check whether the result contains a login redirect indicator. Used by the heartbeat and before publish operations.
**When to use:** Before any publish or analytics scrape, and as a periodic check.

```typescript
// Source: Playwright docs patterns
export async function checkSessionValid(
  userId: string,
  platform: "instagram" | "linkedin" | "x" | "tiktok",
): Promise<boolean> {
  const context = await getOrCreateContext(userId);
  const page = await context.newPage();
  try {
    const checkUrls: Record<string, string> = {
      instagram: "https://www.instagram.com/accounts/activity/",
      linkedin: "https://www.linkedin.com/feed/",
      x: "https://x.com/home",
      tiktok: "https://www.tiktok.com/foryou",
    };
    await page.goto(checkUrls[platform], { waitUntil: "domcontentloaded", timeout: 15000 });
    const url = page.url();
    // Redirected to login = session expired
    const loginIndicators = ["login", "signin", "accounts/login", "challenge"];
    return !loginIndicators.some((indicator) => url.includes(indicator));
  } finally {
    await page.close();
  }
}
```

### Pattern 3: Marketer Graph Topology (matches Accountant/Sales Rep)
**What:** Same 5-node graph topology. The `marketerTools` node runs before the LLM.
**When to use:** The standard pattern for all specialist agents in this project.

```typescript
// Source: Project pattern from accountant.ts / sales-rep.ts
const graph = new StateGraph(AgentState)
  .addNode("readMemory", createReadMemoryNode())
  .addNode("marketerTools", createMarketerToolsNode())
  .addNode("llmNode", createLLMNode(config))
  .addNode("writeMemory", createWriteMemoryNode())
  .addNode("respond", createRespondNode(), { ends: [] })
  .addEdge("__start__", "readMemory")
  .addEdge("readMemory", "marketerTools")
  .addEdge("marketerTools", "llmNode")
  .addEdge("llmNode", "writeMemory")
  .addEdge("writeMemory", "respond");
```

### Pattern 4: Gemini Image Generation (Nano Banana 2)
**What:** Use `@google/genai` SDK with `gemini-2.5-flash-image` model. Response contains base64 image data in `part.inlineData.data`. Store the image as base64 in `agent_assets.content` or write to disk.
**When to use:** MKT-02 (generate_brand_image), MKT-03 (edit_image).

```typescript
// Source: https://ai.google.dev/gemini-api/docs/image-generation
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateBrandImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "1:1", // IG square: 1:1, IG portrait: 4:5, wide: 16:9
      },
    },
  });

  for (const part of response.candidates![0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data; // base64 PNG
    }
  }
  throw new Error("No image in Gemini response");
}
```

**Image edit (MKT-03):** Same call but include the base image as a `inlineData` part alongside the text prompt in the `contents` array.

### Pattern 5: Publish Post with HITL (MKT-05)
**What:** Call `interruptForApproval` before executing the Playwright publish automation. User approves, then the tool navigates to the platform and posts.
**When to use:** Every publish operation.

```typescript
// Source: Project HITL pattern from hitl/interrupt-handler.ts
const decision = interruptForApproval({
  action: "publish_post",
  agentType: AGENT_TYPES.MARKETER,
  description: `Publish to ${platform}: "${content.slice(0, 80)}..."`,
  payload: { postId, platform, content, imageUrl },
});
if (!decision.approved) {
  // Return cancellation message
}
// Proceed with Playwright publish
```

### Pattern 6: Request Classification (matches CoS/Accountant/Sales pattern)
**What:** Regex-based deterministic classification of user message before tool dispatch.
**When to use:** `createMarketerToolsNode()` — no LLM call needed for routing.

```typescript
export interface MarketerClassification {
  isGeneratePost: boolean;
  isGenerateImage: boolean;
  isEditImage: boolean;
  isSchedulePost: boolean;
  isPublishPost: boolean;
  isFetchAnalytics: boolean;
  isAnalyzePerformance: boolean;
  isContentCalendar: boolean;
  isBrandMentions: boolean;
  isCompetitorAnalysis: boolean;
  isTrendingTopics: boolean;
  isContentLibrary: boolean;
}

export function classifyMarketerRequest(content: string): MarketerClassification {
  return {
    isGeneratePost: /\b(write|create|generate|draft).*(post|caption|tweet|content)\b/i.test(content),
    isGenerateImage: /\b(generate|create|make).*(image|graphic|visual|banner|thumbnail)\b/i.test(content),
    isEditImage: /\b(edit|modify|adjust|overlay|add.*text|composite)\b.*(image|photo|graphic)\b/i.test(content),
    isSchedulePost: /\b(schedule|plan|queue|add.*calendar).*(post|content)\b/i.test(content),
    isPublishPost: /\b(publish|post|send|submit).*(now|immediately|live|instagram|linkedin|twitter|tiktok)\b/i.test(content),
    isFetchAnalytics: /\b(analytics|metrics|engagement|reach|impressions|stats|performance)\b/i.test(content),
    isAnalyzePerformance: /\b(analyz|best.*perform|worst|top.*post|bottom.*post|why.*work|compare)\b/i.test(content),
    isContentCalendar: /\b(calendar|content.*plan|weekly.*plan|monthly.*plan|schedule.*week)\b/i.test(content),
    isBrandMentions: /\b(mention|monitor|track|brand.*mention|who.*talking)\b/i.test(content),
    isCompetitorAnalysis: /\b(competitor|rival|compare.*brand|what.*is.*posting)\b/i.test(content),
    isTrendingTopics: /\b(trend|trending|viral|popular|hashtag.*trend|what.*popular)\b/i.test(content),
    isContentLibrary: /\b(library|past.*content|reuse|archive|find.*post|search.*asset)\b/i.test(content),
  };
}
```

### Anti-Patterns to Avoid
- **One browser instance per request:** Never call `chromium.launchPersistentContext` inside a tool function. Always use the `browser-manager.ts` singleton. Launching a new browser per request is extremely slow (2-3s) and wastes Railway RAM.
- **Closing the BrowserContext after each operation:** Do NOT close the context after publish or analytics. Only close pages (`page.close()`). The context must stay alive for session persistence.
- **Running Playwright without `--no-sandbox` in Docker:** Railway runs as root; without the flag, Chromium refuses to launch.
- **Using `storageState` JSON file per user:** The `launchPersistentContext` userDataDir IS the storage. Do not also try to serialize/deserialize storageState separately — it will conflict.
- **Blocking the LangGraph hot path on Playwright operations:** Playwright page loads can take 5-30 seconds. The marketerTools node must handle timeouts gracefully (15s max per page operation) and return partial results rather than hanging.
- **Calling `gemini-2.0-flash-preview-image-generation`:** That preview model retires Oct 31, 2025. Use `gemini-2.5-flash-image` (the stable model, Nano Banana 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent browser sessions | Custom cookie serialization to DB | `playwright launchPersistentContext(userDataDir)` | Handles ALL browser storage (cookies, localStorage, IndexedDB, service workers) automatically |
| Image generation | Stable Diffusion setup, custom image APIs | `@google/genai` + `gemini-2.5-flash-image` | Project locked decision; GPU infra not needed; Gemini handles multimodal editing too |
| Social media APIs | Instagram Graph API, Twitter API v2 | Playwright browser automation | APIs require business accounts, OAuth app review, rate limits; persistent browser uses real user sessions |
| Session validity polling | cron-based DB checks | Playwright `page.goto()` then URL inspection | Actual browser navigation is the only reliable way to detect auth walls |
| Content calendar DB schema | Custom table | `social_posts` table with `scheduled_at` column | Table already exists with all needed columns |

**Key insight:** Social platform APIs are gated behind business account requirements and OAuth app approvals that users do not have. Playwright with saved sessions is the only practical approach for an agent that publishes on behalf of entrepreneurs.

## Common Pitfalls

### Pitfall 1: Playwright Sandbox in Docker
**What goes wrong:** Chromium crashes immediately on launch with `SIGSEGV` or `Exited with code 1`.
**Why it happens:** Docker containers run as root; Chromium's default sandbox requires non-root user namespaces, which are unavailable in most container environments.
**How to avoid:** Always pass `args: ["--no-sandbox", "--disable-setuid-sandbox"]` in `launchPersistentContext` options.
**Warning signs:** Error message contains "No usable sandbox" or the process exits immediately after launch attempt.

### Pitfall 2: Multiple Browser Instances Per User
**What goes wrong:** "Cannot launch multiple instances with the same User Data Directory" error.
**Why it happens:** Playwright enforces exclusive lock on the userDataDir. If two async operations trigger `getOrCreateContext` concurrently, both try to launch.
**How to avoid:** Use a module-level Map with promise-based initialization guard (store the Promise, not the context, until resolution to handle races).
**Warning signs:** Intermittent launch errors under concurrent load.

### Pitfall 3: Platform Login Redirect Loops
**What goes wrong:** `checkSessionValid` returns false constantly even after the user re-logs in.
**Why it happens:** Platforms like Instagram add intermediate "challenge" or 2FA pages that look like login pages but are different flows.
**How to avoid:** Check the URL for multiple indicators (not just "login"). Log the actual redirect URL for debugging. For Instagram specifically, check for `/challenge/` separately.
**Warning signs:** Session check fails immediately after a fresh login.

### Pitfall 4: Image Generation API Key Scope
**What goes wrong:** `@google/genai` SDK throws 403 or "API key not valid."
**Why it happens:** Gemini image generation requires the Gemini API key (not the Lovable AI Gateway key). These are separate credentials.
**How to avoid:** Add `GEMINI_API_KEY` as a separate environment variable. The existing `LOVABLE_API_KEY` routes through the Lovable gateway (OpenAI-compatible format) — image generation uses the direct Google API.
**Warning signs:** 403 errors from `generativelanguage.googleapis.com`.

### Pitfall 5: Playwright Memory Leak on Railway
**What goes wrong:** Railway instance OOM-kills the server after a few hours of Playwright use.
**Why it happens:** Each open page consumes ~50-100MB. Pages not closed after operations accumulate.
**How to avoid:** Always `await page.close()` in a `finally` block after every Playwright operation. Never leave pages open between tool calls.
**Warning signs:** Memory usage grows linearly with usage; Railway restarts the dyno.

### Pitfall 6: Social Posts Analytics — Platform Blocking
**What goes wrong:** Instagram/LinkedIn detects the Playwright session as a bot and blocks the analytics page with a CAPTCHA.
**Why it happens:** Even with real user sessions, headless Chromium has detectable fingerprints (missing plugins, specific User-Agent strings).
**How to avoid:** Add user-agent spoofing. For analytics specifically, prefer the numeric data from the DB (engagement columns on `social_posts`) updated during scrapes, over real-time scraping per request. Only scrape when explicitly requested (not on every agent invocation).
**Warning signs:** Pages return CAPTCHA challenges or empty data where numbers are expected.

### Pitfall 7: Nano Banana 2 Model Name Drift
**What goes wrong:** `gemini-2.5-flash-image-preview` stops working after Oct 2025.
**Why it happens:** Preview models retire on scheduled dates.
**How to avoid:** Use `gemini-2.5-flash-image` (stable, no "preview" suffix). Verify at https://ai.google.dev/gemini-api/docs/models before release.
**Warning signs:** API returns 404 or "model not found."

## Code Examples

### MKT-04: Schedule Post to social_posts Table
```typescript
// Source: Project pattern (social_posts table from 20251204060048 migration)
export async function schedulePost(
  userId: string,
  platform: string,
  content: string,
  scheduledAt: string,
  imageUrl?: string,
): Promise<string> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.social_posts (user_id, platform, content, image_url, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING id`,
    [userId, platform, content, imageUrl ?? null, scheduledAt],
  );
  return result.rows[0].id;
}
```

### MKT-02: Store Generated Image in agent_assets
```typescript
// Source: Project pattern from invoice-pdf.ts + accountant/invoice-pdf.ts
export async function storeGeneratedImage(
  userId: string,
  base64Data: string,
  title: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.agent_assets (user_id, agent_type, asset_type, title, content, metadata)
     VALUES ($1, 'marketer', 'image', $2, $3, $4)
     RETURNING id`,
    [userId, title, base64Data, JSON.stringify(metadata)],
  );
  return result.rows[0].id;
}
```

### MKT-06: Fetch Analytics via Playwright
```typescript
// Source: Playwright docs patterns
export async function scrapeInstagramAnalytics(
  userId: string,
  postUrl: string,
): Promise<{ likes: number; comments: number; reach: number }> {
  const context = await getOrCreateContext(userId);
  const page = await context.newPage();
  try {
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 20000 });
    // Extract metrics from page DOM
    const metrics = await page.evaluate(() => {
      // Platform-specific selectors
      const likes = document.querySelector("[aria-label*='like']")?.textContent ?? "0";
      const comments = document.querySelector("[aria-label*='comment']")?.textContent ?? "0";
      return { likes: parseInt(likes), comments: parseInt(comments), reach: 0 };
    });
    return metrics;
  } finally {
    await page.close();
  }
}
```

### Dockerfile Addition for Playwright
```dockerfile
# Add to existing Dockerfile after node install
FROM node:20-bookworm AS base
RUN npx -y playwright@1.58.2 install chromium --with-deps
# Optionally set PLAYWRIGHT_BROWSERS_PATH if non-default
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gemini-2.0-flash-preview-image-generation` | `gemini-2.5-flash-image` (stable) | Aug 2025 (Nano Banana 2 release) | Preview models retire Oct 31, 2025; must use stable name |
| `@google/generative-ai` (legacy SDK) | `@google/genai` 1.46.0 (new unified SDK) | Early 2025 | New SDK supports both Gemini Developer API and Vertex AI; different import path |
| Playwright `storageState()` JSON files | `launchPersistentContext(userDataDir)` | Architecture choice | userDataDir approach persists ALL browser storage including IndexedDB; JSON approach only covers cookies + localStorage |

**Deprecated/outdated:**
- `gemini-2.5-flash-image-preview`: Retires Oct 31, 2025. Use `gemini-2.5-flash-image`.
- `@google/generative-ai`: Deprecated in favor of `@google/genai`. Different package name and import structure.

## Open Questions

1. **Playwright headless mode and Instagram session persistence**
   - What we know: There is a known Playwright issue where some SSO sessions are not persisted in headless=true mode on certain platforms.
   - What's unclear: Whether Instagram specifically exhibits this problem with `launchPersistentContext` headless.
   - Recommendation: Default to `headless: true` for analytics/scraping tools. For the initial login flow (BROWSER-02), the architecture should guide the user to log in via a visible browser window rather than automated headless login. Once logged in via the visible window to the same userDataDir, subsequent headless operations reuse those cookies.

2. **Railway filesystem persistence for userDataDir**
   - What we know: Railway volumes persist between deploys on the same Railway service. The path `/data/browser/${userId}` works if a Railway volume is mounted at `/data`.
   - What's unclear: Whether the LangGraph server Dockerfile/railway.toml already mounts a volume.
   - Recommendation: Add a volume mount in `railway.toml` for the langgraph-server service. Fall back to `/tmp/browser/${userId}` (ephemeral) if no volume — sessions will be lost on restart but will work within a session.

3. **Gemini image generation cost per call**
   - What we know: Image generation via `gemini-2.5-flash-image` is billed per image, not per token.
   - What's unclear: Exact pricing tier under the Lovable AI Gateway vs. direct Gemini API.
   - Recommendation: Use `GEMINI_API_KEY` (direct Google API) rather than routing through the Lovable gateway, as image generation responses are not in OpenAI chat format and the gateway will not handle them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (detected: `worrylesssuperagent/vitest.config.ts`) |
| Config file | `worrylesssuperagent/vitest.config.ts` |
| Quick run command | `cd worrylesssuperagent && npx vitest run --reporter=verbose` |
| Full suite command | `cd worrylesssuperagent && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MKT-01 | `generate_social_post` returns platform-specific structured content | unit | `npx vitest run src/tools/marketer/content-tools.test.ts` | Wave 0 |
| MKT-02 | `generate_brand_image` calls Gemini API and stores result in agent_assets | unit (mocked) | `npx vitest run src/tools/marketer/image-tools.test.ts` | Wave 0 |
| MKT-03 | `edit_image` sends base image + prompt to Gemini | unit (mocked) | `npx vitest run src/tools/marketer/image-tools.test.ts` | Wave 0 |
| MKT-04 | `schedule_post` writes to social_posts with scheduled_at | unit | `npx vitest run src/tools/marketer/schedule-tools.test.ts` | Wave 0 |
| MKT-05 | `publish_post` calls interruptForApproval before Playwright action | unit (mocked) | `npx vitest run src/tools/marketer/publish-tools.test.ts` | Wave 0 |
| MKT-06 | `fetch_post_analytics` returns numeric metrics | integration (manual) | manual-only — requires live logged-in browser session | N/A |
| MKT-07 | `analyze_post_performance` returns top/bottom performers with WHY | unit | `npx vitest run src/tools/marketer/analytics-tools.test.ts` | Wave 0 |
| MKT-08 | `create_content_calendar` returns array of scheduled posts | unit | `npx vitest run src/tools/marketer/content-tools.test.ts` | Wave 0 |
| MKT-09 | `monitor_brand_mentions` returns list of mentions | unit (mocked Firecrawl) | `npx vitest run src/tools/marketer/research-tools.test.ts` | Wave 0 |
| MKT-10 | `analyze_competitor` returns structured competitor profile | integration (manual) | manual-only — requires Playwright browser | N/A |
| MKT-11 | `search_trending_topics` returns topic list | unit (mocked) | `npx vitest run src/tools/marketer/research-tools.test.ts` | Wave 0 |
| MKT-12 | `manage_content_library` returns assets matching query | unit | `npx vitest run src/tools/marketer/schedule-tools.test.ts` | Wave 0 |
| BROWSER-01 | `getOrCreateContext` returns BrowserContext for userId | unit (mocked playwright) | `npx vitest run src/tools/browser/browser-manager.test.ts` | Wave 0 |
| BROWSER-02 | Login flow detects first-run (no session in userDataDir) | unit | `npx vitest run src/tools/browser/login-flow.test.ts` | Wave 0 |
| BROWSER-03 | Session data is written to userDataDir after login | integration (manual) | manual-only — requires real platform login | N/A |
| BROWSER-04 | `checkSessionValid` returns false when redirected to login | unit (mocked playwright) | `npx vitest run src/tools/browser/browser-manager.test.ts` | Wave 0 |
| BROWSER-05 | Publish tool, analytics tool, competitor tool all use shared context | unit | `npx vitest run src/tools/marketer/publish-tools.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worrylesssuperagent && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **Per wave merge:** `cd worrylesssuperagent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `langgraph-server/src/tools/marketer/content-tools.test.ts` — covers MKT-01, MKT-08
- [ ] `langgraph-server/src/tools/marketer/image-tools.test.ts` — covers MKT-02, MKT-03
- [ ] `langgraph-server/src/tools/marketer/schedule-tools.test.ts` — covers MKT-04, MKT-12
- [ ] `langgraph-server/src/tools/marketer/publish-tools.test.ts` — covers MKT-05, BROWSER-05
- [ ] `langgraph-server/src/tools/marketer/analytics-tools.test.ts` — covers MKT-07
- [ ] `langgraph-server/src/tools/marketer/research-tools.test.ts` — covers MKT-09, MKT-11
- [ ] `langgraph-server/src/tools/browser/browser-manager.test.ts` — covers BROWSER-01, BROWSER-04
- [ ] `langgraph-server/src/tools/browser/login-flow.test.ts` — covers BROWSER-02

## Sources

### Primary (HIGH confidence)
- Playwright official docs (https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) — launchPersistentContext API, options, userDataDir behavior
- Playwright Docker docs (https://playwright.dev/docs/docker) — Dockerfile pattern, --no-sandbox requirement, base image
- Google AI Gemini image generation docs (https://ai.google.dev/gemini-api/docs/image-generation) — model names, response format, aspect ratio options
- Project source code (all read files above) — agent graph topology, tool patterns, HITL pattern, DB schema

### Secondary (MEDIUM confidence)
- npm registry (verified 2026-03-19): playwright@1.58.2, @google/genai@1.46.0
- BrowserStack Playwright persistent context guide (https://www.browserstack.com/guide/playwright-persistent-context) — verified against official docs
- DEV Community Gemini 2.0 Flash image generation article (https://dev.to/wescpy/generating-images-with-gemini-20-flash-from-google-448e) — cross-referenced with official docs

### Tertiary (LOW confidence — flagged for validation)
- Instagram/LinkedIn anti-bot behavior claims (multiple WebSearch sources) — not verified against official platform docs; should be validated during implementation
- Railway filesystem persistence for `/data` volume (mentioned in WebSearch results) — must verify railway.toml for langgraph-server service during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified live; Playwright is the locked decision; @google/genai is the only Google-official Node.js SDK for image generation
- Architecture: HIGH — follows established project patterns exactly (accountant.ts, sales-rep.ts as templates); Playwright API verified against official docs
- Pitfalls: MEDIUM — Docker/sandbox issues and platform anti-bot behavior are well-documented across multiple sources but platform behavior can change

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stable libraries; social platform scraping behavior may change faster)
