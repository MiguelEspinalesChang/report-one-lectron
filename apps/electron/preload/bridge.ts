import type { DeviceReading, DeviceStatus, PlatformApi } from '@platform/shared-types'
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
}

contextBridge.exposeInMainWorld('platform', api)
