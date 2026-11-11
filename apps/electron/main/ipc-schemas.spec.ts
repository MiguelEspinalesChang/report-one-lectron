import { describe, expect, it } from 'vitest'
import { CreateDeviceSchema, UpdateDeviceSchema } from '@platform/shared-types'

// The update handler writes every defined field of the parsed DTO, so a
// partial update must never gain keys the caller did not send.
describe('UpdateDeviceSchema', () => {
  it('does not inject create-time defaults into a partial update', () => {
    expect(UpdateDeviceSchema.parse({ id: 5, name: 'renamed' })).toEqual({
      id: 5,
      name: 'renamed',
    })
  })

  it('keeps the fields the caller sends', () => {
    expect(
      UpdateDeviceSchema.parse({ id: 5, slaveId: 7, pollingIntervalS: 60, enabled: false }),
    ).toEqual({ id: 5, slaveId: 7, pollingIntervalS: 60, enabled: false })
  })

  it('still validates the fields that are present', () => {
    expect(UpdateDeviceSchema.safeParse({ id: 5, slaveId: 248 }).success).toBe(false)
    expect(UpdateDeviceSchema.safeParse({ name: 'no id' }).success).toBe(false)
  })
})

describe('CreateDeviceSchema', () => {
  it('still applies defaults when creating a device', () => {
    expect(
      CreateDeviceSchema.parse({
        modelId: 1,
        name: 'meter',
        transport: 'simulated',
        connection: {},
      }),
    ).toEqual({
      modelId: 1,
      name: 'meter',
      transport: 'simulated',
      connection: {},
      slaveId: 1,
      pollingIntervalS: 900,
      enabled: true,
    })
  })
})
