export class ToolHandler {
  async handleToolCalls(llmResponseText, tools, toolExecutor, toolResultFormatter) {
    // This is a basic implementation. A more robust handler would parse
    // the LLM's response based on a defined format (e.g., JSON, specific tags)
    // to identify tool calls and their parameters.

    // Look for a ```tool_code``` block
    const toolCodeBlockMatch = llmResponseText.match(/```tool_code\n([\s\S]*?)\n```/);

    if (toolCodeBlockMatch && toolCodeBlockMatch[1]) {
      const toolCode = toolCodeBlockMatch[1];

      // Look for the search query within the tool code block
      const searchQueryMatch = toolCode.match(/queries=\["(.*?)"\]/);

      if (searchQueryMatch && searchQueryMatch[1]) {
        const toolName = 'search'; // Assume the tool is 'search' based on the format
        const searchQuery = searchQueryMatch[1];

        if (tools[toolName]) {
          try {
            const result = await toolExecutor(toolName, { query: searchQuery }); // Pass as { query: string }
            // Print the tool result to the console for the user to see
            console.log("\n--- Search Result ---");
            console.log(result);
            console.log("---------------------\n");
            // Format the tool result and append it to the response for the next LLM turn
            return llmResponseText + toolResultFormatter(toolName, JSON.stringify({ query: searchQuery }), result);
          } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            // Append error information to the response
            return llmResponseText + `\n\n### Error calling ${toolName}:\n${error.message}\n\n`;
          }
        } else {
          console.warn(`Tool ${toolName} not found.`);
          // Append a message indicating the tool was not found
          return llmResponseText + `\n\n### Tool not found:\n${toolName}\n\n`;
        }
      }
    }

    // If no tool call is detected or processed, return the original response
    return llmResponseText;
  }
}
