<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const { toasts, dismiss } = useToast()
</script>

<template>
  <div
    aria-live="polite"
    aria-atomic="false"
    class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg"
      :class="
        toast.kind === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      "
      role="alert"
    >
      <span class="flex-1 text-sm">{{ toast.message }}</span>
      <button
        class="shrink-0 text-current opacity-60 hover:opacity-100"
        :aria-label="t('common.dismiss')"
        @click="dismiss(toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>
