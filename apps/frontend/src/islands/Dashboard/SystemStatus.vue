<script setup lang="ts">
import type { PingResult } from '@platform/shared-types'
import { ref } from 'vue'

const result = ref<PingResult | null>(null)
const error = ref<string | null>(null)
const pending = ref(false)

async function ping(): Promise<void> {
  pending.value = true
  error.value = null
  try {
    result.value = await window.platform.system.ping()
  } catch (err) {
    result.value = null
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="island">
    <h2>Python sidecar</h2>
    <button :disabled="pending" @click="ping">Ping sidecar</button>
    <p v-if="result">
      Python {{ result.pythonVersion }} answered from PID {{ result.pid }}
    </p>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>
