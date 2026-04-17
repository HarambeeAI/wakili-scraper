import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { BRAND_GUIDELINES_PROMPT } from "../prompts/brand-guidelines";

const llm = new ChatOpenAI({
  modelName: "google/gemini-2.5-pro-preview",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.3,
});

export async function extractBrand(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "extract_brand",
    message: "Analyzing brand identity and visual design",
  });

  const messageContent: (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  )[] = [
    {
      type: "text",
      text: `${BRAND_GUIDELINES_PROMPT}\n\n## Website Content\n${state.crawledContent.slice(0, 5000)}\n\n## Extracted CSS Data\nColors found: ${state.extractedStyles.colors.join(", ")}\nFonts found: ${state.extractedStyles.fonts.join(", ")}\n\n## Site Metadata\nTitle: ${state.siteMetadata.title || "N/A"}\nDescription: ${state.siteMetadata.description || "N/A"}`,
    },
  ];

  if (state.screenshots.length > 0) {
    messageContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${state.screenshots[0]}` },
    });
  }

  const response = await llm.invoke([
    new HumanMessage({ content: messageContent }),
  ]);

  const brandGuidelines = typeof response.content === "string"
    ? response.content
    : "";

  state.emitEvent("message", {
    role: "agent",
    content: "Solid brand identity emerging. I've mapped out your colors, typography, and design language.",
  });

  state.emitEvent("file_card", {
    type: "brand_guidelines",
    title: "Brand Guidelines",
    content: brandGuidelines,
  });

  return { brandGuidelines };
}
