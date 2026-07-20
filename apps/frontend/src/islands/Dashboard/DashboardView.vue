<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KpiCard from '../../components/KpiCard.vue'
import { useCatalogStore } from '../../stores/catalog'
import { useSessionStore } from '../../stores/session'
import SystemStatus from './SystemStatus.vue'

const { t } = useI18n()
const catalogStore = useCatalogStore()
const sessionStore = useSessionStore()

// Container-only state: real data pulled from the sidecar ping and the
// catalog store, then handed down to the presentational KpiCard components.
const sidecarHealthy = ref<boolean | null>(null)

const sidecarStatusLabel = computed(() => {
  if (sidecarHealthy.value === null) return t('health.checking')
  return sidecarHealthy.value ? t('health.up') : t('health.down')
})

const deviceCount = computed(() => catalogStore.devices.length)
const roleLabel = computed(() => sessionStore.session?.roleName ?? '')

async function pingSidecar(): Promise<void> {
  try {
    await window.platform.system.ping()
    sidecarHealthy.value = true
  } catch {
    sidecarHealthy.value = false
  }
}

onMounted(() => {
  void pingSidecar()
  void catalogStore.loadDevices()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-[30px] font-extrabold text-slate-900">{{ t('dashboard.title') }}</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ t('dashboard.subtitle', { name: sessionStore.session?.displayName ?? '' }) }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard :label="t('dashboard.kpi.sidecar')" :value="sidecarStatusLabel" />
      <KpiCard :label="t('dashboard.kpi.devices')" :value="deviceCount" />
      <KpiCard :label="t('dashboard.kpi.role')" :value="roleLabel" />
    </div>

    <SystemStatus />
  </div>
</template>
