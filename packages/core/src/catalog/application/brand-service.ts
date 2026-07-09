import type { Brand } from '../domain/entities'
import { BrandInUseError, BrandNotFoundError } from '../domain/errors'
import type { BrandRepository } from '../ports/repositories'

export { BrandInUseError, BrandNotFoundError } from '../domain/errors'

export class BrandService {
  constructor(private readonly brands: BrandRepository) {}

  async create(name: string): Promise<Brand> {
    return this.brands.create({ name })
  }

  async list(): Promise<Brand[]> {
    return this.brands.findAll()
  }

  async rename(id: number, name: string): Promise<void> {
    const brand = await this.brands.findById(id)
    if (brand === null) throw new BrandNotFoundError(id)
    await this.brands.rename(id, name)
  }

  async delete(id: number): Promise<void> {
    const brand = await this.brands.findById(id)
    if (brand === null) throw new BrandNotFoundError(id)
    const inUse = await this.brands.hasModels(id)
    if (inUse) throw new BrandInUseError(id)
    await this.brands.delete(id)
  }
}
