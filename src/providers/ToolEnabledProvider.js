import { enhancePromptWithTools, processToolCalls } from '../tools/index.js';

/**
 * Provider wrapper that adds tool support to any LLM provider
 */
export class ToolEnabledProvider {
  /**
   * Create a new tool-enabled provider
   * @param {Object} baseProvider - Base LLM provider to wrap
   * @param {Object} tools - Tools to make available
   */
  constructor(baseProvider, tools = {}) {
    this.baseProvider = baseProvider;
    this.tools = tools;
  }
  
  /**
   * Generate content with tool support
   * @param {Object} params - Generation parameters
   * @returns {Promise<string>} - Generated content with tool results
   */
  async generateContent(params) {
    // Add tool instructions to the prompt
    const enhancedPrompt = enhancePromptWithTools(params.contents, this.tools);
    
    // Call the base provider with the enhanced prompt
    const response = await this.baseProvider.generateContent({
      ...params,
      contents: enhancedPrompt
    });
    
    // Process tool calls in the response
    const processedResponse = await processToolCalls(response, this.tools);
    
    return processedResponse;
  }
}