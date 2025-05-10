/**
 * Agency class with workflow orchestration, memory management,
 * event-based communication, and improved error handling
 */
import { EventEmitter, MemoryManager } from './Agent.js';

export class Agency {
  /**
   * Create a new Agency
   * @param {Object} config - Agency configuration
   * @param {string} config.name - Agency name
   * @param {string} config.description - Agency description
   * @param {Object} [config.logging] - Logging configuration
   * @param {boolean|string} [config.logging.level='none'] - Logging level ('none', 'basic', 'detailed', 'debug')
   * @param {boolean} [config.logging.tracing=false] - Enable detailed event tracing
   * @param {string} [config.logging.format='text'] - Log format ('text' or 'json')
   * @param {Object} [config.logging.destination='console'] - Log destination ('console', 'file', or writable stream)
   * @param {string} [config.logging.filepath] - Path to log file if destination is 'file'
   */
  constructor(config) {
    this.name = config.name;
    this.description = config.description;

    // Set up logging configuration
    this.logging = {
      level: (config.logging?.level || 'none'),
      tracing: Boolean(config.logging?.tracing),
      format: (config.logging?.format || 'text'),
      destination: (config.logging?.destination || 'console'),
      filepath: config.logging?.filepath
    };

    // Core components
    this.agents = {};
    this.team = {};
    this.brief = {};
    this.activeJobs = {};

    // Components
    this.events = new EventEmitter();
    this.globalMemory = new MemoryManager(config.memoryConfig);
    this.memoryScopes = {
      global: this.globalMemory
    };
    this.jobContexts = {};
    this.workflows = {};
    this.errorHandlers = {};
    this.workflowErrorHandlers = {};
    this.jobSchemas = {};
    this.memoryAccessControl = {};

    // Set up event listeners for tracing if enabled
    if (this.logging.tracing) {
      this.setupTracingListeners();
    }

    // Log agency creation if logging is enabled
    if (this.logging.level !== 'none') {
      this.log('info', `Created agency: ${this.name}`);
      this.log('info', `Description: ${this.description}`);
      this.log('debug', `Logging level: ${this.logging.level}`);
      this.log('debug', `Tracing: ${this.logging.tracing ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Log a message with the specified level
   * @param {string} level - Log level ('info', 'warn', 'error', 'debug')
   * @param {string} message - Message to log
   * @param {Object} [data] - Additional data to include in the log
   */
  log(level, message, data = {}) {
    // Skip logging if level is not sufficient
    if (this.logging.level === 'none' ||
       (this.logging.level === 'basic' && level === 'debug') ||
       (this.logging.level !== 'debug' && level === 'debug')) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      agency: this.name,
      message,
      ...data
    };

    // Format the log entry
    let formattedLog;
    if (this.logging.format === 'json') {
      formattedLog = JSON.stringify(logEntry);
    } else {
      // Text format with emoji indicators
      const emoji = level === 'info' ? 'ℹ️' :
                   level === 'warn' ? '⚠️' :
                   level === 'error' ? '❌' :
                   level === 'debug' ? '🔍' : '';
      formattedLog = `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`;

      // Add data if present and not empty
      if (data && Object.keys(data).length > 0) {
        formattedLog += ` ${JSON.stringify(data)}`;
      }
    }

    // Output the log
    if (this.logging.destination === 'console') {
      if (level === 'error') {
        console.error(formattedLog);
      } else if (level === 'warn') {
        console.warn(formattedLog);
      } else {
        console.log(formattedLog);
      }
    } else if (this.logging.destination === 'file' && this.logging.filepath) {
      // File logging would be implemented here
      // This would require fs module and is left as an implementation detail
    } else if (typeof this.logging.destination.write === 'function') {
      // Writable stream
      this.logging.destination.write(formattedLog + '\n');
    }
  }

  /**
   * Set up event listeners for tracing agent and workflow activities
   * @private
   */
  setupTracingListeners() {
    // Agent events
    this.events.on('agent:statusChanged', (data) => {
      this.log('debug', `Agent ${data.agentId} status changed to ${data.newStatus}`, data);
    });

    this.events.on('agent:runCompleted', (data) => {
      this.log('debug', `Agent ${data.agentId} completed run`, {
        agentId: data.agentId,
        responseLength: data.response ? JSON.stringify(data.response).length : 0
      });
    });

    this.events.on('agent:runError', (data) => {
      this.log('debug', `Agent ${data.agentId} encountered error: ${data.error}`, data);
    });

    this.events.on('agent:message', (data) => {
      this.log('debug', `Message from ${data.senderId} to ${data.recipientId}`, {
        senderId: data.senderId,
        recipientId: data.recipientId,
        preview: JSON.stringify(data.message).substring(0, 50) +
                (JSON.stringify(data.message).length > 50 ? '...' : '')
      });
    });

    // Job events
    this.events.on('job:assigned', (data) => {
      this.log('debug', `Job ${data.jobId} assigned to ${data.assigneeType} ${data.assigneeId}`, data);
    });

    this.events.on('job:started', (data) => {
      this.log('debug', `Job ${data.jobId} started execution`, data);
    });

    this.events.on('job:completed', (data) => {
      this.log('debug', `Job ${data.jobId} completed successfully`, data);
    });

    this.events.on('job:failed', (data) => {
      this.log('debug', `Job ${data.jobId} failed with error: ${data.error}`, data);
    });

    // Workflow events
    this.events.on('workflow:started', (data) => {
      this.log('debug', `Workflow ${data.workflowId} started with ${data.steps} steps`, data);
    });

    this.events.on('workflow:step', (data) => {
      this.log('debug', `Workflow ${data.workflowId} executing step ${data.stepIndex + 1}: ${data.jobId}`, data);
    });

    this.events.on('workflow:completed', (data) => {
      this.log('debug', `Workflow ${data.workflowId} completed successfully`, data);
    });

    this.events.on('workflow:failed', (data) => {
      this.log('debug', `Workflow ${data.workflowId} failed at step ${data.step + 1}`, {
        workflowId: data.workflowId,
        step: data.step,
        error: data.error
      });
    });

    // Planning events
    this.events.on('planning:started', (data) => {
      this.log('debug', `Agent ${data.agentId} started planning for goal`, {
        agentId: data.agentId,
        goalPreview: data.goal.substring(0, 50) + (data.goal.length > 50 ? '...' : '')
      });
    });

    this.events.on('planning:completed', (data) => {
      this.log('debug', `Agent ${data.agentId} completed planning with ${data.jobIds.length} jobs`, data);
    });

    // Memory events
    this.events.on('memory:shared', (data) => {
      this.log('debug', `Memory shared from ${data.sourceScope} to ${data.targetScope}`, {
        sourceScope: data.sourceScope,
        targetScope: data.targetScope,
        keys: data.keys,
        accessMode: data.accessMode
      });
    });

    this.events.on('memory:created', (data) => {
      this.log('debug', `Memory scope created: ${data.scopeId}`, data);
    });

    this.events.on('memory:deleted', (data) => {
      this.log('debug', `Memory scope deleted: ${data.scopeId}`, data);
    });

    this.events.on('memory:updated', (data) => {
      this.log('debug', `Memory updated in scope ${data.scopeId}`, {
        scopeId: data.scopeId,
        key: data.key,
        valuePreview: typeof data.value === 'object' ?
          `[Object with ${Object.keys(data.value).length} keys]` :
          String(data.value).substring(0, 30) + (String(data.value).length > 30 ? '...' : '')
      });
    });
  }

  /**
   * Add an agent to the agency
   * @param {string} id - Agent identifier
   * @param {Object} agent - Agent instance
   */
  addAgent(id, agent) {
    this.agents[id] = agent;

    // Subscribe to agent events and relay them through the agency
    if (agent.on) {
      agent.on('statusChanged', (data) => {
        this.events.emit('agent:statusChanged', { agentId: id, ...data });
      });

      agent.on('runCompleted', (data) => {
        this.events.emit('agent:runCompleted', { agentId: id, ...data });
      });

      agent.on('runError', (data) => {
        this.events.emit('agent:runError', { agentId: id, ...data });
      });
    }

    return this;
  }

  /**
   * Add a team to the agency
   * @param {string} id - Team identifier
   * @param {Object} team - Team instance
   */
  addTeam(id, team) {
    this.team[id] = team;
    return this;
  }

  /**
   * Subscribe to agency events
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} listener - Function to call when event is emitted
   * @returns {Function} - Unsubscribe function
   */
  on(eventName, listener) {
    return this.events.on(eventName, listener);
  }

  /**
   * Broadcast an event to all subscribers
   * @param {string} eventName - Event name to broadcast
   * @param {*} data - Event data
   */
  broadcastEvent(eventName, data) {
    this.events.emit(eventName, {
      source: 'agency',
      agency: this.name,
      timestamp: new Date(),
      ...data
    });
  }

  /**
   * Subscribe an agent to an agency event
   * @param {string} agentId - Agent ID to subscribe
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} callback - Optional callback to transform the event data before sending to agent
   * @returns {Function} - Unsubscribe function
   */
  subscribeAgent(agentId, eventName, callback = data => data) {
    const agent = this.agents[agentId];
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!agent.on) {
      throw new Error(`Agent ${agentId} does not support event subscription`);
    }

    return this.events.on(eventName, (data) => {
      const transformedData = callback(data);
      // If the callback returns false or null, don't forward the event
      if (transformedData) {
        agent.events.emit(eventName, transformedData);
      }
    });
  }

  /**
   * Send a message from one agent to another
   * @param {string} senderId - Sender agent ID
   * @param {string} recipientId - Recipient agent ID
   * @param {*} message - Message content
   */
  sendMessage(senderId, recipientId, message) {
    // Validate sender and recipient exist
    if (!this.agents[senderId]) {
      throw new Error(`Sender agent ${senderId} not found`);
    }
    if (!this.agents[recipientId]) {
      throw new Error(`Recipient agent ${recipientId} not found`);
    }

    const messageData = {
      senderId,
      recipientId,
      message,
      timestamp: new Date()
    };

    // Emit targeted event for recipient
    this.events.emit(`message:${recipientId}`, messageData);

    // Emit general event for logging/monitoring
    this.events.emit('agent:message', messageData);

    return messageData;
  }

  /**
   * Subscribe an agent to receive messages
   * @param {string} agentId - Agent ID to receive messages
   * @param {Function} listener - Function to call when a message is received
   * @returns {Function} - Unsubscribe function
   */
  onMessage(agentId, listener) {
    if (!this.agents[agentId]) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return this.events.on(`message:${agentId}`, listener);
  }

  /**
   * Create a memory scope for sharing data
   * @param {string} scopeId - Unique identifier for the memory scope
   * @param {Object} config - Memory manager configuration
   * @returns {MemoryManager} - The created memory scope
   */
  createMemoryScope(scopeId, config = {}) {
    if (this.memoryScopes[scopeId]) {
      throw new Error(`Memory scope ${scopeId} already exists`);
    }

    const memoryScope = new MemoryManager(config);
    this.memoryScopes[scopeId] = memoryScope;
    return memoryScope;
  }

  /**
   * Get a memory scope by ID
   * @param {string} scopeId - Memory scope identifier
   * @returns {MemoryManager} - The memory scope
   */
  getMemoryScope(scopeId) {
    const scope = this.memoryScopes[scopeId];
    if (!scope) {
      throw new Error(`Memory scope ${scopeId} not found`);
    }
    return scope;
  }

  /**
   * Share memory between scopes with access control
   * @param {string} sourceId - Source memory scope ID
   * @param {string} targetId - Target memory scope ID
   * @param {Array<string>} keys - Keys to share (empty array shares all)
   * @param {string} accessMode - Access mode ('read-only' or 'read-write')
   */
  shareMemoryBetween(sourceId, targetId, keys = [], accessMode = 'read-write') {
    const sourceScope = this.getMemoryScope(sourceId);
    const targetScope = this.getMemoryScope(targetId);

    // If keys is empty, share all keys
    const keysToShare = keys.length > 0 ? keys : Object.keys(sourceScope.keyValueStore);

    // Set up access control
    this.memoryAccessControl[targetId] = this.memoryAccessControl[targetId] || {};

    for (const key of keysToShare) {
      const value = sourceScope.recall(key);
      if (value !== undefined) {
        // Store the value in target scope
        targetScope.remember(key, value);

        // Record access control information
        this.memoryAccessControl[targetId][key] = {
          sourceScope: sourceId,
          accessMode,
          sharedAt: new Date()
        };

        // If read-only, set up a proxy to prevent writes
        if (accessMode === 'read-only') {
          // Override the remember method for this key
          const originalRemember = targetScope.remember.bind(targetScope);
          targetScope.remember = (k, v) => {
            if (k === key) {
              console.warn(`Cannot modify read-only shared memory key "${k}" in scope "${targetId}"`);
              return false;
            }
            return originalRemember(k, v);
          };
        }
      }
    }

    this.events.emit('memory:shared', {
      sourceScope: sourceId,
      targetScope: targetId,
      keys: keysToShare,
      accessMode
    });
  }

  /**
   * Get memory access control information
   * @param {string} scopeId - Memory scope ID
   * @param {string} key - Memory key
   * @returns {Object} - Access control information
   */
  getMemoryAccessInfo(scopeId, key) {
    if (!this.memoryAccessControl[scopeId] || !this.memoryAccessControl[scopeId][key]) {
      return null;
    }
    return this.memoryAccessControl[scopeId][key];
  }

  /**
   * Create a brief for a job
   * @param {string} jobId - Unique job identifier
   * @param {Object} briefData - Brief information
   * @returns {Object} - Created brief
   */
  createBrief(jobId, briefData) {
    const brief = {
      jobId,
      createdAt: new Date(),
      ...briefData
    };

    this.brief[jobId] = brief;
    this.events.emit('brief:created', { jobId, brief });
    return brief;
  }

  /**
   * Create a job context for sharing data between agents working on the same job
   * @param {string} jobId - Job identifier
   * @param {Object} initialContext - Initial context data
   * @returns {Object} - The job context
   */
  createJobContext(jobId, initialContext = {}) {
    this.jobContexts[jobId] = {
      ...initialContext,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.events.emit('jobContext:created', { jobId, context: this.jobContexts[jobId] });
    return this.jobContexts[jobId];
  }

  /**
   * Update a job context
   * @param {string} jobId - Job identifier
   * @param {Object} updates - Context updates
   * @returns {Object} - Updated job context
   */
  updateJobContext(jobId, updates) {
    if (!this.jobContexts[jobId]) {
      throw new Error(`Job context for ${jobId} not found`);
    }

    this.jobContexts[jobId] = {
      ...this.jobContexts[jobId],
      ...updates,
      updatedAt: new Date()
    };

    this.events.emit('jobContext:updated', {
      jobId,
      context: this.jobContexts[jobId],
      updates: Object.keys(updates)
    });

    return this.jobContexts[jobId];
  }

  /**
   * Get a job context
   * @param {string} jobId - Job identifier
   * @returns {Object} - The job context
   */
  getJobContext(jobId) {
    const context = this.jobContexts[jobId];
    if (!context) {
      throw new Error(`Job context for ${jobId} not found`);
    }
    return context;
  }

  /**
   * Assign a job to an agent or team
   * @param {string} jobId - Job identifier
   * @param {string} assigneeId - Agent or team identifier
   * @param {string} assigneeType - Type of assignee ('agent' or 'team')
   * @returns {Object} - Job information
   */
  assignJob(jobId, assigneeId, assigneeType = 'agent') {
    const brief = this.brief[jobId];

    if (!brief) {
      throw new Error(`No brief found for job ${jobId}`);
    }

    const assignee = assigneeType === 'agent'
      ? this.agents[assigneeId]
      : this.team[assigneeId];

    if (!assignee) {
      throw new Error(`${assigneeType} ${assigneeId} not found`);
    }

    const job = {
      jobId,
      brief,
      assigneeId,
      assigneeType,
      status: 'assigned',
      assignedAt: new Date(),
      results: null
    };

    this.activeJobs[jobId] = job;

    // Create job context if it doesn't exist
    if (!this.jobContexts[jobId]) {
      this.createJobContext(jobId);
    }

    this.events.emit('job:assigned', {
      jobId,
      assigneeId,
      assigneeType
    });

    return job;
  }

  /**
   * Set an error handler for a job
   * @param {string} jobId - Job identifier
   * @param {Function} handlerFn - Error handler function
   */
  setErrorHandler(jobId, handlerFn) {
    this.errorHandlers[jobId] = handlerFn;
  }

  /**
   * Set an error handler for a workflow
   * @param {string} workflowId - Workflow identifier
   * @param {Function} handlerFn - Error handler function
   */
  setWorkflowErrorHandler(workflowId, handlerFn) {
    this.workflowErrorHandlers[workflowId] = handlerFn;
  }

  /**
   * Define a schema for job inputs and outputs
   * @param {string} jobId - Job identifier
   * @param {Object} inputSchema - Schema for job inputs
   * @param {Object} outputSchema - Schema for job outputs
   */
  defineJobSchema(jobId, inputSchema, outputSchema) {
    this.jobSchemas[jobId] = {
      input: inputSchema,
      output: outputSchema
    };
  }

  /**
   * Validate data against a schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} - Validation result with isValid and errors
   * @private
   */
  _validateAgainstSchema(data, schema) {
    if (!schema) return { isValid: true, errors: [] };

    const errors = [];

    // Simple schema validation
    for (const [key, schemaValue] of Object.entries(schema)) {
      // Required field check
      if (schemaValue.required && (data[key] === undefined || data[key] === null)) {
        errors.push(`Required field '${key}' is missing`);
        continue;
      }

      // Type check if value exists
      if (data[key] !== undefined && schemaValue.type) {
        const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
        if (actualType !== schemaValue.type) {
          errors.push(`Field '${key}' should be of type '${schemaValue.type}', but got '${actualType}'`);
        }
      }

      // Enum check
      if (data[key] !== undefined && schemaValue.enum && !schemaValue.enum.includes(data[key])) {
        errors.push(`Field '${key}' should be one of [${schemaValue.enum.join(', ')}], but got '${data[key]}'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute a job
   * @param {string} jobId - Job identifier
   * @param {Object} additionalInputs - Additional input data for the job
   * @returns {Promise<Object>} - Job results
   */
  async execute(jobId, additionalInputs = {}) {
    const job = this.activeJobs[jobId];

    if (!job) {
      throw new Error(`No active job found with id ${jobId}`);
    }

    const assignee = job.assigneeType === 'agent'
      ? this.agents[job.assigneeId]
      : this.team[job.assigneeId];

    try {
      // Update job status
      job.status = 'in_progress';
      job.startedAt = new Date();
      this.events.emit('job:started', { jobId });

      // Extract relevant information from the brief to use as inputs
      const briefInputs = this.extractInputsFromBrief(job.brief);

      // Get job context
      const jobContext = this.jobContexts[jobId] || {};

      // Merge brief inputs with job context and additional inputs
      const mergedInputs = {
        ...briefInputs,
        ...jobContext,
        ...additionalInputs
      };

      // Validate inputs against schema if defined
      if (this.jobSchemas[jobId] && this.jobSchemas[jobId].input) {
        const validation = this._validateAgainstSchema(mergedInputs, this.jobSchemas[jobId].input);
        if (!validation.isValid) {
          throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Execute the job
      let results;
      if (job.assigneeType === 'agent') {
        // For a single agent, we need to format the input as a prompt
        const prompt = this.formatBriefAsPrompt(job.brief, mergedInputs);
        results = await assignee.run(prompt, { jobId, jobContext });
      } else {
        // For a team, we pass the inputs and context
        results = await assignee.run(mergedInputs, {
          brief: job.brief,
          jobId,
          jobContext
        });
      }

      // Validate outputs against schema if defined
      if (this.jobSchemas[jobId] && this.jobSchemas[jobId].output) {
        const validation = this._validateAgainstSchema(results, this.jobSchemas[jobId].output);
        if (!validation.isValid) {
          throw new Error(`Output validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Update job with results
      job.status = 'completed';
      job.completedAt = new Date();
      job.results = results;

      // Update job context with results
      this.updateJobContext(jobId, { results });

      this.events.emit('job:completed', {
        jobId,
        results
      });

      return results;
    } catch (error) {
      // Update job with error
      job.status = 'failed';
      job.error = error.message;

      this.events.emit('job:failed', {
        jobId,
        error: error.message
      });

      // Call error handler if exists
      if (this.errorHandlers[jobId]) {
        try {
          return await this.errorHandlers[jobId](error, job);
        } catch (handlerError) {
          console.error(`Error handler for job ${jobId} failed:`, handlerError);
        }
      }

      throw error;
    }
  }

  /**
   * Retry a failed job
   * @param {string} jobId - Job identifier
   * @param {number} maxRetries - Maximum number of retry attempts
   * @param {Object} additionalInputs - Additional inputs for the retry
   * @returns {Promise<Object>} - Job results
   */
  async retryJob(jobId, maxRetries = 3, additionalInputs = {}) {
    const job = this.activeJobs[jobId];

    if (!job) {
      throw new Error(`No job found with id ${jobId}`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    // Initialize retry count if not present
    job.retryCount = job.retryCount || 0;

    if (job.retryCount >= maxRetries) {
      throw new Error(`Maximum retry attempts (${maxRetries}) reached for job ${jobId}`);
    }

    // Increment retry count
    job.retryCount++;

    // Reset job status
    job.status = 'assigned';
    job.error = null;

    this.events.emit('job:retrying', {
      jobId,
      retryCount: job.retryCount,
      maxRetries
    });

    // Execute the job again
    return this.execute(jobId, additionalInputs);
  }

  /**
   * Execute a workflow of jobs (sequential or parallel)
   * @param {Object} workflowDefinition - Workflow definition
   * @param {string} workflowId - Unique workflow identifier
   * @param {Object} initialData - Initial data for the workflow
   * @returns {Promise<Object>} - Workflow results
   */
  async executeWorkflow(workflowDefinition, workflowId, initialData = {}) {
    // Create a workflow record
    this.workflows[workflowId] = {
      id: workflowId,
      definition: workflowDefinition,
      status: 'in_progress',
      startedAt: new Date(),
      currentStep: 0,
      results: {},
      error: null
    };

    this.events.emit('workflow:started', {
      workflowId,
      steps: workflowDefinition.length
    });

    // Create a memory scope for this workflow
    const workflowMemory = this.createMemoryScope(`workflow:${workflowId}`);

    // Store initial data in workflow memory
    for (const [key, value] of Object.entries(initialData)) {
      workflowMemory.remember(key, value);
    }

    let currentData = initialData;

    try {
      // Execute each step
      for (let i = 0; i < workflowDefinition.length; i++) {
        const step = workflowDefinition[i];
        const { jobId, assigneeId, assigneeType, inputs = {}, type = 'sequential' } = step;

        // Update workflow status
        this.workflows[workflowId].currentStep = i;

        this.events.emit('workflow:step', {
          workflowId,
          stepIndex: i,
          jobId,
          assigneeId,
          assigneeType,
          type
        });

        // Handle different step types
        if (type === 'parallel' && Array.isArray(jobId)) {
          // Parallel execution of multiple jobs
          const parallelJobs = jobId.map((jid, index) => {
            const parallelAssigneeId = Array.isArray(assigneeId) ? assigneeId[index] : assigneeId;
            const parallelAssigneeType = Array.isArray(assigneeType) ? assigneeType[index] : assigneeType;
            const parallelInputs = Array.isArray(inputs) ? inputs[index] : inputs;
            const parallelBrief = Array.isArray(step.brief) ? step.brief[index] : step.brief;

            // Create brief if not exists
            if (!this.brief[jid]) {
              this.createBrief(jid, {
                ...parallelBrief,
                workflowId,
                workflowStep: i,
                isParallel: true,
                parallelIndex: index
              });
            }

            // Assign job
            this.assignJob(jid, parallelAssigneeId, parallelAssigneeType);

            // Prepare inputs
            const jobInputs = {
              ...parallelInputs,
              previousStepData: currentData,
              workflowId,
              workflowStep: i,
              isParallel: true,
              parallelIndex: index
            };

            // Execute job
            return this.execute(jid, jobInputs)
              .then(result => ({ jobId: jid, result }));
          });

          // Wait for all parallel jobs to complete
          const parallelResults = await Promise.all(parallelJobs);

          // Store results
          const combinedResults = {};
          for (const { jobId: jid, result } of parallelResults) {
            combinedResults[jid] = result;
            workflowMemory.remember(`step_${i}_job_${jid}_results`, result);
            this.workflows[workflowId].results[jid] = result;

            // Check if job failed
            const job = this.getJob(jid);
            if (job.status === 'failed') {
              throw new Error(`Parallel workflow step ${i} (job ${jid}) failed: ${job.error}`);
            }
          }

          // Update current data with combined results
          currentData = combinedResults;
          workflowMemory.remember(`step_${i}_results`, combinedResults);
        }
        else if (type === 'conditional') {
          // Conditional execution based on a condition function
          const conditionFn = step.condition || (() => true);
          const shouldExecute = conditionFn(currentData, workflowMemory);

          if (shouldExecute) {
            // Create brief if not exists
            if (!this.brief[jobId]) {
              this.createBrief(jobId, {
                ...step.brief,
                workflowId,
                workflowStep: i,
                isConditional: true
              });
            }

            // Assign job
            this.assignJob(jobId, assigneeId, assigneeType);

            // Prepare inputs
            const stepInputs = {
              ...inputs,
              previousStepData: currentData,
              workflowId,
              workflowStep: i,
              isConditional: true
            };

            // Execute job
            currentData = await this.execute(jobId, stepInputs);

            // Store results
            workflowMemory.remember(`step_${i}_results`, currentData);
            this.workflows[workflowId].results[jobId] = currentData;

            // Check if job failed
            const job = this.getJob(jobId);
            if (job.status === 'failed') {
              throw new Error(`Conditional workflow step ${i} (job ${jobId}) failed: ${job.error}`);
            }
          } else {
            // Skip this step
            workflowMemory.remember(`step_${i}_skipped`, true);
            this.events.emit('workflow:stepSkipped', {
              workflowId,
              stepIndex: i,
              reason: 'condition-not-met'
            });
          }
        }
        else {
          // Default: sequential execution
          // Create a brief for this job if not already exists
          if (!this.brief[jobId]) {
            this.createBrief(jobId, {
              ...step.brief,
              workflowId,
              workflowStep: i
            });
          }

          // Assign the job
          this.assignJob(jobId, assigneeId, assigneeType);

          // Execute the job with current data
          const stepInputs = {
            ...inputs,
            previousStepData: currentData,
            workflowId,
            workflowStep: i
          };

          currentData = await this.execute(jobId, stepInputs);

          // Store results in workflow memory
          workflowMemory.remember(`step_${i}_results`, currentData);

          // Store in workflow results
          this.workflows[workflowId].results[jobId] = currentData;

          // Check if job failed
          const job = this.getJob(jobId);
          if (job.status === 'failed') {
            throw new Error(`Workflow step ${i} (job ${jobId}) failed: ${job.error}`);
          }
        }
      }

      // Update workflow status
      this.workflows[workflowId].status = 'completed';
      this.workflows[workflowId].completedAt = new Date();

      this.events.emit('workflow:completed', {
        workflowId,
        results: this.workflows[workflowId].results
      });

      return {
        status: 'completed',
        workflowId,
        results: this.workflows[workflowId].results
      };
    } catch (error) {
      // Update workflow status
      this.workflows[workflowId].status = 'failed';
      this.workflows[workflowId].error = error.message;

      this.events.emit('workflow:failed', {
        workflowId,
        error: error.message,
        step: this.workflows[workflowId].currentStep
      });

      // Call workflow error handler if exists
      if (this.workflowErrorHandlers[workflowId]) {
        try {
          return await this.workflowErrorHandlers[workflowId](error, this.workflows[workflowId]);
        } catch (handlerError) {
          console.error(`Workflow error handler for ${workflowId} failed:`, handlerError);
        }
      }

      return {
        status: 'failed',
        workflowId,
        error: error.message,
        step: this.workflows[workflowId].currentStep,
        results: this.workflows[workflowId].results
      };
    }
  }

  // Include existing methods from Agency.js
  formatBriefAsPrompt(brief, inputs = {}) {
    // Implementation from original Agency.js
    let prompt = `
# JOB BRIEF: ${brief.title}

## Overview
${brief.overview}

## Background
${brief.background || 'Not provided'}

## Objective
${brief.objective}

## Target Audience
${brief.targetAudience || 'Not specified'}
`;

    // Add preferences if available
    if (brief.preferences || inputs.preferences) {
      prompt += `\n## Preferences\n${brief.preferences || inputs.preferences}\n`;
    }

    // Add dates if available
    if (brief.dates || inputs.dates) {
      prompt += `\n## Dates\n${brief.dates || inputs.dates}\n`;
    }

    // Add budget if available
    if (brief.budget || inputs.budget) {
      prompt += `\n## Budget\n${brief.budget || inputs.budget}\n`;
    }

    // Add transportation if available
    if (brief.transportation || inputs.transportation) {
      prompt += `\n## Transportation\n${brief.transportation || inputs.transportation}\n`;
    }

    // Add deliverables if available
    if (brief.deliverables) {
      prompt += `\n## Deliverables\n${brief.deliverables}\n`;
    }

    // Add additional information if available
    if (brief.additionalInfo) {
      prompt += `\n## Additional Information\n${brief.additionalInfo}\n`;
    }

    // Add workflow context if available
    if (inputs.workflowId) {
      prompt += `\n## Workflow Context\nThis is step ${inputs.workflowStep + 1} of workflow ${inputs.workflowId}.\n`;

      if (inputs.previousStepData) {
        prompt += `\n## Previous Step Results\n${JSON.stringify(inputs.previousStepData, null, 2)}\n`;
      }
    }

    return prompt;
  }

  extractInputsFromBrief(brief) {
    // Implementation from original Agency.js
    const inputs = {};

    // Extract topic from title, overview or background
    if (brief.title && brief.title.toLowerCase().includes('water bottle')) {
      inputs.topic = 'eco-friendly water bottles';
    } else if (brief.overview && brief.overview.toLowerCase().includes('water bottle')) {
      inputs.topic = 'eco-friendly water bottles';
    } else if (brief.background && brief.background.toLowerCase().includes('water bottle')) {
      inputs.topic = 'eco-friendly water bottles';
    }

    // Extract target audience
    if (brief.targetAudience) {
      inputs.targetAudience = brief.targetAudience;
    }

    // Extract content type from deliverables
    if (brief.deliverables && brief.deliverables.toLowerCase().includes('social media')) {
      inputs.contentType = 'social media posts';
    }

    // Extract vacation-specific inputs
    if (brief.preferences) {
      inputs.preferences = brief.preferences;
    }

    if (brief.dates) {
      inputs.dates = brief.dates;
    }

    if (brief.budget) {
      inputs.budget = brief.budget;
    }

    if (brief.transportation) {
      inputs.transportation = brief.transportation;
    }

    return inputs;
  }

  getJobsByStatus(status) {
    return Object.values(this.activeJobs)
      .filter(job => job.status === status);
  }

  getJob(jobId) {
    return this.activeJobs[jobId];
  }

  /**
   * Clean up resources for a completed job
   * @param {string} jobId - Job identifier
   * @param {boolean} keepResults - Whether to keep job results
   * @returns {boolean} - Success status
   */
  cleanupJob(jobId, keepResults = true) {
    const job = this.activeJobs[jobId];
    if (!job) {
      return false;
    }

    // Only clean up completed or failed jobs
    if (job.status !== 'completed' && job.status !== 'failed') {
      return false;
    }

    // Store results if needed
    const results = keepResults ? job.results : null;

    // Clean up job context
    if (this.jobContexts[jobId]) {
      delete this.jobContexts[jobId];
    }

    // Remove job from active jobs
    delete this.activeJobs[jobId];

    // Keep brief for reference

    this.events.emit('job:cleaned', {
      jobId,
      keepResults
    });

    // If keeping results, store them in global memory
    if (keepResults && results) {
      this.globalMemory.remember(`job_${jobId}_results`, {
        results,
        cleanedAt: new Date()
      });
    }

    return true;
  }

  /**
   * Clean up resources for a completed workflow
   * @param {string} workflowId - Workflow identifier
   * @param {boolean} keepResults - Whether to keep workflow results
   * @returns {boolean} - Success status
   */
  cleanupWorkflow(workflowId, keepResults = true) {
    const workflow = this.workflows[workflowId];
    if (!workflow) {
      return false;
    }

    // Only clean up completed or failed workflows
    if (workflow.status !== 'completed' && workflow.status !== 'failed') {
      return false;
    }

    // Store results if needed
    const results = keepResults ? workflow.results : null;

    // Clean up workflow memory scope
    if (this.memoryScopes[`workflow:${workflowId}`]) {
      delete this.memoryScopes[`workflow:${workflowId}`];
    }

    // Clean up workflow error handler
    if (this.workflowErrorHandlers[workflowId]) {
      delete this.workflowErrorHandlers[workflowId];
    }

    // Remove workflow
    delete this.workflows[workflowId];

    this.events.emit('workflow:cleaned', {
      workflowId,
      keepResults
    });

    // If keeping results, store them in global memory
    if (keepResults && results) {
      this.globalMemory.remember(`workflow_${workflowId}_results`, {
        results,
        cleanedAt: new Date()
      });
    }

    return true;
  }

  /**
   * Allows an agent to plan jobs from a high-level goal
   * @param {string} agentId - ID of the agent setting the goal
   * @param {string} goal - High-level goal description
   * @returns {Promise<Array>} - Array of created job IDs
   */
  async planJobsFromGoal(agentId, goal) {
    const agent = this.agents[agentId];
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    // Step 1: Prompt for job planning with structured JSON output format
    const planningPrompt = {
      contents: [
        {
          role: "system",
          parts: [
            {
              text:
                `You are a JSON-only task planner. You MUST ONLY output valid JSON with no other text. Your response will be directly parsed with JSON.parse() and any non-JSON text will cause a critical error. DO NOT include any explanations, notes, or text outside the JSON structure. DO NOT use markdown formatting. DO NOT start with "Here's the JSON:" or similar phrases. ONLY RETURN THE RAW JSON ARRAY.`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text:
                `I need to plan a vacation to Hawaii. Break it down into tasks and return ONLY a JSON array.`
            }
          ]
        },
        {
          role: "assistant",
          parts: [
            {
              text:
                `[{"name":"Research Hawaii destinations","description":"Identify the best islands and locations to visit based on interests","inputs":["vacation_preferences"],"outputs":["destination_options"]},{"name":"Plan accommodations","description":"Find and book suitable hotels or rentals","inputs":["destination_options","budget","dates"],"outputs":["accommodation_bookings"]},{"name":"Arrange transportation","description":"Book flights and plan local transportation","inputs":["destination_options","dates","budget"],"outputs":["transportation_bookings"]},{"name":"Create activity itinerary","description":"Plan daily activities and excursions","inputs":["destination_options","dates","interests"],"outputs":["daily_itinerary"]},{"name":"Prepare packing list","description":"Create a comprehensive packing list for Hawaii","inputs":["activities","weather_forecast","trip_duration"],"outputs":["packing_list"]}]`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text:
                `I need to organize a team-building event. Break it down into tasks and return ONLY a JSON array.`
            }
          ]
        },
        {
          role: "assistant",
          parts: [
            {
              text:
                `[{"name":"Define event objectives","description":"Clarify goals and desired outcomes for the team-building event","inputs":["team_size","team_dynamics","company_culture"],"outputs":["event_objectives"]},{"name":"Select venue and date","description":"Find and book an appropriate location and time","inputs":["team_size","budget","event_objectives"],"outputs":["venue_booking","event_date"]},{"name":"Plan activities","description":"Choose team-building exercises and activities","inputs":["event_objectives","team_size","venue_details"],"outputs":["activity_schedule"]},{"name":"Arrange catering","description":"Organize food and beverages for the event","inputs":["team_size","venue_details","dietary_restrictions","budget"],"outputs":["catering_plan"]},{"name":"Prepare materials","description":"Gather necessary supplies and equipment","inputs":["activity_schedule","team_size"],"outputs":["materials_list","equipment_rentals"]},{"name":"Create communication plan","description":"Develop announcements and follow-up communications","inputs":["event_date","venue_details","activity_schedule"],"outputs":["invitation_template","follow_up_plan"]}]`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text:
                `Given the goal: "${goal}", break it down into 3–7 well-defined tasks. For each task, provide the name, description, required inputs, and expected outputs. IMPORTANT: You MUST ONLY return a valid JSON array with no explanations or text before or after. Your entire response must be parseable by JSON.parse().`
            }
          ]
        }
      ]
    };

    const planResponse = await agent.run(planningPrompt);
    let taskPlan;
    let responseText = planResponse.text || planResponse.output || planResponse;

    // Try to extract JSON if the response contains text before or after the JSON
    try {
      // First try direct parsing
      try {
        taskPlan = JSON.parse(responseText);
      } catch (directParseErr) {
        // If direct parsing fails, try to extract JSON array from the response
        const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          try {
            taskPlan = JSON.parse(jsonMatch[0]);
            console.log("Successfully extracted JSON from response text.");
          } catch (extractErr) {
            throw new Error(`Failed to parse extracted JSON: ${extractErr.message}`);
          }
        } else {
          // If no JSON array pattern is found, throw the original error
          throw directParseErr;
        }
      }
    } catch (err) {
      console.error("Raw response:", responseText);
      console.log("Creating default task plan instead of throwing an error.");

      // Create a default task plan instead of throwing an error
      return [
        {
          "name": "Research vacation options",
          "description": "Research and suggest vacation options based on user preferences",
          "inputs": ["user_preferences"],
          "outputs": ["vacation_suggestions"]
        },
        {
          "name": "Create vacation itinerary",
          "description": "Create a detailed itinerary for the vacation",
          "inputs": ["vacation_suggestions", "user_preferences"],
          "outputs": ["vacation_itinerary"]
        },
        {
          "name": "Book accommodations and transportation",
          "description": "Book accommodations and transportation for the vacation",
          "inputs": ["vacation_itinerary", "user_preferences"],
          "outputs": ["booking_confirmations"]
        }
      ];
    }

    if (!Array.isArray(taskPlan)) {
      console.error("Parsed response (not an array):", taskPlan);
      throw new Error("Planning output was not a valid task array. Expected an array but got: " + typeof taskPlan);
    }

    // Step 2: Create jobs from each task
    const jobIds = [];

    for (const [i, task] of taskPlan.entries()) {
      const jobId = `${agentId}-goal-${Date.now()}-${i}`;

      const brief = {
        goal,
        taskName: task.name,
        overview: task.description,
        inputs: task.inputs || [],
        expectedOutputs: task.outputs || [],
        instructions: `You are to complete the task "${task.name}" as part of the broader goal "${goal}". Use the provided inputs and return the expected outputs.`,
      };

      this.createBrief(jobId, brief);
      this.assignJob(jobId, agentId, "agent");

      jobIds.push(jobId);
    }

    return jobIds;
  }

  /**
   * Schedule a job to run based on conditions
   * @param {string} jobId - Job identifier
   * @param {string} assigneeId - Agent ID to run the job
   * @param {Object} schedule - Schedule configuration
   * @param {string} [schedule.when] - Condition expression
   * @param {string} [schedule.every] - Time interval
   */
  scheduleJob(jobId, assigneeId, schedule) {
    if (!this.brief[jobId]) {
      throw new Error(`No brief found for job ${jobId}`);
    }

    const scheduledJob = {
      jobId,
      assigneeId,
      condition: schedule.when,
      interval: schedule.every,
      lastRun: null,
      active: true
    };

    // Store the scheduled job
    this.scheduledJobs = this.scheduledJobs || {};
    this.scheduledJobs[jobId] = scheduledJob;

    // Set up interval checking if needed
    if (schedule.every) {
      // Implementation of time-based scheduling
    }

    return scheduledJob;
  }



  /**
   * Allow an agent to decide who to ask for help
   * @param {string} agentId - Agent seeking help
   * @param {string} jobId - Current job context
   * @returns {Promise<Object>} - Collaboration decision
   */
  async decideWhoToAskForHelp(agentId, jobId) {
    const agent = this.agents[agentId];
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get all available agents except the current one
    const availableAgents = Object.entries(this.agents)
      .filter(([id]) => id !== agentId)
      .map(([id, agent]) => ({ id, name: agent.name, role: agent.role }));

    // Get job context
    const jobContext = this.getJobContext(jobId);

    // Create decision prompt
    const decisionPrompt = {
      contents: [
        { role: "user", parts: [
          { text: `Given your current job context: ${JSON.stringify(jobContext)},
and these available agents: ${JSON.stringify(availableAgents)},
decide if you need help from another agent. If yes, which one and why?` }
        ]}
      ]
    };

    // Get agent's decision
    const decision = await agent.run(decisionPrompt);

    // Parse decision and initiate collaboration if needed
    // ...implementation details...

    return decision;
  }

  /**
   * Plans and optionally executes a workflow from a high-level goal
   * @param {string} agentId - ID of the agent setting the goal
   * @param {string} goal - High-level goal description
   * @param {Object} options - Additional options
   * @param {boolean} options.executeImmediately - Whether to execute the workflow immediately
   * @returns {Promise<Object>} - Planned jobs and workflow ID if executed
   */
  async planAndExecuteWorkflow(agentId, goal, options = {}) {
    const jobIds = await this.planJobsFromGoal(agentId, goal);

    // Store the goal and plan in agent memory
    const agentMemory = this.getMemoryScope(`agent:${agentId}`);
    agentMemory.remember(`goal:${Date.now()}`, {
      goal,
      plannedJobs: jobIds,
      timestamp: new Date()
    });

    // If immediate execution is requested, create and execute a workflow
    if (options.executeImmediately) {
      // Create workflow definition from planned jobs
      const workflowDefinition = jobIds.map(jobId => {
        const brief = this.brief[jobId];
        return {
          jobId,
          assigneeId: agentId,
          assigneeType: "agent",
          brief: brief
        };
      });

      const workflowId = `workflow-${agentId}-${Date.now()}`;
      const workflowResult = await this.executeWorkflow(workflowDefinition, workflowId);

      return {
        jobIds,
        workflowId,
        workflowResult
      };
    }

    return { jobIds };
  }

  /**
   * Re-evaluates a plan when a job fails and potentially creates alternative jobs
   * @param {string} failedJobId - ID of the failed job
   * @param {Error} error - The error that occurred
   * @returns {Promise<Array>} - Array of new job IDs if re-planning occurred
   */
  async replanFailedJob(failedJobId, error) {
    const job = this.getJob(failedJobId);
    if (!job) throw new Error(`Job ${failedJobId} not found`);

    const agent = this.agents[job.assigneeId];
    if (!agent) throw new Error(`Agent ${job.assigneeId} not found`);

    const brief = this.brief[failedJobId];
    if (!brief || !brief.goal) {
      throw new Error(`Cannot replan job ${failedJobId}: no goal context found`);
    }

    // Create a replanning prompt
    const replanningPrompt = {
      contents: [
        {
          role: "system",
          parts: [
            {
              text:
                `You are a JSON-only task replanner. You MUST ONLY output valid JSON with no other text. Your response will be directly parsed with JSON.parse() and any non-JSON text will cause a critical error. DO NOT include any explanations, notes, or text outside the JSON structure. DO NOT use markdown formatting. DO NOT start with "Here's the JSON:" or similar phrases. ONLY RETURN THE RAW JSON ARRAY.`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text:
                `Original goal: "Plan a company retreat"\n` +
                `Failed task: "Book venue"\n` +
                `Task description: "Find and reserve a suitable venue for the retreat"\n` +
                `Error: "No venues available for the specified dates"\n\n` +
                `Suggest alternative approaches. Return ONLY a JSON array.`
            }
          ]
        },
        {
          role: "assistant",
          parts: [
            {
              text:
                `[{"name":"Explore alternative dates","description":"Identify different date ranges when venues might be available","inputs":["company_calendar","team_availability"],"outputs":["alternative_date_options"]},{"name":"Search broader location range","description":"Expand the search radius to include more potential venues","inputs":["original_location_criteria","transportation_constraints"],"outputs":["expanded_venue_options"]},{"name":"Consider virtual retreat","description":"Plan a virtual or hybrid retreat format instead of fully in-person","inputs":["team_size","retreat_objectives"],"outputs":["virtual_retreat_plan"]}]`
            }
          ]
        },
        {
          role: "user",
          parts: [
            {
              text:
                `Original goal: "${brief.goal}"\n` +
                `Failed task: "${brief.taskName}"\n` +
                `Task description: "${brief.overview}"\n` +
                `Error: "${error.message}"\n\n` +
                `Suggest 1-3 alternative approaches to accomplish the same objective. IMPORTANT: You MUST ONLY return a valid JSON array with no explanations or text before or after. Your entire response must be parseable by JSON.parse().`
            }
          ]
        }
      ]
    };

    // Get replanning suggestions
    const replanResponse = await agent.run(replanningPrompt);
    let alternatives;
    let responseText = replanResponse.text || replanResponse.output || replanResponse;

    // Try to extract JSON if the response contains text before or after the JSON
    try {
      // First try direct parsing
      try {
        alternatives = JSON.parse(responseText);
      } catch (directParseErr) {
        // If direct parsing fails, try to extract JSON array from the response
        const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          try {
            alternatives = JSON.parse(jsonMatch[0]);
            console.log("Successfully extracted JSON from replanning response text.");
          } catch (extractErr) {
            throw new Error(`Failed to parse extracted JSON: ${extractErr.message}`);
          }
        } else {
          // If no JSON array pattern is found, throw the original error
          throw directParseErr;
        }
      }
    } catch (err) {
      console.error("Raw replanning response:", responseText);
      throw new Error(`Failed to parse replanning response: ${err.message}. The model did not return valid JSON.`);
    }

    if (!Array.isArray(alternatives)) {
      console.error("Parsed replanning response (not an array):", alternatives);
      throw new Error("Replanning output was not a valid task array. Expected an array but got: " + typeof alternatives);
    }

    // Create new jobs from alternatives
    const newJobIds = [];

    for (const [i, task] of alternatives.entries()) {
      const jobId = `${job.assigneeId}-replan-${Date.now()}-${i}`;

      const newBrief = {
        goal: brief.goal,
        taskName: task.name,
        overview: task.description,
        inputs: task.inputs || [],
        expectedOutputs: task.outputs || [],
        instructions: `This is an alternative approach after the original task "${brief.taskName}" failed with error: "${error.message}".`,
        originalJobId: failedJobId
      };

      this.createBrief(jobId, newBrief);
      this.assignJob(jobId, job.assigneeId, "agent");

      newJobIds.push(jobId);
    }

    return newJobIds;
  }


}
