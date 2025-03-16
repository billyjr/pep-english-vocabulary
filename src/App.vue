<script>
export default {
  name: 'App',
  computed: {
    isDevelopment() {
      return import.meta.env.DEV
    }
  }
}
</script>

<template>
  <div id="app">
    <nav>
      <router-link to="/">Dictation</router-link>
      <template v-if="isDevelopment">
        | <router-link to="/test">Test Audio</router-link>
      </template>
    </nav>
    <router-view></router-view>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
  text-decoration: none;
  margin: 0 10px;
}

nav a.router-link-exact-active {
  color: #42b983;
}
</style>
