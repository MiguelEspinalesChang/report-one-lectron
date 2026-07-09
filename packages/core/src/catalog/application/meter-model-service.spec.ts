import { beforeEach, describe, expect, it } from 'vitest'
import type { MeterModel, RegisterMap } from '../domain/entities'
import type { CreateMeterModelInput, MeterModelRepository } from '../ports/repositories'
import { InvalidRegisterMapError, MeterModelInUseError, MeterModelNotFoundError, MeterModelService } from './meter-model-service'

const VALID_MAP: RegisterMap = {
  version: 1,
  registers: [
    { address: 3000, function: 'holding', metric: 'voltage_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
  ],
}

class FakeMeterModelRepository implements MeterModelRepository {
  private store: MeterModel[] = []
  private nextId = 1
  private deviceMap = new Map<number, boolean>()

  seed(model: MeterModel, hasDevices = false): void {
    this.store.push(model)
    if (model.id >= this.nextId) this.nextId = model.id + 1
    this.deviceMap.set(model.id, hasDevices)
  }

  async findById(id: number): Promise<MeterModel | null> {
    return this.store.find((m) => m.id === id) ?? null
  }

  async findAll(): Promise<MeterModel[]> {
    return [...this.store]
  }

  async findByBrand(brandId: number): Promise<MeterModel[]> {
    return this.store.filter((m) => m.brandId === brandId)
  }

  async create(input: CreateMeterModelInput): Promise<MeterModel> {
    const model: MeterModel = {
      id: this.nextId++,
      brandId: input.brandId,
      name: input.name,
      registerMap: input.registerMap,
      notes: input.notes ?? null,
    }
    this.store.push(model)
    this.deviceMap.set(model.id, false)
    return model
  }

  async updateRegisterMap(id: number, registerMap: RegisterMap): Promise<void> {
    const model = this.store.find((m) => m.id === id)
    if (model !== undefined) model.registerMap = registerMap
  }

  async delete(id: number): Promise<void> {
    this.store = this.store.filter((m) => m.id !== id)
  }

  async hasDevices(id: number): Promise<boolean> {
    return this.deviceMap.get(id) ?? false
  }
}

describe('MeterModelService', () => {
  let repo: FakeMeterModelRepository
  let service: MeterModelService

  beforeEach(() => {
    repo = new FakeMeterModelRepository()
    service = new MeterModelService(repo)
  })

  it('creates a model with valid register map', async () => {
    const model = await service.create({ brandId: 1, name: 'SIM-100', registerMap: VALID_MAP })
    expect(model.name).toBe('SIM-100')
    expect(model.registerMap.version).toBe(1)
  })

  it('rejects empty registers array', async () => {
    await expect(service.create({ brandId: 1, name: 'Bad', registerMap: { version: 1, registers: [] } })).rejects.toThrow(
      InvalidRegisterMapError,
    )
  })

  it('rejects duplicate metric names in map', async () => {
    const dupMap = {
      version: 1,
      registers: [
        { address: 3000, function: 'holding', metric: 'voltage_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
        { address: 3002, function: 'holding', metric: 'voltage_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
      ],
    }
    await expect(service.create({ brandId: 1, name: 'Dup', registerMap: dupMap })).rejects.toThrow(InvalidRegisterMapError)
  })

  it('rejects bad datatype', async () => {
    const badMap = {
      version: 1,
      registers: [{ address: 0, function: 'holding', metric: 'x', datatype: 'bad', wordOrder: 'big_endian', scale: 1, unit: '' }],
    }
    await expect(service.create({ brandId: 1, name: 'X', registerMap: badMap })).rejects.toThrow(InvalidRegisterMapError)
  })

  it('lists all models', async () => {
    repo.seed({ id: 1, brandId: 1, name: 'A', registerMap: VALID_MAP, notes: null })
    repo.seed({ id: 2, brandId: 1, name: 'B', registerMap: VALID_MAP, notes: null })
    expect(await service.list()).toHaveLength(2)
  })

  it('lists models by brand', async () => {
    repo.seed({ id: 1, brandId: 1, name: 'A', registerMap: VALID_MAP, notes: null })
    repo.seed({ id: 2, brandId: 2, name: 'B', registerMap: VALID_MAP, notes: null })
    expect(await service.listByBrand(1)).toHaveLength(1)
  })

  it('throws MeterModelNotFoundError when updating nonexistent model', async () => {
    await expect(service.updateMap(999, VALID_MAP)).rejects.toThrow(MeterModelNotFoundError)
  })

  it('throws MeterModelInUseError when deleting model with devices', async () => {
    repo.seed({ id: 1, brandId: 1, name: 'X', registerMap: VALID_MAP, notes: null }, true)
    await expect(service.delete(1)).rejects.toThrow(MeterModelInUseError)
  })

  it('throws MeterModelNotFoundError when deleting nonexistent model', async () => {
    await expect(service.delete(999)).rejects.toThrow(MeterModelNotFoundError)
  })
})
