import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { useSessionStore } from '../stores/session'
import ChangePasswordView from '../islands/Auth/ChangePasswordView.vue'
import DashboardView from '../islands/Dashboard/DashboardView.vue'
import CatalogView from '../islands/Inventory/CatalogView.vue'
import CatalogModelFormView from '../islands/Inventory/CatalogModelFormView.vue'
import LoginView from '../islands/Auth/LoginView.vue'
import UsersView from '../islands/Users/UsersView.vue'

// Hash history is required because Electron loads the app from file:// in
// production. Path-based history would produce 404s for every non-root route.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { breadcrumb: 'nav.dashboard' },
    },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/catalog',
      name: 'catalog',
      component: CatalogView,
      meta: { breadcrumb: 'nav.catalog' },
    },
    {
      path: '/catalog/models/new',
      name: 'catalog-model-new',
      component: CatalogModelFormView,
      meta: {
        breadcrumb: 'catalog.models.createTitle',
        parent: { path: '/catalog', breadcrumb: 'nav.catalog' },
      },
    },
    {
      path: '/catalog/models/:id/edit',
      name: 'catalog-model-edit',
      component: CatalogModelFormView,
      meta: {
        breadcrumb: 'catalog.models.editTitle',
        parent: { path: '/catalog', breadcrumb: 'nav.catalog' },
      },
    },
    {
      path: '/users',
      name: 'users',
      component: UsersView,
      meta: { breadcrumb: 'nav.users' },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: ChangePasswordView,
      meta: { breadcrumb: 'auth.changePassword' },
    },
  ],
})

// Auth guard — called before every navigation.
// useSessionStore() is called INSIDE the callback so Pinia is guaranteed to be
// installed (main.ts installs Pinia before router in the plugin chain).
router.beforeEach(async (to) => {
  const sessionStore = useSessionStore()
  // restore() is idempotent — calls window.platform.auth.getSession() only once.
  // Concurrent navigations during the first restore() call are serialized because
  // the second call returns immediately once restored.value is true.
  await sessionStore.restore()

  const hasSession = sessionStore.session !== null
  const mustChange = sessionStore.session?.mustChangePassword === true

  // No session — only the login route is accessible
  if (!hasSession) {
    if (to.name !== 'login') return { name: 'login' }
    return true
  }

  // Session exists but password must be changed — force to change-password
  if (mustChange) {
    if (to.name !== 'change-password') return { name: 'change-password' }
    return true
  }

  // Session OK — redirect away from auth-only routes
  if (to.name === 'login' || to.name === 'change-password') {
    return { name: 'dashboard' }
  }

  return true
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
