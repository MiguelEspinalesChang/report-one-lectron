import type { BrandDto, MeterModelDto, RegisterMap } from '@platform/shared-types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCatalogStore = defineStore('catalog', () => {
  // ========== Brands ==========
  const brands = ref<BrandDto[]>([])
  const brandsLoaded = ref(false)

  async function loadBrands(): Promise<void> {
    brands.value = await window.platform.catalog.brands.list()
    brandsLoaded.value = true
  }

  async function createBrand(name: string): Promise<BrandDto> {
    const brand = await window.platform.catalog.brands.create({ name })
    brands.value.push(brand)
    return brand
  }

  async function renameBrand(id: number, name: string): Promise<void> {
    await window.platform.catalog.brands.rename({ id, name })
    const brand = brands.value.find((b) => b.id === id)
    if (brand) brand.name = name
  }

  async function deleteBrand(id: number): Promise<void> {
    await window.platform.catalog.brands.delete({ id })
    brands.value = brands.value.filter((b) => b.id !== id)
  }

  // ========== Models ==========
  const models = ref<MeterModelDto[]>([])
  const modelsLoaded = ref(false)

  async function loadModels(): Promise<void> {
    models.value = await window.platform.catalog.models.list()
    modelsLoaded.value = true
  }

  async function loadModelsByBrand(brandId: number): Promise<MeterModelDto[]> {
    return await window.platform.catalog.models.listByBrand(brandId)
  }

  async function createModel(
    brandId: number,
    name: string,
    registerMap: RegisterMap,
    notes?: string,
  ): Promise<MeterModelDto> {
    const model = await window.platform.catalog.models.create({
      brandId,
      name,
      registerMap,
      notes: notes ?? null,
    })
    models.value.push(model)
    return model
  }

  async function updateModelMap(id: number, registerMap: RegisterMap): Promise<void> {
    await window.platform.catalog.models.updateMap({ id, registerMap })
    const model = models.value.find((m) => m.id === id)
    if (model) model.registerMap = registerMap
  }

  async function updateModel(
    id: number,
    data: {
      brandId: number
      name: string
      registerMap: RegisterMap
      notes?: string
    },
  ): Promise<void> {
    await window.platform.catalog.models.update({
      id,
      brandId: data.brandId,
      name: data.name,
      registerMap: data.registerMap,
      notes: data.notes ?? null,
    })
    const model = models.value.find((m) => m.id === id)
    if (model) {
      model.brandId = data.brandId
      model.name = data.name
      model.registerMap = data.registerMap
      model.notes = data.notes ?? null
    }
  }

  async function deleteModel(id: number): Promise<void> {
    await window.platform.catalog.models.delete({ id })
    models.value = models.value.filter((m) => m.id !== id)
  }

  return {
    brands,
    brandsLoaded,
    loadBrands,
    createBrand,
    renameBrand,
    deleteBrand,
    models,
    modelsLoaded,
    loadModels,
    loadModelsByBrand,
    createModel,
    updateModelMap,
    updateModel,
    deleteModel,
  }
})
