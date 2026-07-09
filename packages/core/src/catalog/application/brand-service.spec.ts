import { beforeEach, describe, expect, it } from 'vitest'
import type { Brand } from '../domain/entities'
import type { BrandRepository, CreateBrandInput } from '../ports/repositories'
import { BrandInUseError, BrandNotFoundError, BrandService } from './brand-service'

class FakeBrandRepository implements BrandRepository {
  private store: Brand[] = []
  private nextId = 1
  private modelMap = new Map<number, boolean>()

  seed(brand: Brand, hasModels = false): void {
    this.store.push(brand)
    if (brand.id >= this.nextId) this.nextId = brand.id + 1
    this.modelMap.set(brand.id, hasModels)
  }

  async findById(id: number): Promise<Brand | null> {
    return this.store.find((b) => b.id === id) ?? null
  }

  async findAll(): Promise<Brand[]> {
    return [...this.store]
  }

  async create(input: CreateBrandInput): Promise<Brand> {
    const brand = { id: this.nextId++, name: input.name }
    this.store.push(brand)
    this.modelMap.set(brand.id, false)
    return brand
  }

  async rename(id: number, name: string): Promise<void> {
    const brand = this.store.find((b) => b.id === id)
    if (brand !== undefined) brand.name = name
  }

  async delete(id: number): Promise<void> {
    this.store = this.store.filter((b) => b.id !== id)
  }

  async hasModels(id: number): Promise<boolean> {
    return this.modelMap.get(id) ?? false
  }
}

describe('BrandService', () => {
  let repo: FakeBrandRepository
  let service: BrandService

  beforeEach(() => {
    repo = new FakeBrandRepository()
    service = new BrandService(repo)
  })

  it('creates a brand', async () => {
    const brand = await service.create('ACME')
    expect(brand.name).toBe('ACME')
    expect(brand.id).toBeGreaterThan(0)
  })

  it('lists all brands', async () => {
    repo.seed({ id: 1, name: 'A' })
    repo.seed({ id: 2, name: 'B' })
    const all = await service.list()
    expect(all).toHaveLength(2)
  })

  it('renames a brand', async () => {
    repo.seed({ id: 1, name: 'Old' })
    await service.rename(1, 'New')
    const updated = await repo.findById(1)
    expect(updated?.name).toBe('New')
  })

  it('throws BrandNotFoundError when renaming nonexistent brand', async () => {
    await expect(service.rename(999, 'X')).rejects.toThrow(BrandNotFoundError)
  })

  it('deletes a brand with no models', async () => {
    repo.seed({ id: 1, name: 'Empty' }, false)
    await service.delete(1)
    expect(await repo.findById(1)).toBeNull()
  })

  it('throws BrandInUseError when deleting brand with models', async () => {
    repo.seed({ id: 1, name: 'InUse' }, true)
    await expect(service.delete(1)).rejects.toThrow(BrandInUseError)
  })

  it('throws BrandNotFoundError when deleting nonexistent brand', async () => {
    await expect(service.delete(999)).rejects.toThrow(BrandNotFoundError)
  })
})
