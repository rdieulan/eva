import { createApp } from 'vue'
import './style.scss'
import App from './App.vue'
import router from './router'
import { applyStoredTheme } from './composables/useTheme'

applyStoredTheme()

const app = createApp(App)
app.use(router)
app.mount('#app')
