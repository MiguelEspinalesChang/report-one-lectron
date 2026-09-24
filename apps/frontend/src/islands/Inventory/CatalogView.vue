<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { BrandDto, MeterModelDto } from '@platform/shared-types'
import AppInput from '../../components/AppInput.vue'
import AppModal from '../../components/AppModal.vue'
import AppTable from '../../components/AppTable.vue'
import AppTabs from '../../components/AppTabs.vue'
import type { TabItem } from '../../components/AppTabs.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useCatalogStore } from '../../stores/catalog'
import { useSessionStore } from '../../stores/session'
import { useToastStore } from '../../stores/toast'

// Mirrors packages/shared-types/src/catalog-schemas.ts CreateBrandSchema/RenameBrandSchema
// (name: z.string().min(1).max(128)) — UX-only pre-validation, the backend re-validates.
const BRAND_NAME_MAX_LENGTH = 128

type CatalogTab = 'brands' | 'models'

const { t } = useI18n()
const router = useRouter()
const catalogStore = useCatalogStore()
const sessionStore = useSessionStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()

const canManageDevices = computed(() => sessionStore.hasPermission('devices.manage'))

const activeTab = ref<CatalogTab>('brands')
const tabs = computed<TabItem[]>(() => [
  { name: 'brands', label: t('catalog.tabs.brands') },
  { name: 'models', label: t('catalog.tabs.models') },
])

onMounted(async () => {
  await call(async () => {
    await Promise.all([catalogStore.loadBrands(), catalogStore.loadModels()])
  })
})

function validateBrandName(name: string): string | undefined {
  const trimmed = name.trim()
  if (trimmed.length === 0) return t('catalog.brands.nameRequired')
  if (trimmed.length > BRAND_NAME_MAX_LENGTH) {
    return t('catalog.brands.nameTooLong', { max: BRAND_NAME_MAX_LENGTH })
  }
  return undefined
}

function brandRowKey(brand: BrandDto): number {
  return brand.id
}

function modelRowKey(model: MeterModelDto): number {
  return model.id
}

// ========== Brands section ==========
const createOpen = ref(false)
const createName = ref('')
const createError = computed(() => validateBrandName(createName.value))

function openCreate(): void {
  createName.value = ''
  createOpen.value = true
}

async function submitCreate(): Promise<void> {
  if (!canManageDevices.value) return
  if (createError.value) return
  const brand = await call(() => catalogStore.createBrand(createName.value.trim()))
  if (brand) {
    createOpen.value = false
    toastStore.show('success', t('catalog.brands.created'))
  }
}

const renameOpen = ref(false)
const renameName = ref('')
const renamingBrand = ref<BrandDto | null>(null)
const renameError = computed(() => validateBrandName(renameName.value))

function openRename(brand: BrandDto): void {
  renamingBrand.value = brand
  renameName.value = brand.name
  renameOpen.value = true
}

async function submitRename(): Promise<void> {
  if (!canManageDevices.value) return
  const target = renamingBrand.value
  if (renameError.value || !target) return
  const ok = await call(async () => {
    await catalogStore.renameBrand(target.id, renameName.value.trim())
    return true
  })
  if (ok) {
    renameOpen.value = false
    toastStore.show('success', t('catalog.brands.renamed'))
  }
}

const deleteOpen = ref(false)
const deletingBrand = ref<BrandDto | null>(null)

function openDelete(brand: BrandDto): void {
  deletingBrand.value = brand
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!canManageDevices.value) return
  const target = deletingBrand.value
  if (!target) return
  const ok = await call(async () => {
    await catalogStore.deleteBrand(target.id)
    return true
  })
  if (ok) {
    deleteOpen.value = false
    toastStore.show('success', t('catalog.brands.deleted'))
  }
}

// ========== Models section ==========
const modelsWithBrand = computed(() => {
  return catalogStore.models.map((model) => {
    const brand = catalogStore.brands.find((b) => b.id === model.brandId)
    return { ...model, brandName: brand?.name ?? '—' }
  })
})

const deleteModelOpen = ref(false)
const deletingModel = ref<MeterModelDto | null>(null)

function navigateToNewModel(): void {
  if (!canManageDevices.value) return
  void router.push({ name: 'catalog-model-new' })
}

function navigateToEditModel(model: MeterModelDto): void {
  if (!canManageDevices.value) return
  void router.push({ name: 'catalog-model-edit', params: { id: model.id } })
}

function openDeleteModel(model: MeterModelDto): void {
  deletingModel.value = model
  deleteModelOpen.value = true
}

async function confirmDeleteModel(): Promise<void> {
  if (!canManageDevices.value) return
  const target = deletingModel.value
  if (!target) return
  const ok = await call(async () => {
    await catalogStore.deleteModel(target.id)
    return true
  })
  if (ok) {
    deleteModelOpen.value = false
    toastStore.show('success', t('catalog.models.deleted'))
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-slate-900">{{ t('catalog.title') }}</h1>

    <AppTabs v-model:active="activeTab" :items="tabs">
      <div v-if="activeTab === 'brands'" class="island">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-semibold text-slate-900">{{ t('catalog.brands.title') }}</h2>
          <button v-if="canManageDevices" type="button" class="btn btn-primary" @click="openCreate">
            {{ t('catalog.brands.new') }}
          </button>
        </div>

        <AppTable
          :rows="catalogStore.brands"
          :loading="loading"
          :row-key="brandRowKey"
          :empty-message="t('catalog.brands.empty')"
        >
          <template #header>
            <th
              class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.brands.columns.name') }}
            </th>
            <th
              v-if="canManageDevices"
              class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.brands.columns.actions') }}
            </th>
          </template>
          <template #row="{ row }">
            <td class="px-4 py-3 text-sm text-slate-700">{{ row.name }}</td>
            <td v-if="canManageDevices" class="px-4 py-3 text-right text-sm">
              <button type="button" class="btn-ghost btn" @click="openRename(row)">
                {{ t('common.edit') }}
              </button>
              <button
                type="button"
                class="btn-ghost btn text-danger-600"
                @click="openDelete(row)"
              >
                {{ t('common.delete') }}
              </button>
            </td>
          </template>
        </AppTable>
      </div>

      <div v-else-if="activeTab === 'models'" class="island">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-semibold text-slate-900">{{ t('catalog.models.title') }}</h2>
          <button v-if="canManageDevices" type="button" class="btn btn-primary" @click="navigateToNewModel">
            {{ t('catalog.models.new') }}
          </button>
        </div>

        <AppTable
          :rows="modelsWithBrand"
          :loading="loading"
          :row-key="modelRowKey"
          :empty-message="t('catalog.models.empty')"
        >
          <template #header>
            <th
              class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.models.columns.brand') }}
            </th>
            <th
              class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.models.columns.name') }}
            </th>
            <th
              class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.models.columns.metrics') }}
            </th>
            <th
              v-if="canManageDevices"
              class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            >
              {{ t('catalog.models.columns.actions') }}
            </th>
          </template>
          <template #row="{ row }">
            <td class="px-4 py-3 text-sm text-slate-700">{{ row.brandName }}</td>
            <td class="px-4 py-3 text-sm text-slate-700">{{ row.name }}</td>
            <td class="px-4 py-3 text-sm text-slate-500">
              {{ row.registerMap.registers.length }}
            </td>
            <td v-if="canManageDevices" class="px-4 py-3 text-right text-sm">
              <button type="button" class="btn-ghost btn" @click="navigateToEditModel(row)">
                {{ t('common.edit') }}
              </button>
              <button
                type="button"
                class="btn-ghost btn text-danger-600"
                @click="openDeleteModel(row)"
              >
                {{ t('common.delete') }}
              </button>
            </td>
          </template>
        </AppTable>
      </div>
    </AppTabs>

    <AppModal v-if="canManageDevices" v-model:open="createOpen">
      <template #title>{{ t('catalog.brands.createTitle') }}</template>
      <template #body>
        <AppInput
          v-model="createName"
          :label="t('catalog.brands.nameLabel')"
          :placeholder="t('catalog.brands.namePlaceholder')"
          :error-text="createName.length > 0 ? createError : undefined"
          :disabled="loading"
        />
      </template>
      <template #footer>
        <button type="button" class="btn" @click="createOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !!createError"
          @click="submitCreate"
        >
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal v-if="canManageDevices" v-model:open="renameOpen">
      <template #title>{{ t('catalog.brands.renameTitle') }}</template>
      <template #body>
        <AppInput
          v-model="renameName"
          :label="t('catalog.brands.nameLabel')"
          :placeholder="t('catalog.brands.namePlaceholder')"
          :error-text="renameName.length > 0 ? renameError : undefined"
          :disabled="loading"
        />
      </template>
      <template #footer>
        <button type="button" class="btn" @click="renameOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !!renameError"
          @click="submitRename"
        >
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog
      v-if="canManageDevices"
      v-model:open="deleteOpen"
      :title="t('catalog.brands.deleteTitle')"
      :message="t('catalog.brands.deleteMessage', { name: deletingBrand?.name ?? '' })"
      :confirm-label="t('common.delete')"
      variant="danger"
      @confirm="confirmDelete"
    />

    <ConfirmDialog
      v-if="canManageDevices"
      v-model:open="deleteModelOpen"
      :title="t('catalog.models.deleteTitle')"
      :message="t('catalog.models.deleteMessage', { name: deletingModel?.name ?? '' })"
      :confirm-label="t('common.delete')"
      variant="danger"
      @confirm="confirmDeleteModel"
    />
  </div>
</template>
