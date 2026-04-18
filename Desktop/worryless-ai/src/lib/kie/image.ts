import { kieClient } from "./client";

interface ImageGenerationParams {
  prompt: string;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "4:3";
  resolution?: "1K" | "2K";
  referenceImages?: string[];
}

const PLATFORM_ASPECT_RATIOS: Record<string, string> = {
  instagram_feed: "4:5",
  instagram_story: "9:16",
  instagram_reel: "9:16",
  tiktok: "9:16",
  linkedin: "16:9",
  facebook: "1:1",
  x: "16:9",
  youtube: "16:9",
};

export function getAspectRatio(platform: string, format: string): ImageGenerationParams["aspectRatio"] {
  const key = `${platform}_${format}`;
  return (PLATFORM_ASPECT_RATIOS[key] || PLATFORM_ASPECT_RATIOS[platform] || "1:1") as ImageGenerationParams["aspectRatio"];
}

export async function generateImage(params: ImageGenerationParams): Promise<string> {
  const response = await kieClient.request("/v1/images/generate", {
    model: "nano-banana-pro",
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || "1:1",
    resolution: params.resolution || "1K",
    ...(params.referenceImages?.length ? { reference_images: params.referenceImages } : {}),
  });
  if (!response.task_id) throw new Error("No task_id returned from KIE image generation");
  return kieClient.pollForResult(response.task_id, 60_000);
}
