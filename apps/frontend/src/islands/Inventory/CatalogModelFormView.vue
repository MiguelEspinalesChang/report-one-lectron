<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { MeterModelDto, RegisterEntry, RegisterMap } from '@platform/shared-types'
import AppInput from '../../components/AppInput.vue'
import AppModal from '../../components/AppModal.vue'
import AppSelect from '../../components/AppSelect.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import RegisterMapEditor from '../../components/RegisterMapEditor.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useCatalogStore } from '../../stores/catalog'
import { useToastStore } from '../../stores/toast'

const MODEL_NAME_MAX_LENGTH = 128

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()

const isEdit = computed(() => route.name === 'catalog-model-edit')
const modelId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? Number.parseInt(id, 10) : 0
})

const brandId = ref<number>(0)
const modelName = ref('')
const notes = ref('')
const registerMap = ref<RegisterEntry[]>([
  {
    address: 0,
    function: 'holding',
    metric: '',
    datatype: 'uint16',
    wordOrder: 'big_endian',
    scale: 1,
    unit: '',
  },
])
const registerMapEditorRef = ref<InstanceType<typeof RegisterMapEditor> | null>(null)
const showMetricWarning = ref(false)
const originalMetrics = ref<Set<string>>(new Set())
const showRegisterMapHelp = ref(false)

const brandOptions = computed(() => {
  return [
    { value: 0, label: t('catalog.models.brandPlaceholder') },
    ...catalogStore.brands.map((b) => ({ value: b.id, label: b.name })),
  ]
})

const brandError = computed(() => {
  return brandId.value === 0 ? t('catalog.models.brandRequired') : undefined
})

const nameError = computed(() => {
  const trimmed = modelName.value.trim()
  if (trimmed.length === 0) return t('catalog.models.nameRequired')
  if (trimmed.length > MODEL_NAME_MAX_LENGTH) {
    return t('catalog.models.nameTooLong', { max: MODEL_NAME_MAX_LENGTH })
  }
  return undefined
})

const formValid = computed(() => {
  return (
    !brandError.value &&
    !nameError.value &&
    registerMap.value.length > 0 &&
    !registerMapEditorRef.value?.hasErrors
  )
})

const hasMetricChanges = computed(() => {
  if (!isEdit.value) return false
  const current = new Set(registerMap.value.map((r) => r.metric))
  return (
    current.size !== originalMetrics.value.size ||
    ![...current].every((m) => originalMetrics.value.has(m))
  )
})

onMounted(async () => {
  await call(() => catalogStore.loadBrands())
  if (isEdit.value && modelId.value) {
    await call(() => catalogStore.loadModels())
    const model = catalogStore.models.find((m) => m.id === modelId.value)
    if (model) {
      loadModel(model)
    } else {
      toastStore.show('error', t('errors.meterModelNotFound'))
      void router.push({ name: 'catalog' })
    }
  }
})

function loadModel(model: MeterModelDto): void {
  brandId.value = model.brandId
  modelName.value = model.name
  notes.value = model.notes ?? ''
  registerMap.value = JSON.parse(JSON.stringify(model.registerMap.registers))
  originalMetrics.value = new Set(model.registerMap.registers.map((r) => r.metric))
}

function handleCancel(): void {
  void router.push({ name: 'catalog' })
}

async function handleSave(): Promise<void> {
  if (!formValid.value || brandId.value === 0) return

  if (isEdit.value && hasMetricChanges.value && !showMetricWarning.value) {
    showMetricWarning.value = true
    return
  }

  const map: RegisterMap = {
    version: 1,
    registers: registerMap.value,
  }

  if (isEdit.value) {
    const ok = await call(async () => {
      await catalogStore.updateModel(modelId.value, {
        brandId: brandId.value,
        name: modelName.value.trim(),
        registerMap: map,
        notes: notes.value.trim() || undefined,
      })
      return true
    })
    if (ok) {
      toastStore.show('success', t('catalog.models.updated'))
      void router.push({ name: 'catalog' })
    }
  } else {
    const model = await call(() =>
      catalogStore.createModel(
        brandId.value,
        modelName.value.trim(),
        map,
        notes.value.trim() || undefined,
      ),
    )
    if (model) {
      toastStore.show('success', t('catalog.models.created'))
      void router.push({ name: 'catalog' })
    }
  }
}

function handleWarningCancel(): void {
  showMetricWarning.value = false
}

function handleWarningConfirm(): void {
  showMetricWarning.value = false
  void handleSave()
}

function openRegisterMapHelp(): void {
  showRegisterMapHelp.value = true
}
</script>

<template>
  <div class="p-6 max-w-5xl">
    <h1 class="text-2xl font-bold text-slate-800 mb-6">
      {{ isEdit ? t('catalog.models.editTitle') : t('catalog.models.createTitle') }}
    </h1>

    <div class="bg-white rounded-lg border border-line p-6 space-y-6">
      <!-- Brand -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-2">
          {{ t('catalog.models.brandLabel') }}
        </label>
        <AppSelect v-model="brandId" :options="brandOptions" class="max-w-xs" />
        <p v-if="brandError" class="mt-1 text-sm text-red-600">{{ brandError }}</p>
      </div>

      <!-- Name -->
      <AppInput
        v-model="modelName"
        :label="t('catalog.models.nameLabel')"
        :placeholder="t('catalog.models.namePlaceholder')"
        :error="nameError"
        class="max-w-md"
      />

      <!-- Notes -->
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-2">
          {{ t('catalog.models.notesLabel') }}
        </label>
        <textarea
          v-model="notes"
          :placeholder="t('catalog.models.notesPlaceholder')"
          rows="3"
          class="block w-full rounded-lg border-slate-300 text-sm focus:border-primary-500 focus:ring-primary-500"
        ></textarea>
      </div>

      <!-- Register map -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <label class="text-sm font-semibold text-slate-700">
            {{ t('catalog.models.registerMapLabel') }}
          </label>
          <button
            type="button"
            class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            :aria-label="t('catalog.registerMap.help.title')"
            @click="openRegisterMapHelp"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <RegisterMapEditor ref="registerMapEditorRef" v-model="registerMap" />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-4 border-t border-line">
        <button type="button" class="btn" @click="handleCancel">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="!formValid || loading" @click="handleSave">
          {{ t('common.save') }}
        </button>
      </div>
    </div>

    <!-- Metric warning dialog -->
    <ConfirmDialog
      v-if="showMetricWarning"
      v-model:open="showMetricWarning"
      :title="t('catalog.models.metricWarningTitle')"
      :message="t('catalog.models.metricWarningMessage')"
      :confirm-label="t('common.confirm')"
      variant="primary"
      @confirm="handleWarningConfirm"
      @cancel="handleWarningCancel"
    />

    <!-- Register map help modal -->
    <AppModal v-model:open="showRegisterMapHelp" size="md">
      <template #title>{{ t('catalog.registerMap.help.title') }}</template>
      
      <template #body>
        <div class="space-y-4 text-sm text-slate-700">
          <p class="font-medium">{{ t('catalog.registerMap.help.intro') }}</p>
          
          <div class="space-y-3">
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.address') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.address') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.function') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.function') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.metric') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.metric') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.datatype') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.datatype') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.wordOrder') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.wordOrder') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.scale') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.scale') }}</p>
            </div>
            
            <div>
              <strong class="text-slate-900">{{ t('catalog.registerMap.unit') }}:</strong>
              <p class="mt-0.5">{{ t('catalog.registerMap.help.unit') }}</p>
            </div>
          </div>
        </div>
      </template>
      
      <template #footer>
        <button type="button" class="btn btn-primary" @click="showRegisterMapHelp = false">
          {{ t('common.close') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
