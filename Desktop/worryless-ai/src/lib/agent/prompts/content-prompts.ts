export function buildImageGenerationPrompt(params: {
  caption: string;
  platform: string;
  contentPillar: string;
  contentFormat: string;
  brandColors: string[];
  brandFonts: string[];
  brandPersonality: string;
  businessName: string;
  businessType: string;
  mediaDescription: string;
}): string {
  const { platform, contentPillar, contentFormat, brandColors, brandPersonality, businessName, businessType, mediaDescription } = params;

  const platformContext: Record<string, string> = {
    instagram: "designed for Instagram feed with eye-catching visual impact and clear focal point",
    tiktok: "designed as a TikTok cover image that stops scrolling, bold and dynamic",
    linkedin: "designed for LinkedIn with professional, clean aesthetic and data-driven feel",
    facebook: "designed for Facebook feed, warm and approachable, community-oriented",
    x: "designed for X/Twitter, punchy and attention-grabbing, works at small thumbnail size",
    youtube: "designed as a YouTube thumbnail with high contrast, readable text, expressive composition",
  };

  let prompt = `A stunning, professional social media graphic for ${businessName}, a ${businessType} brand. `;
  prompt += `${mediaDescription}. `;
  prompt += `${platformContext[platform] || "designed for social media"}. `;
  prompt += `The brand personality is ${brandPersonality}. Content theme: ${contentPillar}. `;
  if (brandColors.length > 0) prompt += `Use these brand colors prominently: ${brandColors.slice(0, 3).join(", ")}. `;
  if (contentFormat === "carousel") prompt += `This is a single carousel slide -- clean layout with one key point, ample white space. `;
  prompt += `High-quality, editorial feel. Sharp focus, balanced composition, professional lighting. `;
  prompt += `No watermarks, no stock photo aesthetic, no generic clip art. Modern, polished, scroll-stopping quality.`;
  return prompt;
}

export function buildVideoGenerationPrompt(params: {
  caption: string;
  platform: string;
  contentPillar: string;
  brandPersonality: string;
  businessName: string;
  businessType: string;
  mediaDescription: string;
}): string {
  const { platform, contentPillar, brandPersonality, businessName, businessType, mediaDescription } = params;
  const isVertical = ["instagram", "tiktok"].includes(platform);
  const cameraStyle = isVertical
    ? "Vertical framing, slight handheld movement for authenticity, smooth dolly-in"
    : "Landscape cinematic framing, slow steady pan or static wide shot";

  let prompt = `${mediaDescription}. `;
  prompt += `A short video clip for ${businessName}, a ${businessType} brand with ${brandPersonality} personality. `;
  prompt += `Content theme: ${contentPillar}. ${cameraStyle}. `;
  prompt += `Professional, cinematic lighting with soft natural tones. `;
  prompt += `Clean, modern aesthetic -- no text overlays, no watermarks. `;
  prompt += `The scene should feel authentic and premium, not stock-footage generic.`;
  return prompt;
}

export const CAPTION_REFINEMENT_PROMPT = `You are Helena, an expert social media copywriter.
Refine this caption to be publish-ready for the specified platform.

Rules:
- Match the brand voice exactly (provided in brand guidelines)
- Platform-appropriate length (Instagram: 150-300 chars optimal, LinkedIn: up to 1300, TikTok: 80-150, X: under 280)
- Include a strong hook in the first line
- Add a clear CTA
- Use line breaks for readability
- Hashtags: 5-10 for Instagram, 3-5 for LinkedIn, 2-3 for TikTok, 1-2 for X
- Emojis: moderate for Instagram/TikTok, minimal for LinkedIn, none for X`;
