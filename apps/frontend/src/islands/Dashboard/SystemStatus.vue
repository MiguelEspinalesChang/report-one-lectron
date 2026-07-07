<script setup lang="ts">
import type { PingResult } from '@platform/shared-types'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
    <h2 class="mb-3 text-sm font-semibold text-slate-900">{{ t('system.title') }}</h2>
    <button class="btn btn-primary" :disabled="pending" @click="ping">
      {{ pending ? t('system.pinging') : t('system.ping') }}
    </button>
    <p v-if="result" class="mt-3 text-sm text-emerald-700">
      {{ t('system.answer', { version: result.pythonVersion, pid: result.pid }) }}
    </p>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
  </section>
</template>
