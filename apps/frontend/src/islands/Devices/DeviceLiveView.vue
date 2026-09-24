<script setup lang="ts">
import type { DeviceReading, DeviceState, DeviceStatus, TelemetryPoint } from '@platform/shared-types'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppBadge from '../../components/AppBadge.vue'
import AppSelect from '../../components/AppSelect.vue'
import AppTable from '../../components/AppTable.vue'
import TelemetryChart from '../../components/TelemetryChart.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useCatalogStore } from '../../stores/catalog'

// Rolling window kept per metric for the live chart. 60 points is enough to show a
// meaningful recent trend (the same "recent window" idea as the historical chart,
// just built from point-in-time readings instead of aggregated buckets) without
// letting a long-lived live session grow memory unbounded.
const LIVE_WINDOW_SIZE = 60

type ConnectionState = DeviceState | 'connecting'
type ReadingRow = { metric: string; reading: DeviceReading }

const { t } = useI18n()
const route = useRoute()
const catalogStore = useCatalogStore()
const { call } = useApiCall()

function parseDeviceId(raw: unknown): number | null {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  return Number.isNaN(parsed) ? null : parsed
}

const deviceId = computed(() => parseDeviceId(route.params.deviceId))
const device = computed(() => catalogStore.devices.find((d) => d.id === deviceId.value) ?? null)
const deviceLabel = computed(() => device.value?.name ?? `#${deviceId.value ?? '?'}`)

// ========== Live state ==========
// Latest reading per metric — grows as new metrics show up in the stream, never
// shrinks, so the metric selector below is built dynamically from whatever the
// backend actually sends (no dependency on the model's registerMap).
const latestByMetric = ref(new Map<string, DeviceReading>())
const windowsByMetric = ref(new Map<string, TelemetryPoint[]>())
const status = ref<ConnectionState>('connecting')
const selectedMetric = ref('')

let unsubscribeReading: (() => void) | null = null
let unsubscribeStatus: (() => void) | null = null
// Set only once window.platform.devices.watch(...) actually resolves — this is what
// stopWatching() checks before calling unwatch(), so a device we never finished
// subscribing to is never "unwatched" for nothing.
let watchedDeviceId: number | null = null

function toTelemetryPoint(reading: DeviceReading): TelemetryPoint {
  return { bucket: reading.timestamp, min: reading.value, max: reading.value, avg: reading.value, count: 1 }
}

function handleReading(reading: DeviceReading): void {
  if (reading.deviceId !== watchedDeviceId) return

  latestByMetric.value.set(reading.metric, reading)
  if (!selectedMetric.value) selectedMetric.value = reading.metric

  const existingPoints = windowsByMetric.value.get(reading.metric) ?? []
  windowsByMetric.value.set(
    reading.metric,
    [...existingPoints, toTelemetryPoint(reading)].slice(-LIVE_WINDOW_SIZE),
  )
}

function handleStatus(next: DeviceStatus): void {
  if (next.deviceId !== watchedDeviceId) return
  status.value = next.state
}

async function startWatching(id: number): Promise<void> {
  unsubscribeReading = window.platform.devices.onReading(handleReading)
  unsubscribeStatus = window.platform.devices.onStatus(handleStatus)
  await window.platform.devices.watch(id)
  watchedDeviceId = id
}

// Unconditionally tears down both push subscriptions, even if watch(...) never
// resolved (e.g. the view was closed while the call was still in flight) — that
// race used to leave an orphaned onReading listener on the old demo component.
// unwatch(...) is only sent for a device we actually finished subscribing to.
function stopWatching(): void {
  unsubscribeReading?.()
  unsubscribeStatus?.()
  unsubscribeReading = null
  unsubscribeStatus = null

  if (watchedDeviceId !== null) {
    void window.platform.devices.unwatch(watchedDeviceId)
    watchedDeviceId = null
  }
}

function resetLiveState(): void {
  status.value = 'connecting'
  latestByMetric.value = new Map()
  windowsByMetric.value = new Map()
  selectedMetric.value = ''
}

watch(
  () => route.params.deviceId,
  (raw, previousRaw) => {
    if (raw === previousRaw) return
    stopWatching()
    resetLiveState()
    const id = parseDeviceId(raw)
    if (id !== null) void startWatching(id)
  },
)

onMounted(async () => {
  await call(async () => {
    if (catalogStore.devices.length === 0) await catalogStore.loadDevices()
  })

  if (deviceId.value !== null) await startWatching(deviceId.value)
})

onUnmounted(() => {
  stopWatching()
})

// ========== Derived view state ==========
function statusTone(state: ConnectionState): 'neutral' | 'success' | 'warning' | 'danger' {
  if (state === 'connected') return 'success'
  if (state === 'degraded') return 'warning'
  if (state === 'disconnected') return 'danger'
  return 'neutral'
}

const readingRows = computed<ReadingRow[]>(() => {
  return Array.from(latestByMetric.value.entries())
    .map(([metric, reading]) => ({ metric, reading }))
    .sort((a, b) => a.metric.localeCompare(b.metric))
})

const metricOptions = computed(() => {
  return readingRows.value.map((row) => ({ value: row.metric, label: row.metric }))
})

const chartPoints = computed<TelemetryPoint[]>(() => {
  return windowsByMetric.value.get(selectedMetric.value) ?? []
})

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function readingRowKey(row: ReadingRow): string {
  return row.metric
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">{{ t('live.title', { name: deviceLabel }) }}</h1>
      <AppBadge :label="t(`live.status.${status}`)" :tone="statusTone(status)" />
    </div>

    <div class="island space-y-4">
      <AppTable :rows="readingRows" :row-key="readingRowKey" :empty-message="t('live.empty')">
        <template #header>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('live.readings.columns.metric') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('live.readings.columns.value') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('live.readings.columns.timestamp') }}
          </th>
        </template>
        <template #row="{ row }">
          <td class="px-4 py-3 text-sm font-medium text-slate-700">{{ row.metric }}</td>
          <td class="px-4 py-3 text-sm font-semibold tabular-nums text-primary-700">
            {{ row.reading.value.toFixed(2) }}
          </td>
          <td class="px-4 py-3 text-sm text-slate-500">{{ formatTimestamp(row.reading.timestamp) }}</td>
        </template>
      </AppTable>

      <template v-if="readingRows.length > 0">
        <AppSelect v-model="selectedMetric" :label="t('live.metricSelector.label')" :options="metricOptions" />
        <TelemetryChart
          :points="chartPoints"
          :avg-label="t('live.chart.avgLabel')"
          :band-label="t('live.chart.bandLabel')"
        />
      </template>
    </div>
  </div>
</template>
