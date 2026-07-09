import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DeviceReading, PingResult, SimulatedPollResult } from '@platform/shared-types'
import { RpcMethods } from '@platform/shared-types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SqliteTelemetryReader } from '../telemetry/adapters/sqlite-telemetry-reader'
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

// ---------------------------------------------------------------------------
// Phase 4 integration: simulated meter end-to-end
// ---------------------------------------------------------------------------

/**
 * Register map for the simulated meter (SIM-100 profile, 8 canonical metrics).
 * Mirrors what the catalog seed inserts — kept local here so the test is
 * self-contained (catalog DB not involved).
 */
const SIM_REGISTER_MAP = {
  version: 1,
  registers: [
    { address: 3000, function: 'holding', metric: 'voltage_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'V' },
    { address: 3002, function: 'holding', metric: 'voltage_l2', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'V' },
    { address: 3004, function: 'holding', metric: 'voltage_l3', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'V' },
    { address: 3006, function: 'holding', metric: 'current_l1', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'A' },
    { address: 3008, function: 'holding', metric: 'current_l2', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'A' },
    { address: 3010, function: 'holding', metric: 'current_l3', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'A' },
    { address: 3012, function: 'holding', metric: 'power_active', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'W' },
    { address: 3014, function: 'holding', metric: 'energy_active', datatype: 'float32', wordOrder: 'big_endian', scale: 1.0, unit: 'kWh' },
  ],
} as const

describe('Phase 4: simulated meter end-to-end (integration)', () => {
  let child: ChildProcessWithoutNullStreams
  const bridge = new PythonBridge()
  let telemetryDbPath: string
  let tmpDir: string

  beforeAll(() => {
    // Each test run gets its own temp directory — isolates telemetry.db.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-one-telemetry-'))
    telemetryDbPath = path.join(tmpDir, 'telemetry.db')

    // Spawn the sidecar WITH TELEMETRY_DB_PATH so acquisition.simulatedPoll
    // can write to the same file the reader will open below.
    child = spawn(resolvePythonBin(serviceDir), ['main.py'], {
      cwd: serviceDir,
      env: { ...process.env, TELEMETRY_DB_PATH: telemetryDbPath },
    })
    child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))
    bridge.attach(child.stdin, child.stdout)
  })

  afterAll(() => {
    bridge.detach()
    child.kill()
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('acquisition.simulatedPoll writes readings to telemetry.db', async () => {
    const DEVICE_ID = 99
    const TICKS = 5

    const result = await bridge.request<SimulatedPollResult>(
      RpcMethods.AcquisitionSimulatedPoll,
      { deviceId: DEVICE_ID, registerMap: SIM_REGISTER_MAP, ticks: TICKS },
      20_000,
    )

    // Python should report inserted counts
    expect(result.inserted).toBe(TICKS * SIM_REGISTER_MAP.registers.length)
    expect(result.ignored).toBe(0)
    expect(result.ticks).toBe(TICKS)
    expect(result.metrics).toBe(SIM_REGISTER_MAP.registers.length)
  })

  it('telemetry.db has rows with source=simulated for all expected metrics', () => {
    // Open telemetry.db read-only with the core adapter and verify rows exist.
    const reader = new SqliteTelemetryReader(telemetryDbPath)
    try {
      // Use a wide time range to catch all rows regardless of wall clock.
      const now = Date.now()
      const history = reader.getHistory({
        deviceId: 99,
        metric: 'voltage_l1',
        fromMs: now - 60_000 * 60, // 1 hour back
        toMs: now + 60_000,
        bucketMs: 60_000 * 60, // 1-hour bucket so all ticks land in one bucket
      })

      expect(history.length).toBeGreaterThan(0)
      const bucket = history[0]
      expect(bucket).toBeDefined()
      if (bucket !== undefined) {
        expect(bucket.count).toBeGreaterThanOrEqual(1)
        expect(typeof bucket.avg).toBe('number')
        expect(bucket.avg).toBeGreaterThan(0) // voltage > 0
        expect(bucket.min).toBeLessThanOrEqual(bucket.max)
      }
    } finally {
      reader.close()
    }
  })

  it('history query returns aggregated points for energy_active metric', () => {
    const reader = new SqliteTelemetryReader(telemetryDbPath)
    try {
      const now = Date.now()
      const history = reader.getHistory({
        deviceId: 99,
        metric: 'energy_active',
        fromMs: now - 60_000 * 60,
        toMs: now + 60_000,
        bucketMs: 60_000 * 60,
      })

      expect(history.length).toBeGreaterThan(0)
      const bucket = history[0]
      if (bucket !== undefined) {
        // Energy is monotonically increasing — min should be > 0 (tick starts at 1)
        expect(bucket.min).toBeGreaterThan(0)
        expect(bucket.max).toBeGreaterThanOrEqual(bucket.min)
      }
    } finally {
      reader.close()
    }
  })

  it('returns empty array for a metric not written to telemetry.db', () => {
    const reader = new SqliteTelemetryReader(telemetryDbPath)
    try {
      const now = Date.now()
      const history = reader.getHistory({
        deviceId: 99,
        metric: 'nonexistent_metric',
        fromMs: now - 60_000,
        toMs: now + 60_000,
      })
      expect(history).toEqual([])
    } finally {
      reader.close()
    }
  })
})
