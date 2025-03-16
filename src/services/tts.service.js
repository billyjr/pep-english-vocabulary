import axios from 'axios';
import { textToSpeech } from './elevenlabs';

class TTSService {
  constructor() {
    this.audioCache = new Map();
    this.urlCache = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.maxConcurrent = 3; // Maximum concurrent requests
  }

  async getAudioUrl(text, filename, attempt = 1) {
    try {
      // Check URL cache first
      if (this.urlCache.has(filename)) {
        return this.urlCache.get(filename);
      }

      // Check if audio exists in Cloudinary
      const checkResponse = await axios.get(`/api/save-audio?filename=${encodeURIComponent(filename)}`);

      if (checkResponse.data.exists) {
        const url = checkResponse.data.url;
        this.urlCache.set(filename, url);
        return url;
      }

      // If not in Cloudinary, generate new audio
      const audioData = await textToSpeech(text);

      // Save to Cloudinary
      const saveResponse = await axios.post('/api/save-audio', {
        audio: audioData,
        filename
      });

      const url = saveResponse.data.url;
      this.urlCache.set(filename, url);
      return url;
    } catch (error) {
      if (attempt < this.maxRetries) {
        // Wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.getAudioUrl(text, filename, attempt + 1);
      }
      throw error;
    }
  }

  async loadAudioFile(url, filename, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        audio.oncanplaythrough = null;
        audio.onerror = null;
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Audio loading timeout'));
      }, timeout);

      audio.oncanplaythrough = () => {
        cleanup();
        this.audioCache.set(filename, audio);
        resolve(audio);
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error('Failed to load audio'));
      };
    });
  }

  async preloadAudio(words, progressCallback) {
    const total = words.length;
    let completed = 0;
    let failures = 0;

    // Process words in chunks to limit concurrent requests
    for (let i = 0; i < words.length; i += this.maxConcurrent) {
      const chunk = words.slice(i, i + this.maxConcurrent);

      try {
        await Promise.all(chunk.map(async word => {
          const filename = `${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp3`;

          try {
            // Try to get the URL with retries
            const url = await this.getAudioUrl(word, filename);

            // Try to load the audio with retries
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
              try {
                await this.loadAudioFile(url, filename);
                completed++;
                break; // Success, exit retry loop
              } catch (error) {
                if (attempt === this.maxRetries) {
                  throw error; // Last attempt failed
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
              }
            }
          } catch (error) {
            console.error(`Failed to preload audio for word: ${word}`, error);
            failures++;
          }

          // Update progress after each word (success or failure)
          if (progressCallback) {
            progressCallback((completed / total) * 100);
          }
        }));

        // Add a small delay between chunks to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Chunk processing error:', error);
      }
    }

    // Return detailed results
    return {
      total,
      completed,
      failures,
      successRate: (completed / total)
    };
  }

  async playAudio(text, filename) {
    try {
      // Check if we have a cached audio object
      if (this.audioCache.has(filename)) {
        const cachedAudio = this.audioCache.get(filename);
        cachedAudio.currentTime = 0;
        return cachedAudio;
      }

      const url = await this.getAudioUrl(text, filename);
      const audio = await this.loadAudioFile(url, filename);
      return audio;
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  clearCache() {
    // Stop all cached audio
    for (const audio of this.audioCache.values()) {
      audio.pause();
      audio.currentTime = 0;
    }

    // Clear both caches
    this.audioCache.clear();
    this.urlCache.clear();
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
