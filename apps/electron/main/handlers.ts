import type { Core } from '@platform/core'
import { IpcChannels } from '@platform/shared-types'
import { ipcMain } from 'electron'

/**
 * Thin IPC handlers: every handler is a one-line delegation to
 * packages/core. Business logic never lives here.
 */
export function registerHandlers(core: Core): void {
  ipcMain.handle(IpcChannels.SystemPing, () => core.system.pingPython())
  ipcMain.handle(IpcChannels.DeviceWatch, (_event, deviceId: number) => core.devices.watch(deviceId))
  ipcMain.handle(IpcChannels.DeviceUnwatch, (_event, deviceId: number) => core.devices.unwatch(deviceId))
}
