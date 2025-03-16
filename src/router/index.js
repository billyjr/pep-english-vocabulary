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
    component: AudioTest
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
