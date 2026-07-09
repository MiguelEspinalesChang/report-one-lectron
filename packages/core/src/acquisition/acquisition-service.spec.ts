/**
 * Unit tests for AcquisitionService param validation.
 *
 * The register map must be fully validated by core's own domain validator
 * BEFORE crossing the RPC boundary — an invalid map never reaches Python.
 */
import { describe, expect, it, vi } from 'vitest'
import { RpcMethods } from '@platform/shared-types'
import type { RegisterMap } from '@platform/shared-types'
import { InvalidRegisterMapError } from '../catalog/domain/errors'
import type { PythonBridge } from '../python-bridge/client'
import { AcquisitionService } from './acquisition-service'

const VALID_MAP: RegisterMap = {
  version: 1,
  registers: [
    {
      address: 3000,
      function: 'holding',
      metric: 'voltage_l1',
      datatype: 'float32',
      wordOrder: 'big_endian',
      scale: 1,
      unit: 'V',
    },
  ],
}

function makeBridge(): { bridge: PythonBridge; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({ inserted: 1, ignored: 0, ticks: 1, metrics: 1 })
  return { bridge: { request } as unknown as PythonBridge, request }
}

describe('AcquisitionService.runSimulatedPoll', () => {
  it('sends a valid poll over RPC with the expected method and params', async () => {
    const { bridge, request } = makeBridge()
    const service = new AcquisitionService(bridge)

    await service.runSimulatedPoll(7, VALID_MAP, 5)

    expect(request).toHaveBeenCalledWith(
      RpcMethods.AcquisitionSimulatedPoll,
      { deviceId: 7, registerMap: VALID_MAP, ticks: 5 },
      30_000,
    )
  })

  it('rejects a register map with an unsupported version before calling the bridge', async () => {
    const { bridge, request } = makeBridge()
    const service = new AcquisitionService(bridge)
    const badMap = { ...VALID_MAP, version: 2 } as unknown as RegisterMap

    await expect(service.runSimulatedPoll(7, badMap)).rejects.toThrow(InvalidRegisterMapError)
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects a register map with duplicate metrics before calling the bridge', async () => {
    const { bridge, request } = makeBridge()
    const service = new AcquisitionService(bridge)
    const entry = VALID_MAP.registers[0]
    if (entry === undefined) throw new Error('fixture must have one register')
    const badMap: RegisterMap = { version: 1, registers: [entry, { ...entry }] }

    await expect(service.runSimulatedPoll(7, badMap)).rejects.toThrow(InvalidRegisterMapError)
    expect(request).not.toHaveBeenCalled()
  })
})
