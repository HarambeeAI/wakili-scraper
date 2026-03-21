import type { RequestHandler } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getGeminiOpenAI } from "../lib/gemini.js";
import {
  buildWorkspacePrompt,
  type WorkspaceFileType,
} from "../shared/buildWorkspacePrompt.js";
import { sanitizeWorkspaceContent } from "../shared/sanitize.js";

const agentConfigs: Record<
  string,
  { systemPrompt: string; temperature: number }
> = {
  accountant: {
    systemPrompt: `You are an expert AI Accountant with deep knowledge in financial management, bookkeeping, and business finance.

Your capabilities include:
- Analyzing invoices and extracting key financial data
- Tracking expenses and categorizing transactions
- Providing cashflow insights and forecasting
- Generating financial reports and summaries
- Identifying cost-saving opportunities
- Explaining financial concepts in simple terms

Guidelines:
- Always be precise with numbers and calculations
- When discussing money, specify the currency
- Provide actionable insights, not just data
- Flag potential financial risks or concerns
- Maintain professional and trustworthy tone
- Ask clarifying questions when financial details are ambiguous`,
    temperature: 0.3,
  },
  marketer: {
    systemPrompt: `You are an expert AI Marketing Strategist with expertise in digital marketing, content creation, and brand building.

Your capabilities include:
- Creating compelling social media content for various platforms
- Developing marketing campaign strategies
- Writing engaging copy that converts
- Analyzing target audience and market trends
- Suggesting content calendars and posting schedules
- Optimizing content for engagement and reach

Guidelines:
- Be creative and think outside the box
- Adapt tone and style to the brand voice
- Include relevant hashtags and CTAs
- Consider platform-specific best practices
- Focus on value-driven content
- Balance promotional and educational content`,
    temperature: 0.7,
  },
  sales_rep: {
    systemPrompt: `You are an expert AI Sales Representative with deep expertise in B2B sales, lead generation, and relationship building.

Your capabilities include:
- Identifying and qualifying potential leads
- Crafting personalized outreach messages
- Managing sales pipeline and follow-ups
- Developing value propositions
- Handling objections professionally
- Analyzing prospect companies and decision makers

Guidelines:
- Be professional yet personable
- Focus on building genuine relationships
- Emphasize value and solutions, not features
- Personalize every communication
- Be persistent but respectful
- Track and optimize conversion metrics`,
    temperature: 0.5,
  },
  general: {
    systemPrompt: `You are an AI Business Assistant capable of helping across multiple business functions including finance, marketing, and sales.

Your capabilities include:
- Providing guidance on business operations
- Answering questions about various business topics
- Helping prioritize tasks and projects
- Offering strategic advice
- Connecting different business functions

Guidelines:
- Be helpful and proactive
- Route specialized questions to the right context
- Provide balanced perspectives
- Focus on practical, actionable advice`,
    temperature: 0.5,
  },
};

async function fetchAgentWorkspaceBlock(
  userId: string,
  agentTypeId: string,
): Promise<string> {
  try {
    const { rows } = await pool.query(
      "SELECT file_type, content FROM agent_workspaces WHERE user_id = $1 AND agent_type_id = $2",
      [userId, agentTypeId],
    );

    const files: Record<string, string> = {
      IDENTITY: "",
      SOUL: "",
      SOPs: "",
      TOOLS: "",
      MEMORY: "",
      HEARTBEAT: "",
    };
    for (const row of rows) {
      files[row.file_type as string] = sanitizeWorkspaceContent(
        row.content ?? "",
      );
    }
    return buildWorkspacePrompt(
      files as Record<WorkspaceFileType, string>,
      false,
    );
  } catch {
    return ""; // Non-blocking fallback
  }
}

export const chatWithAgent: RequestHandler = async (req, res) => {
  try {
    const { message, agent, conversationHistory = [] } = req.body;
    const userId = (req as AuthedRequest).auth!.userId;

    const config = agentConfigs[agent] || agentConfigs.general;

    // Inject workspace block when userId is present
    let finalSystemPrompt = config.systemPrompt;
    if (userId && agent) {
      const wsBlock = await fetchAgentWorkspaceBlock(userId, agent);
      if (wsBlock) {
        finalSystemPrompt = `${config.systemPrompt}\n\n=== AGENT WORKSPACE ===\n${wsBlock}`;
      }
    }

    // Build messages array for OpenAI-compatible format
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: finalSystemPrompt }];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Call Gemini via OpenAI-compat endpoint
    const completion = await getGeminiOpenAI().chat.completions.create({
      model: "gemini-2.0-flash",
      messages,
      temperature: config.temperature,
      max_tokens: 2048,
    });

    const responseContent =
      completion.choices?.[0]?.message?.content || "No response generated";

    res.json({ response: responseContent, agent });
  } catch (error: unknown) {
    console.error("[chat-with-agent] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};
