import type { AgentStateType } from "../state";
import { scrapeWebsite, extractLogoFromHtml, extractStylesFromHtml } from "../tools/firecrawl";

export async function crawlWebsite(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "crawl_website",
    message: "Working on getWebsiteContent",
  });

  const result = await scrapeWebsite(state.websiteUrl);

  const logoUrl = extractLogoFromHtml(result.html, state.websiteUrl);
  const extractedStyles = extractStylesFromHtml(result.html);

  state.emitEvent("message", {
    role: "agent",
    content: `Great picture forming already. I've scraped your website and found ${extractedStyles.colors.length} colors and ${extractedStyles.fonts.length} fonts in your design system.${logoUrl ? " Found your logo too." : ""}`,
  });

  return {
    crawledContent: result.content,
    crawledHtml: result.html,
    screenshots: result.screenshot ? [result.screenshot] : [],
    logoUrl,
    extractedStyles,
    siteMetadata: result.metadata,
  };
}
