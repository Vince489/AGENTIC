import { Agent } from './Agent.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { searchTool } from './searchTool.js'; // Corrected import path for searchTool
import { ToolHandler } from './toolHandler.js'; // Import ToolHandler
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is not set.');
  console.error('Create a .env file with your API key or export it manually.');
  process.exit(1);
}

const gemini = new GeminiProvider(apiKey);

// Create agent with the search tool and tool handler
const agent = new Agent({
  id: "SearchAgentId", // Added a unique ID for the agent
  name: "SearchAgent", // Using the name from the previous attempt
  description: "An agent that searches for information.", // Generic description
  role: "You are a helpful assistant that uses the search tool to find information.", // Role focusing on search
  llmProvider: gemini,
  tools: {
    search: searchTool
  },
  toolHandler: new ToolHandler() // Add the tool handler
});

// Prompt the agent to search for "popcorn" and run it
async function runAgent() {
    console.log("Running agent with search tool...");
    try {
        await agent.run("Search for information about popcorn."); // Prompt the agent
        console.log("Agent finished.");
    } catch (error) {
        console.error("Error running agent:", error);
    }
}

runAgent();
