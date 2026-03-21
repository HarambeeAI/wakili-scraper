import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_MODEL = "gemini-2.0-flash";

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
}

// Convert LangChain messages to OpenAI-format messages for the gateway
function messagesToOpenAI(
  messages: BaseMessage[],
): Array<{ role: string; content: string }> {
  return messages.map((msg) => {
    let role = "user";
    if (msg instanceof SystemMessage || msg._getType() === "system")
      role = "system";
    else if (msg instanceof AIMessage || msg._getType() === "ai")
      role = "assistant";
    else if (msg instanceof HumanMessage || msg._getType() === "human")
      role = "user";
    return {
      role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    };
  });
}

// Core LLM call — sends messages to Gemini OpenAI-compatible endpoint, returns text + token count
export async function callLLM(
  messages: BaseMessage[],
  options: LLMCallOptions = {},
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const openAIMessages = messagesToOpenAI(messages);

  // Prepend system prompt if provided and not already in messages
  if (
    options.systemPrompt &&
    !openAIMessages.some((m) => m.role === "system")
  ) {
    openAIMessages.unshift({ role: "system", content: options.systemPrompt });
  }

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages: openAIMessages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  const response = await fetch(GEMINI_OPENAI_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM call failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed =
    (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

  return { content, tokensUsed };
}

// Structured output variant — asks LLM to return JSON matching a schema description
export async function callLLMWithStructuredOutput<T = Record<string, unknown>>(
  messages: BaseMessage[],
  schemaDescription: string,
  options: LLMCallOptions = {},
): Promise<{ data: T; tokensUsed: number }> {
  const systemAddendum = `\n\nYou MUST respond with valid JSON matching this schema:\n${schemaDescription}\n\nRespond ONLY with the JSON object, no markdown fences, no explanation.`;

  const effectiveSystemPrompt = (options.systemPrompt ?? "") + systemAddendum;
  const result = await callLLM(messages, {
    ...options,
    systemPrompt: effectiveSystemPrompt,
  });

  // Parse JSON from response, stripping markdown fences if present
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const data = JSON.parse(jsonStr) as T;
  return { data, tokensUsed: result.tokensUsed };
}
