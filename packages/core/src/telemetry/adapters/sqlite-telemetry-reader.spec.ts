/**
 * Unit tests for SqliteTelemetryReader.
 *
 * Startup ordering matters: telemetry.db is created by the Python sidecar on
 * its first write, so core may boot BEFORE the file exists. The reader must
 * tolerate a missing (or not-yet-migrated) database and pick it up lazily.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteTelemetryReader } from './sqlite-telemetry-reader'

const HISTORY_PARAMS = {
  deviceId: 1,
  metric: 'voltage_l1',
  fromMs: 0,
  toMs: 10_000_000,
  bucketMs: 60_000,
}

/** Simulates the Python sidecar: creates telemetry.db with the readings table. */
function createTelemetryDb(dbPath: string, rows: Array<[number, string, number, number]> = []): void {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE readings (
      device_id  INTEGER NOT NULL,
      metric     TEXT    NOT NULL,
      timestamp  INTEGER NOT NULL,
      value      REAL    NOT NULL,
      source     TEXT    NOT NULL,
      UNIQUE (device_id, metric, timestamp)
    ) STRICT
  `)
  const insert = db.prepare('INSERT INTO readings VALUES (?, ?, ?, ?, ?)')
  for (const [deviceId, metric, timestamp, value] of rows) {
    insert.run(deviceId, metric, timestamp, value, 'simulated')
  }
  db.close()
}

describe('SqliteTelemetryReader', () => {
  let dir: string
  let dbPath: string
  let reader: SqliteTelemetryReader | null

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'telemetry-reader-'))
    dbPath = path.join(dir, 'telemetry.db')
    reader = null
  })

  afterEach(() => {
    reader?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not throw when telemetry.db does not exist yet (python has not written)', () => {
    expect(() => {
      reader = new SqliteTelemetryReader(dbPath)
    }).not.toThrow()
    expect(reader?.getHistory(HISTORY_PARAMS)).toEqual([])
  })

  it('picks up the database lazily once python creates it', () => {
    reader = new SqliteTelemetryReader(dbPath)
    expect(reader.getHistory(HISTORY_PARAMS)).toEqual([])

    createTelemetryDb(dbPath, [[1, 'voltage_l1', 1_000, 220]])

    const points = reader.getHistory(HISTORY_PARAMS)
    expect(points).toHaveLength(1)
    expect(points[0]?.avg).toBe(220)
  })

  it('returns empty history when the file exists but migrations have not run', () => {
    new Database(dbPath).close() // empty file, no readings table yet
    reader = new SqliteTelemetryReader(dbPath)
    expect(reader.getHistory(HISTORY_PARAMS)).toEqual([])
  })

  it('aggregates readings into buckets (min/max/avg/count)', () => {
    createTelemetryDb(dbPath, [
      [1, 'voltage_l1', 1_000, 210],
      [1, 'voltage_l1', 2_000, 230],
      [1, 'voltage_l1', 61_000, 225],
      [2, 'voltage_l1', 3_000, 999], // other device — excluded
    ])
    reader = new SqliteTelemetryReader(dbPath)

    const points = reader.getHistory(HISTORY_PARAMS)
    expect(points).toHaveLength(2)
    expect(points[0]).toEqual({ bucket: 0, min: 210, max: 230, avg: 220, count: 2 })
    expect(points[1]).toEqual({ bucket: 60_000, min: 225, max: 225, avg: 225, count: 1 })
  })
})
