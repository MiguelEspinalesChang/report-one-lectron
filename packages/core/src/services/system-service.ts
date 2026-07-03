import type { PingResult } from '@platform/shared-types'
import { RpcMethods } from '@platform/shared-types'
import type { PythonBridge } from '../python-bridge/client'

export class SystemService {
  constructor(private readonly bridge: PythonBridge) {}

  pingPython(): Promise<PingResult> {
    return this.bridge.request<PingResult>(RpcMethods.SystemPing)
  }
}
