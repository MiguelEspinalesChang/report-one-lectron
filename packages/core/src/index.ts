/**
 * Business core. Pure TypeScript library — no HTTP server, no open ports.
 * Consumed by the Electron main process through thin IPC handlers.
 */

import { DeviceService } from './devices/device-service'
import { PythonBridge } from './python-bridge/client'
import { SystemService } from './services/system-service'

export interface Core {
  bridge: PythonBridge
  system: SystemService
  devices: DeviceService
}

export function createCore(): Core {
  const bridge = new PythonBridge()
  return {
    bridge,
    system: new SystemService(bridge),
    devices: new DeviceService(bridge),
  }
}

export { DeviceService } from './devices/device-service'
export { PythonBridge } from './python-bridge/client'
export { resolvePythonBin } from './python-bridge/resolve-python'
export { SystemService } from './services/system-service'
