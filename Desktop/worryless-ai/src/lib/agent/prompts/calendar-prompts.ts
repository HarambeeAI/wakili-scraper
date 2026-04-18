export const CALENDAR_GENERATION_SYSTEM_PROMPT = `You are Helena, an expert social media strategist. You are creating a 4-week content calendar for a business.

You will be given:
1. The business profile, brand guidelines, market research, and marketing strategy documents
2. The user's selected platforms and posting frequency
3. Any additional context the user provided

Your job is to create a detailed, strategic content calendar that:
- Follows the content pillar strategy from the marketing strategy document
- Respects the posting frequency the user selected for each platform
- Uses the brand voice and tone from the brand guidelines
- Targets the audience segments identified in market research
- Applies the 80/20 rule: 80% value content (educational, entertaining, inspiring) / 20% promotional
- Varies content formats appropriately for each platform
- Plans content around optimal posting times per platform
- Includes trending and seasonal hooks where relevant
- Builds a coherent narrative across the month

Platform-specific best practices:
- Instagram: Reels for discovery (3-5x/week), Carousels for engagement, Stories for community
- TikTok: Short-form video (15-60s), authentic/raw over polished, trending sounds
- LinkedIn: Carousels/PDF posts drive highest engagement, thought leadership, industry data
- Facebook: Format-agnostic, community engagement, groups content
- X/Twitter: Text posts and threads drive highest engagement, conversations
- YouTube: Shorts for discovery, long-form for authority

Content pillars should be 3-5 categories like:
- Educational (how-tos, tips, industry insights)
- Social proof (testimonials, case studies, results)
- Behind-the-scenes (team, process, culture)
- Entertainment (trending formats, humor, storytelling)
- Promotional (product features, offers, launches)

Respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export const CALENDAR_GENERATION_USER_PROMPT = (context: {
  businessProfile: string;
  brandGuidelines: string;
  marketResearch: string;
  marketingStrategy: string;
  platforms: string[];
  frequency: Record<string, string>;
  additionalContext?: string;
}) => `
## Business Profile
${context.businessProfile.slice(0, 3000)}

## Brand Guidelines
${context.brandGuidelines.slice(0, 2000)}

## Market Research
${context.marketResearch.slice(0, 3000)}

## Marketing Strategy
${context.marketingStrategy.slice(0, 3000)}

## User Preferences
Platforms: ${context.platforms.join(", ")}
Posting frequency: ${JSON.stringify(context.frequency)}
${context.additionalContext ? `Additional context: ${context.additionalContext}` : ""}

## Output Format

Return a JSON object with this exact structure:
{
  "contentPillars": ["Pillar1", "Pillar2", "Pillar3", "Pillar4"],
  "posts": [
    {
      "platform": "instagram",
      "contentFormat": "image_post",
      "scheduledDate": "2026-04-21",
      "scheduledTime": "09:00",
      "caption": "Full caption text with emojis and line breaks as appropriate",
      "hashtags": ["#tag1", "#tag2"],
      "contentPillar": "Educational",
      "weekNumber": 1,
      "dayOfWeek": 1,
      "mediaDescription": "Brief description of what the image/video should depict"
    }
  ]
}

Generate posts for 4 full weeks starting from the next Monday. Use real dates.
Each post MUST have a complete, publish-ready caption (not a placeholder).
Include the correct number of posts per platform per week matching the user's frequency.
mediaDescription should be vivid enough to generate a compelling image or video from.`;

export const CLARIFYING_QUESTIONS = `[
  {
    "id": "platforms",
    "question": "Which social media platforms would you like to post on?",
    "type": "multi_select",
    "options": [
      { "value": "instagram", "label": "Instagram", "recommended": true, "description": "Best for visual brands, reels & carousels" },
      { "value": "tiktok", "label": "TikTok", "recommended": true, "description": "Fastest organic growth, short-form video" },
      { "value": "linkedin", "label": "LinkedIn", "description": "B2B audiences, thought leadership" },
      { "value": "facebook", "label": "Facebook", "description": "Broadest demographics, community building" },
      { "value": "x", "label": "X (Twitter)", "description": "Real-time engagement, threads & conversations" },
      { "value": "youtube", "label": "YouTube", "description": "Long-form authority + Shorts for discovery" }
    ],
    "required": true
  },
  {
    "id": "frequency",
    "question": "How often would you like to post on each platform?",
    "type": "frequency_grid",
    "frequencyOptions": [
      { "value": "3x/week", "label": "3x/week", "description": "Minimum effective" },
      { "value": "5x/week", "label": "5x/week", "recommended": true, "description": "Recommended" },
      { "value": "7x/week", "label": "Daily", "description": "Maximum growth" },
      { "value": "14x/week", "label": "2x/day", "description": "Aggressive growth" }
    ],
    "required": true
  },
  {
    "id": "contentGoals",
    "question": "What are your top content goals?",
    "type": "multi_select",
    "options": [
      { "value": "brand_awareness", "label": "Brand Awareness", "recommended": true },
      { "value": "lead_generation", "label": "Lead Generation" },
      { "value": "community_building", "label": "Community Building" },
      { "value": "thought_leadership", "label": "Thought Leadership" },
      { "value": "product_launches", "label": "Product/Service Promotion" },
      { "value": "traffic", "label": "Website Traffic" }
    ],
    "required": true
  },
  {
    "id": "additionalContext",
    "question": "Anything else Helena should know? (upcoming launches, seasonal events, specific topics to cover)",
    "type": "text",
    "required": false
  }
]`;
