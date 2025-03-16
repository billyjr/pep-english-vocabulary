import pkg from 'cloudinary';
const { v2: cloudinary } = pkg;

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Add debug logging for configuration
console.log('Cloudinary Configuration:', {
  cloud_name: cloudinaryConfig.cloud_name,
  api_key: cloudinaryConfig.api_key ? '***' : 'missing',
  api_secret: cloudinaryConfig.api_secret ? '***' : 'missing'
});

if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('Missing Cloudinary configuration');
}

cloudinary.config(cloudinaryConfig);

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

  console.log('Request received:', {
    method: event.httpMethod,
    path: event.path,
    params: event.queryStringParameters,
    body: event.body ? JSON.parse(event.body) : null
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
      console.log('Checking for audio file:', publicId);

      try {
        const result = await cloudinary.api.resource(publicId, { resource_type: 'video' });
        console.log('Audio file found:', result.secure_url);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ exists: true, url: result.secure_url }),
        };
      } catch (error) {
        console.log('Cloudinary error:', error);
        // Check if it's a "not found" error
        if (error.error && error.error.http_code === 404) {
          console.log('Audio file not found');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ exists: false }),
          };
        }
        throw error;
      }
    } catch (error) {
      console.error('Error checking audio:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to check audio file',
          details: error.message,
          stack: error.stack
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
      console.log('Uploading audio file:', publicId);

      // Upload to Cloudinary
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: 'auto',
        public_id: publicId,
        format: 'mp3',
      });

      console.log('Audio file uploaded:', uploadResponse.secure_url);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id,
        }),
      };
    } catch (error) {
      console.error('Error saving audio:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to save audio file',
          details: error.message,
          stack: error.stack
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
