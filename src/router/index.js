import { createRouter, createWebHistory } from 'vue-router'
import DictationApp from '../components/DictationApp.vue'
import AudioTest from '../components/AudioTest.vue'

const routes = [
  {
    path: '/',
    name: 'dictation',
    component: DictationApp
  },
  {
    path: '/test',
    name: 'test',
    component: AudioTest,
    // Only show in development environment
    beforeEnter: (to, from, next) => {
      if (import.meta.env.DEV) {
        next()
      } else {
        next('/')
      }
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
