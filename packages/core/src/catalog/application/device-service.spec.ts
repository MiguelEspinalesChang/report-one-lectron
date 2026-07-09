import { beforeEach, describe, expect, it } from 'vitest'
import type { Device } from '../domain/entities'
import type { CreateDeviceInput, DeviceRepository, UpdateDeviceInput } from '../ports/repositories'
import { DeviceNotFoundError, DeviceService, InvalidConnectionError } from './device-service'

class FakeDeviceRepository implements DeviceRepository {
  private store: Device[] = []
  private nextId = 1

  seed(device: Device): void {
    this.store.push(device)
    if (device.id >= this.nextId) this.nextId = device.id + 1
  }

  async findById(id: number): Promise<Device | null> {
    return this.store.find((d) => d.id === id) ?? null
  }

  async findAll(): Promise<Device[]> {
    return [...this.store]
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    const now = Date.now()
    const device: Device = { id: this.nextId++, ...input, createdAt: now, updatedAt: now }
    this.store.push(device)
    return device
  }

  async update(id: number, input: UpdateDeviceInput): Promise<Device> {
    const device = this.store.find((d) => d.id === id)
    if (device === undefined) throw new Error('not found')
    Object.assign(device, input, { updatedAt: Date.now() })
    return { ...device }
  }

  async setEnabled(id: number, enabled: boolean): Promise<void> {
    const device = this.store.find((d) => d.id === id)
    if (device !== undefined) device.enabled = enabled
  }

  async delete(id: number): Promise<void> {
    this.store = this.store.filter((d) => d.id !== id)
  }
}

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  id: 1,
  modelId: 10,
  name: 'Test',
  transport: 'simulated',
  connection: {},
  slaveId: 1,
  pollingIntervalS: 900,
  enabled: true,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

describe('DeviceService', () => {
  let repo: FakeDeviceRepository
  let service: DeviceService

  beforeEach(() => {
    repo = new FakeDeviceRepository()
    service = new DeviceService(repo)
  })

  it('creates a simulated device', async () => {
    const device = await service.create({
      modelId: 1,
      name: 'Sim',
      transport: 'simulated',
      connection: {},
      slaveId: 1,
      pollingIntervalS: 900,
      enabled: true,
    })
    expect(device.name).toBe('Sim')
    expect(device.transport).toBe('simulated')
  })

  it('creates a tcp device with valid connection', async () => {
    const device = await service.create({
      modelId: 1,
      name: 'TCP',
      transport: 'tcp',
      connection: { host: '192.168.1.1', port: 502, timeoutMs: 2000 },
      slaveId: 1,
      pollingIntervalS: 900,
      enabled: true,
    })
    expect(device.transport).toBe('tcp')
  })

  it('rejects tcp device with missing host', async () => {
    await expect(
      service.create({
        modelId: 1,
        name: 'Bad TCP',
        transport: 'tcp',
        connection: { port: 502, timeoutMs: 2000 },
        slaveId: 1,
        pollingIntervalS: 900,
        enabled: true,
      }),
    ).rejects.toThrow(InvalidConnectionError)
  })

  it('rejects connection/transport mismatch for serial with missing fields', async () => {
    await expect(
      service.create({
        modelId: 1,
        name: 'Mismatch',
        transport: 'serial',
        connection: {},
        slaveId: 1,
        pollingIntervalS: 900,
        enabled: true,
      }),
    ).rejects.toThrow(InvalidConnectionError)
  })

  it('enables/disables device', async () => {
    repo.seed(makeDevice({ enabled: true }))
    await service.enable(1, false)
    const d = await repo.findById(1)
    expect(d?.enabled).toBe(false)
  })

  it('throws DeviceNotFoundError when enabling nonexistent device', async () => {
    await expect(service.enable(999, true)).rejects.toThrow(DeviceNotFoundError)
  })

  it('throws DeviceNotFoundError when deleting nonexistent device', async () => {
    await expect(service.delete(999)).rejects.toThrow(DeviceNotFoundError)
  })

  it('lists all devices', async () => {
    repo.seed(makeDevice({ id: 1 }))
    repo.seed(makeDevice({ id: 2, name: 'Second' }))
    expect(await service.list()).toHaveLength(2)
  })
})
