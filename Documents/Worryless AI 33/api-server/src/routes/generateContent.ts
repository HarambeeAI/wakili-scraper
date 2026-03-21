import { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { geminiOpenAI } from '../lib/gemini.js';
import { generateImageImagen3 } from '../lib/geminiImage.js';
import { pool } from '../db/pool.js';

const platformPrompts: Record<string, string> = {
  instagram: `You are an expert Instagram content creator. Create an engaging Instagram post about the following topic.

Requirements:
- Start with a hook that stops the scroll
- Provide genuine value or insight
- Use line breaks for readability
- End with a clear call-to-action
- Include 5-7 relevant hashtags at the end
- Keep the tone authentic and relatable
- Optimal length: 150-300 words

Format your response as the complete post caption, ready to copy and paste.`,

  twitter: `You are an expert Twitter/X content creator. Create an engaging tweet about the following topic.

Requirements:
- Hook readers in the first line
- Be concise but impactful (under 280 characters for main tweet)
- Use thread format if needed (separate with ---)
- Include 1-3 relevant hashtags
- End with engagement prompt

Format your response as the complete tweet(s), ready to post.`,

  linkedin: `You are an expert LinkedIn content creator. Create a professional LinkedIn post about the following topic.

Requirements:
- Start with a compelling hook
- Share insights or lessons learned
- Use short paragraphs and line breaks
- Include a personal perspective or story
- End with a thought-provoking question
- Keep professional but conversational
- 3-5 relevant hashtags at the end

Format your response as the complete post, ready to publish.`,

  default: `You are an expert social media content creator. Create engaging content about the following topic.

Requirements:
- Start with an attention-grabbing hook
- Provide value to the reader
- Include a clear call-to-action
- Add 5-7 relevant hashtags
- Keep the tone engaging and authentic

Format your response as the complete post, ready to use.`,
};

async function saveAsset(
  userId: string,
  assetData: {
    agentType: string;
    assetType: string;
    title: string;
    content?: string;
    fileUrl?: string;
    metadata?: Record<string, unknown>;
    relatedPostId?: string;
    relatedTaskId?: string;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO agent_assets (user_id, agent_type, asset_type, title, content, file_url, metadata, related_post_id, related_task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        assetData.agentType,
        assetData.assetType,
        assetData.title,
        assetData.content || null,
        assetData.fileUrl || null,
        JSON.stringify(assetData.metadata || {}),
        assetData.relatedPostId || null,
        assetData.relatedTaskId || null,
      ],
    );
    console.log('Asset saved successfully:', assetData.title);
  } catch (error) {
    console.error('Failed to save asset:', error);
  }
}

export const generateContent: RequestHandler = async (req, res) => {
  try {
    const { topic, platform = 'instagram', businessContext, generateImageForPost = true, taskId } = req.body;
    const userId = (req as AuthedRequest).auth!.userId;

    // Build system instruction
    let systemInstruction = platformPrompts[platform] || platformPrompts.default;

    if (businessContext) {
      systemInstruction = `Business Context:\n${businessContext}\n\n${systemInstruction}\n\nMake sure the content aligns with the business context and brand voice.`;
    }

    // Generate content using Gemini OpenAI-compat endpoint
    console.log('Generating content for topic:', topic);

    const completion = await geminiOpenAI.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `Create a ${platform} post about: ${topic}` },
      ],
      temperature: 0.8,
      max_tokens: 1024,
    });

    const content = completion.choices?.[0]?.message?.content || 'No content generated';

    // Automatically generate image for visual platforms
    let imageUrl: string | null = null;
    if (generateImageForPost && ['instagram', 'default'].includes(platform)) {
      console.log('Auto-generating image for post...');
      try {
        const enhancedPrompt = businessContext
          ? `Create a professional, eye-catching social media image for: ${topic}. Brand context: ${businessContext}. Style: modern, clean, engaging, suitable for Instagram. High quality, visually appealing.`
          : `Create a professional, eye-catching social media image for: ${topic}. Style: modern, clean, engaging, suitable for Instagram. High quality, visually appealing.`;
        imageUrl = await generateImageImagen3(enhancedPrompt);
      } catch (imgErr) {
        console.error('Image generation failed:', imgErr);
        imageUrl = null;
      }
    }

    // Save generated assets
    await saveAsset(userId, {
      agentType: 'marketer',
      assetType: 'post',
      title: `${platform} post: ${(topic as string).substring(0, 50)}...`,
      content,
      metadata: {
        platform,
        topic,
        generatedAt: new Date().toISOString(),
        hasImage: !!imageUrl,
      },
      relatedTaskId: taskId,
    });

    if (imageUrl) {
      await saveAsset(userId, {
        agentType: 'marketer',
        assetType: 'image',
        title: `Image for: ${(topic as string).substring(0, 50)}...`,
        fileUrl: imageUrl,
        metadata: {
          platform,
          topic,
          generatedAt: new Date().toISOString(),
          imageType: 'social_media_visual',
        },
        relatedTaskId: taskId,
      });
    }

    res.json({ content, platform, imageUrl });
  } catch (error) {
    console.error('Error in generate-content:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
};
