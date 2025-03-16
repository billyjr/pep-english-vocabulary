const VOICE_ID = 'FGY2WhTYpPnrIDTdsKH5';
const BASE_URL = 'https://api.elevenlabs.io/v1';

export async function textToSpeech(text) {
  try {
    // Log to debug
    console.log('API Key:', import.meta.env.VITE_ELEVENLABS_PATH);

    const response = await fetch(`${BASE_URL}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': import.meta.env.VITE_ELEVENLABS_PATH,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:audio/mpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error in textToSpeech:', error);
    throw error;
  }
}
