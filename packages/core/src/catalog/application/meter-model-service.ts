import type { MeterModel, RegisterMap } from '../domain/entities'
import { MeterModelInUseError, MeterModelNotFoundError } from '../domain/errors'
import { validateRegisterMap } from '../domain/validators'
import type { MeterModelRepository } from '../ports/repositories'

export { InvalidRegisterMapError, MeterModelInUseError, MeterModelNotFoundError } from '../domain/errors'

export interface CreateModelParams {
  brandId: number
  name: string
  registerMap: unknown
  notes?: string | null
}

export class MeterModelService {
  constructor(private readonly models: MeterModelRepository) {}

  private validateMap(raw: unknown): RegisterMap {
    return validateRegisterMap(raw)
  }

  async create(params: CreateModelParams): Promise<MeterModel> {
    const registerMap = this.validateMap(params.registerMap)
    return this.models.create({
      brandId: params.brandId,
      name: params.name,
      registerMap,
      notes: params.notes ?? null,
    })
  }

  async list(): Promise<MeterModel[]> {
    return this.models.findAll()
  }

  async listByBrand(brandId: number): Promise<MeterModel[]> {
    return this.models.findByBrand(brandId)
  }

  async updateMap(id: number, rawMap: unknown): Promise<void> {
    const model = await this.models.findById(id)
    if (model === null) throw new MeterModelNotFoundError(id)
    const registerMap = this.validateMap(rawMap)
    await this.models.updateRegisterMap(id, registerMap)
  }

  async delete(id: number): Promise<void> {
    const model = await this.models.findById(id)
    if (model === null) throw new MeterModelNotFoundError(id)
    const inUse = await this.models.hasDevices(id)
    if (inUse) throw new MeterModelInUseError(id)
    await this.models.delete(id)
  }
}
