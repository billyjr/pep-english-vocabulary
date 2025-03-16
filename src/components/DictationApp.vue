<template>
  <div class="dictation-app">
    <h1>听写小助手</h1>

    <!-- Selection Form -->
    <div class="selection-form">
      <div class="form-group">
        <label for="edition">教材:</label>
        <select v-model="filters.edition" id="edition" class="form-select" :disabled="isPlaying">
          <option value="1">人教版</option>
        </select>
      </div>

      <div class="form-group">
        <label for="grade">年级:</label>
        <select v-model="filters.grade" id="grade" class="form-select" :disabled="isPlaying">
          <option value="1">一</option>
          <option value="2">二</option>
          <option value="3">三</option>
          <option value="4">四</option>
          <option value="5">五</option>
          <option value="6">六</option>
        </select>
      </div>

      <div class="form-group">
        <label for="term">学期:</label>
        <select v-model="filters.term" id="term" class="form-select" :disabled="isPlaying">
          <option value="1">上学期</option>
          <option value="2">下学期</option>
        </select>
      </div>

      <div class="form-group">
        <label for="unit">单元:</label>
        <select v-model="filters.unit" id="unit" class="form-select" :disabled="isPlaying">
          <option v-for="unit in unitOptions" :key="unit.id" :value="unit.id">
            第{{ unit.id }}单元 - {{ unit.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Word Display and Controls -->
    <div class="controls">
      <div class="word-display">
        <h2 :class="{ 'text-warning': words.length === 0 }">{{ currentUnitName }}</h2>
        <div class="current-word-display">
          <h3 v-if="words.length > 0">Current Word: {{ currentIndex + 1 }} / {{ words.length }}</h3>
          <div v-if="isLoading" class="inline-spinner"></div>
        </div>
        <div class="audio-controls">
          <button
            class="btn icon-btn"
            @click="toggleMute"
            :title="isMuted ? 'Unmute' : 'Mute'"
          >
            <span class="material-icons">
              {{ isMuted ? 'volume_off' : isPlaying ? 'volume_up' : 'volume_up' }}
            </span>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            v-model="volume"
            class="volume-slider"
            :title="'Volume: ' + Math.round(volume * 100) + '%'"
          />
        </div>
        <div v-if="audioError" class="error-message">
          {{ audioError }}
          <button class="btn secondary" @click="retryAudio">Retry</button>
        </div>
        <div v-if="isPreparing" class="countdown">
          Ready to start in: {{ preparationCountdown }} seconds
        </div>
        <div v-if="isPlaying" class="countdown">
          Next word in: {{ countdown }} seconds
        </div>
      </div>
      <div v-if="words.length > 0" class="buttons">
        <button
          @click="startAutoPlay"
          class="btn primary"
          :disabled="isPlaying && !isPaused"
        >
          Start Auto Play
        </button>
        <button
          v-if="!isPaused"
          @click="pauseAutoPlay"
          class="btn warning"
          :disabled="!isPlaying"
        >
          Pause
        </button>
        <button
          v-else
          @click="resumePlayback"
          class="btn warning"
        >
          Resume
        </button>
        <button
          @click="showWord"
          class="btn secondary"
          :disabled="isWordShown"
        >
          Show Word
        </button>
      </div>
      <div v-if="isWordShown && words.length > 0" class="word-details">
        <p class="word">{{ currentWordDetails.english }}</p>
        <p class="phonetic">{{ currentWordDetails.phonetic }}</p>
        <p class="chinese">{{ currentWordDetails.chinese }}</p>
      </div>
    </div>

    <!-- Loading Progress -->
    <div v-if="isPreloading" class="preloading-overlay">
      <div class="preloading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">
          {{ loadingMessage }}
        </div>
        <div class="loading-progress">
          Loading audio files: {{ Math.round(preloadProgress) }}%
        </div>
      </div>
    </div>

    <!-- Error with retry option -->
    <div v-if="audioError && showRetryPreload" class="error-overlay">
      <div class="error-content">
        <div class="error-message">{{ audioError }}</div>
        <button class="btn primary" @click="retryPreload">
          Retry Loading
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ttsService } from '../services/tts.service'

export default {
  name: 'DictationApp',
  data() {
    return {
      words: [],
      currentIndex: 0,
      isWordShown: false,
      filters: {
        edition: '1',
        grade: '1',
        term: '1',
        unit: '1'
      },
      allWords: [], // Store all words from CSV
      currentUnitName: '',
      isPlaying: false,
      isPaused: false,
      countdown: 5,
      playTimer: null,
      countdownTimer: null,
      playCount: 0, // Track how many times current word has been played
      resumeState: null, // Store state for resuming
      isPreparing: false,
      preparationCountdown: 5,
      isLoading: false,
      isPreloading: false,
      preloadProgress: 0,
      volume: 1,
      isMuted: false,
      previousVolume: 1,
      audioError: null,
      currentAudio: null,
      loadingMessage: '',
      showRetryPreload: false
    }
  },
  mounted() {
    this.loadDefaultWords()
  },
  watch: {
    filters: {
      handler() {
        this.applyFilters()
      },
      deep: true
    },
    volume(newVolume) {
      // Update current audio volume if it exists
      if (this.currentAudio) {
        this.currentAudio.volume = newVolume;
      }
      // Update muted state
      this.isMuted = newVolume === 0;
      if (!this.isMuted) {
        this.previousVolume = newVolume;
      }
    }
  },
  computed: {
    currentWord() {
      return this.words[this.currentIndex]?.english || ''
    },
    currentWordDetails() {
      const word = this.words[this.currentIndex]
      if (!word) return null
      return {
        english: word.english,
        chinese: word.chinese,
        phonetic: word.phonetic
      }
    },
    unitOptions() {
      // Get unique units for current edition/grade/term
      const units = this.allWords
        .filter(word =>
          word.edition === this.filters.edition &&
          word.grade === this.filters.grade &&
          word.term === this.filters.term
        )
        .reduce((acc, word) => {
          if (!acc.find(u => u.id === word.unitId)) {
            acc.push({
              id: word.unitId,
              name: word.unitName
            })
          }
          return acc
        }, [])
        .sort((a, b) => Number(a.id) - Number(b.id))
      return units
    }
  },
  methods: {
    async loadDefaultWords() {
      try {
        const response = await fetch('/data/pep_english_vocabulary_full.csv')
        const text = await response.text()
        this.parseCSVData(text)
        this.applyFilters()
      } catch (error) {
        console.error('Error loading default vocabulary:', error)
        this.allWords = []
        this.words = []
      }
    },
    parseCSVData(csvText) {
      const lines = csvText.split('\n')
      console.log('Total CSV lines:', lines.length)

      this.allWords = lines.slice(1)
        .map(line => {
          if (!line.trim()) return null
          const values = line.split(',')
          // Check if we have minimum required fields (up to english and chinese)
          if (values.length < 8) {
            console.warn('Skipping malformed line:', line)
            return null
          }
          try {
            const word = {
              edition: String(values[0] || '').trim(),
              grade: String(values[1] || '').trim(),
              term: String(values[2] || '').trim(),
              unitId: String(values[3] || '').trim(),
              unitName: String(values[4] || '').trim(),
              sn: String(values[5] || '').trim(),
              english: String(values[6] || '').trim(),
              chinese: String(values[7] || '').trim(),
              phonetic: values.length >= 9 ? String(values[8] || '').trim() : '' // Handle missing phonetic
            }
            // Debug log for grade 6 term 2 unit 6 entries
            if (word.grade === '6' && word.term === '2' && word.unitId === '6') {
              console.log('Found Grade 6 Term 2 Unit 6 word:', word)
            }
            return word
          } catch (error) {
            console.warn('Error parsing line:', line, error)
            return null
          }
        })
        .filter(word => {
          // Filter out null entries and entries with missing required fields
          // Note: phonetic is not required
          const isValid = word !== null &&
            word.edition &&
            word.grade &&
            word.term &&
            word.unitId &&
            word.english &&
            word.chinese
          if (!isValid) {
            console.warn('Filtering out invalid word:', word)
          }
          return isValid
        })

      console.log('Loaded words count:', this.allWords.length)

      // Debug count of grade 6 term 2 unit 6 words after parsing
      const grade6Term2Unit6Count = this.allWords.filter(word =>
        word.grade === '6' && word.term === '2' && word.unitId === '6'
      ).length
      console.log('Grade 6 Term 2 Unit 6 words count after parsing:', grade6Term2Unit6Count)
    },
    applyFilters() {
      console.log('Applying filters:', this.filters)
      console.log('Total words before filtering:', this.allWords.length)

      // Debug log for grade 6 term 2 unit 6 words
      const grade6Term2Unit6 = this.allWords.filter(word =>
        word.grade === '6' && word.term === '2' && word.unitId === '6'
      )
      console.log('Grade 6 Term 2 Unit 6 words:', grade6Term2Unit6)

      this.words = this.allWords.filter(word => {
        const matches =
          word.edition === this.filters.edition &&
          word.grade === this.filters.grade &&
          word.term === this.filters.term &&
          word.unitId === this.filters.unit

        if (matches) {
          console.log('Matched word:', word)
        }
        return matches
      })

      // Update current unit name
      const firstWord = this.words[0]
      this.currentUnitName = firstWord ? firstWord.unitName : ''

      // Reset position and state
      this.currentIndex = 0
      this.isWordShown = false // Ensure words are hidden when filters change

      // If no words found, clear the unit name
      if (this.words.length === 0) {
        this.currentUnitName = 'No words found for this selection'
      }

      // Reset resume state when filters change
      this.resumeState = null
      this.isPaused = false

      console.log('Filtered words count:', this.words.length)
    },
    async startAutoPlay() {
      if (this.isPlaying && !this.isPaused) return;

      // Start preloading
      this.isPreloading = true;
      this.preloadProgress = 0;
      this.audioError = null;

      try {
        // Create a queue of all words to preload
        const wordsToPreload = this.words.map(word => word.english);

        // Show initial loading message
        this.loadingMessage = 'Starting audio preload...';

        // Preload all audio files with progress tracking
        const result = await ttsService.preloadAudio(wordsToPreload, (progress) => {
          this.preloadProgress = progress;
          // Update loading message based on progress
          if (progress < 33) {
            this.loadingMessage = 'Loading audio files...';
          } else if (progress < 66) {
            this.loadingMessage = 'Preparing audio playback...';
          } else {
            this.loadingMessage = 'Almost ready...';
          }
        });

        // Check if we have enough successful loads
        if (result.successRate < 0.8) {
          throw new Error(`Failed to load enough audio files (${Math.round(result.successRate * 100)}% loaded). Please try again.`);
        }

        // Start preparation countdown
        this.isPreparing = true;
        this.preparationCountdown = 5;
        this.loadingMessage = 'Starting playback...';

        const prepTimer = setInterval(() => {
          this.preparationCountdown--;
          if (this.preparationCountdown <= 0) {
            clearInterval(prepTimer);
            this.isPreparing = false;
            this.startPlayback();
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to preload audio:', error);
        this.audioError = error.message;
        // Add retry button for preloading
        this.showRetryPreload = true;
      } finally {
        this.isPreloading = false;
        this.loadingMessage = '';
      }
    },
    async retryPreload() {
      this.showRetryPreload = false;
      this.audioError = null;
      await this.startAutoPlay();
    },
    prepareCurrentUtterance() {
      if (!this.currentWord) return

      if (!this.currentUtterance) {
        this.currentUtterance = new SpeechSynthesisUtterance(this.currentWord)
        this.currentUtterance.rate = 0.8
      }
    },
    prepareNextUtterance() {
      if (this.currentIndex < this.words.length - 1) {
        const nextWord = this.words[this.currentIndex + 1].english
        this.nextUtterance = new SpeechSynthesisUtterance(nextWord)
        this.nextUtterance.rate = 0.8
      }
    },
    startPlayback() {
      // Always start from beginning
      this.isPlaying = true
      this.isPaused = false
      this.resumeState = null
      this.currentIndex = 0
      this.playCount = 0
      this.isWordShown = false
      this.playCurrentWordTwice()
    },
    resumePlayback() {
      if (!this.resumeState) return
      this.isPlaying = true
      this.isPaused = false

      // Resume from stored state
      this.currentIndex = this.resumeState.currentIndex
      this.playCount = this.resumeState.playCount
      this.isWordShown = this.resumeState.isWordShown
      this.continuePlayback()
    },
    pauseAutoPlay() {
      this.isPlaying = false
      this.isPaused = true
      clearTimeout(this.playTimer)
      clearInterval(this.countdownTimer)
      this.synth.cancel()

      // Store current state for resuming
      this.resumeState = {
        currentIndex: this.currentIndex,
        playCount: this.playCount,
        isWordShown: this.isWordShown
      }
    },
    async continuePlayback() {
      if (!this.isPlaying) return

      if (this.playCount === 0) {
        // Haven't played current word yet
        this.playCurrentWordTwice()
      } else if (this.playCount === 1) {
        // Played once, need to play second time
        this.playCurrentWord()
        this.playCount++

        // Start countdown for next word
        if (this.currentIndex < this.words.length - 1) {
          this.startCountdown()
        } else {
          this.isPlaying = false
          this.isPaused = false
        }
      } else {
        // Already played twice, just continue with countdown
        this.startCountdown()
      }
    },
    async playCurrentWordTwice() {
      if (!this.isPlaying) return

      // Play first time using cached utterance
      this.playCurrentWord()
      this.playCount++

      // Prepare next utterance during the wait
      this.prepareNextUtterance()

      // Wait 3 seconds and play second time
      await new Promise(resolve => setTimeout(resolve, 3000))
      if (!this.isPlaying) return

      this.playCurrentWord()
      this.playCount++

      // Start countdown for next word
      if (this.currentIndex < this.words.length - 1) {
        this.startCountdown()
      } else {
        this.isPlaying = false
      }
    },
    startCountdown() {
      this.countdown = 5
      clearInterval(this.countdownTimer)

      this.countdownTimer = setInterval(() => {
        if (!this.isPlaying) {
          clearInterval(this.countdownTimer)
          return
        }

        this.countdown--
        if (this.countdown <= 0) {
          clearInterval(this.countdownTimer)
          if (this.currentIndex < this.words.length - 1) {
            this.currentIndex++
            this.isWordShown = false // Reset word visibility for next word
            // Use the preloaded next utterance as current
            this.currentUtterance = this.nextUtterance
            this.nextUtterance = null
            this.playCurrentWordTwice()
          } else {
            this.isPlaying = false
          }
        }
      }, 1000)
    },
    async playCurrentWord() {
      if (!this.currentWord) return;

      try {
        this.isLoading = true;
        this.audioError = null;
        const text = this.currentWord;
        const filename = `${text.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mp3`;

        // Stop any currently playing audio
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }

        const audio = await ttsService.playAudio(text, filename);
        this.currentAudio = audio;

        // Set volume
        audio.volume = this.volume;

        // Add loading state handling
        let isLoaded = false;

        // Promise to handle audio loading
        const loadPromise = new Promise((resolve, reject) => {
          // Handle successful loading
          audio.oncanplaythrough = () => {
            isLoaded = true;
            resolve();
          };

          // Handle loading error
          audio.onerror = (error) => {
            console.error('Audio loading error:', error);
            reject(new Error('Failed to load audio file'));
          };

          // Handle loading timeout after 10 seconds
          setTimeout(() => {
            if (!isLoaded) {
              reject(new Error('Audio loading timed out'));
            }
          }, 10000);
        });

        // Wait for audio to load
        await loadPromise;

        // Start playback only after successful loading
        await audio.play();

        // Add error handling
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          this.audioError = 'Failed to play audio. Click retry to try again.';
          this.isLoading = false;
        };

        // Add ended handler
        audio.onended = () => {
          this.currentAudio = null;
        };

        // Monitor playback
        const playbackCheck = setInterval(() => {
          if (!audio.paused && audio.currentTime > 0) {
            // Audio is actually playing, clear the check
            clearInterval(playbackCheck);
          } else if (audio.ended) {
            // Audio has finished, clear the check
            clearInterval(playbackCheck);
          } else if (!this.isLoading && !this.audioError) {
            // If we're not loading and don't have an error, but audio isn't playing
            this.audioError = 'Audio playback failed to start. Click retry to try again.';
            clearInterval(playbackCheck);
          }
        }, 500);

      } catch (error) {
        console.error('Error playing word:', error);
        this.audioError = error.message || 'Failed to play audio. Click retry to try again.';
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
      } finally {
        this.isLoading = false;
      }
    },
    showWord() {
      this.isWordShown = true
    },
    nextWord() {
      if (this.currentIndex < this.words.length - 1) {
        this.currentIndex++
        this.isWordShown = false
      }
    },
    toggleMute() {
      if (this.isMuted) {
        this.volume = this.previousVolume;
        this.isMuted = false;
      } else {
        this.previousVolume = this.volume;
        this.volume = 0;
        this.isMuted = true;
      }
    },
    retryAudio() {
      this.audioError = null;
      this.playCurrentWord();
    }
  },
  beforeUnmount() {
    // Clean up timers and audio when component is destroyed
    clearTimeout(this.playTimer)
    clearInterval(this.countdownTimer)
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    ttsService.clearCache()
  }
}
</script>

<style scoped>
.dictation-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.selection-form {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 100px;
  font-size: 1rem;
}

.form-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

label {
  font-weight: bold;
  color: #666;
}

.controls {
  margin-top: 2rem;
}

.word-display {
  text-align: center;
  margin-bottom: 2rem;
}

.word-display h2 {
  color: #2196F3;
  margin-bottom: 0.5rem;
}

.word-display h2.text-warning {
  color: #ff9800;
}

.countdown {
  font-size: 1.2rem;
  color: #ff9800;
  margin-top: 1rem;
  font-weight: bold;
}

.buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background-color: #4CAF50;
  color: white;
}

.btn.secondary {
  background-color: #2196F3;
  color: white;
}

.btn.warning {
  background-color: #ff9800;
  color: white;
}

.word-details {
  text-align: center;
  margin-top: 2rem;
}

.word {
  font-size: 2rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.phonetic {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.chinese {
  font-size: 1.5rem;
  color: #2196F3;
}

.current-word-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.inline-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.preloading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.preloading-content {
  text-align: center;
  color: white;
}

.loading-text {
  margin-top: 1rem;
  font-size: 1.2rem;
}

.audio-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin: 1rem 0;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.volume-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  background: #ddd;
  outline: none;
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.error-message {
  color: #f44336;
  margin: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.material-icons {
  font-size: 24px;
  color: #4CAF50;
}

.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.error-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  max-width: 80%;
}

.loading-progress {
  margin-top: 0.5rem;
  font-size: 1rem;
  color: #4CAF50;
}
</style>
