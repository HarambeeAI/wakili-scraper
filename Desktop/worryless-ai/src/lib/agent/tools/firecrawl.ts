import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});

export interface CrawlResult {
  content: string;
  html: string;
  screenshot?: string;
  metadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export async function scrapeWebsite(url: string): Promise<CrawlResult> {
  const result = await firecrawl.scrapeUrl(url, {
    formats: ["markdown", "html", "screenshot"],
  });

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error}`);
  }

  return {
    content: result.markdown || "",
    html: result.html || "",
    screenshot: result.screenshot,
    metadata: {
      title: result.metadata?.title,
      description: result.metadata?.description,
      ogImage: result.metadata?.ogImage,
    },
  };
}

export function extractLogoFromHtml(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/gi,
    /<(?:header|nav)[^>]*>[\s\S]*?<img[^>]*(?:class|alt|src)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+)["'][^>]*(?:class|alt)=["'][^"']*logo[^"']*["']/gi,
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const logoPath = match[1];
      if (logoPath.startsWith("http")) return logoPath;
      if (logoPath.startsWith("//")) return `https:${logoPath}`;
      return new URL(logoPath, baseUrl).toString();
    }
  }

  return null;
}

export function extractStylesFromHtml(html: string): {
  colors: string[];
  fonts: string[];
} {
  const colorPattern = /#[0-9a-fA-F]{3,8}/g;
  const fontPattern = /font-family:\s*["']?([^;"']+)/g;

  const colors = [...new Set(html.match(colorPattern) || [])];
  const fonts: string[] = [];
  let fontMatch;
  while ((fontMatch = fontPattern.exec(html)) !== null) {
    const font = fontMatch[1].split(",")[0].trim().replace(/["']/g, "");
    if (!fonts.includes(font)) fonts.push(font);
  }

  return { colors, fonts };
}
