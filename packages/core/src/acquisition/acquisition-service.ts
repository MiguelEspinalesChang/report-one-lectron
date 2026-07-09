/**
 * Acquisition service — orchestrates simulated (and future real) device polls.
 *
 * Sends device config over RPC; Python runs the poll and writes to telemetry.db.
 * Core never touches telemetry.db for writes (ARCHITECTURE.md §11).
 */
import { RpcMethods } from '@platform/shared-types'
import type { RegisterMap, SimulatedPollResult } from '@platform/shared-types'
import { z } from 'zod'
import { validateRegisterMap } from '../catalog/domain/validators'
import type { PythonBridge } from '../python-bridge/client'

const simulatedPollParamsSchema = z.object({
  deviceId: z.number().int().positive(),
  ticks: z.number().int().min(1).max(1000).optional(),
})

export class AcquisitionService {
  constructor(private readonly bridge: PythonBridge) {}

  /**
   * Triggers a simulated base poll for a device.
   *
   * Core sends the device config (device_id + register_map) over RPC.
   * Python runs the simulator, writes `ticks` readings to telemetry.db
   * with source='simulated', and returns the insert counts.
   *
   * This is BASE mode (persists to DB), distinct from device.watch (ephemeral live).
   */
  async runSimulatedPoll(
    deviceId: number,
    registerMap: RegisterMap,
    ticks = 10,
  ): Promise<SimulatedPollResult> {
    const validMap = validateRegisterMap(registerMap)
    const params = simulatedPollParamsSchema.parse({ deviceId, ticks })
    return this.bridge.request<SimulatedPollResult>(
      RpcMethods.AcquisitionSimulatedPoll,
      { ...params, registerMap: validMap },
      30_000, // longer timeout: ticks × 1s per tick
    )
  }
}
