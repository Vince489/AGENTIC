// Import packages
import pkg from "@googlemaps/google-maps-services-js";
const { Client } = pkg;
import { webSearch as performWebSearch } from '../search_tool.js';

const apiKey = 'AIzaSyA_Ksvh5au3HZvehsyK7rvOyplK1p4thM0';

/**
 * Search tools module for agent-framework-2
 * Provides various search-related tools
 */

/**
 * Searches Google Maps for hotels near a given location.
 * @param {string} query - The search query (e.g., "hotels near Winter Haven").
 * @param {string} location - The location to search near (e.g., "730 Sunset Cove Dr, Winter Haven, FL 33880").
 * @param {number} radius - The search radius in miles.
 * @returns {Promise<Array>} - A promise that resolves to an array of hotel objects.
 */
async function searchGoogleMaps(query, location, radius) {
  const client = new Client();

  try {
    // Geocode the address to get latitude and longitude
    const geocodeRequest = {
      params: {
        address: location,
        key: apiKey,
      },
      timeout: 1000, // milliseconds
    };

    const geocodeResponse = await client.geocode(geocodeRequest);

    if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;

      const nearbySearchResponse = await client.placesNearby({
        params: {
          key: apiKey,
          location: { lat, lng },
          radius: radius * 1609.34, // Convert miles to meters
          type: "hotel",
          keyword: query,
        },
        timeout: 1000, // milliseconds
      });

      if (nearbySearchResponse.data.results) {
        const hotelDetails = await Promise.all(
          nearbySearchResponse.data.results.map(async (result) => {
            try {
              const placeDetailsResponse = await client.placeDetails({
                params: {
                  place_id: result.place_id,
                  key: apiKey,
                  fields: ['name', 'vicinity', 'rating', 'price_level'],
                },
                timeout: 1000, // milliseconds
              });

              const priceLevel = placeDetailsResponse.data.result.price_level;

              return {
                name: result.name,
                address: result.vicinity,
                rating: result.rating,
                price_level: priceLevel,
              };
            } catch (error) {
              console.error("Error fetching place details:", error);
              return {
                name: result.name,
                address: result.vicinity,
                rating: result.rating,
                price_level: undefined,
              };
            }
          })
        );
        return hotelDetails;
      } else {
        return [];
      }
    } else {
      console.error("Geocoding failed for address:", location);
      return [];
    }
  } catch (error) {
    console.error("Error searching Google Maps:", error);
    return [];
  }
}

/**
 * Real web search tool implementation using our existing search functionality
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Search results
 */
export async function webSearch(query) {
  console.log(`🔍 Performing web search for: ${query}`);

  try {
    // Use the webSearch function from search_tool.js
    return await performWebSearch(query);
  } catch (error) {
    console.error('Error performing web search:', error);
    return [{
      title: 'Search Error',
      snippet: `Failed to perform search: ${error.message}`,
      url: '#'
    }];
  }
}

/**
 * Real web search implementation (if you have an API key)
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Search results
 */
export async function realWebSearch(query) {
  // For now, just use the mock implementation
  // In a real implementation, this would use a real search API
  return webSearch(query);
}

// Export a default object with all search tools
export default {
  realWebSearch,
  searchGoogleMaps,
  webSearch,
};
