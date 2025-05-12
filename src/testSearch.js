import { searchTool } from './searchTool.js';

async function runTest() {
    console.log("Running searchTool test...");
    try {
        const results = await searchTool.execute({ query: "popcorn" });
        console.log("Search Results:", results);
    } catch (error) {
        console.error("Error running searchTool:", error);
    }
}

runTest();
