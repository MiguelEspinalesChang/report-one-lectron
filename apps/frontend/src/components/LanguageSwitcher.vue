<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type Locale } from '../i18n'

const { locale, t } = useI18n()

function onChange(value: Locale): void {
  setLocale(value)
}
</script>

<template>
  <div class="flex items-center gap-1" role="group" :aria-label="t('language.label')">
    <button
      v-for="option in SUPPORTED_LOCALES"
      :key="option"
      class="rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors"
      :class="
        locale === option
          ? 'bg-accent-600 text-white'
          : 'text-slate-500 hover:bg-slate-200'
      "
      @click="onChange(option)"
    >
      {{ option }}
    </button>
  </div>
</template>
