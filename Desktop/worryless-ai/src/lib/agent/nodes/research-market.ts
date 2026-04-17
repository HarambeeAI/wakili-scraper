import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { MARKET_RESEARCH_PROMPT } from "../prompts/market-research";
import { searchMultiple } from "../tools/serper";

export async function researchMarket(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const llm = new ChatOpenAI({
    modelName: "google/gemini-2.5-pro-preview",
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.4,
  });

  state.emitEvent("status", {
    task: "research_market",
    message: "Searching the web",
  });

  const domain = new URL(state.websiteUrl).hostname;
  const companyName =
    state.siteMetadata.title?.split(/[|\-–]/)[0]?.trim() || domain;

  const queries = [
    `${companyName} industry market size 2025 2026`,
    `${companyName} competitors alternatives`,
    `"${domain}" reviews OR customers OR users`,
    `${companyName} industry trends growth`,
  ];

  const searchResults = await searchMultiple(queries);

  state.emitEvent("status", {
    task: "research_market",
    message: "Researching keywords",
  });

  const keywordQueries = [
    `${companyName} type of product keyword search volume`,
  ];
  const keywordResults = await searchMultiple(keywordQueries);

  const allResults = { ...searchResults, ...keywordResults };
  const searchContext = Object.entries(allResults)
    .map(([query, results]) => {
      const formatted = results
        .slice(0, 5)
        .map((r) => `  - ${r.title}: ${r.snippet}`)
        .join("\n");
      return `### Query: "${query}"\n${formatted}`;
    })
    .join("\n\n");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${MARKET_RESEARCH_PROMPT}\n\n## Company Website Content\n${state.crawledContent.slice(0, 4000)}\n\n## Company URL\n${state.websiteUrl}\n\n## Web Search Results\n${searchContext}`,
    }),
  ]);

  const marketResearch =
    typeof response.content === "string" ? response.content : "";

  state.emitEvent("message", {
    role: "agent",
    content:
      "Big market signals found. I've mapped the competitive landscape, keyword opportunity, and target segments.",
  });

  state.emitEvent("file_card", {
    type: "market_research",
    title: "Market Research",
    content: marketResearch,
  });

  return { marketResearch };
}
