import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../islands/Dashboard/DashboardView.vue'
import CatalogView from '../islands/Inventory/CatalogView.vue'
import LoginView from '../islands/Auth/LoginView.vue'
import UsersView from '../islands/Users/UsersView.vue'

// Hash history is required because Electron loads the app from file:// in
// production. Path-based history would produce 404s for every non-root route.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/catalog', name: 'catalog', component: CatalogView },
    { path: '/users', name: 'users', component: UsersView },
  ],
})

// Re-initialize Preline components after every navigation. Preline scans
// the DOM on init; without this hook, dropdowns/modals die after route changes.
// nextTick guarantees the new view's DOM is fully patched before the scan.
router.afterEach(() => {
  void nextTick(() => {
    if (typeof window.HSStaticMethods !== 'undefined') {
      window.HSStaticMethods.autoInit()
    }
  })
})

export default router
