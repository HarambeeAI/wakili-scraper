import type { RequestHandler } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getGeminiOpenAI } from "../lib/gemini.js";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import {
  buildWorkspacePrompt,
  type WorkspaceFileType,
} from "../shared/buildWorkspacePrompt.js";
import { sanitizeWorkspaceContent } from "../shared/sanitize.js";

// ----- Agent prompt configs -----

const baseAgentPrompts: Record<
  string,
  { name: string; description: string; basePrompt: string; temperature: number }
> = {
  accountant: {
    name: "AI Accountant",
    description:
      "Financial management, invoices, expenses, cashflow, transactions, budgets, P&L reports",
    basePrompt: `You are an expert AI Accountant with deep knowledge in financial management, bookkeeping, and business finance.

CAPABILITIES:
- Analyze invoices and extract key financial data
- Track expenses and categorize transactions
- Provide cashflow insights and forecasting
- Generate financial reports and summaries
- Identify cost-saving opportunities
- Explain financial concepts simply
- Query and analyze user-uploaded financial data using the query_user_data tool

GUIDELINES:
- Be precise with numbers and calculations
- Always specify currency when discussing money
- Provide actionable insights, not just data
- Flag potential financial risks or concerns
- Maintain professional and trustworthy tone
- IMPORTANT: Use the Business Knowledge Base provided below to understand the business context
- When asked about uploaded data (expenses, revenue, transactions, etc.), use the query_user_data tool to retrieve relevant rows and provide insights
- Only ask follow-up questions if the required information is NOT available in the Business Knowledge Base

When asked to perform actions, structure your response clearly with any data that should be saved.`,
    temperature: 0.3,
  },
  marketer: {
    name: "AI Marketer",
    description:
      "Social media content, Instagram posts, marketing campaigns, brand strategy, content calendars, copywriting",
    basePrompt: `You are an expert AI Marketing Strategist with expertise in digital marketing, content creation, and brand building.

CAPABILITIES:
- Create compelling social media content for various platforms
- Develop marketing campaign strategies
- Write engaging copy that converts
- Analyze target audience and market trends
- Suggest content calendars and posting schedules
- Optimize content for engagement and reach
- Generate visual asset concepts and descriptions

GUIDELINES:
- Be creative and think outside the box
- Adapt tone and style to the brand voice from the Business Knowledge Base
- Include relevant hashtags and CTAs
- Consider platform-specific best practices
- Focus on value-driven content
- Balance promotional and educational content
- IMPORTANT: Use the Business Knowledge Base provided below to understand the business, its brand, products/services, and target audience
- Only ask follow-up questions if the required information is NOT available in the Business Knowledge Base

When creating content, provide complete ready-to-post copy with hashtags.`,
    temperature: 0.7,
  },
  sales_rep: {
    name: "AI Sales Rep",
    description:
      "Lead generation, cold outreach, sales emails, prospecting, pipeline management, B2B sales, follow-ups",
    basePrompt: `You are an expert AI Sales Representative with deep expertise in B2B sales, lead generation, and relationship building.

CAPABILITIES:
- Identify and qualify potential leads
- Craft personalized outreach messages
- Manage sales pipeline and follow-ups
- Develop value propositions
- Handle objections professionally
- Analyze prospect companies and decision makers
- Write compelling cold emails

GUIDELINES:
- Be professional yet personable
- Focus on building genuine relationships
- Emphasize value and solutions, not features
- Personalize every communication using the Business Knowledge Base
- Be persistent but respectful
- Track and optimize conversion metrics
- IMPORTANT: Use the Business Knowledge Base provided below to understand the business value proposition and tailor outreach
- Only ask follow-up questions if the required information is NOT available in the Business Knowledge Base

When writing outreach, provide complete email copy with subject line.`,
    temperature: 0.5,
  },
  personal_assistant: {
    name: "AI Personal Assistant",
    description:
      "Email management, calendar, scheduling, daily briefings, email drafting",
    basePrompt: `You are an expert AI Personal Assistant specializing in executive support, email management, and calendar organization.

CAPABILITIES:
- Analyze and prioritize emails
- Manage calendar and scheduling
- Draft professional email responses
- Create daily briefings and summaries
- Identify urgent communications
- Organize tasks and priorities

GUIDELINES:
- Be proactive in identifying what needs attention
- Prioritize by urgency and importance
- Maintain professional communication style
- Respect time zones and scheduling preferences
- IMPORTANT: Use the Business Knowledge Base provided below to understand the business context
- Only ask follow-up questions if the required information is NOT available in the Business Knowledge Base

When drafting emails, provide complete professional copy ready for review.`,
    temperature: 0.4,
  },
};

// ----- Orchestrator tool definitions (OpenAI-compatible function calling) -----

const orchestratorTools = [
  {
    type: "function" as const,
    function: {
      name: "delegate_to_accountant",
      description:
        "Delegate a task to the AI Accountant for financial matters like invoices, expenses, cashflow, transactions, budgets, or financial reports",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The specific task or question for the accountant",
          },
          context: {
            type: "string",
            description: "Any relevant business context",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delegate_to_marketer",
      description:
        "Delegate a task to the AI Marketer for content creation, social media posts, marketing campaigns, or brand strategy",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The specific task or question for the marketer",
          },
          platform: {
            type: "string",
            description: "Target platform (instagram, twitter, linkedin)",
          },
          context: {
            type: "string",
            description: "Any relevant business or brand context",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delegate_to_sales_rep",
      description:
        "Delegate a task to the AI Sales Rep for lead generation, outreach emails, prospecting, or pipeline management",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The specific task or question for the sales rep",
          },
          leadInfo: {
            type: "string",
            description: "Information about the lead or prospect",
          },
          context: {
            type: "string",
            description: "Any relevant business context",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delegate_to_personal_assistant",
      description:
        "Delegate a task to the AI Personal Assistant for email management, calendar organization, scheduling, or drafting email responses",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The specific task for the personal assistant",
          },
          context: { type: "string", description: "Any relevant context" },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_social_content",
      description:
        "Generate social media content with optional AI image. Use this when user wants to create a post.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The topic or theme for the content",
          },
          platform: {
            type: "string",
            description: "Target platform (instagram, twitter, linkedin)",
          },
          includeImage: {
            type: "boolean",
            description: "Whether to generate an accompanying image",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_outreach_email",
      description: "Generate a personalized sales outreach email for a lead",
      parameters: {
        type: "object",
        properties: {
          leadName: {
            type: "string",
            description: "Name of the lead/prospect",
          },
          companyName: { type: "string", description: "Company name" },
          context: {
            type: "string",
            description: "What you know about them or why reaching out",
          },
        },
        required: ["leadName", "companyName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_leads",
      description:
        "Search to find and generate real business leads based on search criteria. Use this when user wants to find leads, prospects, or potential customers. IMPORTANT: Use the Business Knowledge Base to determine the query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query describing the type of business/person to find as leads.",
          },
          location: { type: "string", description: "Location to search in" },
          industry: {
            type: "string",
            description: "Industry to filter leads by",
          },
          jobTitle: {
            type: "string",
            description: "Job title to filter leads by",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_invoice",
      description:
        "Save an invoice to the database. Use this when the user asks to create, save, or track an invoice.",
      parameters: {
        type: "object",
        properties: {
          vendorName: {
            type: "string",
            description: "Name of the vendor or client",
          },
          amount: {
            type: "number",
            description: "Invoice amount in the specified currency",
          },
          currency: {
            type: "string",
            description: "Currency code (e.g., USD, KES, EUR)",
          },
          dueDate: {
            type: "string",
            description: "Due date in YYYY-MM-DD format",
          },
          description: {
            type: "string",
            description: "Description of what the invoice is for",
          },
          status: {
            type: "string",
            description: "Invoice status: pending, paid, or overdue",
          },
        },
        required: ["vendorName", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_transaction",
      description: "Record a financial transaction (income or expense).",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Transaction type: income or expense",
          },
          amount: { type: "number", description: "Transaction amount" },
          description: {
            type: "string",
            description: "Description of the transaction",
          },
          category: {
            type: "string",
            description: "Category (e.g., salary, utilities, sales, services)",
          },
          date: {
            type: "string",
            description: "Transaction date in YYYY-MM-DD format",
          },
        },
        required: ["type", "amount", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_user_data",
      description:
        "Query the user's uploaded datasheets to retrieve and analyze data.",
      parameters: {
        type: "object",
        properties: {
          datasheetName: {
            type: "string",
            description: "Name or partial name of the datasheet to query",
          },
          filterColumn: {
            type: "string",
            description: "Column name to filter by (optional)",
          },
          filterValue: {
            type: "string",
            description: "Value to filter for (optional)",
          },
          filterOperator: {
            type: "string",
            description:
              "Comparison operator: equals, contains, greater_than, less_than (default: equals)",
          },
          limit: {
            type: "number",
            description: "Maximum rows to return (default: 50)",
          },
        },
        required: ["datasheetName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "answer_directly",
      description:
        "Answer the user's question directly without delegating. Use for general questions, clarifications, or when the user just wants to chat.",
      parameters: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "Your direct response to the user",
          },
        },
        required: ["response"],
      },
    },
  },
];

const orchestratorSystemPrompt = `You are the AI Co-Founder Orchestrator - a strategic business assistant that coordinates a team of specialized AI agents.

YOUR TEAM:
1. **AI Accountant** - Financial expert: invoices, expenses, cashflow, reports, budgets
2. **AI Marketer** - Creative expert: social media, content, campaigns, branding
3. **AI Sales Rep** - Sales expert: leads, outreach, prospecting, pipeline
4. **AI Personal Assistant** - Executive support: email, calendar, scheduling, briefings

YOUR ROLE:
- Analyze user intent and understand what they need
- Route tasks to the appropriate specialist agent(s)
- For complex tasks, coordinate multiple agents
- Execute actions when users want things done (generate content, create posts, send emails, find leads)
- Provide strategic oversight and connect different business functions

IMPORTANT - BUSINESS CONTEXT:
You have access to a Business Knowledge Base below that contains detailed information about the user's business.

CRITICAL - LEAD GENERATION:
When the user asks to "generate leads", "find leads", "find prospects", or similar:
1. FIRST, look at the Business Knowledge Base to find the TARGET AUDIENCE or TARGET CUSTOMERS
2. The "query" parameter should be WHO the business sells to
3. Use the business's country/city from the profile for the "location" parameter
4. Use the business's industry context for the "industry" parameter if relevant
5. DO NOT ask the user what type of leads - INFER IT from the Business Knowledge Base

DECISION RULES:
1. If user asks about money, invoices, expenses, financial reports -> delegate_to_accountant
2. If user asks about content, posts, marketing, social media -> delegate_to_marketer
3. If user asks about leads, sales, outreach, prospects -> delegate_to_sales_rep
4. If user asks about emails, calendar, scheduling, briefings -> delegate_to_personal_assistant
5. If user wants to CREATE content/post -> generate_social_content
6. If user wants to CREATE outreach email -> generate_outreach_email
7. If user wants to FIND or GENERATE leads/prospects -> generate_leads
8. If user wants to CREATE or SAVE an INVOICE -> save_invoice
9. If user wants to RECORD a TRANSACTION -> save_transaction
10. If user asks a general question or just wants to chat -> answer_directly

ALWAYS use a tool. Never respond without calling a tool first.`;

// ----- Helper functions -----

async function fetchBusinessKnowledge(userId: string): Promise<string> {
  try {
    // Fetch user profile
    const { rows: profileRows } = await pool.query(
      "SELECT * FROM profiles WHERE user_id = $1 LIMIT 1",
      [userId],
    );
    const profile = profileRows[0] ?? null;

    // Fetch business artifacts
    const { rows: artifacts } = await pool.query(
      "SELECT * FROM business_artifacts WHERE user_id = $1",
      [userId],
    );

    // Fetch user datasheets
    const { rows: datasheets } = await pool.query(
      "SELECT * FROM user_datasheets WHERE user_id = $1",
      [userId],
    );

    let knowledgeBase = "\n\n=== BUSINESS KNOWLEDGE BASE ===\n";

    if (profile) {
      knowledgeBase += "\n## Business Profile\n";
      if (profile.business_name)
        knowledgeBase += `- Business Name: ${profile.business_name}\n`;
      if (profile.industry)
        knowledgeBase += `- Industry: ${profile.industry}\n`;
      if (profile.website) knowledgeBase += `- Website: ${profile.website}\n`;
      if (profile.company_description)
        knowledgeBase += `- Description: ${profile.company_description}\n`;
    }

    if (artifacts && artifacts.length > 0) {
      knowledgeBase += "\n## Business Artifacts & Details\n";
      for (const artifact of artifacts) {
        knowledgeBase += `\n### ${artifact.title || artifact.artifact_type}\n`;
        if (artifact.content) knowledgeBase += `${artifact.content}\n`;
        if (artifact.source_url)
          knowledgeBase += `Source: ${artifact.source_url}\n`;
        if (artifact.metadata && Object.keys(artifact.metadata).length > 0) {
          knowledgeBase += `Metadata: ${JSON.stringify(artifact.metadata)}\n`;
        }
      }
    }

    if (datasheets && datasheets.length > 0) {
      knowledgeBase +=
        "\n## Available Data Sheets (Use query_user_data tool to query these)\n";
      for (const sheet of datasheets) {
        knowledgeBase += `\n### ${sheet.name}\n`;
        knowledgeBase += `- Description: ${sheet.description}\n`;
        knowledgeBase += `- Columns: ${sheet.column_names.join(", ")}\n`;
        knowledgeBase += `- Rows: ${sheet.row_count}\n`;
      }
    }

    knowledgeBase += "\n=== END BUSINESS KNOWLEDGE BASE ===\n";
    knowledgeBase +=
      "\nIMPORTANT: Use the above Business Knowledge Base to inform your responses.\n";

    return knowledgeBase;
  } catch (error) {
    console.error("[orchestrator] Failed to fetch business knowledge:", error);
    return "";
  }
}

async function fetchAndBuildWorkspacePrompt(
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
    return "";
  }
}

function getAgentConfig(agentKey: string) {
  return baseAgentPrompts[agentKey];
}

async function buildAgentPrompt(
  agentKey: string,
  businessKnowledge: string,
  userId?: string,
): Promise<string> {
  const agent = baseAgentPrompts[agentKey];
  if (!agent) return "";

  let toolBoundarySection = "";

  try {
    const { rows } = await pool.query(
      "SELECT skill_config, display_name FROM available_agent_types WHERE id = $1 LIMIT 1",
      [agentKey],
    );
    const agentType = rows[0];

    if (
      agentType?.skill_config &&
      Array.isArray(agentType.skill_config) &&
      agentType.skill_config.length > 0
    ) {
      toolBoundarySection = `\n\nTOOL BOUNDARIES: You are the ${agentType.display_name || agentKey}. You are ONLY permitted to use tools and capabilities in this category list: ${agentType.skill_config.join(", ")}.\nDo not attempt actions outside your designated tool categories. Stay within your role boundaries.`;
    }
  } catch {
    // Non-blocking
  }

  let workspaceBlock = "";
  if (userId) {
    workspaceBlock = await fetchAndBuildWorkspacePrompt(userId, agentKey);
  }

  return (
    agent.basePrompt +
    (workspaceBlock
      ? `\n\n=== AGENT WORKSPACE ===\n${workspaceBlock}\n\n`
      : "") +
    businessKnowledge +
    toolBoundarySection
  );
}

function buildOrchestratorPrompt(
  businessKnowledge: string,
  workspaceBlock = "",
): string {
  const wsSection = workspaceBlock
    ? `\n\n=== CHIEF OF STAFF WORKSPACE ===\n${workspaceBlock}\n\n`
    : "";
  return orchestratorSystemPrompt + wsSection + businessKnowledge;
}

async function callGemini(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    temperature?: number;
    maxTokens?: number;
    tools?: typeof orchestratorTools;
  } = {},
) {
  const params: Record<string, unknown> = {
    model: "gemini-2.0-flash",
    messages,
  };
  if (options.temperature !== undefined)
    params.temperature = options.temperature;
  if (options.maxTokens !== undefined) params.max_tokens = options.maxTokens;
  if (options.tools) params.tools = options.tools;

  return getGeminiOpenAI().chat.completions.create(
    params as unknown as ChatCompletionCreateParamsNonStreaming,
  ) as Promise<ChatCompletion>;
}

async function executeSpecialist(
  agentKey: string,
  task: string,
  businessKnowledge: string,
  additionalContext?: string,
  userId?: string,
): Promise<string> {
  const agentConfig = getAgentConfig(agentKey);
  if (!agentConfig) return "Agent not found";

  const fullSystemPrompt = await buildAgentPrompt(
    agentKey,
    businessKnowledge,
    userId,
  );
  const prompt = additionalContext
    ? `${task}\n\nAdditional Context: ${additionalContext}`
    : task;

  const completion = await callGemini(
    [
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: prompt },
    ],
    { temperature: agentConfig.temperature, maxTokens: 2048 },
  );

  return completion.choices?.[0]?.message?.content || "No response generated";
}

async function generateOutreachEmail(
  leadName: string,
  companyName: string,
  businessKnowledge: string,
  context = "",
): Promise<{ subject: string; body: string }> {
  const fullSystemPrompt = await buildAgentPrompt(
    "sales_rep",
    businessKnowledge,
  );

  const prompt = `Write a personalized cold outreach email to ${leadName} at ${companyName}.
${context ? `Additional Context: ${context}` : ""}

Use the business information from the Business Knowledge Base to craft a compelling value proposition.

Respond in this exact JSON format:
{"subject": "email subject line", "body": "email body text"}`;

  const agentConfig = getAgentConfig("sales_rep");
  const completion = await callGemini(
    [
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: prompt },
    ],
    { temperature: agentConfig?.temperature || 0.5, maxTokens: 1024 },
  );

  const text = completion.choices?.[0]?.message?.content || "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // fallback
  }
  return { subject: `Connecting with ${leadName}`, body: text };
}

async function fetchDatasheetContext(userId: string): Promise<string> {
  try {
    const { rows: datasheets } = await pool.query(
      "SELECT * FROM user_datasheets WHERE user_id = $1",
      [userId],
    );
    if (!datasheets || datasheets.length === 0) return "";

    let dataContext = "\n\n=== ACTUAL DATASHEET DATA ===\n";

    for (const sheet of datasheets) {
      const { rows } = await pool.query(
        "SELECT row_data, row_index FROM datasheet_rows WHERE datasheet_id = $1 ORDER BY row_index ASC LIMIT 100",
        [sheet.id],
      );

      if (rows && rows.length > 0) {
        dataContext += `\n### ${sheet.name}\n`;
        dataContext += `Columns: ${sheet.column_names.join(", ")}\n\n`;
        dataContext += "| " + sheet.column_names.join(" | ") + " |\n";
        dataContext +=
          "| " + sheet.column_names.map(() => "---").join(" | ") + " |\n";

        for (const row of rows) {
          const values = sheet.column_names.map((col: string) => {
            const val = row.row_data[col];
            return val !== null && val !== undefined ? String(val) : "";
          });
          dataContext += "| " + values.join(" | ") + " |\n";
        }
        dataContext += "\n";
      }
    }

    dataContext += "=== END DATASHEET DATA ===\n";
    return dataContext;
  } catch (error) {
    console.error("[orchestrator] fetchDatasheetContext error:", error);
    return "";
  }
}

// ----- Attachment helpers -----

interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

function getFileDescription(attachment: Attachment): string {
  const extension = attachment.name.split(".").pop()?.toLowerCase() || "";
  const sizeKB = Math.round(attachment.size / 1024);
  if (extension === "pdf")
    return `[PDF Document: ${attachment.name} (${sizeKB}KB)]`;
  if (["doc", "docx"].includes(extension))
    return `[Word Document: ${attachment.name} (${sizeKB}KB)]`;
  if (["xls", "xlsx"].includes(extension))
    return `[Excel Spreadsheet: ${attachment.name} (${sizeKB}KB)]`;
  if (["csv"].includes(extension))
    return `[CSV File: ${attachment.name} (${sizeKB}KB)]`;
  if (["txt", "md"].includes(extension))
    return `[Text File: ${attachment.name} (${sizeKB}KB)]`;
  return `[File: ${attachment.name} (${sizeKB}KB)]`;
}

function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// ----- Main orchestrator route -----

export const orchestrator: RequestHandler = async (req, res) => {
  try {
    const {
      message,
      conversationHistory = [],
      businessContext = "",
      stream = false,
      attachments = [],
    } = req.body;
    const userId = (req as AuthedRequest).auth!.userId;

    // Fetch business knowledge base
    let businessKnowledge = "";
    if (userId) {
      businessKnowledge = await fetchBusinessKnowledge(userId);
    }

    // Fetch Chief of Staff workspace block
    let chiefWorkspaceBlock = "";
    if (userId) {
      chiefWorkspaceBlock = await fetchAndBuildWorkspacePrompt(
        userId,
        "chief_of_staff",
      );
    }

    // Build conversation messages
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: buildOrchestratorPrompt(
          businessKnowledge,
          chiefWorkspaceBlock,
        ),
      },
    ];

    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Process attachments
    let attachmentContext = "";
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments as Attachment[]) {
        if (isImageFile(attachment.type)) {
          attachmentContext += `\n[Image attached: ${attachment.name}]`;
        } else if (attachment.type === "application/pdf") {
          attachmentContext += `\n[PDF attached: ${attachment.name} - Please analyze this document]`;
        } else {
          attachmentContext += `\n${getFileDescription(attachment)}`;
        }
      }
    }

    const fullMessage = attachmentContext
      ? `${message}\n\n--- Attached Files ---${attachmentContext}`
      : message;

    messages.push({ role: "user", content: fullMessage });

    // Call orchestrator with function calling
    const orchestratorCompletion = await callGemini(messages, {
      temperature: 0.3,
      maxTokens: 512,
      tools: orchestratorTools,
    });

    const responseMessage = orchestratorCompletion.choices?.[0]?.message;
    const toolCalls = responseMessage?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0];
      const args = JSON.parse(call.function.arguments || "{}");

      let finalResponse = "";
      let agentUsed = "orchestrator";
      let actionTaken: Record<string, unknown> | null = null;

      console.log(`[orchestrator] Delegating to: ${call.function.name}`, args);

      switch (call.function.name) {
        case "delegate_to_accountant": {
          agentUsed = "accountant";
          let datasheetCtx = "";
          if (userId) datasheetCtx = await fetchDatasheetContext(userId);
          const fullContext = (args.context || "") + datasheetCtx;
          finalResponse = await executeSpecialist(
            "accountant",
            args.task,
            businessKnowledge,
            fullContext,
            userId,
          );
          break;
        }
        case "delegate_to_marketer": {
          agentUsed = "marketer";
          const additionalCtx = `${args.platform ? `Platform: ${args.platform}. ` : ""}${args.context || ""}`;
          finalResponse = await executeSpecialist(
            "marketer",
            args.task,
            businessKnowledge,
            additionalCtx,
            userId,
          );
          break;
        }
        case "delegate_to_sales_rep": {
          agentUsed = "sales_rep";
          const additionalCtx = `${args.leadInfo ? `Lead: ${args.leadInfo}. ` : ""}${args.context || ""}`;
          finalResponse = await executeSpecialist(
            "sales_rep",
            args.task,
            businessKnowledge,
            additionalCtx,
            userId,
          );
          break;
        }
        case "delegate_to_personal_assistant": {
          agentUsed = "personal_assistant";
          finalResponse = await executeSpecialist(
            "personal_assistant",
            args.task,
            businessKnowledge,
            args.context,
            userId,
          );
          break;
        }
        case "generate_social_content": {
          agentUsed = "marketer";
          // Generate content using marketer specialist (no separate edge function call needed)
          const contentPrompt = `Create a social media post about: ${args.topic}\nPlatform: ${args.platform || "instagram"}\nProvide complete ready-to-post copy with hashtags.`;
          finalResponse = await executeSpecialist(
            "marketer",
            contentPrompt,
            businessKnowledge,
            businessContext,
            userId,
          );
          actionTaken = { type: "content_generated", content: finalResponse };
          break;
        }
        case "generate_outreach_email": {
          agentUsed = "sales_rep";
          const email = await generateOutreachEmail(
            args.leadName,
            args.companyName,
            businessKnowledge,
            args.context,
          );
          finalResponse = `**Subject:** ${email.subject}\n\n${email.body}`;
          actionTaken = { type: "email_generated", ...email };
          break;
        }
        case "generate_leads": {
          agentUsed = "sales_rep";
          // Generate leads via the sales rep specialist (placeholder -- real lead gen via external service routes in plan 22-03+)
          const leadPrompt = `Find potential leads matching: query="${args.query}" location="${args.location || ""}" industry="${args.industry || ""}" jobTitle="${args.jobTitle || ""}".\nProvide a list of potential leads with company names and contact details.`;
          finalResponse = await executeSpecialist(
            "sales_rep",
            leadPrompt,
            businessKnowledge,
            undefined,
            userId,
          );
          actionTaken = { type: "leads_generated" };
          break;
        }
        case "save_invoice": {
          agentUsed = "accountant";
          if (!userId) {
            finalResponse = "Unable to save invoice: missing user context.";
            break;
          }

          const { rows: profileRows } = await pool.query(
            "SELECT business_name, email FROM profiles WHERE user_id = $1 LIMIT 1",
            [userId],
          );

          const invoiceData = {
            user_id: userId,
            vendor_name: args.vendorName,
            amount: args.amount,
            currency: args.currency || "USD",
            due_date: args.dueDate || null,
            description: args.description || null,
            status: args.status || "pending",
          };

          try {
            const { rows: invoiceRows } = await pool.query(
              `INSERT INTO invoices (user_id, vendor_name, amount, currency, due_date, description, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
              [
                invoiceData.user_id,
                invoiceData.vendor_name,
                invoiceData.amount,
                invoiceData.currency,
                invoiceData.due_date,
                invoiceData.description,
                invoiceData.status,
              ],
            );
            const invoice = invoiceRows[0];
            finalResponse = `Invoice saved successfully!\n\nInvoice Details:\n- Vendor/Client: ${invoice.vendor_name}\n- Amount: ${invoice.currency} ${invoice.amount}\n- Status: ${invoice.status}${invoice.due_date ? `\n- Due Date: ${invoice.due_date}` : ""}${invoice.description ? `\n- Description: ${invoice.description}` : ""}\n\nThis invoice is now tracked in your Accountant dashboard.`;
            actionTaken = { type: "invoice_saved", invoice };
          } catch (error) {
            console.error("[orchestrator] Failed to save invoice:", error);
            finalResponse = `Failed to save invoice: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
          break;
        }
        case "query_user_data": {
          agentUsed = "accountant";
          if (!userId) {
            finalResponse = "Unable to query data: missing user context.";
            break;
          }

          const { rows: datasheets } = await pool.query(
            "SELECT * FROM user_datasheets WHERE user_id = $1 AND name ILIKE $2",
            [userId, `%${args.datasheetName}%`],
          );

          if (!datasheets || datasheets.length === 0) {
            finalResponse = `No datasheet found matching "${args.datasheetName}".`;
            break;
          }

          const datasheet = datasheets[0];
          const { rows: rowsResult } = await pool.query(
            "SELECT row_data, row_index FROM datasheet_rows WHERE datasheet_id = $1 ORDER BY row_index ASC LIMIT $2",
            [datasheet.id, args.limit || 50],
          );

          // Apply filter in JavaScript if specified
          let filteredRows = rowsResult || [];
          if (args.filterColumn && args.filterValue) {
            const operator = args.filterOperator || "equals";
            filteredRows = filteredRows.filter(
              (row: { row_data: Record<string, unknown> }) => {
                const cellValue = row.row_data[args.filterColumn];
                if (cellValue === null || cellValue === undefined) return false;
                const strValue = String(cellValue).toLowerCase();
                const filterVal = String(args.filterValue).toLowerCase();
                switch (operator) {
                  case "contains":
                    return strValue.includes(filterVal);
                  case "greater_than":
                    return Number(cellValue) > Number(args.filterValue);
                  case "less_than":
                    return Number(cellValue) < Number(args.filterValue);
                  default:
                    return strValue === filterVal;
                }
              },
            );
          }

          finalResponse = `Data from: ${datasheet.name}\n\n`;
          finalResponse += `${datasheet.description}\n\n`;
          finalResponse += `Columns: ${datasheet.column_names.join(", ")}\n`;
          finalResponse += `Showing: ${filteredRows.length} of ${datasheet.row_count} rows\n\n`;

          if (filteredRows.length > 0) {
            filteredRows
              .slice(0, 20)
              .forEach(
                (row: { row_data: Record<string, unknown> }, idx: number) => {
                  finalResponse += `Row ${idx + 1}:\n`;
                  for (const [key, value] of Object.entries(row.row_data)) {
                    if (value !== null && value !== undefined) {
                      finalResponse += `  - ${key}: ${value}\n`;
                    }
                  }
                  finalResponse += "\n";
                },
              );
            if (filteredRows.length > 20) {
              finalResponse += `...and ${filteredRows.length - 20} more rows\n`;
            }
          } else {
            finalResponse += "No matching rows found.\n";
          }

          actionTaken = {
            type: "data_queried",
            datasheet: datasheet.name,
            rowCount: filteredRows.length,
          };
          break;
        }
        case "save_transaction": {
          agentUsed = "accountant";
          if (!userId) {
            finalResponse = "Unable to save transaction: missing user context.";
            break;
          }

          const transactionData = {
            user_id: userId,
            type: args.type,
            amount: args.amount,
            description: args.description,
            category: args.category || null,
            date: args.date || new Date().toISOString().split("T")[0],
          };

          try {
            const { rows: txRows } = await pool.query(
              `INSERT INTO transactions (user_id, type, amount, description, category, date)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
              [
                transactionData.user_id,
                transactionData.type,
                transactionData.amount,
                transactionData.description,
                transactionData.category,
                transactionData.date,
              ],
            );
            const transaction = txRows[0];
            finalResponse = `Transaction recorded successfully!\n\nDetails:\n- Type: ${transaction.type}\n- Amount: $${transaction.amount}\n- Description: ${transaction.description}${transaction.category ? `\n- Category: ${transaction.category}` : ""}\n- Date: ${transaction.date}`;
            actionTaken = { type: "transaction_saved", transaction };
          } catch (error) {
            console.error("[orchestrator] Failed to save transaction:", error);
            finalResponse = `Failed to save transaction: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
          break;
        }
        case "answer_directly": {
          agentUsed = "orchestrator";
          finalResponse = args.response;
          break;
        }
        default: {
          finalResponse =
            responseMessage?.content || "I'm not sure how to help with that.";
        }
      }

      res.json({
        response: finalResponse,
        agent: agentUsed,
        toolUsed: call.function.name,
        actionTaken,
      });
      return;
    }

    // Fallback if no function call
    res.json({
      response:
        responseMessage?.content ||
        "I'm here to help. What would you like to do?",
      agent: "orchestrator",
    });
  } catch (error: unknown) {
    console.error("[orchestrator] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};
