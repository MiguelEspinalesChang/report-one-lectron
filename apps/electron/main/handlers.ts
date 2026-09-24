import type { Core } from '@platform/core'
import {
  AssignRoleSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  IpcChannels,
  LoginSchema,
  CreateBrandSchema,
  RenameBrandSchema,
  DeleteBrandSchema,
  CreateMeterModelSchema,
  ListModelsByBrandSchema,
  UpdateMeterModelSchema,
  UpdateRegisterMapSchema,
  DeleteMeterModelSchema,
  CreateDeviceSchema,
  UpdateDeviceSchema,
  DeleteDeviceSchema,
  EnableDeviceSchema,
  SimulatedPollParamsSchema,
  TelemetryHistoryParamsSchema,
  type SessionUserDto,
  type BrandDto,
  type MeterModelDto,
  type DeviceDto,
  type RoleDto,
} from '@platform/shared-types'
import { ipcMain } from 'electron'

/**
 * Maps core's internal SessionUser to the cross-boundary SessionUserDto.
 * Both shapes are structurally identical today; the explicit map keeps the
 * boundary honest: if core's internal model diverges, TypeScript catches it here.
 */
function toSessionUserDto(user: {
  id: number
  username: string
  displayName: string
  roleId: number
  roleName: string
  mustChangePassword: boolean
  permissionCodes: string[]
}): SessionUserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roleId: user.roleId,
    roleName: user.roleName,
    mustChangePassword: user.mustChangePassword,
    permissionCodes: user.permissionCodes,
  }
}

function toBrandDto(brand: { id: number; name: string }): BrandDto {
  return { id: brand.id, name: brand.name }
}

function toRoleDto(role: { id: number; name: string; description: string | null; isSystem: boolean }): RoleDto {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
  }
}

function toMeterModelDto(model: {
  id: number
  brandId: number
  name: string
  registerMap: MeterModelDto['registerMap']
  notes: string | null
}): MeterModelDto {
  return {
    id: model.id,
    brandId: model.brandId,
    name: model.name,
    registerMap: model.registerMap,
    notes: model.notes,
  }
}

function toDeviceDto(device: {
  id: number
  modelId: number
  name: string
  transport: string
  connection: Record<string, unknown>
  slaveId: number
  pollingIntervalS: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}): DeviceDto {
  return {
    id: device.id,
    modelId: device.modelId,
    name: device.name,
    transport: device.transport as DeviceDto['transport'],
    connection: device.connection,
    slaveId: device.slaveId,
    pollingIntervalS: device.pollingIntervalS,
    enabled: device.enabled,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  }
}

function getTelemetry(core: Core): NonNullable<Core['telemetry']> {
  if (core.telemetry === null) {
    throw new Error('Telemetry service is not configured')
  }
  return core.telemetry
}

/**
 * Thin IPC handlers: every handler is a one-line delegation to
 * packages/core. Business logic never lives here.
 * IPC boundary is validated with Zod schemas from shared-types.
 */
export function registerHandlers(core: Core): void {
  // System
  ipcMain.handle(IpcChannels.SystemPing, () => core.system.pingPython())

  // Devices
  ipcMain.handle(IpcChannels.DeviceWatch, (_event, deviceId: number) => core.devices.watch(deviceId))
  ipcMain.handle(IpcChannels.DeviceUnwatch, (_event, deviceId: number) => core.devices.unwatch(deviceId))

  // Auth
  ipcMain.handle(IpcChannels.AuthLogin, async (_event, raw: unknown) => {
    const dto = LoginSchema.parse(raw)
    const user = await core.auth.login(dto.username, dto.password)
    return toSessionUserDto(user)
  })
  ipcMain.handle(IpcChannels.AuthLogout, () => core.auth.logout())
  ipcMain.handle(IpcChannels.AuthGetSession, () => {
    const user = core.auth.getSession()
    return user !== null ? toSessionUserDto(user) : null
  })
  ipcMain.handle(IpcChannels.AuthChangePassword, (_event, raw: unknown) => {
    const dto = ChangePasswordSchema.parse(raw)
    return core.auth.changePassword(dto.userId, dto.currentPassword, dto.newPassword)
  })

  // User management
  ipcMain.handle(IpcChannels.UsersCreate, (_event, raw: unknown) => {
    const dto = CreateUserSchema.parse(raw)
    return core.userManagement.createUser(dto)
  })
  ipcMain.handle(IpcChannels.UsersList, () => core.userManagement.listUsers())
  ipcMain.handle(IpcChannels.UsersAssignRole, (_event, raw: unknown) => {
    const dto = AssignRoleSchema.parse(raw)
    return core.userManagement.assignRole(dto.userId, dto.roleId)
  })
  ipcMain.handle(IpcChannels.UsersListRoles, async () => {
    const all = await core.userManagement.listRoles()
    return all.map(toRoleDto)
  })

  // Catalog — brands
  ipcMain.handle(IpcChannels.CatalogBrandsCreate, async (_event, raw: unknown) => {
    const dto = CreateBrandSchema.parse(raw)
    const brand = await core.catalog.brands.create(dto.name)
    return toBrandDto(brand)
  })
  ipcMain.handle(IpcChannels.CatalogBrandsList, async () => {
    const all = await core.catalog.brands.list()
    return all.map(toBrandDto)
  })
  ipcMain.handle(IpcChannels.CatalogBrandsRename, async (_event, raw: unknown) => {
    const dto = RenameBrandSchema.parse(raw)
    return core.catalog.brands.rename(dto.id, dto.name)
  })
  ipcMain.handle(IpcChannels.CatalogBrandsDelete, async (_event, raw: unknown) => {
    const dto = DeleteBrandSchema.parse(raw)
    return core.catalog.brands.delete(dto.id)
  })

  // Catalog — models
  ipcMain.handle(IpcChannels.CatalogModelsCreate, async (_event, raw: unknown) => {
    const dto = CreateMeterModelSchema.parse(raw)
    const model = await core.catalog.models.create(dto)
    return toMeterModelDto(model)
  })
  ipcMain.handle(IpcChannels.CatalogModelsList, async () => {
    const all = await core.catalog.models.list()
    return all.map(toMeterModelDto)
  })
  ipcMain.handle(IpcChannels.CatalogModelsListByBrand, async (_event, raw: unknown) => {
    const dto = ListModelsByBrandSchema.parse(raw)
    const all = await core.catalog.models.listByBrand(dto.brandId)
    return all.map(toMeterModelDto)
  })
  ipcMain.handle(IpcChannels.CatalogModelsUpdate, async (_event, raw: unknown) => {
    const dto = UpdateMeterModelSchema.parse(raw)
    return core.catalog.models.update(dto.id, {
      brandId: dto.brandId,
      name: dto.name,
      registerMap: dto.registerMap,
      notes: dto.notes,
    })
  })
  ipcMain.handle(IpcChannels.CatalogModelsUpdateMap, async (_event, raw: unknown) => {
    const dto = UpdateRegisterMapSchema.parse(raw)
    return core.catalog.models.updateMap(dto.id, dto.registerMap)
  })
  ipcMain.handle(IpcChannels.CatalogModelsDelete, async (_event, raw: unknown) => {
    const dto = DeleteMeterModelSchema.parse(raw)
    return core.catalog.models.delete(dto.id)
  })

  // Catalog — devices
  ipcMain.handle(IpcChannels.CatalogDevicesCreate, async (_event, raw: unknown) => {
    const dto = CreateDeviceSchema.parse(raw)
    const device = await core.catalog.devices.create({
      modelId: dto.modelId,
      name: dto.name,
      transport: dto.transport,
      connection: dto.connection as Record<string, unknown>,
      slaveId: dto.slaveId,
      pollingIntervalS: dto.pollingIntervalS,
      enabled: dto.enabled,
    })
    return toDeviceDto(device)
  })
  ipcMain.handle(IpcChannels.CatalogDevicesList, async () => {
    const all = await core.catalog.devices.list()
    return all.map(toDeviceDto)
  })
  ipcMain.handle(IpcChannels.CatalogDevicesUpdate, async (_event, raw: unknown) => {
    const dto = UpdateDeviceSchema.parse(raw)
    const { id, connection, ...rest } = dto
    const device = await core.catalog.devices.update(id, {
      ...rest,
      connection: connection !== undefined ? (connection as Record<string, unknown>) : undefined,
    })
    return toDeviceDto(device)
  })
  ipcMain.handle(IpcChannels.CatalogDevicesEnable, async (_event, raw: unknown) => {
    const dto = EnableDeviceSchema.parse(raw)
    return core.catalog.devices.enable(dto.id, dto.enabled)
  })
  ipcMain.handle(IpcChannels.CatalogDevicesDelete, async (_event, raw: unknown) => {
    const dto = DeleteDeviceSchema.parse(raw)
    return core.catalog.devices.delete(dto.id)
  })

  // Telemetry
  ipcMain.handle(IpcChannels.TelemetryGetHistory, (_event, raw: unknown) => {
    const dto = TelemetryHistoryParamsSchema.parse(raw)
    return getTelemetry(core).getHistory(dto)
  })

  // Acquisition
  ipcMain.handle(IpcChannels.AcquisitionSimulatedPoll, (_event, raw: unknown) => {
    const dto = SimulatedPollParamsSchema.parse(raw)
    return core.acquisition.runSimulatedPoll(dto.deviceId, dto.registerMap, dto.ticks)
  })
}
