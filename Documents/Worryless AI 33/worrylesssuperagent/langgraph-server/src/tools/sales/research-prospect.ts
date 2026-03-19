// SALES-03: Prospect research via Firecrawl scrape + structured LLM synthesis

import type { ProspectResearch } from "./types.js";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";

export async function researchProspect(url: string, _userId: string): Promise<ProspectResearch> {
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not configured — add your Firecrawl API key in Settings.");
  }

  // Scrape via Firecrawl /v1/scrape
  const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!scrapeResponse.ok) {
    const errorText = await scrapeResponse.text();
    throw new Error(`Firecrawl error: ${scrapeResponse.status} - ${errorText}`);
  }

  const scrapeData = await scrapeResponse.json() as { data?: { markdown?: string } };
  const pageContent = scrapeData.data?.markdown ?? "";

  // Synthesize via LLM with structured output — truncate to 15000 chars
  const { data } = await callLLMWithStructuredOutput<ProspectResearch>(
    [new HumanMessage(`Research this prospect website:\n\n${pageContent.slice(0, 15000)}`)],
    '{"companyName": "string", "description": "string", "products": ["string"], "recentNews": ["string"], "teamSize": "string", "fundingStage": "string", "painPoints": ["string"], "talkingPoints": ["string"]}',
    {
      systemPrompt:
        "You are a sales research analyst. Extract key prospect information for B2B sales outreach. Focus on pain points and talking points for personalized outreach.",
      temperature: 0.2,
    },
  );

  return data;
}
