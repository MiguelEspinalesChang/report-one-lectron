import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DeviceReading, PingResult } from '@platform/shared-types'
import { RpcMethods } from '@platform/shared-types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PythonBridge } from './client'
import { resolvePythonBin } from './resolve-python'

const here = path.dirname(fileURLToPath(import.meta.url))
const serviceDir = path.resolve(here, '../../../../apps/python-service')

describe('PythonBridge <-> python sidecar (integration)', () => {
  let child: ChildProcessWithoutNullStreams
  const bridge = new PythonBridge()

  beforeAll(() => {
    child = spawn(resolvePythonBin(serviceDir), ['main.py'], { cwd: serviceDir })
    child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))
    bridge.attach(child.stdin, child.stdout)
  })

  afterAll(() => {
    bridge.detach()
    child.kill()
  })

  it('responds to system.ping', async () => {
    const result = await bridge.request<PingResult>(RpcMethods.SystemPing)
    expect(result.status).toBe('ok')
    expect(result.pid).toBeGreaterThan(0)
    expect(result.pythonVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('pushes device.reading notifications while watching', async () => {
    const firstReading = new Promise<DeviceReading>((resolve) => {
      const handler = (method: string, params: unknown): void => {
        if (method === RpcMethods.DeviceReading) {
          bridge.off('notification', handler)
          resolve(params as DeviceReading)
        }
      }
      bridge.on('notification', handler)
    })

    await bridge.request(RpcMethods.DeviceWatch, { deviceId: 1 })
    const reading = await firstReading
    await bridge.request(RpcMethods.DeviceUnwatch, { deviceId: 1 })

    expect(reading.deviceId).toBe(1)
    expect(reading.timestamp).toBeGreaterThan(0)
    expect(typeof reading.value).toBe('number')
  })

  it('rejects unknown methods with a JSON-RPC error', async () => {
    await expect(bridge.request('nope.nothing')).rejects.toThrow('[-32601]')
  })
})
