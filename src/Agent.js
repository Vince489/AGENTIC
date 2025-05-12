/**
 * Event System for Agent Framework
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Function to call when the event is emitted
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
    
    // Return unsubscribe function
    return () => this.off(eventName, listener);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event to unsubscribe from
   * @param {Function} listenerToRemove - Listener function to remove
   */
  off(eventName, listenerToRemove) {
    if (!this.events[eventName]) return;
    
    this.events[eventName] = this.events[eventName].filter(
      listener => listener !== listenerToRemove
    );
  }

  /**
   * Emit an event
   * @param {string} eventName - Name of the event to emit
   * @param {*} data - Data to pass to the listeners
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    
    this.events[eventName].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
  }

  /**
   * Subscribe to an event for a single occurrence
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} listener - Function to call when the event is emitted
   */
  once(eventName, listener) {
    const onceWrapper = (data) => {
      listener(data);
      this.off(eventName, onceWrapper);
    };
    return this.on(eventName, onceWrapper);
  }
}

/**
 * Memory System for Agent Framework
 */
class MemoryManager {
  constructor(config = {}) {
    this.conversationHistory = [];
    this.keyValueStore = {};
    this.maxHistoryLength = config.maxHistoryLength || 100;
    this.events = new EventEmitter();
  }

  /**
   * Add an entry to the conversation history
   * @param {Object} entry - Entry to add to history
   */
  addToHistory(entry) {
    this.conversationHistory.push({
      ...entry,
      timestamp: entry.timestamp || new Date()
    });
    
    // Trim history if it exceeds max length
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory.shift();
    }
    
    this.events.emit('historyUpdated', this.conversationHistory);
  }

  /**
   * Get the conversation history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Conversation history
   */
  getHistory(limit = this.maxHistoryLength) {
    return this.conversationHistory.slice(-limit);
  }

  /**
   * Store a value in memory
   * @param {string} key - Key to store the value under
   * @param {*} value - Value to store
   */
  remember(key, value) {
    this.keyValueStore[key] = value;
    this.events.emit('memoryUpdated', { key, value });
  }

  /**
   * Retrieve a value from memory
   * @param {string} key - Key to retrieve
   * @returns {*} - Stored value or undefined
   */
  recall(key) {
    return this.keyValueStore[key];
  }

  /**
   * Clear all memory
   */
  clear() {
    this.conversationHistory = [];
    this.keyValueStore = {};
    this.events.emit('memoryCleared');
  }

  /**
   * Subscribe to memory events
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} listener - Function to call when event is emitted
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    return this.events.on(eventName, listener);
  }
}

/**
 * Interface for an LLM Provider.
 */
class LLMProvider {
  async generateContent(options) {
    throw new Error("Subclasses must implement generateContent.");
  }
}

/**
 * Base Agent (Composable with LLM Provider, Tool Handler, and Event System).
 */
export class Agent {
  constructor(config) {
    if (!config.id || !config.name || !config.description || !config.role || !config.llmProvider) {
      throw new Error("Agent configuration must include id, name, description, role, and llmProvider.");
    }
    
    // Core properties
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.role = config.role;
    this.tools = config.tools || {};
    
    // LLM configuration
    this.llmConfig = {
      temperature: 0.7,
      maxOutputTokens: 1024,
      ...config.llmConfig,
    };
    this.llmProvider = config.llmProvider;
    
    // Component systems
    this.toolHandler = config.toolHandler
    this.memory = config.memoryManager || new MemoryManager(config.memoryConfig);
    this.events = new EventEmitter();
    
    // Context for current operation
    this.context = {};
    this.status = 'idle';
    
    // Formatter functions
    this.inputFormatter = config.inputFormatter || ((input) => [{ role: "user", parts: [{ text: String(input) }] }]);
    this.toolResultFormatter = config.toolResultFormatter || ((toolName, toolParams, toolResult) => {
      let formatted = `\n\n### Result of ${toolName}("${toolParams}"):\n\n`;
      if (Array.isArray(toolResult)) {
        formatted += toolResult.map(item => `- ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n');
      } else if (typeof toolResult === 'object') {
        formatted += JSON.stringify(toolResult, null, 2);
      } else {
        formatted += String(toolResult);
      }
      formatted += '\n\n';
      return formatted;
    });
  }

  /**
   * Get the agent's current status.
   * @returns {string} - The agent's status.
   */
  getStatus() {
    return this.status;
  }

  /**
   * Set the agent's status and emit a status change event.
   * @param {string} newStatus - The new status for the agent.
   */
  setStatus(newStatus) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.events.emit('statusChanged', { 
      agent: this.id, 
      oldStatus, 
      newStatus,
      timestamp: new Date()
    });
  }

  /**
   * Add a tool to the agent and emit a tool added event.
   * @param {string} name - Tool name.
   * @param {Function} tool - Tool function.
   */
  addTool(name, tool) {
    this.tools[name] = tool;
    this.events.emit('toolAdded', { agent: this.id, toolName: name });
  }

  /**
   * Get the available tools for the agent.
   * @returns {Object} - An object containing the agent's tools.
   */
  getTools() {
    return this.tools;
  }

  /**
   * Subscribe to agent events.
   * @param {string} eventName - Event name to subscribe to.
   * @param {Function} listener - Function to call when event is emitted.
   * @returns {Function} - Unsubscribe function.
   */
  on(eventName, listener) {
    return this.events.on(eventName, listener);
  }

  /**
   * Run the agent with a specific input.
   * @param {*} input - Input for the agent to process.
   * @param {Object} [context={}] - Additional context for the agent's operation.
   * @returns {Promise<*>} - Agent's response.
   */
  async run(input, context = {}) {
    if (!this.llmProvider) {
      throw new Error(`Agent ${this.name} has no LLM provider.`);
    }

    this.context = { ...this.context, ...context };
    this.setStatus('working');
    this.events.emit('runStarted', { 
      agent: this.id, 
      input, 
      context: this.context,
      timestamp: new Date()
    });

    try {
      // Format input and call LLM
      const formattedInput = await this.inputFormatter(input, this.tools);
      this.events.emit('inputFormatted', { agent: this.id, formattedInput });
      
      const llmResponse = await this.llmProvider.generateContent({
        contents: formattedInput,
        systemInstruction: this.role,
        temperature: this.llmConfig.temperature,
        maxOutputTokens: this.llmConfig.maxOutputTokens,
        ...this.llmProviderSpecificConfig(),
      });
      this.events.emit('llmResponseReceived', { agent: this.id, llmResponse });
      
      // Process response and handle tool calls
      // The LLM provider should return the text directly
      let processedResponse = llmResponse; 
      this.events.emit('responseProcessed', { agent: this.id, processedResponse });

      if (Object.keys(this.tools).length > 0 && this.toolHandler) {
        processedResponse = await this.toolHandler.handleToolCalls(
          processedResponse, // Pass the text directly
          this.tools,
          async (toolName, params) => {
            this.events.emit('toolCalled', { agent: this.id, toolName, params });
            let result;
            if (typeof this.tools[toolName]?.execute === 'function') {
              // If the tool is an object with an execute method, call it
              result = await this.tools[toolName].execute(params);
            } else if (typeof this.tools[toolName] === 'function') {
              // If the tool is a function, call it directly
              result = await this.tools[toolName](params);
            } else {
              throw new Error(`Tool "${toolName}" is not a function or an object with an execute method.`);
            }
            this.events.emit('toolCompleted', { agent: this.id, toolName, params, result });
            return result;
          },
          this.toolResultFormatter
        );
        this.events.emit('toolCallsHandled', { agent: this.id, processedResponse });
      }

      // Store in memory and return
      this.memory.addToHistory({ input, response: processedResponse, timestamp: new Date() });
      this.setStatus('idle');
      
      this.events.emit('runCompleted', { 
        agent: this.id, 
        input, 
        response: processedResponse,
        timestamp: new Date()
      });
      
      return processedResponse;
    } catch (error) {
      this.setStatus('error');
      this.events.emit('runError', { 
        agent: this.id, 
        input, 
        error: error.message,
        timestamp: new Date()
      });
      console.error(`Agent ${this.name} encountered an error:`, error);
      throw error;
    }
  }

  /**
   * Optional method to provide LLM provider-specific configuration.
   * @returns {Object} - Provider-specific configuration.
   */
  llmProviderSpecificConfig() {
    return {};
  }

  /**
   * Set the agent's persona/reasoning style
   * @param {string} persona - Persona identifier
   */
  setPersona(persona) {
    const personaTemplates = {
      strategist: "You are a strategic thinker who excels at long-term planning and identifying key leverage points. Consider multiple approaches before deciding on the optimal path forward.",
      analyst: "You are a detail-oriented analyst who excels at breaking down complex problems into manageable components. Focus on data and evidence-based reasoning.",
      creative: "You are an innovative thinker who excels at generating novel solutions. Don't be constrained by conventional approaches.",
      // Add more personas as needed
    };
    
    if (!personaTemplates[persona]) {
      throw new Error(`Unknown persona: ${persona}`);
    }
    
    // Enhance the agent's role with the persona
    this.role = `${this.role}\n\n${personaTemplates[persona]}`;
    this.persona = persona;
    
    return this;
  }
}

// Export all classes
export { EventEmitter, MemoryManager, LLMProvider };
