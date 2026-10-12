import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { auth } from './store/auth'
import './assets/main.css'

auth.init().finally(() => {
  createApp(App).use(router).mount('#app')
})
