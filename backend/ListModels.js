
import axios from 'axios';

// Replace with your Google API key (ensure it's valid and has access to the Generative AI API)
const apiKey = 'AIzaSyDGJWN7lDCXRDFHsnelj0Ob6JhcXjQh9tQ';

// Function to list available models
async function listAvailableModels() {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models';  // List models endpoint

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,  // Use Bearer token (OAuth or API Key)
      },
    });

    console.log('Available Models:', response.data);  // Output available models to console
    return response.data;  // Return available models data
  } catch (error) {
    console.error('Error fetching models:', error.response ? error.response.data : error.message);
  }
}

// Run the function to list models
listAvailableModels();
