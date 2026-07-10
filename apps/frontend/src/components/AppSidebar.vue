<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()

const OVERLAY_ID = 'hs-sidebar-shell'

// Close the off-canvas sidebar on every navigation (mobile).
// HSOverlay.close is a no-op when the sidebar is already closed or not rendered
// as an overlay (lg breakpoint), so it's safe to call unconditionally.
watch(
  () => route.fullPath,
  () => {
    if (typeof window.HSOverlay !== 'undefined') {
      window.HSOverlay.close(`#${OVERLAY_ID}`)
    }
  },
)

// Preline's autoInit runs via router.afterEach (route changes), but the sidebar
// lives at App.vue level — outside any route view — so we need an extra init on
// first mount to wire up the off-canvas overlay behaviour.
onMounted(() => {
  void nextTick(() => {
    if (typeof window.HSStaticMethods !== 'undefined') {
      window.HSStaticMethods.autoInit()
    }
  })
})

const navItems = [
  { name: 'dashboard' as const, labelKey: 'nav.dashboard' },
  { name: 'catalog' as const, labelKey: 'nav.catalog' },
  { name: 'users' as const, labelKey: 'nav.users' },
]
</script>

<template>
  <!-- Sidebar: off-canvas on mobile, static on lg+ -->
  <div
    :id="OVERLAY_ID"
    class="hs-overlay [--auto-close:lg] hs-overlay-open:translate-x-0 -translate-x-full
           fixed inset-y-0 start-0 z-60 hidden w-64 transform
           border-e border-slate-200 bg-white transition-all duration-300
           lg:block lg:translate-x-0"
    role="dialog"
    tabindex="-1"
    :aria-label="t('nav.main')"
  >
    <!-- Brand -->
    <div class="flex h-16 items-center border-b border-slate-200 px-5">
      <div>
        <p class="text-sm font-semibold text-slate-900">{{ t('app.title') }}</p>
        <p class="text-xs text-slate-400">{{ t('app.subtitle') }}</p>
      </div>
    </div>

    <!-- Nav -->
    <nav class="p-3" :aria-label="t('nav.main')">
      <ul role="list" class="space-y-0.5">
        <li v-for="item in navItems" :key="item.name">
          <RouterLink
            :to="{ name: item.name }"
            class="flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium
                   text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900
                   focus:outline-none focus:bg-slate-100"
            active-class="bg-accent-50 text-accent-700 hover:bg-accent-100 hover:text-accent-700"
          >
            <!-- Dashboard icon -->
            <svg
              v-if="item.name === 'dashboard'"
              class="size-4 shrink-0"
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
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>

            <!-- Catalog icon -->
            <svg
              v-else-if="item.name === 'catalog'"
              class="size-4 shrink-0"
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
                d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
              />
            </svg>

            <!-- Users icon -->
            <svg
              v-else-if="item.name === 'users'"
              class="size-4 shrink-0"
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
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>

            {{ t(item.labelKey) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
