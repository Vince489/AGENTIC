import { GoogleGenAI } from '@google/genai';

/**
 * GeminiProvider class for generating content using Google's Gemini API
 */
export class GeminiProvider {
  /**
   * Create a new Gemini provider
   * @param {string} apiKey - Gemini API key
   * @param {string} modelName - Model name to use (default: 'gemini-2.0-flash-lite')
   */
  constructor(apiKey, modelName = 'gemini-2.0-flash-lite') {
    this.genAI = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  /**
   * Generate content using Gemini
   * @param {Object} prompt - Formatted prompt for the LLM
   * @returns {Promise<string>} - LLM response
   */
  async generateContent(prompt) {
    try {
      // Implement retry with backoff logic
      return await this.retryWithBackoff(async () => {
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt.contents,
          config: {
            temperature: prompt.temperature || 0.7,
            topP: prompt.topP || 0.95,
            topK: prompt.topK || 40,
            maxOutputTokens: prompt.maxOutputTokens || 1024,
            systemInstruction: prompt.systemInstruction
          }
        });
        
        // Access the text content from the response structure
        return response.candidates[0].content.parts[0].text;
      });
    } catch (error) {
      console.error('Error calling Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate content with streaming response
   * @param {Object} prompt - Formatted prompt for the LLM
   * @param {Function} onChunk - Callback for each chunk of the response
   * @returns {Promise<string>} - Complete LLM response
   */
  async generateContentStream(prompt, onChunk) {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await this.genAI.models.generateContentStream({
          model: this.modelName,
          contents: prompt.contents,
          config: {
            temperature: prompt.temperature || 0.7,
            topP: prompt.topP || 0.95,
            topK: prompt.topK || 40,
            maxOutputTokens: prompt.maxOutputTokens || 1024,
            systemInstruction: prompt.systemInstruction
          }
        });
        
        let fullResponse = '';
        
        for await (const chunk of response) {
          if (chunk.text) {
            fullResponse += chunk.text;
            if (onChunk) {
              onChunk(chunk.text);
            }
          }
        }
        
        return fullResponse;
      });
    } catch (error) {
      console.error('Error calling Gemini stream:', error);
      throw error;
    }
  }

  /**
   * Helper function to implement retry with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} initialDelay - Initial delay in milliseconds
   * @returns {Promise<any>} - Result of the operation
   */
  async retryWithBackoff(operation, maxRetries = 5, initialDelay = 1000) {
    let retries = 0;
    let delay = initialDelay;

    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        // Check if this is a server overload error
        const isOverloaded =
          error.message?.includes('UNAVAILABLE') ||
          error.message?.includes('overloaded') ||
          error.message?.includes('503') ||
          (error.status === 503);

        // If it's not an overload error or we've used all retries, throw
        if (!isOverloaded || retries >= maxRetries - 1) {
          throw error;
        }

        // Increment retry counter
        retries++;

        // Log the retry attempt
        console.log(`Model overloaded. Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);

        // Wait for the delay period
        await new Promise(resolve => setTimeout(resolve, delay));

        // Exponential backoff with jitter
        delay = Math.min(delay * 2, 30000) * (0.8 + Math.random() * 0.4);
      }
    }
  }
}
