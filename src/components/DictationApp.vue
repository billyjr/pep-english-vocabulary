<template>
  <div class="dictation-app">
    <h1>Dictation Practice</h1>

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
        <h3 v-if="words.length > 0">Current Word: {{ currentIndex + 1 }} / {{ words.length }}</h3>
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
  </div>
</template>

<script>
export default {
  name: 'DictationApp',
  data() {
    return {
      words: [],
      currentIndex: 0,
      isWordShown: false,
      synth: window.speechSynthesis,
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
      preparationCountdown: 5
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
    startAutoPlay() {
      if (this.isPlaying && !this.isPaused) return

      // Start preparation countdown
      this.isPreparing = true
      this.preparationCountdown = 5

      const prepTimer = setInterval(() => {
        this.preparationCountdown--
        if (this.preparationCountdown <= 0) {
          clearInterval(prepTimer)
          this.isPreparing = false
          this.startPlayback()
        }
      }, 1000)
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

      this.playCount = 0
      this.isWordShown = false

      // Play first time
      this.playCurrentWord()
      this.playCount++

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
            this.playCurrentWordTwice()
          } else {
            this.isPlaying = false
          }
        }
      }, 1000)
    },
    playCurrentWord() {
      if (!this.currentWord) return

      const utterance = new SpeechSynthesisUtterance(this.currentWord)
      utterance.rate = 0.8
      this.synth.speak(utterance)
    },
    showWord() {
      this.isWordShown = true
    },
    nextWord() {
      if (this.currentIndex < this.words.length - 1) {
        this.currentIndex++
        this.isWordShown = false
      }
    }
  },
  beforeUnmount() {
    // Clean up timers when component is destroyed
    clearTimeout(this.playTimer)
    clearInterval(this.countdownTimer)
    this.synth.cancel()
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
</style>
