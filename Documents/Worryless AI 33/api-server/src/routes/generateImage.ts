import { RequestHandler } from 'express';
import { generateImageImagen3 } from '../lib/geminiImage.js';

export const generateImage: RequestHandler = async (req, res) => {
  try {
    const { prompt, businessContext } = req.body;

    const enhancedPrompt = businessContext
      ? `Create a professional, eye-catching social media image for: ${prompt}. Brand context: ${businessContext}. Style: modern, clean, engaging, suitable for Instagram. High quality, visually appealing.`
      : `Create a professional, eye-catching social media image for: ${prompt}. Style: modern, clean, engaging, suitable for Instagram. High quality, visually appealing.`;

    console.log('Generating image with prompt:', enhancedPrompt);

    const imageUrl = await generateImageImagen3(enhancedPrompt);

    res.json({ imageUrl, description: '' });
  } catch (error) {
    console.error('Error in generate-image:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
};
