import type { Device } from '../domain/entities'
import { DeviceNotFoundError } from '../domain/errors'
import { validateConnection } from '../domain/validators'
import type { CreateDeviceInput, DeviceRepository, UpdateDeviceInput } from '../ports/repositories'

export { DeviceNotFoundError, InvalidConnectionError, TransportMismatchError } from '../domain/errors'

export interface CreateDeviceParams {
  modelId: number
  name: string
  transport: 'serial' | 'tcp' | 'simulated'
  connection: Record<string, unknown>
  slaveId: number
  pollingIntervalS: number
  enabled: boolean
}

export interface UpdateDeviceParams {
  modelId?: number
  name?: string
  transport?: 'serial' | 'tcp' | 'simulated'
  connection?: Record<string, unknown>
  slaveId?: number
  pollingIntervalS?: number
  enabled?: boolean
}

export class DeviceService {
  constructor(private readonly devices: DeviceRepository) {}

  private validateConnection(transport: string, connection: Record<string, unknown>): Record<string, unknown> {
    return validateConnection(transport, connection)
  }

  async create(params: CreateDeviceParams): Promise<Device> {
    const connection = this.validateConnection(params.transport, params.connection)
    const input: CreateDeviceInput = {
      modelId: params.modelId,
      name: params.name,
      transport: params.transport,
      connection,
      slaveId: params.slaveId,
      pollingIntervalS: params.pollingIntervalS,
      enabled: params.enabled,
    }
    return this.devices.create(input)
  }

  async list(): Promise<Device[]> {
    return this.devices.findAll()
  }

  async update(id: number, params: UpdateDeviceParams): Promise<Device> {
    const existing = await this.devices.findById(id)
    if (existing === null) throw new DeviceNotFoundError(id)

    const input: UpdateDeviceInput = {}

    if (params.modelId !== undefined) input.modelId = params.modelId
    if (params.name !== undefined) input.name = params.name
    if (params.slaveId !== undefined) input.slaveId = params.slaveId
    if (params.pollingIntervalS !== undefined) input.pollingIntervalS = params.pollingIntervalS
    if (params.enabled !== undefined) input.enabled = params.enabled

    // If transport or connection changes, re-validate
    const transport = params.transport ?? existing.transport
    const connection = params.connection ?? existing.connection
    if (params.transport !== undefined || params.connection !== undefined) {
      input.connection = this.validateConnection(transport, connection)
      if (params.transport !== undefined) input.transport = params.transport
    }

    return this.devices.update(id, input)
  }

  async enable(id: number, enabled: boolean): Promise<void> {
    const existing = await this.devices.findById(id)
    if (existing === null) throw new DeviceNotFoundError(id)
    await this.devices.setEnabled(id, enabled)
  }

  async delete(id: number): Promise<void> {
    const existing = await this.devices.findById(id)
    if (existing === null) throw new DeviceNotFoundError(id)
    await this.devices.delete(id)
  }
}
