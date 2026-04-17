import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { BRAND_GUIDELINES_PROMPT } from "../prompts/brand-guidelines";

export async function extractBrand(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const llm = new ChatOpenAI({
    modelName: "google/gemini-2.5-pro-preview",
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.3,
  });

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
    try {
      const screenshotData = state.screenshots[0];
      // Handle both raw base64 and data URI formats
      const imageUrl = screenshotData.startsWith("data:")
        ? screenshotData
        : `data:image/png;base64,${screenshotData}`;
      messageContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    } catch (e) {
      console.error("Failed to attach screenshot, proceeding without:", e);
    }
  }

  let response;
  try {
    response = await llm.invoke([
      new HumanMessage({ content: messageContent }),
    ]);
  } catch (e) {
    // If multimodal fails (e.g. image format issue), retry without screenshot
    console.error("LLM call with image failed, retrying text-only:", e);
    const textOnly = messageContent.filter((m) => m.type === "text");
    response = await llm.invoke([new HumanMessage({ content: textOnly })]);
  }

  const brandGuidelines =
    typeof response.content === "string" ? response.content : "";

  state.emitEvent("message", {
    role: "agent",
    content:
      "Solid brand identity emerging. I've mapped out your colors, typography, and design language.",
  });

  state.emitEvent("file_card", {
    type: "brand_guidelines",
    title: "Brand Guidelines",
    content: brandGuidelines,
  });

  return { brandGuidelines };
}
