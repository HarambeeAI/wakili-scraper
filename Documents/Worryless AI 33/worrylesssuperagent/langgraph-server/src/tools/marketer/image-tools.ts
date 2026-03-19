// MKT-02 + MKT-03: Image generation and editing tools for Marketer agent
// Uses @google/genai SDK with gemini-2.5-flash-image (Nano Banana 2)

import { GoogleGenAI } from "@google/genai";
import { getPool } from "../shared/db.js";
import type { BrandImageResult, ImageEditResult } from "./types.js";

// Lazy singleton — initialized on first call
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

/**
 * MKT-02: Generates a brand-consistent image using Gemini 2.5 Flash Image (Nano Banana 2).
 * Stores the result in agent_assets for the content library.
 *
 * @param userId - The user's ID
 * @param prompt - Description of the desired image, including brand elements
 * @param aspectRatio - "1:1" (IG square), "4:5" (IG portrait), "16:9" (wide/LinkedIn)
 */
export async function generateBrandImage(
  userId: string,
  prompt: string,
  aspectRatio: string = "1:1",
): Promise<BrandImageResult> {
  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio as "1:1" | "4:5" | "16:9",
      },
    },
  });

  // Extract base64 image data from response
  let base64Data = "";
  let mimeType = "image/png";

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      base64Data = part.inlineData.data!;
      mimeType = part.inlineData.mimeType || "image/png";
      break;
    }
  }

  if (!base64Data) {
    throw new Error("No image data in Gemini response");
  }

  // Store in agent_assets
  const title = `Brand image: ${prompt.slice(0, 80)}`;
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.agent_assets (user_id, agent_type, asset_type, title, content, metadata)
     VALUES ($1, 'marketer', 'image', $2, $3, $4)
     RETURNING id`,
    [userId, title, base64Data, JSON.stringify({ aspectRatio, mimeType, prompt: prompt.slice(0, 200) })],
  );

  return {
    assetId: result.rows[0].id,
    base64Data,
    mimeType,
    title,
    aspectRatio,
  };
}

/**
 * MKT-03: Edits an existing image using Gemini multimodal (base image + text prompt).
 * Retrieves the base image from agent_assets by assetId, sends to Gemini with edit instructions.
 */
export async function editImage(
  userId: string,
  assetId: string,
  editPrompt: string,
): Promise<ImageEditResult> {
  const db = getPool();

  // Fetch the base image from agent_assets
  const assetResult = await db.query<{ content: string; title: string; metadata: Record<string, unknown> }>(
    `SELECT content, title, metadata FROM public.agent_assets
     WHERE id = $1 AND user_id = $2 AND agent_type = 'marketer'`,
    [assetId, userId],
  );

  if (assetResult.rows.length === 0) {
    throw new Error(`Asset ${assetId} not found for user`);
  }

  const baseImage = assetResult.rows[0];
  const baseMimeType = (baseImage.metadata as Record<string, string>)?.mimeType || "image/png";

  const ai = getAIClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: baseImage.content, mimeType: baseMimeType } },
          { text: editPrompt },
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  let base64Data = "";
  let mimeType = "image/png";

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      base64Data = part.inlineData.data!;
      mimeType = part.inlineData.mimeType || "image/png";
      break;
    }
  }

  if (!base64Data) {
    throw new Error("No image data in Gemini edit response");
  }

  // Store edited image as new asset
  const title = `Edited: ${baseImage.title} — ${editPrompt.slice(0, 50)}`;
  const insertResult = await db.query<{ id: string }>(
    `INSERT INTO public.agent_assets (user_id, agent_type, asset_type, title, content, metadata)
     VALUES ($1, 'marketer', 'image', $2, $3, $4)
     RETURNING id`,
    [userId, title, base64Data, JSON.stringify({ mimeType, editPrompt: editPrompt.slice(0, 200), sourceAssetId: assetId })],
  );

  return {
    assetId: insertResult.rows[0].id,
    base64Data,
    mimeType,
    title,
  };
}
