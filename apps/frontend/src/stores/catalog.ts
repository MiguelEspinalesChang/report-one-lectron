import type { BrandDto } from '@platform/shared-types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCatalogStore = defineStore('catalog', () => {
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
    // rename() returns void — mutate the local item instead of a full refetch.
    const brand = brands.value.find((b) => b.id === id)
    if (brand) brand.name = name
  }

  async function deleteBrand(id: number): Promise<void> {
    await window.platform.catalog.brands.delete({ id })
    // delete() returns void — filter locally. If the backend rejected (e.g.
    // BrandInUseError) this line never runs because the await above throws,
    // so the brand correctly survives in the caller's view.
    brands.value = brands.value.filter((b) => b.id !== id)
  }

  return { brands, brandsLoaded, loadBrands, createBrand, renameBrand, deleteBrand }
})
