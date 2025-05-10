// Import the search functionality from the search_tool directory
import search from './tools/search_tool/search.js';

/**
 * Perform a web search using the search tool
 * @param {string} query - The search query
 * @returns {Promise<Array>} - An array of search results
 */
export async function webSearch(query) {
  console.log(`🔍 Performing web search for: ${query}`);
  
  try {
    return await search(query);
  } catch (error) {
    console.error('Error performing web search:', error);
    return [{
      title: 'Search Error',
      snippet: `Failed to perform search: ${error.message}`,
      url: '#'
    }];
  }
}

// Export the search function as default
export default {
  webSearch
};
