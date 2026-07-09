import type { Brand, Device, MeterModel, RegisterMap, Transport } from '../domain/entities'

export interface CreateBrandInput {
  name: string
}

export interface BrandRepository {
  findById(id: number): Promise<Brand | null>
  findAll(): Promise<Brand[]>
  create(input: CreateBrandInput): Promise<Brand>
  rename(id: number, name: string): Promise<void>
  delete(id: number): Promise<void>
  hasModels(id: number): Promise<boolean>
}

export interface CreateMeterModelInput {
  brandId: number
  name: string
  registerMap: RegisterMap
  notes?: string | null
}

export interface MeterModelRepository {
  findById(id: number): Promise<MeterModel | null>
  findAll(): Promise<MeterModel[]>
  findByBrand(brandId: number): Promise<MeterModel[]>
  create(input: CreateMeterModelInput): Promise<MeterModel>
  updateRegisterMap(id: number, registerMap: RegisterMap): Promise<void>
  delete(id: number): Promise<void>
  hasDevices(id: number): Promise<boolean>
}

export interface CreateDeviceInput {
  modelId: number
  name: string
  transport: Transport
  connection: Record<string, unknown>
  slaveId: number
  pollingIntervalS: number
  enabled: boolean
}

export interface UpdateDeviceInput {
  modelId?: number
  name?: string
  transport?: Transport
  connection?: Record<string, unknown>
  slaveId?: number
  pollingIntervalS?: number
  enabled?: boolean
}

export interface DeviceRepository {
  findById(id: number): Promise<Device | null>
  findAll(): Promise<Device[]>
  create(input: CreateDeviceInput): Promise<Device>
  update(id: number, input: UpdateDeviceInput): Promise<Device>
  setEnabled(id: number, enabled: boolean): Promise<void>
  delete(id: number): Promise<void>
}
