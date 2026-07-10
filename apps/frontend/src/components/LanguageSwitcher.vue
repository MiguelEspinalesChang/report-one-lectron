<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type Locale } from '../i18n'

const { locale, t } = useI18n()

const LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

function onChange(value: Locale): void {
  setLocale(value)
}
</script>

<!--
  Preline HSDropdown markup (https://preline.co/docs/dropdown.html).
  Accent/slate tokens replace Preline's default blue-* palette.
  autoInit() fires after every route change (router.afterEach) so this
  keeps responding without a page reload.
-->
<template>
  <div class="hs-dropdown relative inline-flex" :aria-label="t('language.label')">
    <!-- Trigger -->
    <button
      id="lang-switcher-btn"
      type="button"
      class="btn hs-dropdown-toggle"
      aria-haspopup="menu"
      aria-expanded="false"
      aria-controls="lang-switcher-menu"
    >
      <span class="text-xs font-semibold uppercase">{{ locale }}</span>
      <svg
        class="size-3 shrink-0 text-slate-500 hs-dropdown-open:rotate-180"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- Menu -->
    <div
      id="lang-switcher-menu"
      class="hs-dropdown-menu z-10 hidden min-w-[8rem] divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-md"
      role="menu"
      aria-labelledby="lang-switcher-btn"
    >
      <div class="p-1">
        <button
          v-for="option in SUPPORTED_LOCALES"
          :key="option"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-accent-50 hover:text-accent-700"
          :class="{ 'font-semibold text-accent-600': locale === option }"
          role="menuitem"
          @click="onChange(option)"
        >
          <span class="text-xs font-bold uppercase">{{ option }}</span>
          <span class="text-slate-500">{{ LABELS[option] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
