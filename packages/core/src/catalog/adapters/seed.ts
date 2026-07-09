/**
 * Idempotent seed: inserts the simulated brand, SIM-100 model, and test device.
 * Safe to call on every startup.
 */
import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import { brands, devices, meterModels } from '../../persistence/adapters/schema'
import type { RegisterMap } from '../domain/entities'

const SIM_REGISTER_MAP: RegisterMap = {
  version: 1,
  registers: [
    { address: 3000, function: 'holding', metric: 'voltage_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
    { address: 3002, function: 'holding', metric: 'voltage_l2', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
    { address: 3004, function: 'holding', metric: 'voltage_l3', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'V' },
    { address: 3006, function: 'holding', metric: 'current_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'A' },
    { address: 3008, function: 'holding', metric: 'current_l2', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'A' },
    { address: 3010, function: 'holding', metric: 'current_l3', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'A' },
    { address: 3012, function: 'holding', metric: 'active_power_total', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'kW' },
    { address: 3020, function: 'holding', metric: 'energy_active_total', datatype: 'float32', wordOrder: 'big_endian', scale: 1, unit: 'kWh' },
  ],
}

export async function seedCatalogData(db: BetterSQLite3Database<AppSchema>): Promise<void> {
  // Brand: Simulated
  let brand = db.select().from(brands).where(eq(brands.name, 'Simulated')).get()
  if (brand === undefined) {
    brand = db.insert(brands).values({ name: 'Simulated' }).returning().get()
  }

  // Model: SIM-100
  let model = db.select().from(meterModels).where(eq(meterModels.name, 'SIM-100')).get()
  if (model === undefined) {
    model = db
      .insert(meterModels)
      .values({
        brandId: brand.id,
        name: 'SIM-100',
        registerMap: JSON.stringify(SIM_REGISTER_MAP),
        notes: 'Simulated meter for development and testing',
      })
      .returning()
      .get()
  }

  // Device: Test simulator
  const existingDevice = db.select().from(devices).where(eq(devices.name, 'Test simulator')).get()
  if (existingDevice === undefined) {
    const now = Date.now()
    db
      .insert(devices)
      .values({
        modelId: model.id,
        name: 'Test simulator',
        transport: 'simulated',
        connection: JSON.stringify({}),
        slaveId: 1,
        pollingIntervalS: 900,
        enabled: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }
}
