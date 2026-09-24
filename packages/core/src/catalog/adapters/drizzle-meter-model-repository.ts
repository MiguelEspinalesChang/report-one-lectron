import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import { devices, meterModels } from '../../persistence/adapters/schema'
import type { MeterModel, RegisterMap } from '../domain/entities'
import type { CreateMeterModelInput, MeterModelRepository, UpdateMeterModelInput } from '../ports/repositories'

type ModelRow = typeof meterModels.$inferSelect

function toModel(row: ModelRow): MeterModel {
  return {
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    registerMap: JSON.parse(row.registerMap) as RegisterMap,
    notes: row.notes,
  }
}

export class DrizzleMeterModelRepository implements MeterModelRepository {
  constructor(private readonly db: BetterSQLite3Database<AppSchema>) {}

  async findById(id: number): Promise<MeterModel | null> {
    const row = this.db.select().from(meterModels).where(eq(meterModels.id, id)).get()
    return row !== undefined ? toModel(row) : null
  }

  async findAll(): Promise<MeterModel[]> {
    return this.db.select().from(meterModels).all().map(toModel)
  }

  async findByBrand(brandId: number): Promise<MeterModel[]> {
    return this.db.select().from(meterModels).where(eq(meterModels.brandId, brandId)).all().map(toModel)
  }

  async create(input: CreateMeterModelInput): Promise<MeterModel> {
    const result = this.db
      .insert(meterModels)
      .values({
        brandId: input.brandId,
        name: input.name,
        registerMap: JSON.stringify(input.registerMap),
        notes: input.notes ?? null,
      })
      .returning()
      .get()
    return toModel(result)
  }

  async updateRegisterMap(id: number, registerMap: RegisterMap): Promise<void> {
    this.db.update(meterModels).set({ registerMap: JSON.stringify(registerMap) }).where(eq(meterModels.id, id)).run()
  }

  async update(id: number, input: UpdateMeterModelInput): Promise<void> {
    this.db
      .update(meterModels)
      .set({
        brandId: input.brandId,
        name: input.name,
        registerMap: JSON.stringify(input.registerMap),
        notes: input.notes ?? null,
      })
      .where(eq(meterModels.id, id))
      .run()
  }

  async delete(id: number): Promise<void> {
    this.db.delete(meterModels).where(eq(meterModels.id, id)).run()
  }

  async hasDevices(id: number): Promise<boolean> {
    const row = this.db.select({ id: devices.id }).from(devices).where(eq(devices.modelId, id)).get()
    return row !== undefined
  }
}
