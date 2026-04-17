import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { MARKETING_STRATEGY_PROMPT } from "../prompts/marketing-strategy";

export async function generateStrategy(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const llm = new ChatOpenAI({
    modelName: "google/gemini-2.5-pro-preview",
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.6,
  });

  state.emitEvent("status", {
    task: "generate_strategy",
    message: "Crafting marketing strategy",
  });

  const selectedServicesText = state.selectedServices.join(", ");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${MARKETING_STRATEGY_PROMPT}\n\n## Selected Marketing Services\nThe client wants help with: ${selectedServicesText}\nFocus your strategy primarily on these channels.\n\n## Business Profile\n${state.businessProfile.slice(0, 3000)}\n\n## Brand Guidelines\n${state.brandGuidelines.slice(0, 2000)}\n\n## Market Research\n${state.marketResearch.slice(0, 4000)}\n\n## Website URL\n${state.websiteUrl}`,
    }),
  ]);

  const marketingStrategy =
    typeof response.content === "string" ? response.content : "";

  state.emitEvent("message", {
    role: "agent",
    content:
      "Strategy locked in. I've tailored recommendations to your market position and competitive landscape. Let me pull everything together into the final files.",
  });

  state.emitEvent("file_card", {
    type: "marketing_strategy",
    title: "Marketing Strategy",
    content: marketingStrategy,
  });

  return { marketingStrategy };
}
