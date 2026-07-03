import { RpcMethods } from '@platform/shared-types'
import { z } from 'zod'
import type { PythonBridge } from '../python-bridge/client'

const deviceIdSchema = z.number().int().positive()

export class DeviceService {
  constructor(private readonly bridge: PythonBridge) {}

  /** Start live polling for a device (fast readings pushed as events). */
  async watch(deviceId: number): Promise<void> {
    await this.bridge.request(RpcMethods.DeviceWatch, {
      deviceId: deviceIdSchema.parse(deviceId),
    })
  }

  /** Stop live polling for a device. */
  async unwatch(deviceId: number): Promise<void> {
    await this.bridge.request(RpcMethods.DeviceUnwatch, {
      deviceId: deviceIdSchema.parse(deviceId),
    })
  }
}
