import { Agent } from './Agent.js';
import { GeminiProvider } from './providers/GeminiProvider.js';

/**
 * Factory class for creating agents with agent.js
 */
export class AgentFactory {
  /**
   * Create a new AgentFactory
   * @param {Object} config - Configuration object
   * @param {string} config.defaultProvider - Default LLM provider to use
   * @param {Object} config.apiKeys - API keys for different providers
   */
  constructor(config) {
    this.defaultProvider = config.defaultProvider || 'gemini';
    this.apiKeys = config.apiKeys || {};
    this.tools = {};
  }

  /**
   * Create multiple agents from a configuration object
   * @param {Object} agentsConfig - Object with agent configurations
   * @returns {Object} - Object with created agent instances
   */
  createAgents(agentsConfig) {
    const agents = {};

    for (const [agentId, agentConfig] of Object.entries(agentsConfig)) {
      try {
        agents[agentId] = this.createAgent(agentConfig);
      } catch (error) {
        console.error(`Error creating agent ${agentId}:`, error);
        throw error;
      }
    }

    return agents;
  }

  /**
   * Register a tool that can be used by agents
   * @param {string} toolName - Name of the tool
   * @param {Function} toolFunction - Tool implementation function
   */
  registerTool(toolName, toolFunction) {
    if (typeof toolFunction !== 'function') {
      throw new Error(`Tool must be a function: ${toolName}`);
    }
    this.tools[toolName] = toolFunction;
    console.log(`Tool registered: ${toolName}`);
  }

  /**
   * Create an agent from a JSON configuration
   * @param {Object} agentConfig - Agent configuration
   * @returns {Agent} - Created agent instance
   */
  createAgent(agentConfig) {
    // Ensure the agent has an ID
    if (!agentConfig.id) {
      agentConfig.id = `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    const provider = agentConfig.provider || this.defaultProvider;

    // Try to get API key from the factory config first
    let apiKey = this.apiKeys[provider];

    // If not found, try to get from environment variables
    if (!apiKey) {
      if (provider.toLowerCase() === 'gemini' && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
        console.log('Using GEMINI_API_KEY from environment variables');
      } else if (provider.toLowerCase() === 'openai' && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
        console.log('Using OPENAI_API_KEY from environment variables');
      }
    }

    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}. Please set it in the factory config or as an environment variable.`);
    }

    // Create the appropriate LLM provider based on the provider type
    let llmProvider;
    switch (provider.toLowerCase()) {
      case 'gemini':
        const modelName = agentConfig.llmConfig?.model || 'gemini-2.0-flash-lite';
        llmProvider = new GeminiProvider(apiKey, modelName);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Create the agent configuration with the LLM provider
    const agentWithProvider = {
      ...agentConfig,
      llmProvider,
      llmConfig: agentConfig.llmConfig || {}
    };

    // Add tools to the agent if specified in the configuration
    if (agentConfig.tools) {
      const agentTools = {};

      for (const [toolName, toolRef] of Object.entries(agentConfig.tools)) {
        // If the tool reference is a string, look it up in the registered tools
        if (typeof toolRef === 'string') {
          if (!this.tools[toolRef]) {
            console.warn(`Warning: Tool not found: ${toolRef}`);
            continue;
          }
          agentTools[toolName] = this.tools[toolRef];
        } else if (typeof toolRef === 'function') {
          // If the tool is already a function, use it directly
          agentTools[toolName] = toolRef;
        }
      }

      agentWithProvider.tools = agentTools;
    }

    return new Agent(agentWithProvider);
  }
}
