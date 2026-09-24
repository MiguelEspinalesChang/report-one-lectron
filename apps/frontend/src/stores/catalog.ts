import type { BrandDto, DeviceDto, MeterModelDto, RegisterMap } from '@platform/shared-types'
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

  // ========== Devices ==========
  const devices = ref<DeviceDto[]>([])
  const devicesLoaded = ref(false)

  async function loadDevices(): Promise<void> {
    devices.value = await window.platform.catalog.devices.list()
    devicesLoaded.value = true
  }

  async function createDevice(dto: Omit<DeviceDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeviceDto> {
    const device = await window.platform.catalog.devices.create(dto)
    devices.value.push(device)
    return device
  }

  async function updateDevice(
    dto: Partial<Omit<DeviceDto, 'createdAt' | 'updatedAt'>> & { id: number },
  ): Promise<DeviceDto> {
    const device = await window.platform.catalog.devices.update(dto)
    const index = devices.value.findIndex((d) => d.id === dto.id)
    if (index >= 0) {
      devices.value[index] = device
    }
    return device
  }

  async function enableDevice(id: number, enabled: boolean): Promise<void> {
    await window.platform.catalog.devices.enable({ id, enabled })
    const device = devices.value.find((d) => d.id === id)
    if (device) device.enabled = enabled
  }

  async function deleteDevice(id: number): Promise<void> {
    await window.platform.catalog.devices.delete({ id })
    devices.value = devices.value.filter((d) => d.id !== id)
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
    devices,
    devicesLoaded,
    loadDevices,
    createDevice,
    updateDevice,
    enableDevice,
    deleteDevice,
  }
})
