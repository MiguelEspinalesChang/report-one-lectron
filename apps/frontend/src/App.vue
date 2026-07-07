<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import SystemStatus from './islands/Dashboard/SystemStatus.vue'
import DeviceLive from './islands/Devices/DeviceLive.vue'

const { t } = useI18n()
const hasBridge = 'platform' in window
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">{{ t('app.title') }}</h1>
          <p class="text-xs text-slate-500">{{ t('app.subtitle') }}</p>
        </div>
        <LanguageSwitcher />
      </div>
    </header>

    <main class="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <p
        v-if="!hasBridge"
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {{ t('app.noBridge') }}
      </p>
      <template v-else>
        <SystemStatus />
        <DeviceLive />
      </template>
    </main>
  </div>
</template>
