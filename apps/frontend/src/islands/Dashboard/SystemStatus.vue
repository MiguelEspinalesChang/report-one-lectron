<script setup lang="ts">
import type { PingResult } from '@platform/shared-types'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApiCall } from '../../composables/useApiCall'

const { t } = useI18n()
const { loading: pending, call } = useApiCall()

const result = ref<PingResult | null>(null)

async function ping(): Promise<void> {
  const res = await call(() => window.platform.system.ping())
  if (res !== undefined) {
    result.value = res
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
  </section>
</template>
