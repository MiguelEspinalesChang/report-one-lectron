<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppBadge from '../../components/AppBadge.vue'

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
  <AppBadge
    variant="outline"
    :tone="healthy === null ? 'neutral' : healthy ? 'success' : 'danger'"
    :label="healthy === null ? t('health.checking') : healthy ? t('health.up') : t('health.down')"
  />
</template>
