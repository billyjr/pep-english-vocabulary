<script>
import DictationApp from './components/DictationApp.vue'

export default {
  name: 'App',
  components: {
    DictationApp
  }
}
</script>

<template>
  <div id="app">
    <DictationApp />
  </div>
</template>

<style>
#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 20px;
}
</style>
