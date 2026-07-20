/**
 * Unit tests for DeviceService.watch/unwatch.
 *
 * watch() must resolve the device's register map from the catalog (python
 * never touches app.db) and forward it over RPC alongside deviceId.
 */
import { describe, expect, it, vi } from 'vitest'
import { RpcMethods } from '@platform/shared-types'
import type { RegisterMap } from '@platform/shared-types'
import { DeviceNotFoundError, MeterModelNotFoundError } from '../catalog/domain/errors'
import type { Device, MeterModel } from '../catalog/domain/entities'
import type { DeviceRepository, MeterModelRepository } from '../catalog/ports/repositories'
import type { PythonBridge } from '../python-bridge/client'
import { DeviceService } from './device-service'

const REGISTER_MAP: RegisterMap = {
  version: 1,
  registers: [
    {
      address: 100,
      function: 'holding',
      metric: 'voltage_l1',
      datatype: 'float32',
      wordOrder: 'big_endian',
      scale: 1,
      unit: 'V',
    },
  ],
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

const makeModel = (overrides: Partial<MeterModel> = {}): MeterModel => ({
  id: 10,
  brandId: 1,
  name: 'Model',
  registerMap: REGISTER_MAP,
  notes: null,
  ...overrides,
})

function makeBridge(): { bridge: PythonBridge; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(undefined)
  return { bridge: { request } as unknown as PythonBridge, request }
}

function makeDeviceRepository(device: Device | null): DeviceRepository {
  return {
    findById: vi.fn().mockResolvedValue(device),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setEnabled: vi.fn(),
    delete: vi.fn(),
  }
}

function makeMeterModelRepository(model: MeterModel | null): MeterModelRepository {
  return {
    findById: vi.fn().mockResolvedValue(model),
    findAll: vi.fn(),
    findByBrand: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateRegisterMap: vi.fn(),
    delete: vi.fn(),
    hasDevices: vi.fn(),
  }
}

describe('DeviceService.watch', () => {
  it('resolves the register map from the catalog and forwards it over RPC', async () => {
    const { bridge, request } = makeBridge()
    const deviceRepository = makeDeviceRepository(makeDevice({ id: 7, modelId: 10 }))
    const meterModelRepository = makeMeterModelRepository(makeModel({ id: 10, registerMap: REGISTER_MAP }))
    const service = new DeviceService(bridge, deviceRepository, meterModelRepository)

    await service.watch(7)

    expect(deviceRepository.findById).toHaveBeenCalledWith(7)
    expect(meterModelRepository.findById).toHaveBeenCalledWith(10)
    expect(request).toHaveBeenCalledWith(RpcMethods.DeviceWatch, {
      deviceId: 7,
      registerMap: REGISTER_MAP,
    })
  })

  it('throws DeviceNotFoundError when the device does not exist', async () => {
    const { bridge, request } = makeBridge()
    const deviceRepository = makeDeviceRepository(null)
    const meterModelRepository = makeMeterModelRepository(makeModel())
    const service = new DeviceService(bridge, deviceRepository, meterModelRepository)

    await expect(service.watch(999)).rejects.toThrow(DeviceNotFoundError)
    expect(request).not.toHaveBeenCalled()
  })

  it('throws MeterModelNotFoundError when the device references a deleted model', async () => {
    const { bridge, request } = makeBridge()
    const deviceRepository = makeDeviceRepository(makeDevice({ id: 7, modelId: 10 }))
    const meterModelRepository = makeMeterModelRepository(null)
    const service = new DeviceService(bridge, deviceRepository, meterModelRepository)

    await expect(service.watch(7)).rejects.toThrow(MeterModelNotFoundError)
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects a non-positive deviceId before touching the repositories', async () => {
    const { bridge, request } = makeBridge()
    const deviceRepository = makeDeviceRepository(null)
    const meterModelRepository = makeMeterModelRepository(null)
    const service = new DeviceService(bridge, deviceRepository, meterModelRepository)

    await expect(service.watch(-1)).rejects.toThrow()
    expect(deviceRepository.findById).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('DeviceService.unwatch', () => {
  it('sends deviceId over RPC without touching the catalog', async () => {
    const { bridge, request } = makeBridge()
    const deviceRepository = makeDeviceRepository(null)
    const meterModelRepository = makeMeterModelRepository(null)
    const service = new DeviceService(bridge, deviceRepository, meterModelRepository)

    await service.unwatch(7)

    expect(request).toHaveBeenCalledWith(RpcMethods.DeviceUnwatch, { deviceId: 7 })
    expect(deviceRepository.findById).not.toHaveBeenCalled()
  })
})
