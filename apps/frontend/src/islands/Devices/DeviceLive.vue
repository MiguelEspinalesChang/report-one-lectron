<script setup lang="ts">
import type { DeviceReading } from '@platform/shared-types'
import { onUnmounted, ref } from 'vue'

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
    <h2>Live view (demo device)</h2>
    <button v-if="!watching" @click="start">Start live view</button>
    <button v-else @click="stop">Stop live view</button>
    <ul>
      <li v-for="reading in readings" :key="reading.timestamp">
        {{ new Date(reading.timestamp).toLocaleTimeString() }} —
        {{ reading.metric }}: {{ reading.value.toFixed(2) }}
      </li>
    </ul>
  </section>
</template>
