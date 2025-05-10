import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

// Ensure the GEMINI_API_KEY is loaded from .env
// (User should ensure dotenv is configured in the main application, e.g., require('dotenv').config();)
const apiKey = process.env.GEMINI_API_KEY;

const DEFAULT_MODEL_NAME = "gemini-1.5-flash-latest"; // Or "gemini-2.0-flash-preview-image-generation" if specifically for that
const DEFAULT_OUTPUT_DIR = "generated_images";

/**
 * Generates an image based on a textual prompt using Google Gemini API.
 * @param {string} prompt - The text description for the image.
 * @param {string} [outputFilename] - Optional. The desired filename for the saved image (e.g., "pig_with_wings.png").
 *                                    If not provided, a timestamped name will be used.
 * @param {string} [outputDirectoryRelPath] - Optional. Relative path to the directory to save the image.
 *                                            Defaults to "generated_images/" at the project root.
 * @returns {Promise<string>} - A promise that resolves with the path to the saved image file.
 * @throws {Error} - If API key is missing, API call fails, or file system operations fail.
 */
async function generateImage(prompt, outputFilename, outputDirectoryRelPath) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL_NAME,
    // safetySettings: [ // Optional: configure safety settings if needed
    //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    // ],
  });

  console.log(`Generating image for prompt: "${prompt}"`);

  try {
    // For image generation, the prompt itself is the content.
    // The example provided used `generateContent` with `contents` as a string
    // and `responseModalities`. Let's adapt that.
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }], // Standard way to provide prompt
        generationConfig: {
            responseMimeType: "image/png", // Request image directly
        },
        // The example used `responseModalities` with an older model.
        // For newer models, directly requesting `image/png` in `responseMimeType` is preferred.
        // If using a model that requires `responseModalities`:
        // config: {
        //   responseModalities: [Modality.IMAGE], // Or [Modality.TEXT, Modality.IMAGE]
        // },
    });
    
    // In the direct image generation flow, the image data might be directly in the first part.
    // This depends on the exact model and API version.
    // The provided example `gemini-2.0-flash-preview-image-generation` might have a different response structure.
    // Let's assume the response structure from the Gemini API for direct image generation.
    // Typically, the image data is base64 encoded in `inlineData`.

    const response = result.response;
    const imagePart = response.candidates[0].content.parts.find(part => part.inlineData && part.inlineData.mimeType === 'image/png');

    if (!imagePart || !imagePart.inlineData) {
        // Fallback or error if text part is present instead of image
        const textPart = response.candidates[0].content.parts.find(part => part.text);
        if (textPart) {
            console.error("API returned text instead of an image:", textPart.text);
            throw new Error(`Image generation failed. API response: ${textPart.text}`);
        }
        throw new Error("Image generation failed. No image data found in the API response.");
    }

    const imageData = imagePart.inlineData.data;
    const buffer = Buffer.from(imageData, "base64");

    // Determine output path
    const outputDir = path.resolve(process.cwd(), outputDirectoryRelPath || DEFAULT_OUTPUT_DIR);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    const finalFilename = outputFilename || `generated_image_${Date.now()}.png`;
    const outputPath = path.join(outputDir, finalFilename);

    fs.writeFileSync(outputPath, buffer);
    console.log(`Image saved as ${outputPath}`);
    return outputPath;

  } catch (error) {
    console.error("Error generating image:", error);
    if (error.message.includes("API key not valid")) {
        throw new Error("Image generation failed: Invalid API key. Please check your GEMINI_API_KEY.");
    }
    if (error.message.includes("quota")) {
        throw new Error("Image generation failed: API quota exceeded.");
    }
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

// Example usage (for testing directly, comment out when used as a module)

async function main() {
  try {
    // Ensure you have a .env file with GEMINI_API_KEY or set it in your environment
    // require('dotenv').config({ path: path.resolve(process.cwd(), '.env') }); 
    
    const imagePath = await generateImage(
      "A whimsical cat astronaut floating in a neon-lit galaxy, digital art",
      "cat_astronaut.png"
    );
    console.log("Test image generated at:", imagePath);

    const imagePath2 = await generateImage(
      "A serene landscape with a crystal clear lake and snow-capped mountains at sunset"
    );
    console.log("Test image 2 generated at:", imagePath2);

  } catch (e) {
    console.error("Test failed:", e.message);
  }
}

if (process.env.NODE_ENV === 'test_image_gen') { // Simple flag to run test
    // To run this test:
    // 1. Ensure .env file has GEMINI_API_KEY
    // 2. Run: NODE_ENV=test_image_gen node tools/imageGenerator.js
    // Make sure your .env file is in the root of the project (c:/Users/Vince/Documents/augment-projects/Agentic)
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env') }); 
    main();
}


export { generateImage };
