import OpenAI from "openai";

// Lazy-initialize to avoid crash when GEMINI_API_KEY is unset (e.g. tests)
let _client: OpenAI | null = null;

export function getGeminiOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  return _client;
}
