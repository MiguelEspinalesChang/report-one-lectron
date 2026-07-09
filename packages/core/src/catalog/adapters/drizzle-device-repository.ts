import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import { devices } from '../../persistence/adapters/schema'
import type { Device } from '../domain/entities'
import type { CreateDeviceInput, DeviceRepository, UpdateDeviceInput } from '../ports/repositories'

type DeviceRow = typeof devices.$inferSelect
type DeviceInsert = typeof devices.$inferInsert

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    modelId: row.modelId,
    name: row.name,
    transport: row.transport as 'serial' | 'tcp' | 'simulated',
    connection: JSON.parse(row.connection) as Record<string, unknown>,
    slaveId: row.slaveId,
    pollingIntervalS: row.pollingIntervalS,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleDeviceRepository implements DeviceRepository {
  constructor(private readonly db: BetterSQLite3Database<AppSchema>) {}

  async findById(id: number): Promise<Device | null> {
    const row = this.db.select().from(devices).where(eq(devices.id, id)).get()
    return row !== undefined ? toDevice(row) : null
  }

  async findAll(): Promise<Device[]> {
    return this.db.select().from(devices).all().map(toDevice)
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    const now = Date.now()
    const values: DeviceInsert = {
      modelId: input.modelId,
      name: input.name,
      transport: input.transport,
      connection: JSON.stringify(input.connection),
      slaveId: input.slaveId,
      pollingIntervalS: input.pollingIntervalS,
      enabled: input.enabled ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }
    const result = this.db.insert(devices).values(values).returning().get()
    return toDevice(result)
  }

  async update(id: number, input: UpdateDeviceInput): Promise<Device> {
    const now = Date.now()
    // Build a typed partial update object
    const patch: Partial<DeviceInsert> & { updatedAt: number } = { updatedAt: now }
    if (input.modelId !== undefined) patch.modelId = input.modelId
    if (input.name !== undefined) patch.name = input.name
    if (input.transport !== undefined) patch.transport = input.transport
    if (input.connection !== undefined) patch.connection = JSON.stringify(input.connection)
    if (input.slaveId !== undefined) patch.slaveId = input.slaveId
    if (input.pollingIntervalS !== undefined) patch.pollingIntervalS = input.pollingIntervalS
    if (input.enabled !== undefined) patch.enabled = input.enabled ? 1 : 0
    const result = this.db.update(devices).set(patch).where(eq(devices.id, id)).returning().get()
    return toDevice(result)
  }

  async setEnabled(id: number, enabled: boolean): Promise<void> {
    this.db
      .update(devices)
      .set({ enabled: enabled ? 1 : 0, updatedAt: Date.now() })
      .where(eq(devices.id, id))
      .run()
  }

  async delete(id: number): Promise<void> {
    this.db.delete(devices).where(eq(devices.id, id)).run()
  }
}
