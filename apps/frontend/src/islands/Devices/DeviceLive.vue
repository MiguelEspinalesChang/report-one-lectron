<script setup lang="ts">
import type { DeviceReading } from '@platform/shared-types'
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const DEMO_DEVICE_ID = 1
const MAX_ROWS = 10

const watching = ref(false)
const readings = ref<DeviceReading[]>([])
let unsubscribe: (() => void) | null = null

async function start(): Promise<void> {
  unsubscribe = window.platform.devices.onReading((reading) => {
    readings.value = [reading, ...readings.value].slice(0, MAX_ROWS)
  })
  await window.platform.devices.watch(DEMO_DEVICE_ID)
  watching.value = true
}

async function stop(): Promise<void> {
  await window.platform.devices.unwatch(DEMO_DEVICE_ID)
  unsubscribe?.()
  unsubscribe = null
  watching.value = false
}

onUnmounted(() => {
  if (watching.value) void stop()
})
</script>

<template>
  <section class="island">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-900">{{ t('devices.title') }}</h2>
      <button v-if="!watching" class="btn" @click="start">{{ t('devices.start') }}</button>
      <button v-else class="btn" @click="stop">{{ t('devices.stop') }}</button>
    </div>

    <p v-if="readings.length === 0" class="text-sm text-slate-400">
      {{ t('devices.empty') }}
    </p>
    <ul v-else :class="$style.list">
      <li v-for="reading in readings" :key="reading.timestamp" :class="$style.row">
        <span class="text-slate-500">
          {{ new Date(reading.timestamp).toLocaleTimeString() }}
        </span>
        <span class="font-medium">{{ reading.metric }}</span>
        <span :class="$style.value">{{ reading.value.toFixed(2) }}</span>
      </li>
    </ul>
  </section>
</template>

<style module>
/*
 * Component-specific styles live in a CSS module ($style);
 * layout/spacing stays in Tailwind utilities.
 */
.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;
  padding: 0.375rem 0;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--color-slate-100);
}

.row:last-child {
  border-bottom: none;
}

.value {
  font-variant-numeric: tabular-nums;
  color: var(--color-accent-700);
  font-weight: 600;
}
</style>
