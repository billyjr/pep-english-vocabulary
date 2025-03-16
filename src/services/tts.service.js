import axios from 'axios';
import { textToSpeech } from './elevenlabs';

class TTSService {
  constructor() {
    this.audioCache = new Map();
  }

  async getAudioUrl(text, filename) {
    try {
      console.log('Checking for audio:', filename);
      // Check if audio exists in Cloudinary
      const checkResponse = await axios.get(`/api/save-audio?filename=${encodeURIComponent(filename)}`);
      console.log('Check response:', checkResponse.data);

      if (checkResponse.data.exists) {
        console.log('Audio found in Cloudinary');
        return checkResponse.data.url;
      }

      // If not in Cloudinary, generate new audio
      console.log('Generating new audio...');
      const audioData = await textToSpeech(text);

      // Save to Cloudinary
      const saveResponse = await axios.post('/api/save-audio', {
        audio: audioData,
        filename
      });

      console.log('Save response:', saveResponse.data);
      return saveResponse.data.url;
    } catch (error) {
      console.error('Error in getAudioUrl:', error);
      throw error;
    }
  }

  async playAudio(text, filename) {
    try {
      const url = await this.getAudioUrl(text, filename);
      console.log('Playing audio from URL:', url);

      // Create and play audio
      const audio = new Audio(url);
      await audio.play();

      return audio;
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  async preloadAudio(words, progressCallback) {
    const total = words.length;
    let completed = 0;

    for (const word of words) {
      try {
        const filename = `${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp3`;
        await this.getAudioUrl(word, filename);
      } catch (error) {
        console.error(`Failed to preload audio for word: ${word}`, error);
      }
      completed++;
      if (progressCallback) {
        progressCallback((completed / total) * 100);
      }
    }
  }

  clearCache() {
    this.audioCache.clear();
  }
}

export const ttsService = new TTSService();

export async function generateAndSaveAudio(text) {
  try {
    // Generate audio using ElevenLabs
    const audioData = await textToSpeech(text);

    // Create a filename from the text (sanitized)
    const filename = text.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Save audio using Netlify function
    const response = await fetch('/api/save-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        filename: `${filename}.mp3`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save audio: ${response.statusText}`);
    }

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Error in generateAndSaveAudio:', error);
    throw error;
  }
}
