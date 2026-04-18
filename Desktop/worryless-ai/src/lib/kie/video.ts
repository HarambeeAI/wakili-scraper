import { kieClient } from "./client";

interface VideoGenerationParams {
  prompt: string;
  duration?: 5 | 8;
  resolution?: "720p";
  aspectRatio?: "16:9" | "9:16";
  generateAudio?: boolean;
  referenceImage?: string;
}

const PLATFORM_VIDEO_ASPECT: Record<string, "9:16" | "16:9"> = {
  instagram: "9:16",
  tiktok: "9:16",
  youtube: "16:9",
  linkedin: "16:9",
  facebook: "9:16",
  x: "16:9",
};

export function getVideoAspectRatio(platform: string): "9:16" | "16:9" {
  return PLATFORM_VIDEO_ASPECT[platform] || "9:16";
}

export async function generateVideo(params: VideoGenerationParams): Promise<string> {
  const response = await kieClient.request("/v1/videos/generate", {
    model: "veo-3.1-lite",
    prompt: params.prompt,
    duration: params.duration || 5,
    resolution: params.resolution || "720p",
    aspect_ratio: params.aspectRatio || "9:16",
    generate_audio: params.generateAudio ?? false,
    ...(params.referenceImage ? { image: params.referenceImage } : {}),
  });
  if (!response.task_id) throw new Error("No task_id returned from KIE video generation");
  return kieClient.pollForResult(response.task_id, 180_000);
}
