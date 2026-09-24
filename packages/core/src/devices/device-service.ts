import { RpcMethods } from '@platform/shared-types'
import type { DeviceWatchRpcParams } from '@platform/shared-types'
import { z } from 'zod'
import { DeviceNotFoundError, MeterModelNotFoundError } from '../catalog/domain/errors'
import type { DeviceRepository, MeterModelRepository } from '../catalog/ports/repositories'
import type { PythonBridge } from '../python-bridge/client'

const deviceIdSchema = z.number().int().positive()

export class DeviceService {
  constructor(
    private readonly bridge: PythonBridge,
    private readonly deviceRepository: DeviceRepository,
    private readonly meterModelRepository: MeterModelRepository,
  ) {}

  /**
   * Start live polling for a device (fast readings pushed as events).
   *
   * Resolves the device's register map from the catalog (python never
   * touches app.db, docs/ARCHITECTURE.md §11) and forwards it over RPC so
   * python can drive SimulatedReader with the device's REAL register map
   * instead of a hardcoded metric.
   */
  async watch(deviceId: number): Promise<void> {
    const id = deviceIdSchema.parse(deviceId)

    const device = await this.deviceRepository.findById(id)
    if (device === null) {
      throw new DeviceNotFoundError(id)
    }

    const model = await this.meterModelRepository.findById(device.modelId)
    if (model === null) {
      throw new MeterModelNotFoundError(device.modelId)
    }

    const params: DeviceWatchRpcParams = { deviceId: id, registerMap: model.registerMap }
    await this.bridge.request(RpcMethods.DeviceWatch, params)
  }

  /** Stop live polling for a device. */
  async unwatch(deviceId: number): Promise<void> {
    await this.bridge.request(RpcMethods.DeviceUnwatch, {
      deviceId: deviceIdSchema.parse(deviceId),
    })
  }
}
