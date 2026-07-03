import type { PythonBridge } from '@platform/core'
import { IpcChannels, RpcMethods } from '@platform/shared-types'
import type { BrowserWindow } from 'electron'

/** RPC notification -> renderer IPC channel. */
const channelByMethod: Record<string, string> = {
  [RpcMethods.DeviceReading]: IpcChannels.DeviceReading,
  [RpcMethods.DeviceStatus]: IpcChannels.DeviceStatus,
}

/** Forward push events from the python sidecar to the renderer. */
export function forwardCoreEvents(bridge: PythonBridge, win: BrowserWindow): void {
  bridge.on('notification', (method: string, params: unknown) => {
    const channel = channelByMethod[method]
    if (channel && !win.isDestroyed()) {
      win.webContents.send(channel, params)
    }
  })
}
