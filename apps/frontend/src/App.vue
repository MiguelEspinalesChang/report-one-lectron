<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppBreadcrumb from './components/AppBreadcrumb.vue'
import AppDropdown from './components/AppDropdown.vue'
import type { DropdownItem } from './components/AppDropdown.vue'
import AppSidebar from './components/AppSidebar.vue'
import type { NavGroup, NavItem } from './components/AppSidebar.vue'
import AppToast from './components/AppToast.vue'
import AvatarInitials from './components/AvatarInitials.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import SidecarHealth from './islands/Dashboard/SidecarHealth.vue'
import { useSessionStore } from './stores/session'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()
const hasBridge = 'platform' in window

const session = computed(() => sessionStore.session)
const hasBreadcrumbs = computed(() => route.matched.some((r) => r.meta.breadcrumb != null))

// Sidebar nav config + permission gating live here — AppSidebar is a pure
// presentational component that only renders the groups/items it's given.
const NAV_GROUPS: Array<{ titleKey: string; items: Array<NavItem & { permission: string | null }> }> = [
  {
    titleKey: 'nav.groups.general',
    items: [
      { name: 'dashboard', labelKey: 'nav.dashboard', permission: null },
      { name: 'catalog', labelKey: 'nav.catalog', permission: 'devices.view' },
      { name: 'devices', labelKey: 'nav.devices', permission: 'devices.view' },
      { name: 'telemetry', labelKey: 'nav.telemetry', permission: 'telemetry.view' },
      { name: 'users', labelKey: 'nav.users', permission: 'users.manage' },
    ],
  },
  {
    titleKey: 'nav.groups.system',
    items: [{ name: 'design-system', labelKey: 'nav.designSystem', permission: null }],
  },
]

const visibleNavGroups = computed<NavGroup[]>(() =>
  NAV_GROUPS.map((group) => ({
    titleKey: group.titleKey,
    items: group.items.filter(
      (item) => item.permission === null || sessionStore.hasPermission(item.permission),
    ),
  })).filter((group) => group.items.length > 0),
)

// Show the dashboard shell only when there is a fully-authenticated session
// and the user is not on the change-password route. Guards guarantee that
// unauthenticated users only ever reach /login, and mustChangePassword users
// are forced to /change-password — so checking route name here is sufficient.
const showShell = computed(
  () => session.value !== null && route.name !== 'change-password' && route.name !== 'login',
)

const SIDEBAR_ID = 'hs-sidebar-shell'

const userMenuItems = computed<DropdownItem[]>(() => [
  {
    label: t('auth.signOut'),
    danger: true,
    onClick: async () => {
      await sessionStore.logout()
      await router.push({ name: 'login' })
    },
  },
])
</script>

<template>
  <!-- ── Dashboard shell layout ──────────────────────────────────────────── -->
  <template v-if="showShell">
    <AppSidebar :groups="visibleNavGroups" />

    <!-- Content wrapper — offset by sidebar width on lg+ -->
    <div class="lg:ps-64">
      <!-- Topbar -->
      <header
        class="sticky top-0 z-40 flex h-14 items-center gap-x-3 border-b border-line
               bg-white px-4"
      >
        <!-- Hamburger (mobile only) -->
        <button
          type="button"
          class="btn shrink-0 lg:hidden"
          aria-haspopup="dialog"
          aria-expanded="false"
          :aria-controls="SIDEBAR_ID"
          :aria-label="t('nav.openMenu')"
          :data-hs-overlay="`#${SIDEBAR_ID}`"
        >
          <svg
            class="size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>

        <!-- Breadcrumb -->
        <div class="min-w-0 flex-1">
          <AppBreadcrumb v-if="hasBreadcrumbs" />
        </div>

        <!-- Right-side controls -->
        <div class="flex shrink-0 items-center gap-3">
          <SidecarHealth />
          <LanguageSwitcher />

          <AppDropdown
            trigger-id="user-menu-btn"
            menu-id="user-menu"
            :items="userMenuItems"
          >
            <span class="flex items-center gap-2">
              <AvatarInitials :name="session!.displayName" size="sm" />
              <span class="flex flex-col items-start text-left">
                <span class="text-sm font-medium">{{ session!.displayName }}</span>
                <span class="text-xs text-slate-500">{{ session!.roleName }}</span>
              </span>
            </span>
          </AppDropdown>
        </div>
      </header>

      <!-- Page content -->
      <main class="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-7">
        <div class="mx-auto max-w-content">
          <p
            v-if="!hasBridge"
            class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm
                   text-amber-800"
          >
            {{ t('app.noBridge') }}
          </p>
          <RouterView />
        </div>
      </main>
    </div>
  </template>

  <!-- ── Bare / auth layout (login, change-password) ────────────────────── -->
  <template v-else>
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <div class="w-full max-w-sm px-4">
        <p
          v-if="!hasBridge"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm
                 text-amber-800"
        >
          {{ t('app.noBridge') }}
        </p>
        <RouterView />
      </div>
    </div>
  </template>

  <AppToast />
</template>
