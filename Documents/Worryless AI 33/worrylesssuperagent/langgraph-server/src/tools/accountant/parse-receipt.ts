// ACCT-04: Parse receipt photo using Gemini multimodal vision.
// Bypasses callLLM because callLLM's messagesToOpenAI() stringifies content arrays,
// which breaks the image_url content format required by the vision model.
// Uses direct fetch to the Lovable AI Gateway with base64-encoded image content.

import type { ParsedReceipt } from "./types.js";

const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function parseReceipt(
  base64Image: string,
  mimeType: string,
  userId: string,
): Promise<ParsedReceipt> {
  // userId reserved for future audit logging / rate limiting
  void userId;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY environment variable is required");

  const response = await fetch(LOVABLE_AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: "text",
              text: 'Extract all transaction details from this receipt. Return ONLY valid JSON with: {"vendor": "string", "amount": number, "currency": "string (3-letter code)", "date": "YYYY-MM-DD", "category": "food|transport|office|utilities|other", "line_items": [{"description": "string", "amount": number}]}',
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Receipt parsing failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let content = data.choices?.[0]?.message?.content ?? "{}";

  // Strip markdown fences if present
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  return JSON.parse(content) as ParsedReceipt;
}
