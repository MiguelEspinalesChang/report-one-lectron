/**
 * Single source of truth for every cross-boundary contract:
 * - JSON-RPC 2.0 envelopes (packages/core <-> python sidecar over stdio)
 * - IPC channel names and payloads (Vue renderer <-> Electron main)
 * - DTOs shared by all layers
 */
import type { RegisterMap, Transport } from './catalog-schemas'

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 envelopes (core <-> python)
// ---------------------------------------------------------------------------

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

export interface RpcError {
  code: number
  message: string
  data?: unknown
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: RpcError
}

/** Unsolicited message pushed by the python sidecar (no `id`). */
export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

/** RPC method names spoken between core and the python sidecar. */
export const RpcMethods = {
  SystemPing: 'system.ping',
  SystemShutdown: 'system.shutdown',
  DeviceWatch: 'device.watch',
  DeviceUnwatch: 'device.unwatch',
  // Notifications emitted by python:
  DeviceReading: 'device.reading',
  DeviceStatus: 'device.status',
  // Acquisition — simulated base poll (Phase 4)
  AcquisitionSimulatedPoll: 'acquisition.simulatedPoll',
} as const

// ---------------------------------------------------------------------------
// DTOs — devices
// ---------------------------------------------------------------------------

export interface PingResult {
  status: 'ok'
  pythonVersion: string
  pid: number
}

export type DeviceState = 'connected' | 'degraded' | 'disconnected'

export interface DeviceReading {
  deviceId: number
  metric: string
  /** Epoch milliseconds. */
  timestamp: number
  value: number
}

export interface DeviceStatus {
  deviceId: number
  state: DeviceState
}

// ---------------------------------------------------------------------------
// DTOs — auth
// ---------------------------------------------------------------------------

export interface SessionUserDto {
  id: number
  username: string
  displayName: string
  roleId: number
  roleName: string
  mustChangePassword: boolean
  permissionCodes: string[]
}

export interface LoginDto {
  username: string
  password: string
}

export interface ChangePasswordDto {
  userId: number
  currentPassword: string
  newPassword: string
}

export interface CreateUserDto {
  username: string
  password: string
  displayName: string
  roleId: number
  mustChangePassword?: boolean
}

export interface AssignRoleDto {
  userId: number
  roleId: number
}

export interface UserDto {
  id: number
  username: string
  displayName: string
  roleId: number
  isActive: boolean
  mustChangePassword: boolean
  /** Epoch milliseconds. */
  createdAt: number
  /** Epoch milliseconds. */
  updatedAt: number
}

// ---------------------------------------------------------------------------
// IPC (renderer <-> main)
// ---------------------------------------------------------------------------

export const IpcChannels = {
  // System
  SystemPing: 'system:ping',
  // Devices
  DeviceWatch: 'device:watch',
  DeviceUnwatch: 'device:unwatch',
  // Push channels (main -> renderer):
  DeviceReading: 'device:reading',
  DeviceStatus: 'device:status',
  // Auth
  AuthLogin: 'auth:login',
  AuthLogout: 'auth:logout',
  AuthGetSession: 'auth:getSession',
  AuthChangePassword: 'auth:changePassword',
  // User management
  UsersCreate: 'users:create',
  UsersList: 'users:list',
  UsersAssignRole: 'users:assignRole',
  // Catalog — brands
  CatalogBrandsCreate: 'catalog:brands:create',
  CatalogBrandsList: 'catalog:brands:list',
  CatalogBrandsRename: 'catalog:brands:rename',
  CatalogBrandsDelete: 'catalog:brands:delete',
  // Catalog — models
  CatalogModelsCreate: 'catalog:models:create',
  CatalogModelsList: 'catalog:models:list',
  CatalogModelsListByBrand: 'catalog:models:listByBrand',
  CatalogModelsUpdateMap: 'catalog:models:updateMap',
  CatalogModelsDelete: 'catalog:models:delete',
  // Catalog — devices
  CatalogDevicesCreate: 'catalog:devices:create',
  CatalogDevicesList: 'catalog:devices:list',
  CatalogDevicesUpdate: 'catalog:devices:update',
  CatalogDevicesEnable: 'catalog:devices:enable',
  CatalogDevicesDelete: 'catalog:devices:delete',
} as const

/**
 * API exposed to the renderer through the preload contextBridge
 * (`window.platform`). The renderer never sees Node or Electron directly.
 */
export interface PlatformApi {
  system: {
    ping(): Promise<PingResult>
  }
  devices: {
    watch(deviceId: number): Promise<void>
    unwatch(deviceId: number): Promise<void>
    /** Returns an unsubscribe function. */
    onReading(callback: (reading: DeviceReading) => void): () => void
    /** Returns an unsubscribe function. */
    onStatus(callback: (status: DeviceStatus) => void): () => void
  }
  auth: {
    login(dto: LoginDto): Promise<SessionUserDto>
    logout(): Promise<void>
    getSession(): Promise<SessionUserDto | null>
    changePassword(dto: ChangePasswordDto): Promise<void>
  }
  users: {
    create(dto: CreateUserDto): Promise<UserDto>
    list(): Promise<UserDto[]>
    assignRole(dto: AssignRoleDto): Promise<void>
  }
  catalog: {
    brands: {
      create(dto: Pick<BrandDto, 'name'>): Promise<BrandDto>
      list(): Promise<BrandDto[]>
      rename(dto: { id: number; name: string }): Promise<void>
      delete(dto: { id: number }): Promise<void>
    }
    models: {
      create(dto: Omit<MeterModelDto, 'id'>): Promise<MeterModelDto>
      list(): Promise<MeterModelDto[]>
      listByBrand(brandId: number): Promise<MeterModelDto[]>
      updateMap(dto: { id: number; registerMap: RegisterMap }): Promise<void>
      delete(dto: { id: number }): Promise<void>
    }
    devices: {
      create(dto: Omit<DeviceDto, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeviceDto>
      list(): Promise<DeviceDto[]>
      update(dto: Partial<Omit<DeviceDto, 'createdAt' | 'updatedAt'>> & { id: number }): Promise<DeviceDto>
      enable(dto: { id: number; enabled: boolean }): Promise<void>
      delete(dto: { id: number }): Promise<void>
    }
  }
}

// ---------------------------------------------------------------------------
// DTOs — catalog
// ---------------------------------------------------------------------------

export interface BrandDto {
  id: number
  name: string
}

export interface MeterModelDto {
  id: number
  brandId: number
  name: string
  registerMap: RegisterMap
  notes: string | null
}

export interface DeviceDto {
  id: number
  modelId: number
  name: string
  transport: Transport
  connection: Record<string, unknown>
  slaveId: number
  pollingIntervalS: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// DTOs — telemetry (Phase 4)
// ---------------------------------------------------------------------------

/** Params sent to acquisition.simulatedPoll over RPC. */
export interface SimulatedPollParams {
  deviceId: number
  registerMap: RegisterMap
  /** Number of ticks (samples) to generate. Default 10. */
  ticks?: number
}

/** Result returned by acquisition.simulatedPoll. */
export interface SimulatedPollResult {
  inserted: number
  ignored: number
  ticks: number
  metrics: number
}

/** One aggregated telemetry point returned by the history query. */
export interface TelemetryPoint {
  /** Start of the bucket (epoch ms). */
  bucket: number
  min: number
  max: number
  avg: number
  count: number
}

/** Params for a telemetry history query. */
export interface TelemetryHistoryParams {
  deviceId: number
  metric: string
  /** Start of range (epoch ms, inclusive). */
  fromMs: number
  /** End of range (epoch ms, inclusive). */
  toMs: number
  /**
   * Bucket size in milliseconds.
   * Defaults to 60_000 (1 minute).
   */
  bucketMs?: number
}

// Re-export Zod schemas for use at IPC boundaries
export { LoginSchema, ChangePasswordSchema, CreateUserSchema, AssignRoleSchema } from './auth-schemas'
export {
  RegisterMapSchema,
  ConnectionSchema,
  CreateBrandSchema,
  RenameBrandSchema,
  DeleteBrandSchema,
  CreateMeterModelSchema,
  ListModelsByBrandSchema,
  UpdateRegisterMapSchema,
  DeleteMeterModelSchema,
  CreateDeviceSchema,
  UpdateDeviceSchema,
  DeleteDeviceSchema,
  EnableDeviceSchema,
} from './catalog-schemas'
export type { RegisterEntry, RegisterMap, Transport } from './catalog-schemas'
