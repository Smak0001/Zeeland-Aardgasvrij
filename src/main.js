import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
// Lettertypen worden meegeleverd, zodat bezoekers geen verbinding met Google Fonts maken.
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import '@fontsource/open-sans/700.css'
import '@fontsource/roboto-slab/400.css'
import './assets/main.css'

createApp(App).use(router).mount('#app')
