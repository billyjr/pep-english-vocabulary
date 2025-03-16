import pkg from 'cloudinary';
import process from 'process';
const { v2: cloudinary } = pkg;

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Only log configuration status, not values
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('Missing required Cloudinary configuration');
}

cloudinary.config(cloudinaryConfig);

// Helper function to determine if we're in development
const isDevelopment = () => process.env.NODE_ENV === 'development';

// Safe logging function that only logs in development
const devLog = (...args) => {
  if (isDevelopment()) {
    console.log(...args);
  }
};

export const handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Development-only request logging
  devLog('Request received:', {
    method: event.httpMethod,
    path: event.path,
    params: event.queryStringParameters
  });

  // Handle GET request to check if audio exists
  if (event.httpMethod === 'GET') {
    try {
      const { filename } = event.queryStringParameters || {};
      if (!filename) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Filename is required' }),
        };
      }

      const publicId = `dictation-audio/${filename.replace('.mp3', '')}`;
      devLog('Checking for audio file:', publicId);

      try {
        const result = await cloudinary.api.resource(publicId, { resource_type: 'video' });
        devLog('Audio file found');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ exists: true, url: result.secure_url }),
        };
      } catch (error) {
        if (error.error && error.error.http_code === 404) {
          devLog('Audio file not found');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ exists: false }),
          };
        }
        throw error;
      }
    } catch (error) {
      console.error('Error checking audio');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to check audio file',
          ...(isDevelopment() && { details: error.message })
        }),
      };
    }
  }

  // Handle POST request to save audio
  if (event.httpMethod === 'POST') {
    try {
      const { audio, filename } = JSON.parse(event.body);
      if (!audio || !filename) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Audio data and filename are required' }),
        };
      }

      const publicId = `dictation-audio/${filename.replace('.mp3', '')}`;
      devLog('Uploading audio file:', publicId);

      // Upload to Cloudinary
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: 'auto',
        public_id: publicId,
        format: 'mp3',
      });

      devLog('Audio file uploaded successfully');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id,
        }),
      };
    } catch (error) {
      console.error('Error saving audio');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to save audio file',
          ...(isDevelopment() && { details: error.message })
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
