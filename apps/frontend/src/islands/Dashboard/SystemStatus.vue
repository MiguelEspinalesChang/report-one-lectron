<script setup lang="ts">
import type { PingResult } from '@platform/shared-types'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppBadge from '../../components/AppBadge.vue'
import { useApiCall } from '../../composables/useApiCall'

const { t } = useI18n()
const { loading: pending, call } = useApiCall()

const result = ref<PingResult | null>(null)
const status = ref<'idle' | 'ok' | 'error'>('idle')

async function ping(): Promise<void> {
  const res = await call(() => window.platform.system.ping())
  if (res !== undefined) {
    result.value = res
    status.value = 'ok'
  } else {
    status.value = 'error'
  }
}
</script>

<template>
  <section class="island">
    <div class="mb-3 flex items-center gap-2">
      <h2 class="text-sm font-semibold text-slate-900">{{ t('system.title') }}</h2>
      <AppBadge
        v-if="status !== 'idle'"
        variant="outline"
        :tone="status === 'ok' ? 'success' : 'danger'"
        :label="status === 'ok' ? t('health.up') : t('health.down')"
      />
    </div>
    <button class="btn btn-primary" :disabled="pending" @click="ping">
      {{ pending ? t('system.pinging') : t('system.ping') }}
    </button>
    <p v-if="result" class="mt-3 text-sm text-success-700">
      {{ t('system.answer', { version: result.pythonVersion, pid: result.pid }) }}
    </p>
  </section>
</template>
