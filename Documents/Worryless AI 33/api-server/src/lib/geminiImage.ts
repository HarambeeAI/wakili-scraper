import { GoogleGenAI } from "@google/genai";

// Lazy-initialize to avoid crash when GEMINI_API_KEY is unset (e.g. tests)
let _genai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genai)
    _genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _genai;
}

export async function generateImageImagen3(prompt: string): Promise<string> {
  const response = await getGenAI().models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt,
    config: { numberOfImages: 1, outputMimeType: "image/png" },
  });
  const b64 = response.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) throw new Error("No image returned from Imagen 3");
  return `data:image/png;base64,${b64}`;
}
