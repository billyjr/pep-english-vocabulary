<template>
  <div class="audio-test">
    <h2>Audio Test</h2>
    <div class="test-controls">
      <input v-model="testText" placeholder="Enter text to test" />
      <button @click="playAudio" :disabled="isLoading">
        {{ isLoading ? 'Loading...' : 'Play' }}
      </button>
    </div>
    <div v-if="error" class="error">
      {{ error }}
    </div>
    <div v-if="audioUrl" class="success">
      Last played audio URL: {{ audioUrl }}
    </div>
  </div>
</template>

<script>
import { ttsService } from '../services/tts.service';

export default {
  name: 'AudioTest',
  data() {
    return {
      testText: 'Hello, this is a test.',
      isLoading: false,
      error: null,
      audioUrl: null
    };
  },
  methods: {
    async playAudio() {
      this.isLoading = true;
      this.error = null;
      this.audioUrl = null;

      try {
        const filename = `test_${Date.now()}.mp3`;
        const url = await ttsService.getAudioUrl(this.testText, filename);
        this.audioUrl = url;

        const audio = new Audio(url);
        await audio.play();
      } catch (error) {
        console.error('Test failed:', error);
        this.error = error.message || 'Failed to play audio';
      } finally {
        this.isLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.audio-test {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1rem;
}

.test-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

input {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error {
  color: red;
  margin-top: 1rem;
}

.success {
  color: green;
  margin-top: 1rem;
  word-break: break-all;
}
</style>
