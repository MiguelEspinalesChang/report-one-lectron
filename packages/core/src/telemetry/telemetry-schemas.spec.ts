import { describe, expect, it } from 'vitest'
import { TelemetryHistoryParamsSchema } from '@platform/shared-types'

describe('telemetry:getHistory IPC boundary schema', () => {
  it('accepts valid params', () => {
    const parsed = TelemetryHistoryParamsSchema.parse({
      deviceId: 12,
      metric: 'voltage_l1',
      fromMs: 1_700_000_000_000,
      toMs: 1_700_000_060_000,
      bucketMs: 60_000,
    })

    expect(parsed.deviceId).toBe(12)
    expect(parsed.metric).toBe('voltage_l1')
  })

  it('rejects invalid params', () => {
    expect(() =>
      TelemetryHistoryParamsSchema.parse({
        deviceId: 0,
        metric: '',
        fromMs: 1,
        toMs: 2,
        bucketMs: 0,
      }),
    ).toThrow()
  })
})
