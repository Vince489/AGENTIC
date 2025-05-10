/**
 * Team class for managing multiple agents working together
 */
export class Team {
  /**
   * Create a new team
   * @param {Object} config - Team configuration
   * @param {string} config.name - Team name
   * @param {string} config.description - Team description
   * @param {Object} config.agents - Map of agent names to agent instances
   * @param {Object} config.jobs - Job definitions
   * @param {Array} config.workflow - Order of job execution
   */
  constructor(config) {
    this.name = config.name || 'Unnamed Team';
    this.description = config.description || '';
    this.agents = config.agents || {};
    this.jobs = config.jobs || {};
    this.workflow = config.workflow || [];

    // Debug logging
    console.log('Team constructor called with:');
    console.log('- name:', this.name);
    console.log('- agents:', Object.keys(this.agents));
    console.log('- jobs:', Object.keys(this.jobs));
    console.log('- workflow:', this.workflow);
  }

  /**
   * Add an agent to the team
   * @param {string} name - Agent name
   * @param {Agent} agent - Agent instance
   */
  addAgent(name, agent) {
    this.agents[name] = agent;
  }

  /**
   * Add a job to the team
   * @param {string} name - Job name
   * @param {Object} job - Job definition
   */
  addJob(name, job) {
    this.jobs[name] = job;
  }

  /**
   * Define the workflow for the team
   * @param {Array} workflow - Array of job names in execution order
   */
  setWorkflow(workflow) {
    this.workflow = workflow;
  }

  /**
   * Run the team with specific inputs
   * @param {Object} inputs - Input data for the team
   * @param {Object} context - Additional context for the team
   * @returns {Promise<Object>} - Results from all jobs
   */
  async run(inputs = {}, context = {}) {
    console.log(`Starting team run for: ${this.name}`);
    console.log('- inputs:', JSON.stringify(inputs));
    console.log('- context:', Object.keys(context));

    // Initialize results and context
    this.results = {};
    this.context = { ...context };

    console.log(`🚀 Starting team: ${this.name}`);

    // Execute each job in the workflow
    for (const jobName of this.workflow) {
      const job = this.jobs[jobName];

      if (!job) {
        console.error(`Job ${jobName} not found in team ${this.name}`);
        continue;
      }

      console.log(`⏳ Running job: ${jobName}`);

      try {
        // Get the agent for this job
        const agent = this.agents[job.agent];

        if (!agent) {
          throw new Error(`Agent ${job.agent} not found for job ${jobName}`);
        }

        // Prepare the input for the agent
        const jobInput = this.prepareJobInput(job, inputs);

        console.log(`- Agent: ${job.agent}`);
        console.log(`- Job input:`, jobInput);

        // Run the agent with the prepared input
        const result = await agent.run(jobInput, this.context);

        // Store the result
        this.results[jobName] = result;

        // Update the context with the result
        this.context[jobName] = result;

        console.log(`✅ Job ${jobName} completed`);
      } catch (error) {
        console.error(`❌ Job ${jobName} failed:`, error);
        this.results[jobName] = { error: error.message };
      }
    }

    console.log(`🏁 Team ${this.name} completed`);
    return this.results;
  }

  /**
   * Prepare the input for a job
   * @param {Object} job - Job definition
   * @param {Object} inputs - Input values
   * @returns {string} - Prepared input for the agent
   */
  prepareJobInput(job, inputs) {
    // Start with the job description
    let jobInput = `Job: ${job.description}\n\n`;

    // For the research job, emphasize the topic at the beginning
    if (job.agent === 'researcher' && inputs.topic) {
      jobInput = `Job: ${job.description} on the topic "${inputs.topic}"\n\n`;
      jobInput += `IMPORTANT: You must research the topic "${inputs.topic}" using the search tool.\n\n`;
    }

    // Add context from previous jobs if specified
    if (job.context && job.context.length > 0) {
      for (const contextKey of job.context) {
        if (contextKey === 'brief' && this.context.brief) {
          // Special handling for brief context
          jobInput += `\n## Brief Information\n`;
          const brief = this.context.brief;

          if (brief.title) jobInput += `Title: ${brief.title}\n`;
          if (brief.overview) jobInput += `Overview: ${brief.overview}\n`;
          if (brief.background) jobInput += `Background: ${brief.background}\n`;
          if (brief.objective) jobInput += `Objective: ${brief.objective}\n`;
          if (brief.targetAudience) jobInput += `Target Audience: ${brief.targetAudience}\n`;
          if (brief.topic) jobInput += `Topic: ${brief.topic}\n`;
          if (brief.preferences) jobInput += `Preferences: ${brief.preferences}\n`;
          if (brief.dates) jobInput += `Dates: ${brief.dates}\n`;
          if (brief.budget) jobInput += `Budget: ${brief.budget}\n`;
          if (brief.transportation) jobInput += `Transportation: ${brief.transportation}\n`;
          if (brief.additionalInfo) jobInput += `Additional Info: ${brief.additionalInfo}\n`;
          if (brief.deliverables) jobInput += `Deliverables: ${brief.deliverables}\n`;

          jobInput += `\n`;
        } else if (this.results[contextKey]) {
          // Add other context
          jobInput += `\n## ${contextKey.charAt(0).toUpperCase() + contextKey.slice(1)} Results\n`;
          jobInput += `${this.results[contextKey]}\n\n`;
        }
      }
    }

    // Add inputs if specified
    if (job.inputs && job.inputs.length > 0) {
      jobInput += `\n## Inputs\n`;

      for (const inputKey of job.inputs) {
        if (inputs[inputKey]) {
          jobInput += `${inputKey}: ${inputs[inputKey]}\n`;
        }
      }
    }

    // For researcher, add explicit instructions to use the search tool
    if (job.agent === 'researcher') {
      jobInput += `\n## Instructions for Research\n`;
      jobInput += `1. Use the search tool to find information about the topic\n`;
      jobInput += `2. Format your response as a comprehensive research summary\n`;
      jobInput += `3. Include key facts, statistics, and insights\n`;
      jobInput += `4. Organize information in a clear, structured format\n`;
      jobInput += `5. Cite sources where possible\n\n`;
      jobInput += `Example of using the search tool: [TOOL: search(${inputs.topic || 'topic'})]\n\n`;
    }

    return jobInput;
  }

  /**
   * Process a template string with variables
   * @param {string} template - Template string with {variable} placeholders
   * @param {Object} variables - Variables to replace in the template
   * @returns {string} - Processed template
   */
  processTemplate(template, variables) {
    return template.replace(/{([^}]+)}/g, (match, variable) => {
      return variables[variable] || '';
    });
  }
}

