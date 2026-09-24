import { describe, expect, it } from 'vitest'
import { SimulatedPollParamsSchema } from '@platform/shared-types'

describe('acquisition:simulatedPoll IPC boundary schema', () => {
  it('accepts valid params', () => {
    const parsed = SimulatedPollParamsSchema.parse({
      deviceId: 5,
      ticks: 20,
      registerMap: {
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
      },
    })

    expect(parsed.deviceId).toBe(5)
    expect(parsed.ticks).toBe(20)
  })

  it('rejects invalid params', () => {
    expect(() =>
      SimulatedPollParamsSchema.parse({
        deviceId: -1,
        ticks: 1_500,
        registerMap: {
          version: 2,
          registers: [],
        },
      }),
    ).toThrow()
  })
})
