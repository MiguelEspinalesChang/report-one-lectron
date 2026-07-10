<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const healthy = ref<boolean | null>(null)

async function ping(): Promise<void> {
  try {
    await window.platform.system.ping()
    healthy.value = true
  } catch {
    healthy.value = false
  }
}

void ping() // immediate first check

const interval = window.setInterval(() => void ping(), 30_000)

onUnmounted(() => {
  window.clearInterval(interval)
})
</script>

<template>
  <div
    class="flex items-center gap-1.5"
    :title="healthy === false ? t('health.down') : t('health.up')"
  >
    <span
      class="size-2 rounded-full"
      :class="
        healthy === null ? 'bg-slate-300' : healthy ? 'bg-emerald-500' : 'bg-red-500'
      "
      aria-hidden="true"
    />
    <span class="text-xs text-slate-500">
      {{ healthy === null ? t('health.checking') : healthy ? t('health.up') : t('health.down') }}
    </span>
  </div>
</template>
