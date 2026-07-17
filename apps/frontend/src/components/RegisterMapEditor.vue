<script setup lang="ts">
import type { RegisterEntry } from '@platform/shared-types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from './AppSelect.vue'

interface Props {
  modelValue: RegisterEntry[]
}

interface Emits {
  (e: 'update:modelValue', value: RegisterEntry[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const localRegisters = ref<RegisterEntry[]>([])

// Initialize from prop
watch(
  () => props.modelValue,
  (newVal) => {
    localRegisters.value = JSON.parse(JSON.stringify(newVal))
  },
  { immediate: true },
)

// Emit changes upstream
watch(localRegisters, (newVal) => {
  emit('update:modelValue', newVal)
})

// ========== Validation ==========
const duplicateMetrics = computed(() => {
  const metrics = localRegisters.value.map((r) => r.metric.trim()).filter(Boolean)
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const m of metrics) {
    if (seen.has(m)) dupes.add(m)
    seen.add(m)
  }
  return Array.from(dupes)
})

const addressErrors = computed(() => {
  return localRegisters.value
    .map((r, idx) => ({ idx, address: r.address }))
    .filter((r) => r.address < 0 || r.address > 65535)
})

const hasErrors = computed(() => {
  return duplicateMetrics.value.length > 0 || addressErrors.value.length > 0
})

// ========== Actions ==========
function addRegister() {
  localRegisters.value.push({
    address: 0,
    function: 'holding',
    metric: '',
    datatype: 'uint16',
    wordOrder: 'big_endian',
    scale: 1,
    unit: '',
  })
}

function removeRegister(index: number) {
  localRegisters.value.splice(index, 1)
}

// ========== Options for selects ==========
const functionOptions = [
  { value: 'holding', label: t('catalog.registerMap.functions.holding') },
  { value: 'input', label: t('catalog.registerMap.functions.input') },
]

const datatypeOptions = [
  { value: 'int16', label: t('catalog.registerMap.datatypes.int16') },
  { value: 'uint16', label: t('catalog.registerMap.datatypes.uint16') },
  { value: 'int32', label: t('catalog.registerMap.datatypes.int32') },
  { value: 'uint32', label: t('catalog.registerMap.datatypes.uint32') },
  { value: 'int64', label: t('catalog.registerMap.datatypes.int64') },
  { value: 'float32', label: t('catalog.registerMap.datatypes.float32') },
  { value: 'float64', label: t('catalog.registerMap.datatypes.float64') },
]

const wordOrderOptions = [
  { value: 'big_endian', label: t('catalog.registerMap.wordOrders.big_endian') },
  { value: 'little_endian', label: t('catalog.registerMap.wordOrders.little_endian') },
]

defineExpose({ hasErrors })
</script>

<template>
  <div class="space-y-4">
    <!-- Validation errors -->
    <div v-if="hasErrors" class="rounded-btn bg-danger-50 border border-danger-200 p-4 text-sm text-danger-800">
      <ul class="list-disc list-inside space-y-1">
        <li v-for="metric in duplicateMetrics" :key="metric">
          {{ t('catalog.registerMap.duplicateMetric', { metric }) }}
        </li>
        <li v-for="err in addressErrors" :key="err.idx">
          {{ t('catalog.registerMap.addressOutOfRange') }} ({{ t('catalog.registerMap.address') }}
          {{ localRegisters[err.idx]?.address ?? err.address }})
        </li>
      </ul>
    </div>

    <!-- Registers table -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.address') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.function') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.metric') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.datatype') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.wordOrder') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.scale') }}
            </th>
            <th class="text-left p-2 font-semibold text-slate-600">
              {{ t('catalog.registerMap.unit') }}
            </th>
            <th class="w-24"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(register, index) in localRegisters"
            :key="index"
            class="border-b border-line hover:bg-slate-50"
          >
            <td class="p-2">
              <input
                v-model.number="register.address"
                type="number"
                min="0"
                max="65535"
                :placeholder="t('catalog.registerMap.placeholders.address')"
                class="block w-24 rounded-lg border-slate-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </td>
            <td class="p-2">
              <AppSelect v-model="register.function" :options="functionOptions" class="w-32" />
            </td>
            <td class="p-2">
              <input
                v-model="register.metric"
                type="text"
                :placeholder="t('catalog.registerMap.placeholders.metric')"
                class="block w-40 rounded-lg border-slate-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </td>
            <td class="p-2">
              <AppSelect v-model="register.datatype" :options="datatypeOptions" class="w-32" />
            </td>
            <td class="p-2">
              <AppSelect v-model="register.wordOrder" :options="wordOrderOptions" class="w-40" />
            </td>
            <td class="p-2">
              <input
                v-model.number="register.scale"
                type="number"
                step="any"
                :placeholder="t('catalog.registerMap.placeholders.scale')"
                class="block w-24 rounded-lg border-slate-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </td>
            <td class="p-2">
              <input
                v-model="register.unit"
                type="text"
                :placeholder="t('catalog.registerMap.placeholders.unit')"
                class="block w-24 rounded-lg border-slate-300 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </td>
            <td class="p-2 text-right">
              <button
                type="button"
                class="text-sm text-danger-600 hover:text-danger-800"
                :disabled="localRegisters.length === 1"
                @click="removeRegister(index)"
              >
                {{ t('catalog.registerMap.removeRegister') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add button -->
    <div class="flex justify-start">
      <button type="button" class="btn btn-soft" @click="addRegister">
        {{ t('catalog.registerMap.addRegister') }}
      </button>
    </div>

    <!-- Min one register validation -->
    <p v-if="localRegisters.length === 0" class="text-sm text-danger-600">
      {{ t('catalog.registerMap.minOne') }}
    </p>
  </div>
</template>
