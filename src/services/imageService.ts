import { GoogleGenAI } from '@google/genai';
import localforage from 'localforage';

// Initialize localforage
localforage.config({
  name: 'UbrainLuckyFlip',
  storeName: 'generated_images'
});

const STYLE_PROMPT = "Hand-drawn, thick bold black lines, black and white line art, simple sketch, humorous cartoon style, minimal shading, white background.";

export const IMAGE_PROMPTS: Record<string, string> = {
  'icon_bulb_v3': `A hand-drawn black and white sketch of a lightbulb. ${STYLE_PROMPT}`,
  'icon_megaphone_v3': `A hand-drawn black and white sketch of a megaphone. ${STYLE_PROMPT}`,
  'icon_target_v3': `A hand-drawn black and white sketch of a target with an arrow. ${STYLE_PROMPT}`,
  'icon_chat_v3': `A hand-drawn black and white sketch of a chat bubble. ${STYLE_PROMPT}`,
  'icon_smile_v3': `A hand-drawn black and white sketch of a smiling face. ${STYLE_PROMPT}`,
  'icon_star_v3': `A hand-drawn black and white sketch of a star. ${STYLE_PROMPT}`,
  'icon_coffee_v3': `A hand-drawn black and white sketch of a coffee cup. ${STYLE_PROMPT}`,
  'icon_fish_v3': `A hand-drawn black and white sketch of a fish. ${STYLE_PROMPT}`,
  'lose_image_v3': `A hand-drawn black and white sketch of a funny, slightly cynical fat cat sitting in a bathroom sink, looking blankly. Humorous cartoon style, thick bold black lines, simple line art, white background.`,
  'win_image_v3': `A hand-drawn black and white sketch of a funny fat cat jumping for joy with a trophy. Humorous cartoon style, thick bold black lines, simple line art, white background.`,
  'voucher_outback_v3': `A realistic, high-quality gift certificate design for "Outback Steakhouse" with the text "200,000 KRW" prominently displayed. Professional, elegant design, full color, photorealistic.`
};

export async function getOrGenerateImage(key: string, prompt: string): Promise<string> {
  try {
    const cached = await localforage.getItem<string>(key);
    if (cached) {
      return cached;
    }

    // Use the API key injected by Vite (API_KEY is for selected key, GEMINI_API_KEY is fallback)
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("No API key available to generate image:", key);
      return '';
    }

    // Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey });

    console.log(`Generating image for ${key}...`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      // Note: imageConfig is not supported for gemini-2.5-flash-image
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const dataUrl = `data:${part.inlineData.mimeType};base64,${base64Data}`;
        await localforage.setItem(key, dataUrl);
        return dataUrl;
      }
    }
    
    throw new Error(`No image data returned for ${key}`);
  } catch (error: any) {
    console.error(`Error generating image ${key}:`, error);
    // Rethrow permission errors so the UI can prompt for API key selection
    if (error?.message?.includes('Requested entity was not found') || error?.message?.includes('403') || error?.message?.includes('PERMISSION_DENIED')) {
      throw error;
    }
    return '';
  }
}

export async function preloadAllImages(onProgress: (loaded: number, total: number) => void): Promise<Record<string, string>> {
  const keys = Object.keys(IMAGE_PROMPTS);
  const total = keys.length;
  let loaded = 0;
  const results: Record<string, string> = {};

  // Generate sequentially or in small batches to avoid rate limits
  for (const key of keys) {
    results[key] = await getOrGenerateImage(key, IMAGE_PROMPTS[key]);
    loaded++;
    onProgress(loaded, total);
  }

  return results;
}
