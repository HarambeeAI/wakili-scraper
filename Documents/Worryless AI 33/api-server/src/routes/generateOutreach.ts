import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getGeminiOpenAI } from "../lib/gemini.js";

// Fetch business knowledge base for a user
async function fetchBusinessKnowledge(userId: string): Promise<string> {
  // Fetch user profile
  const profileRes = await pool.query(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [userId],
  );
  const profile = profileRes.rows[0];

  // Fetch business artifacts
  const artifactsRes = await pool.query(
    `SELECT * FROM business_artifacts WHERE user_id = $1`,
    [userId],
  );
  const artifacts = artifactsRes.rows;

  let knowledgeBase = "\n\n=== MY COMPANY / BUSINESS KNOWLEDGE ===\n";

  if (profile) {
    knowledgeBase += "\n## Business Profile\n";
    if (profile.business_name)
      knowledgeBase += `- Business Name: ${profile.business_name}\n`;
    if (profile.industry) knowledgeBase += `- Industry: ${profile.industry}\n`;
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
    }
  }

  knowledgeBase += "\n=== END BUSINESS KNOWLEDGE ===\n";
  return knowledgeBase;
}

const baseSystemInstruction = `You are an expert B2B sales professional crafting personalized cold outreach emails.

IMPORTANT: You have access to detailed information about MY COMPANY below. Use this to craft compelling value propositions that highlight what WE offer.

Craft a highly personalized cold email following these principles:

1. SUBJECT LINE:
   - Keep under 50 characters
   - Create curiosity without being clickbait
   - Personalize when possible

2. OPENING (First 2 lines):
   - Reference something specific about THEIR company
   - Show you've done your research
   - Avoid generic openers like "I hope this email finds you well"

3. VALUE PROPOSITION:
   - Lead with the outcome/benefit MY COMPANY provides
   - Be specific about the problem WE solve
   - Use details from the Business Knowledge to make it authentic

4. CALL TO ACTION:
   - Single, clear ask
   - Low commitment (15-min call, not 1-hour demo)
   - Suggest specific times if appropriate

5. SIGNATURE:
   - Keep professional but warm
   - Include relevant credentials briefly

CRITICAL RULES:
- Keep total email under 150 words
- Use short paragraphs (2-3 sentences max)
- Sound human, not robotic
- Don't be pushy or desperate
- Avoid jargon and buzzwords
- USE the Business Knowledge to personalize the value proposition

ALWAYS respond with a valid JSON object in this exact format (no markdown, just JSON):
{"subject": "your subject line", "body": "your email body"}`;

export const generateOutreach = async (
  req: AuthedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const { lead } = req.body;

    // Fetch business knowledge if userId is available
    let businessKnowledge = "";
    if (userId) {
      console.log("Fetching business knowledge for user:", userId);
      businessKnowledge = await fetchBusinessKnowledge(userId);
      console.log(
        "Business knowledge loaded:",
        businessKnowledge.length > 0 ? "Yes" : "No",
      );
    }

    const systemInstruction = baseSystemInstruction + businessKnowledge;

    const prompt = `Write a personalized cold outreach email for:

PROSPECT/LEAD Information:
- Company: ${lead.company_name || "Unknown Company"}
- Contact: ${lead.contact_name || "Decision Maker"}
- Industry: ${lead.industry || "Not specified"}
- Website: ${lead.website || "Not provided"}
- Company Size: ${lead.company_size || "Not specified"}
- Location: ${lead.location || "Not specified"}
- Notes: ${lead.notes || "No additional notes"}

Use the MY COMPANY / BUSINESS KNOWLEDGE in your system instructions to craft a compelling email that shows why we're a great fit for them.

Generate the email now. Remember to respond with ONLY a JSON object.`;

    const response = await getGeminiOpenAI().chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1024,
    });

    const responseText = response.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let parsed;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = {
          subject:
            "Quick question about " + (lead.company_name || "your company"),
          body: responseText,
        };
      }
    } else {
      parsed = {
        subject:
          "Quick question about " + (lead.company_name || "your company"),
        body: responseText,
      };
    }

    res.json(parsed);
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
};
