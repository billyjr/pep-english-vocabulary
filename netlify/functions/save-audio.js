import pkg from 'cloudinary';
const { v2: cloudinary } = pkg;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handler = async (event) => {
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
          body: JSON.stringify({ exists: true, url: result.secure_url }),
        };
      } catch (error) {
        console.log('Cloudinary error:', error);
        // Check if it's a "not found" error
        if (error.error && error.error.http_code === 404) {
          console.log('Audio file not found');
          return {
            statusCode: 200,  // Changed from 404 to 200 to match expected response
            body: JSON.stringify({ exists: false }),
          };
        }
        // For other errors, throw them to be caught by the outer try-catch
        throw error;
      }
    } catch (error) {
      console.error('Error checking audio:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to check audio file', details: error.message }),
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
        body: JSON.stringify({
          url: uploadResponse.secure_url,
          public_id: uploadResponse.public_id,
        }),
      };
    } catch (error) {
      console.error('Error saving audio:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save audio file', details: error.message }),
      };
    }
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
