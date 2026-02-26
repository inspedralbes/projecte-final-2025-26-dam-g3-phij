import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles/main.scss'

const RUNTIME_RESET_VERSION = '2026-02-25-runtime-reset-1';
if (localStorage.getItem('valkrypt_runtime_reset_version') !== RUNTIME_RESET_VERSION) {
  localStorage.removeItem('valkrypt_current_game');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('valkrypt_runtime_state_'))
    .forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('valkrypt_runtime_reset_version', RUNTIME_RESET_VERSION);
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
