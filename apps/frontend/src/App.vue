<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'
import AppToast from './components/AppToast.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'

const { t } = useI18n()
const hasBridge = 'platform' in window
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">{{ t('app.title') }}</h1>
          <p class="text-xs text-slate-500">{{ t('app.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-4">
          <nav class="flex items-center gap-1" :aria-label="t('nav.main')">
            <RouterLink
              v-for="name in ['dashboard', 'catalog', 'users']"
              :key="name"
              :to="{ name }"
              class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              active-class="bg-accent-50 text-accent-700"
            >
              {{ t(`nav.${name}`) }}
            </RouterLink>
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6">
      <p
        v-if="!hasBridge"
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {{ t('app.noBridge') }}
      </p>
      <RouterView v-else />
    </main>

    <AppToast />
  </div>
</template>
