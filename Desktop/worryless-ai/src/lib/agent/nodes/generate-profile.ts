import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { BUSINESS_PROFILE_PROMPT } from "../prompts/business-profile";
import { searchWeb } from "../tools/serper";

export async function generateProfile(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  const llm = new ChatOpenAI({
    modelName: "google/gemini-2.5-pro-preview",
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0.3,
  });

  state.emitEvent("status", {
    task: "generate_profile",
    message: "Building business profile",
  });

  const domain = new URL(state.websiteUrl).hostname;
  const pressResults = await searchWeb(
    `"${domain}" OR "${state.siteMetadata.title}" news coverage`,
    5,
  );
  const pressContext = pressResults
    .map((r) => `- ${r.title}: ${r.snippet}`)
    .join("\n");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${BUSINESS_PROFILE_PROMPT}\n\n## Website Content\n${state.crawledContent.slice(0, 8000)}\n\n## Website URL\n${state.websiteUrl}\n\n## Press / External Mentions\n${pressContext || "No press coverage found"}\n\n## Site Metadata\nTitle: ${state.siteMetadata.title || "N/A"}\nDescription: ${state.siteMetadata.description || "N/A"}`,
    }),
  ]);

  const businessProfile =
    typeof response.content === "string" ? response.content : "";

  state.emitEvent("message", {
    role: "agent",
    content:
      "Great picture forming already. I've mapped out the product, traction, and key value props.",
  });

  state.emitEvent("file_card", {
    type: "business_profile",
    title: "Business Profile",
    content: businessProfile,
  });

  return { businessProfile };
}
