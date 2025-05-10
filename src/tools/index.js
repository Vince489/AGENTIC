// Import all tools
import { dateTimeTool } from './datetime.js';
import mapsTools from './maps.js';
import search from './search_tool/search.js';
import { calculatorTool } from './calc-2.js';
import { generateImage } from './imageGenerator.js';

/**
 * Register all tools with the agent factory
 * @param {Object} agentFactory - The agent factory to register tools with
 */
export function registerAllTools(agentFactory) {
  // Register datetime tool
  agentFactory.registerTool('datetime', dateTimeTool);

  // Register maps tools
  agentFactory.registerTool('searchGoogleMaps', mapsTools.searchGoogleMaps);
  agentFactory.registerTool('webSearch', mapsTools.webSearch);

  // Register search tool directly
  agentFactory.registerTool('search', async (query) => {
    console.log(`🔍 Searching for: ${query}`);
    return await search(query);
  });

  // Register calculator tool
  agentFactory.registerTool('calc-2', (expression) => {
    console.log(`🧮 Calculating: ${expression}`);
    return calculatorTool(expression);
  });

  // Register image generation tool
  agentFactory.registerTool('generateImage', async (prompt, outputFilename, outputDirectoryRelPath) => {
    console.log(`🖼️ Generating image for prompt: "${prompt}"`);
    // outputFilename and outputDirectoryRelPath are optional for the tool itself
    return await generateImage(prompt, outputFilename, outputDirectoryRelPath);
  });

  console.log('All tools registered successfully');
}
