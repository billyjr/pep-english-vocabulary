const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = 'FGY2WhTYpPnrIDTdsKH5'
const BASE_URL = 'https://api.elevenlabs.io/v1'
const AUDIO_PATH = '/downloads/audio'

class TTSServiceClass {
  constructor() {
    this.audioCache = new Map()
  }

  async getLocalAudio(word) {
    try {
      const safeName = encodeURIComponent(word.replace(/[^a-zA-Z0-9]/g, '_'))
      const response = await fetch(`${AUDIO_PATH}/${safeName}.mp3`)
      if (!response.ok) {
        console.log(`No cached audio found for: ${word}`)
        return null
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        console.log(`Empty audio file for: ${word}`)
        return null
      }

      const audio = new Audio()
      const url = URL.createObjectURL(blob)
      audio.src = url

      // Verify the audio can be loaded
      return new Promise(resolve => {
        audio.oncanplaythrough = () => resolve(audio)
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          console.error(`Error loading audio for: ${word}`)
          resolve(null)
        }
        // Set source after adding event listeners
        audio.load()
      })
    } catch (error) {
      console.error('Error fetching local audio:', error)
      return null
    }
  }

  async saveLocalAudio(word, blob) {
    try {
      const safeName = encodeURIComponent(word.replace(/[^a-zA-Z0-9]/g, '_'))
      const formData = new FormData()
      formData.append('audio', blob, `${safeName}.mp3`)

      const response = await fetch('/api/save-audio', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to save audio file')
      }
    } catch (error) {
      console.error('Error saving audio:', error)
      throw error
    }
  }

  async preloadAudio(words, progressCallback) {
    const total = words.length
    let completed = 0

    for (const word of words) {
      if (!this.audioCache.has(word)) {
        try {
          const audio = await this.getAudioForWord(word)
          this.audioCache.set(word, audio)
        } catch (error) {
          console.error(`Failed to preload audio for word: ${word}`, error)
        }
      }
      completed++
      if (progressCallback) {
        progressCallback((completed / total) * 100)
      }
    }
  }

  async getAudioForWord(word) {
    // First try to get from local storage
    const localAudio = await this.getLocalAudio(word)
    if (localAudio) {
      console.log(`Using cached audio for: ${word}`)
      return localAudio
    }

    // If not in local storage, fetch from API
    console.log(`Fetching audio from API for: ${word}`)
    const response = await fetch(`${BASE_URL}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: word,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })

    // Save to local storage
    await this.saveLocalAudio(word, blob)

    return new Audio(URL.createObjectURL(blob))
  }

  async playWord(word) {
    let audio
    if (this.audioCache.has(word)) {
      audio = this.audioCache.get(word)
    } else {
      audio = await this.getAudioForWord(word)
      this.audioCache.set(word, audio)
    }

    return new Promise((resolve, reject) => {
      audio.onended = resolve
      audio.onerror = reject
      audio.currentTime = 0 // Reset audio to start
      audio.play().catch(reject)
    })
  }

  clearCache() {
    // Clear memory cache only
    this.audioCache.forEach(audio => {
      if (audio.src) {
        URL.revokeObjectURL(audio.src)
      }
    })
    this.audioCache.clear()
  }
}

export const TTSService = new TTSServiceClass()
