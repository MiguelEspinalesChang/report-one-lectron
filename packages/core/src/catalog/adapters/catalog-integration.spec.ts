/**
 * Integration tests: real SQLite DB, real migrations + seed.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asSqliteAppDatabase, createAppDatabase } from '../../persistence/adapters/sqlite-database'
import type { SqliteAppDatabase } from '../../persistence/adapters/sqlite-database'
import { BrandService } from '../application/brand-service'
import { DeviceService } from '../application/device-service'
import { MeterModelService } from '../application/meter-model-service'
import { DrizzleBrandRepository } from './drizzle-brand-repository'
import { DrizzleDeviceRepository } from './drizzle-device-repository'
import { DrizzleMeterModelRepository } from './drizzle-meter-model-repository'
import { seedCatalogData } from './seed'

describe('catalog integration', () => {
  let tmpDir: string
  let database: SqliteAppDatabase
  let brandService: BrandService
  let modelService: MeterModelService
  let deviceService: DeviceService

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-integration-'))
    database = asSqliteAppDatabase(createAppDatabase({ filePath: path.join(tmpDir, 'app.db') }))
    database.runMigrations()
    await seedCatalogData(database.db)

    brandService = new BrandService(new DrizzleBrandRepository(database.db))
    modelService = new MeterModelService(new DrizzleMeterModelRepository(database.db))
    deviceService = new DeviceService(new DrizzleDeviceRepository(database.db))
  })

  afterEach(() => {
    database.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('Simulated brand exists after seed', async () => {
    const all = await brandService.list()
    expect(all.some((b) => b.name === 'Simulated')).toBe(true)
  })

  it('SIM-100 model exists with valid register map', async () => {
    const all = await modelService.list()
    const sim = all.find((m) => m.name === 'SIM-100')
    expect(sim).toBeDefined()
    expect(sim?.registerMap.version).toBe(1)
    expect(sim?.registerMap.registers).toHaveLength(8)
  })

  it('Test simulator device exists after seed', async () => {
    const all = await deviceService.list()
    const dev = all.find((d) => d.name === 'Test simulator')
    expect(dev).toBeDefined()
    expect(dev?.transport).toBe('simulated')
    expect(dev?.pollingIntervalS).toBe(900)
    expect(dev?.enabled).toBe(true)
  })

  it('seed is idempotent', async () => {
    await seedCatalogData(database.db)
    const brands = await brandService.list()
    expect(brands.filter((b) => b.name === 'Simulated')).toHaveLength(1)
  })

  it('brand CRUD round-trip', async () => {
    const brand = await brandService.create('TestBrand')
    expect(brand.name).toBe('TestBrand')

    await brandService.rename(brand.id, 'Renamed')
    const renamed = await brandService.list()
    expect(renamed.find((b) => b.id === brand.id)?.name).toBe('Renamed')

    await brandService.delete(brand.id)
    const after = await brandService.list()
    expect(after.find((b) => b.id === brand.id)).toBeUndefined()
  })

  it('device CRUD round-trip', async () => {
    const brands = await brandService.list()
    const simBrand = brands.find((b) => b.name === 'Simulated')
    if (simBrand === undefined) throw new Error('Simulated brand not found')

    const models = await modelService.listByBrand(simBrand.id)
    const sim100 = models.find((m) => m.name === 'SIM-100')
    if (sim100 === undefined) throw new Error('SIM-100 model not found')

    const device = await deviceService.create({
      modelId: sim100.id,
      name: 'Integration Device',
      transport: 'simulated',
      connection: {},
      slaveId: 1,
      pollingIntervalS: 60,
      enabled: true,
    })
    expect(device.id).toBeGreaterThan(0)

    await deviceService.enable(device.id, false)
    const all = await deviceService.list()
    const found = all.find((d) => d.id === device.id)
    expect(found?.enabled).toBe(false)

    await deviceService.delete(device.id)
    const after = await deviceService.list()
    expect(after.find((d) => d.id === device.id)).toBeUndefined()
  })

  it('SIM-100 register map has all 8 expected metrics', async () => {
    const all = await modelService.list()
    const sim = all.find((m) => m.name === 'SIM-100')
    if (sim === undefined) throw new Error('SIM-100 not found')
    const metrics = sim.registerMap.registers.map((r) => r.metric)
    expect(metrics).toContain('voltage_l1')
    expect(metrics).toContain('voltage_l2')
    expect(metrics).toContain('voltage_l3')
    expect(metrics).toContain('current_l1')
    expect(metrics).toContain('current_l2')
    expect(metrics).toContain('current_l3')
    expect(metrics).toContain('active_power_total')
    expect(metrics).toContain('energy_active_total')
  })
})
