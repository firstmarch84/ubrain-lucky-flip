import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function generateAndSave(prompt: string, filename: string) {
  console.log(`Generating ${filename}...`);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(process.cwd(), 'public', filename), buffer);
        console.log(`Saved ${filename}`);
        return;
      }
    }
    console.log(`No image data found for ${filename}`);
  } catch (e) {
    console.error(`Failed to generate ${filename}:`, e);
  }
}

async function main() {
  const stylePrompt = "3D icon style, soft, rounded, glossy, pastel gradient, isometric view. Colors: Deep Navy Blue (#253585) and Gold/Yellow (#ffcc00). Clean white background.";
  
  await generateAndSave(`A lightbulb. ${stylePrompt}`, "icon_bulb.png");
  await generateAndSave(`A megaphone. ${stylePrompt}`, "icon_megaphone.png");
  await generateAndSave(`A target with an arrow. ${stylePrompt}`, "icon_target.png");
  await generateAndSave(`A chat bubble. ${stylePrompt}`, "icon_chat.png");
  
  await generateAndSave(`A humorous 3D illustration of a cute, sad character politely handing over a gift box to someone else. Soft, rounded, glossy 3D style. Colors: Deep Navy Blue and Gold. Clean white background.`, "lose_image.png");
  
  await generateAndSave(`A humorous 3D illustration of a cute character jumping for joy, holding a large golden trophy with confetti falling. Soft, rounded, glossy 3D style. Colors: Deep Navy Blue and Gold. Clean white background.`, "win_image.png");
  
  await generateAndSave(`A realistic, high-quality gift certificate design for "Outback Steakhouse" with the text "200,000 KRW" prominently displayed. Professional, elegant design.`, "voucher_outback.png");
}

main();
