import type {
  AssignRoleDto,
  BrandDto,
  ChangePasswordDto,
  CreateUserDto,
  DeviceDto,
  DeviceReading,
  DeviceStatus,
  LoginDto,
  MeterModelDto,
  PlatformApi,
  RegisterMap,
  RoleDto,
  SimulatedPollParams,
  SimulatedPollResult,
  TelemetryHistoryParams,
} from '@platform/shared-types'
import { IpcChannels } from '@platform/shared-types'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PlatformApi = {
  system: {
    ping: () => ipcRenderer.invoke(IpcChannels.SystemPing),
  },
  devices: {
    watch: (deviceId) => ipcRenderer.invoke(IpcChannels.DeviceWatch, deviceId),
    unwatch: (deviceId) => ipcRenderer.invoke(IpcChannels.DeviceUnwatch, deviceId),
    onReading: (callback) => subscribe<DeviceReading>(IpcChannels.DeviceReading, callback),
    onStatus: (callback) => subscribe<DeviceStatus>(IpcChannels.DeviceStatus, callback),
  },
  auth: {
    login: (dto: LoginDto) => ipcRenderer.invoke(IpcChannels.AuthLogin, dto),
    logout: () => ipcRenderer.invoke(IpcChannels.AuthLogout),
    getSession: () => ipcRenderer.invoke(IpcChannels.AuthGetSession),
    changePassword: (dto: ChangePasswordDto) => ipcRenderer.invoke(IpcChannels.AuthChangePassword, dto),
  },
  users: {
    create: (dto: CreateUserDto) => ipcRenderer.invoke(IpcChannels.UsersCreate, dto),
    list: () => ipcRenderer.invoke(IpcChannels.UsersList),
    assignRole: (dto: AssignRoleDto) => ipcRenderer.invoke(IpcChannels.UsersAssignRole, dto),
    listRoles: (): Promise<RoleDto[]> => ipcRenderer.invoke(IpcChannels.UsersListRoles),
  },
  catalog: {
    brands: {
      create: (dto: Pick<BrandDto, 'name'>) => ipcRenderer.invoke(IpcChannels.CatalogBrandsCreate, dto),
      list: () => ipcRenderer.invoke(IpcChannels.CatalogBrandsList),
      rename: (dto: { id: number; name: string }) => ipcRenderer.invoke(IpcChannels.CatalogBrandsRename, dto),
      delete: (dto: { id: number }) => ipcRenderer.invoke(IpcChannels.CatalogBrandsDelete, dto),
    },
    models: {
      create: (dto: Omit<MeterModelDto, 'id'>) => ipcRenderer.invoke(IpcChannels.CatalogModelsCreate, dto),
      list: () => ipcRenderer.invoke(IpcChannels.CatalogModelsList),
      listByBrand: (brandId: number) => ipcRenderer.invoke(IpcChannels.CatalogModelsListByBrand, { brandId }),
      update: (dto: { id: number; brandId: number; name: string; registerMap: RegisterMap; notes: string | null }) =>
        ipcRenderer.invoke(IpcChannels.CatalogModelsUpdate, dto),
      updateMap: (dto: { id: number; registerMap: RegisterMap }) =>
        ipcRenderer.invoke(IpcChannels.CatalogModelsUpdateMap, dto),
      delete: (dto: { id: number }) => ipcRenderer.invoke(IpcChannels.CatalogModelsDelete, dto),
    },
    devices: {
      create: (dto: Omit<DeviceDto, 'id' | 'createdAt' | 'updatedAt'>) =>
        ipcRenderer.invoke(IpcChannels.CatalogDevicesCreate, dto),
      list: () => ipcRenderer.invoke(IpcChannels.CatalogDevicesList),
      update: (dto: Partial<Omit<DeviceDto, 'createdAt' | 'updatedAt'>> & { id: number }) =>
        ipcRenderer.invoke(IpcChannels.CatalogDevicesUpdate, dto),
      enable: (dto: { id: number; enabled: boolean }) => ipcRenderer.invoke(IpcChannels.CatalogDevicesEnable, dto),
      delete: (dto: { id: number }) => ipcRenderer.invoke(IpcChannels.CatalogDevicesDelete, dto),
    },
  },
  telemetry: {
    getHistory: (params: TelemetryHistoryParams) => ipcRenderer.invoke(IpcChannels.TelemetryGetHistory, params),
  },
  acquisition: {
    simulatedPoll: (params: SimulatedPollParams): Promise<SimulatedPollResult> =>
      ipcRenderer.invoke(IpcChannels.AcquisitionSimulatedPoll, params),
  },
}

contextBridge.exposeInMainWorld('platform', api)
