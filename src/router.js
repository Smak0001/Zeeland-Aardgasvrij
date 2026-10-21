import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from './views/HomePage.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/kansenkaart', component: () => import('./views/OpportunityMapPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})
