import type { RequestHandler } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getGeminiOpenAI } from "../lib/gemini.js";

const DEFAULT_AGENT_IDS = new Set([
  "chief_of_staff",
  "accountant",
  "marketer",
  "sales_rep",
  "personal_assistant",
]);

export function extractJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

export function filterRecommendations(
  parsed: unknown,
  validIds: Set<string>,
  defaultIds: Set<string>,
): Array<{
  agent_type_id: string;
  reasoning: string;
  first_week_value: string;
}> {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as Record<string, unknown>).recommendations)
  ) {
    return [];
  }
  return (
    (parsed as Record<string, unknown[]>).recommendations as Array<
      Record<string, unknown>
    >
  )
    .filter(
      (r) =>
        r?.agent_type_id &&
        validIds.has(r.agent_type_id as string) &&
        !defaultIds.has(r.agent_type_id as string),
    )
    .map((r) => ({
      agent_type_id: String(r.agent_type_id),
      reasoning: String(r.reasoning || ""),
      first_week_value: String(r.first_week_value || ""),
    }))
    .slice(0, 5);
}

export const spawnAgentTeam: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    // Parse request body
    const { businessName, industry, description, location } = req.body;

    // Fetch full agent catalog
    const { rows: catalog } = await pool.query(
      "SELECT id, display_name, description, skill_config FROM available_agent_types",
    );

    if (!catalog || catalog.length === 0) {
      res.json({ recommendations: [], allAgents: [] });
      return;
    }

    // Build valid additional IDs (catalog IDs not in DEFAULT_AGENT_IDS)
    const validAdditionalIds = new Set(
      catalog
        .map((a) => a.id as string)
        .filter((id) => !DEFAULT_AGENT_IDS.has(id)),
    );
    const validAdditionalIdsList = Array.from(validAdditionalIds).join(", ");

    // Build system prompt constraining output to valid catalog IDs
    const systemPrompt = `You are an AI business advisor that recommends agent types for a new business.
You MUST return a JSON object with exactly this structure -- no markdown, no extra keys:
{
  "recommendations": [
    {
      "agent_type_id": "<id from allowed list>",
      "reasoning": "<why this agent helps this specific business>",
      "first_week_value": "<concrete action this agent takes in week 1>"
    }
  ]
}

STRICT RULES:
1. You MUST only use agent_type_id values from this allowed list: ${validAdditionalIdsList}
2. Recommend 3-5 agents maximum.
3. Return ONLY raw JSON -- no markdown code fences, no explanation outside the JSON.
4. Do NOT include these default agent IDs (they are always pre-selected): chief_of_staff, accountant, marketer, sales_rep, personal_assistant`;

    const userMessage = `Business context:
Name: ${businessName || "Not provided"}
Industry: ${industry || "Not provided"}
Description: ${description || "Not provided"}
Location: ${location || "Not provided"}

Recommend the most valuable additional agents for this business from the allowed list.`;

    // Call LLM
    let safeRecommendations: Array<{
      agent_type_id: string;
      reasoning: string;
      first_week_value: string;
    }> = [];

    try {
      const completion = await getGeminiOpenAI().chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      });

      const rawContent = completion.choices?.[0]?.message?.content || "";
      const cleanedJson = extractJson(rawContent);

      try {
        const parsedLlm = JSON.parse(cleanedJson);
        safeRecommendations = filterRecommendations(
          parsedLlm,
          validAdditionalIds,
          DEFAULT_AGENT_IDS,
        );
      } catch (parseError) {
        console.error(
          "[spawn-agent-team] Failed to parse LLM JSON response:",
          parseError,
        );
      }
    } catch (llmError) {
      console.error("[spawn-agent-team] LLM call error:", llmError);
    }

    const allAgents = catalog.map((a) => ({
      id: a.id,
      display_name: a.display_name,
      description: a.description,
      skill_config: a.skill_config,
    }));

    res.json({ recommendations: safeRecommendations, allAgents });
  } catch (error: unknown) {
    console.error("[spawn-agent-team] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};
