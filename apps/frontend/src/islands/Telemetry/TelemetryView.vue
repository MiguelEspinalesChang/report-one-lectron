<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { TelemetryPoint } from '@platform/shared-types'
import AppEmptyState from '../../components/AppEmptyState.vue'
import AppInput from '../../components/AppInput.vue'
import AppSelect from '../../components/AppSelect.vue'
import TelemetryChart from '../../components/TelemetryChart.vue'
import { useApiCall } from '../../composables/useApiCall'
import {
  SIMULATED_POLL_DEFAULT_TICKS,
  SIMULATED_POLL_MAX_TICKS,
  SIMULATED_POLL_MIN_TICKS,
} from '../../constants/telemetry'
import { useCatalogStore } from '../../stores/catalog'
import { useSessionStore } from '../../stores/session'
import { useTelemetryStore } from '../../stores/telemetry'
import { useToastStore } from '../../stores/toast'

type RangePreset = '1h' | '24h' | '7d' | 'custom'

const ONE_HOUR_MS = 3_600_000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS
const MIN_CUSTOM_BUCKET_MS = 60_000
const CUSTOM_BUCKET_DIVISIONS = 200
const NO_DEVICE_SELECTED = 0

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const sessionStore = useSessionStore()
const telemetryStore = useTelemetryStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()

const canManageDevices = computed(() => sessionStore.hasPermission('devices.manage'))

function toInt(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDeviceId(raw: unknown): number | null {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  return Number.isNaN(parsed) ? null : parsed
}

// ========== Device selection ==========
const selectedDeviceId = ref<number | null>(parseDeviceId(route.params.deviceId))

const deviceOptions = computed(() => [
  { value: NO_DEVICE_SELECTED, label: t('telemetry.deviceSelector.placeholder') },
  ...catalogStore.devices.map((d) => ({ value: d.id, label: d.name })),
])

// Bridges the plain number the AppSelect needs with the route-driven
// selectedDeviceId (null when nothing is picked yet).
const deviceSelectValue = computed<number>({
  get: () => selectedDeviceId.value ?? NO_DEVICE_SELECTED,
  set: (value) => {
    if (value === NO_DEVICE_SELECTED) return
    void router.push({ name: 'telemetry', params: { deviceId: String(value) } })
  },
})

const device = computed(() => catalogStore.devices.find((d) => d.id === selectedDeviceId.value) ?? null)
const model = computed(() => {
  const current = device.value
  if (!current) return null
  return catalogStore.models.find((m) => m.id === current.modelId) ?? null
})

// ========== History (moved from islands/Devices/DeviceHistory.vue) ==========
const metricOptions = computed(() => {
  return (model.value?.registerMap.registers ?? []).map((entry) => ({
    value: entry.metric,
    label: entry.metric,
  }))
})

const selectedMetric = ref('')
const rangePreset = ref<RangePreset>('1h')
const customFrom = ref('')
const customTo = ref('')
const points = ref<TelemetryPoint[]>([])
const hasQueried = ref(false)

const rangePresetOptions = computed(() => [
  { value: '1h' as const, label: t('telemetry.history.ranges.oneHour') },
  { value: '24h' as const, label: t('telemetry.history.ranges.oneDay') },
  { value: '7d' as const, label: t('telemetry.history.ranges.sevenDays') },
  { value: 'custom' as const, label: t('telemetry.history.ranges.custom') },
])

function computeRange(): { fromMs: number; toMs: number; bucketMs: number } {
  const now = Date.now()

  if (rangePreset.value === '1h') return { fromMs: now - ONE_HOUR_MS, toMs: now, bucketMs: 60_000 }
  if (rangePreset.value === '24h') return { fromMs: now - ONE_DAY_MS, toMs: now, bucketMs: 900_000 }
  if (rangePreset.value === '7d') return { fromMs: now - SEVEN_DAYS_MS, toMs: now, bucketMs: 3_600_000 }

  const parsedFrom = customFrom.value ? new Date(customFrom.value).getTime() : now - ONE_HOUR_MS
  const parsedTo = customTo.value ? new Date(customTo.value).getTime() : now
  const fromMs = Number.isNaN(parsedFrom) ? now - ONE_HOUR_MS : parsedFrom
  const toMs = Number.isNaN(parsedTo) ? now : parsedTo
  const bucketMs = Math.max(MIN_CUSTOM_BUCKET_MS, Math.round((toMs - fromMs) / CUSTOM_BUCKET_DIVISIONS))

  return { fromMs, toMs, bucketMs }
}

async function refreshHistory(): Promise<void> {
  const current = device.value
  if (!current || !selectedMetric.value) {
    points.value = []
    hasQueried.value = true
    return
  }

  const { fromMs, toMs, bucketMs } = computeRange()
  const result = await call(() =>
    telemetryStore.getHistory({
      deviceId: current.id,
      metric: selectedMetric.value,
      fromMs,
      toMs,
      bucketMs,
    }),
  )
  hasQueried.value = true
  points.value = result ?? []
}

// Resets the history/poll state and (re)loads it for whichever device is
// currently selected. Called both on initial mount (deep-linked deviceId)
// and whenever the route param changes (device switched via the selector).
async function loadForSelectedDevice(): Promise<void> {
  selectedMetric.value = ''
  points.value = []
  hasQueried.value = false
  pollTicks.value = SIMULATED_POLL_DEFAULT_TICKS

  if (!device.value) return

  const firstMetric = metricOptions.value[0]
  if (firstMetric) selectedMetric.value = firstMetric.value

  await refreshHistory()
}

watch(
  () => route.params.deviceId,
  (raw) => {
    selectedDeviceId.value = parseDeviceId(raw)
    void loadForSelectedDevice()
  },
)

watch([selectedMetric, rangePreset, customFrom, customTo], () => {
  void refreshHistory()
})

onMounted(async () => {
  await call(async () => {
    if (catalogStore.devices.length === 0) await catalogStore.loadDevices()
    if (catalogStore.models.length === 0) await catalogStore.loadModels()
  })

  if (selectedDeviceId.value !== null) await loadForSelectedDevice()
})

// ========== Simulated poll ==========
// Same validation rule as DevicesView's row action (both stay: this is the
// consolidated view, the row action is a quick shortcut that doesn't
// navigate away). Rendered inline here instead of in a modal since this
// view is already dedicated to a single device, and the ticks input fits
// naturally alongside the history chart.
const pollTicks = ref(SIMULATED_POLL_DEFAULT_TICKS)

const canGeneratePoll = computed(
  () => canManageDevices.value && device.value?.transport === 'simulated',
)

const pollTicksValid = computed(() => {
  const parsed = toInt(pollTicks.value)
  return parsed !== null && parsed >= SIMULATED_POLL_MIN_TICKS && parsed <= SIMULATED_POLL_MAX_TICKS
})

async function submitGeneratePoll(): Promise<void> {
  if (!canGeneratePoll.value) return
  const current = device.value
  const currentModel = model.value
  const ticks = toInt(pollTicks.value)
  if (!current || !currentModel || ticks === null || !pollTicksValid.value) return

  const result = await call(() =>
    telemetryStore.triggerSimulatedPoll({
      deviceId: current.id,
      registerMap: currentModel.registerMap,
      ticks,
    }),
  )

  if (result) {
    toastStore.show(
      'success',
      t('telemetry.poll.resultToast', {
        inserted: result.inserted,
        ignored: result.ignored,
        ticks: result.ticks,
        metrics: result.metrics,
      }),
    )
    await refreshHistory()
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-slate-900">{{ t('nav.telemetry') }}</h1>

    <div class="island">
      <AppSelect
        v-model="deviceSelectValue"
        :label="t('telemetry.deviceSelector.label')"
        :options="deviceOptions"
        :disabled="loading"
      />
    </div>

    <template v-if="device">
      <div class="island space-y-4">
        <h2 class="text-base font-semibold text-slate-900">
          {{ t('telemetry.history.title', { name: device.name }) }}
        </h2>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <AppSelect
            v-model="selectedMetric"
            :label="t('telemetry.history.metricLabel')"
            :options="metricOptions"
            :disabled="loading || metricOptions.length === 0"
          />
          <AppSelect
            v-model="rangePreset"
            :label="t('telemetry.history.rangeLabel')"
            :options="rangePresetOptions"
            :disabled="loading"
          />
          <template v-if="rangePreset === 'custom'">
            <AppInput
              v-model="customFrom"
              :label="t('telemetry.history.fromLabel')"
              type="datetime-local"
              :disabled="loading"
            />
            <AppInput
              v-model="customTo"
              :label="t('telemetry.history.toLabel')"
              type="datetime-local"
              :disabled="loading"
            />
          </template>
        </div>

        <div v-if="loading" class="py-10 text-center text-sm text-slate-500">
          {{ t('common.loading') }}
        </div>
        <AppEmptyState v-else-if="hasQueried && points.length === 0" :message="t('telemetry.history.empty')" />
        <TelemetryChart
          v-else
          :points="points"
          :avg-label="t('telemetry.history.avgLabel')"
          :band-label="t('telemetry.history.bandLabel')"
        />
      </div>

      <div v-if="canGeneratePoll" class="island space-y-4">
        <h2 class="text-base font-semibold text-slate-900">
          {{ t('telemetry.poll.title', { name: device.name }) }}
        </h2>

        <div class="flex flex-wrap items-end gap-4">
          <div class="w-40">
            <AppInput
              v-model="pollTicks"
              :label="t('telemetry.poll.ticksLabel')"
              type="number"
              :disabled="loading"
            />
          </div>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="loading || !pollTicksValid"
            @click="submitGeneratePoll"
          >
            {{ t('telemetry.poll.confirm') }}
          </button>
        </div>
        <p v-if="!pollTicksValid" class="text-sm text-red-600">
          {{ t('telemetry.poll.ticksValidation', { max: SIMULATED_POLL_MAX_TICKS }) }}
        </p>
      </div>
    </template>

    <AppEmptyState v-else :message="t('telemetry.deviceSelector.empty')" />
  </div>
</template>
