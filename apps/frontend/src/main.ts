import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import '@fontsource/figtree/800.css'
import './assets/main.css'

createApp(App).use(createPinia()).use(i18n).use(router).mount('#app')

// Load Preline after mount so it can scan the initial DOM.
// Dynamic import so Preline's DOM scan runs after Vue has rendered the first frame.
// Using the package root ('preline') which resolves via the exports map to dist/index.mjs.
void import('preline')
