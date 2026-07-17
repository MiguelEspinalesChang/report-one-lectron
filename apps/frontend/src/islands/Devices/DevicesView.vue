<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceDto, Transport } from '@platform/shared-types'
import AppBadge from '../../components/AppBadge.vue'
import AppInput from '../../components/AppInput.vue'
import AppModal from '../../components/AppModal.vue'
import AppSelect from '../../components/AppSelect.vue'
import AppTable from '../../components/AppTable.vue'
import AppToggle from '../../components/AppToggle.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useCatalogStore } from '../../stores/catalog'
import { useSessionStore } from '../../stores/session'
import { useToastStore } from '../../stores/toast'

const DEVICE_NAME_MAX_LENGTH = 128

type SerialConnectionForm = {
  vid: string
  pid: string
  serialNumber: string
  baudrate: string
  parity: 'N' | 'E' | 'O'
  timeoutMs: string
}

type TcpConnectionForm = {
  host: string
  port: string
  timeoutMs: string
}

type DeviceFormState = {
  modelId: number
  name: string
  transport: Transport
  slaveId: string
  pollingIntervalS: string
  enabled: boolean
  serial: SerialConnectionForm
  tcp: TcpConnectionForm
}

const DEFAULT_SERIAL_CONNECTION: SerialConnectionForm = {
  vid: '',
  pid: '',
  serialNumber: '',
  baudrate: '9600',
  parity: 'N',
  timeoutMs: '1000',
}

const DEFAULT_TCP_CONNECTION: TcpConnectionForm = {
  host: '',
  port: '502',
  timeoutMs: '1000',
}

const { t } = useI18n()
const catalogStore = useCatalogStore()
const sessionStore = useSessionStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()
const canManageDevices = computed(() => sessionStore.hasPermission('devices.manage'))

onMounted(async () => {
  await call(async () => {
    await Promise.all([catalogStore.loadModels(), catalogStore.loadDevices()])
  })
})

function toInt(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function deviceRowKey(device: DeviceDto): number {
  return device.id
}

const modelsById = computed(() => {
  return new Map(catalogStore.models.map((model) => [model.id, model]))
})

const deviceRows = computed(() => {
  return catalogStore.devices.map((device) => ({
    ...device,
    modelName: modelsById.value.get(device.modelId)?.name ?? '—',
  }))
})

function transportBadgeTone(transport: Transport): 'primary' | 'warning' | 'neutral' {
  if (transport === 'serial' || transport === 'tcp') return 'primary'
  if (transport === 'simulated') return 'warning'
  return 'neutral'
}

function enabledBadgeTone(enabled: boolean): 'success' | 'neutral' {
  return enabled ? 'success' : 'neutral'
}

const transportOptions = computed(() => [
  { value: 'serial' as const, label: t('catalog.devices.transportValues.serial') },
  { value: 'tcp' as const, label: t('catalog.devices.transportValues.tcp') },
  { value: 'simulated' as const, label: t('catalog.devices.transportValues.simulated') },
  { value: 'csv' as const, label: t('catalog.devices.transportValues.csv') },
])

const modelOptions = computed(() => {
  return [
    { value: 0, label: t('catalog.devices.modelPlaceholder') },
    ...catalogStore.models.map((model) => ({ value: model.id, label: model.name })),
  ]
})

function createDefaultDeviceFormState(): DeviceFormState {
  return {
    modelId: 0,
    name: '',
    transport: 'simulated',
    slaveId: '1',
    pollingIntervalS: '900',
    enabled: true,
    serial: { ...DEFAULT_SERIAL_CONNECTION },
    tcp: { ...DEFAULT_TCP_CONNECTION },
  }
}

function connectionFromForm(form: DeviceFormState): Record<string, unknown> {
  if (form.transport === 'serial') {
    return {
      vid: form.serial.vid.trim(),
      pid: form.serial.pid.trim(),
      serialNumber: form.serial.serialNumber.trim() || undefined,
      baudrate: Number.parseInt(form.serial.baudrate, 10),
      parity: form.serial.parity,
      timeoutMs: Number.parseInt(form.serial.timeoutMs, 10),
    }
  }

  if (form.transport === 'tcp') {
    return {
      host: form.tcp.host.trim(),
      port: Number.parseInt(form.tcp.port, 10),
      timeoutMs: Number.parseInt(form.tcp.timeoutMs, 10),
    }
  }

  return {}
}

function formFromDevice(device: DeviceDto): DeviceFormState {
  const form = createDefaultDeviceFormState()
  form.modelId = device.modelId
  form.name = device.name
  form.transport = device.transport
  form.slaveId = String(device.slaveId)
  form.pollingIntervalS = String(device.pollingIntervalS)
  form.enabled = device.enabled

  if (device.transport === 'serial') {
    const connection = device.connection as Partial<Record<keyof SerialConnectionForm, unknown>>
    form.serial.vid = String(connection.vid ?? '')
    form.serial.pid = String(connection.pid ?? '')
    form.serial.serialNumber = String(connection.serialNumber ?? '')
    form.serial.baudrate = String(connection.baudrate ?? '9600')
    form.serial.parity = (connection.parity as 'N' | 'E' | 'O') ?? 'N'
    form.serial.timeoutMs = String(connection.timeoutMs ?? '1000')
  }

  if (device.transport === 'tcp') {
    const connection = device.connection as Partial<Record<keyof TcpConnectionForm, unknown>>
    form.tcp.host = String(connection.host ?? '')
    form.tcp.port = String(connection.port ?? '502')
    form.tcp.timeoutMs = String(connection.timeoutMs ?? '1000')
  }

  return form
}

function validateDeviceForm(form: DeviceFormState): string[] {
  const errors: string[] = []

  const trimmedName = form.name.trim()
  if (trimmedName.length === 0) errors.push(t('catalog.devices.validation.nameRequired'))
  if (trimmedName.length > DEVICE_NAME_MAX_LENGTH) {
    errors.push(t('catalog.devices.validation.nameTooLong', { max: DEVICE_NAME_MAX_LENGTH }))
  }

  if (form.modelId <= 0) errors.push(t('catalog.devices.validation.modelRequired'))

  // Mirrors packages/shared-types/src/catalog-schemas.ts CreateDeviceSchema
  // (slaveId: z.number().int().min(0).max(247)) — UX-only pre-validation, the backend re-validates.
  const slaveId = toInt(form.slaveId)
  if (slaveId === null || slaveId < 0 || slaveId > 247) {
    errors.push(t('catalog.devices.validation.slaveIdRange'))
  }

  const pollingIntervalS = toInt(form.pollingIntervalS)
  if (pollingIntervalS === null || pollingIntervalS <= 0) {
    errors.push(t('catalog.devices.validation.pollingRequired'))
  }

  if (form.transport === 'serial') {
    if (form.serial.vid.trim().length === 0) errors.push(t('catalog.devices.validation.serialVidRequired'))
    if (form.serial.pid.trim().length === 0) errors.push(t('catalog.devices.validation.serialPidRequired'))

    const baudrate = toInt(form.serial.baudrate)
    if (baudrate === null || baudrate <= 0) {
      errors.push(t('catalog.devices.validation.serialBaudrateRequired'))
    }

    const timeoutMs = toInt(form.serial.timeoutMs)
    if (timeoutMs === null || timeoutMs <= 0) {
      errors.push(t('catalog.devices.validation.timeoutRequired'))
    }
  }

  if (form.transport === 'tcp') {
    if (form.tcp.host.trim().length === 0) errors.push(t('catalog.devices.validation.tcpHostRequired'))

    // Mirrors packages/shared-types/src/catalog-schemas.ts TcpConnectionSchema
    // (port: z.number().int().min(1).max(65535)) — UX-only pre-validation, the backend re-validates.
    const port = toInt(form.tcp.port)
    if (port === null || port < 1 || port > 65535) {
      errors.push(t('catalog.devices.validation.tcpPortRange'))
    }

    const timeoutMs = toInt(form.tcp.timeoutMs)
    if (timeoutMs === null || timeoutMs <= 0) {
      errors.push(t('catalog.devices.validation.timeoutRequired'))
    }
  }

  return errors
}

const deviceFormOpen = ref(false)
const editingDevice = ref<DeviceDto | null>(null)
const deviceForm = ref<DeviceFormState>(createDefaultDeviceFormState())
const deviceDeleteOpen = ref(false)
const deletingDevice = ref<DeviceDto | null>(null)

const deviceValidationErrors = computed(() => validateDeviceForm(deviceForm.value))
const deviceFormValid = computed(() => deviceValidationErrors.value.length === 0)

function openCreateDevice(): void {
  if (!canManageDevices.value) return
  editingDevice.value = null
  deviceForm.value = createDefaultDeviceFormState()
  deviceFormOpen.value = true
}

function openEditDevice(device: DeviceDto): void {
  if (!canManageDevices.value) return
  editingDevice.value = device
  deviceForm.value = formFromDevice(device)
  deviceFormOpen.value = true
}

function openDeleteDevice(device: DeviceDto): void {
  if (!canManageDevices.value) return
  deletingDevice.value = device
  deviceDeleteOpen.value = true
}

async function submitDevice(): Promise<void> {
  if (!canManageDevices.value) return
  if (!deviceFormValid.value) return

  const payload = {
    modelId: deviceForm.value.modelId,
    name: deviceForm.value.name.trim(),
    transport: deviceForm.value.transport,
    connection: connectionFromForm(deviceForm.value),
    slaveId: Number.parseInt(deviceForm.value.slaveId, 10),
    pollingIntervalS: Number.parseInt(deviceForm.value.pollingIntervalS, 10),
    enabled: deviceForm.value.enabled,
  }

  if (editingDevice.value) {
    const updated = await call(() =>
      catalogStore.updateDevice({
        id: editingDevice.value!.id,
        ...payload,
      }),
    )
    if (updated) {
      deviceFormOpen.value = false
      toastStore.show('success', t('catalog.devices.updated'))
    }
    return
  }

  const created = await call(() => catalogStore.createDevice(payload))
  if (created) {
    deviceFormOpen.value = false
    toastStore.show('success', t('catalog.devices.created'))
  }
}

async function confirmDeleteDevice(): Promise<void> {
  if (!canManageDevices.value) return
  const target = deletingDevice.value
  if (!target) return
  const ok = await call(async () => {
    await catalogStore.deleteDevice(target.id)
    return true
  })
  if (ok) {
    deviceDeleteOpen.value = false
    toastStore.show('success', t('catalog.devices.deleted'))
  }
}

async function toggleDeviceEnabled(device: DeviceDto, nextEnabled: boolean): Promise<void> {
  if (!canManageDevices.value) return
  const ok = await call(async () => {
    await catalogStore.enableDevice(device.id, nextEnabled)
    return true
  })
  if (ok) {
    toastStore.show(
      'success',
      nextEnabled ? t('catalog.devices.enabledToast') : t('catalog.devices.disabledToast'),
    )
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-slate-900">{{ t('catalog.devices.title') }}</h1>

    <div class="island">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold text-slate-900">{{ t('catalog.devices.title') }}</h2>
        <button v-if="canManageDevices" type="button" class="btn btn-primary" @click="openCreateDevice">
          {{ t('catalog.devices.new') }}
        </button>
      </div>

      <AppTable
        :rows="deviceRows"
        :loading="loading"
        :row-key="deviceRowKey"
        :empty-message="t('catalog.devices.empty')"
      >
        <template #header>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('catalog.devices.columns.name') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('catalog.devices.columns.model') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('catalog.devices.columns.transport') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('catalog.devices.columns.enabled') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('catalog.devices.columns.pollingIntervalS') }}
          </th>
          <th
            v-if="canManageDevices"
            class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {{ t('catalog.devices.columns.toggle') }}
          </th>
          <th
            v-if="canManageDevices"
            class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {{ t('catalog.devices.columns.actions') }}
          </th>
        </template>
        <template #row="{ row }">
          <td class="px-4 py-3 text-sm text-slate-700">{{ row.name }}</td>
          <td class="px-4 py-3 text-sm text-slate-700">{{ row.modelName }}</td>
          <td class="px-4 py-3 text-sm">
            <AppBadge
              :label="t(`catalog.devices.transportValues.${row.transport}`)"
              :tone="transportBadgeTone(row.transport)"
            />
          </td>
          <td class="px-4 py-3 text-sm">
            <AppBadge
              :label="row.enabled ? t('catalog.devices.enabled') : t('catalog.devices.disabled')"
              :tone="enabledBadgeTone(row.enabled)"
            />
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">{{ row.pollingIntervalS }}</td>
          <td v-if="canManageDevices" class="px-4 py-3 text-sm">
            <AppToggle
              :model-value="row.enabled"
              :disabled="loading"
              @update:model-value="toggleDeviceEnabled(row, $event)"
            />
          </td>
          <td v-if="canManageDevices" class="px-4 py-3 text-right text-sm">
            <button type="button" class="btn-ghost btn" @click="openEditDevice(row)">
              {{ t('common.edit') }}
            </button>
            <button type="button" class="btn-ghost btn text-danger-600" @click="openDeleteDevice(row)">
              {{ t('common.delete') }}
            </button>
          </td>
        </template>
      </AppTable>
    </div>

    <AppModal v-if="canManageDevices" v-model:open="deviceFormOpen" size="lg">
      <template #title>
        {{ editingDevice ? t('catalog.devices.editTitle') : t('catalog.devices.createTitle') }}
      </template>
      <template #body>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AppInput
            v-model="deviceForm.name"
            :label="t('catalog.devices.nameLabel')"
            :placeholder="t('catalog.devices.namePlaceholder')"
            :disabled="loading"
          />
          <AppSelect
            v-model="deviceForm.modelId"
            :label="t('catalog.devices.modelLabel')"
            :options="modelOptions"
            :disabled="loading"
          />
          <AppSelect
            v-model="deviceForm.transport"
            :label="t('catalog.devices.transportLabel')"
            :options="transportOptions"
            :disabled="loading"
          />
          <div class="flex items-end pb-2">
            <AppToggle
              v-model="deviceForm.enabled"
              :disabled="loading"
              :label="t('catalog.devices.enabledLabel')"
            />
          </div>
          <AppInput
            v-model="deviceForm.slaveId"
            :label="t('catalog.devices.slaveIdLabel')"
            :placeholder="t('catalog.devices.slaveIdPlaceholder')"
            :disabled="loading"
            type="number"
          />
          <AppInput
            v-model="deviceForm.pollingIntervalS"
            :label="t('catalog.devices.pollingIntervalLabel')"
            :placeholder="t('catalog.devices.pollingIntervalPlaceholder')"
            :disabled="loading"
            type="number"
          />
        </div>

        <div v-if="deviceForm.transport === 'serial'" class="mt-6 rounded-lg border border-line p-4">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">
            {{ t('catalog.devices.connection.serialTitle') }}
          </h3>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AppInput
              v-model="deviceForm.serial.vid"
              :label="t('catalog.devices.connection.vid')"
              :disabled="loading"
            />
            <AppInput
              v-model="deviceForm.serial.pid"
              :label="t('catalog.devices.connection.pid')"
              :disabled="loading"
            />
            <AppInput
              v-model="deviceForm.serial.serialNumber"
              :label="t('catalog.devices.connection.serialNumber')"
              :disabled="loading"
            />
            <AppInput
              v-model="deviceForm.serial.baudrate"
              :label="t('catalog.devices.connection.baudrate')"
              :disabled="loading"
              type="number"
            />
            <AppSelect
              v-model="deviceForm.serial.parity"
              :label="t('catalog.devices.connection.parity')"
              :disabled="loading"
              :options="[
                { value: 'N', label: 'N' },
                { value: 'E', label: 'E' },
                { value: 'O', label: 'O' },
              ]"
            />
            <AppInput
              v-model="deviceForm.serial.timeoutMs"
              :label="t('catalog.devices.connection.timeoutMs')"
              :disabled="loading"
              type="number"
            />
          </div>
        </div>

        <div v-else-if="deviceForm.transport === 'tcp'" class="mt-6 rounded-lg border border-line p-4">
          <h3 class="mb-4 text-sm font-semibold text-slate-700">
            {{ t('catalog.devices.connection.tcpTitle') }}
          </h3>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AppInput
              v-model="deviceForm.tcp.host"
              :label="t('catalog.devices.connection.host')"
              :disabled="loading"
            />
            <AppInput
              v-model="deviceForm.tcp.port"
              :label="t('catalog.devices.connection.port')"
              :disabled="loading"
              type="number"
            />
            <AppInput
              v-model="deviceForm.tcp.timeoutMs"
              :label="t('catalog.devices.connection.timeoutMs')"
              :disabled="loading"
              type="number"
            />
          </div>
        </div>

        <p v-else class="mt-6 text-sm text-slate-500">
          {{ t('catalog.devices.connection.noneRequired') }}
        </p>

        <ul v-if="deviceValidationErrors.length > 0" class="mt-4 list-disc space-y-1 pl-5 text-sm text-red-600">
          <li v-for="error in deviceValidationErrors" :key="error">{{ error }}</li>
        </ul>
      </template>
      <template #footer>
        <button type="button" class="btn" @click="deviceFormOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !deviceFormValid"
          @click="submitDevice"
        >
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog
      v-if="canManageDevices"
      v-model:open="deviceDeleteOpen"
      :title="t('catalog.devices.deleteTitle')"
      :message="t('catalog.devices.deleteMessage', { name: deletingDevice?.name ?? '' })"
      :confirm-label="t('common.delete')"
      variant="danger"
      @confirm="confirmDeleteDevice"
    />
  </div>
</template>
