/**
 * Adapter: reads telemetry.db read-only with bucketed aggregation.
 *
 * This is the ONLY file in core that opens telemetry.db.
 * It satisfies the TelemetryReader port via structural subtyping.
 *
 * Ownership rules (ARCHITECTURE.md §11):
 * - Python is the sole WRITER of telemetry.db.
 * - core opens it read-only (PRAGMA query_only = ON) — never writes.
 * - SQLite WAL allows concurrent readers; busy_timeout guards against
 *   rare checkpoint contention.
 *
 * Note on CJS bundles: this adapter uses the same createRequire pattern
 * as the app.db adapter to keep import.meta.url safe under esbuild/CJS.
 */
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'
import type { TelemetryHistoryParams, TelemetryPoint } from '@platform/shared-types'
import type { TelemetryReader } from '../ports/telemetry-reader'

const require = createRequire(import.meta.url ?? __filename)
const Database = require('better-sqlite3') as typeof BetterSqlite3

/**
 * Raw row returned by the aggregation query.
 * All columns come back as numbers because telemetry.db is STRICT.
 */
interface AggRow {
  bucket: number
  min: number
  max: number
  avg: number
  count: number
}

/**
 * Opens telemetry.db read-only and exposes an aggregated history query.
 * One instance per call site — the caller controls the lifetime.
 */
export class SqliteTelemetryReader implements TelemetryReader {
  private readonly connection: BetterSqlite3.Database

  constructor(
    /** Absolute path to telemetry.db (injected — never hardcoded). */
    dbPath: string,
    busyTimeoutMs = 5_000,
  ) {
    // Open read-only: prevents any accidental write from core.
    this.connection = new Database(dbPath, { readonly: true })
    this.connection.pragma(`busy_timeout = ${busyTimeoutMs}`)
    // WAL checkpoint reads can still race; query_only is an extra safety belt.
    this.connection.pragma('query_only = ON')
  }

  getHistory(params: TelemetryHistoryParams): TelemetryPoint[] {
    const { deviceId, metric, fromMs, toMs, bucketMs = 60_000 } = params

    /**
     * Bucket aggregation on raw `readings` table.
     *
     * SQLite integer arithmetic: (timestamp / bucketMs) * bucketMs gives the
     * start of each bucket (floor division, integer result).
     *
     * We avoid reading from readings_1m / readings_1h because the downsampling
     * job is not yet implemented — all aggregation happens on-the-fly here.
     * The idx_readings_dev_ts index makes this efficient for normal ranges.
     */
    const stmt = this.connection.prepare<[number, number, number, string, number, number], AggRow>(`
      SELECT
        (timestamp / ?) * ? AS bucket,
        MIN(value)          AS min,
        MAX(value)          AS max,
        AVG(value)          AS avg,
        COUNT(*)            AS count
      FROM readings
      WHERE device_id = ?
        AND metric    = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `)

    const rows = stmt.all(bucketMs, bucketMs, deviceId, metric, fromMs, toMs)
    return rows
  }

  /** Close the underlying connection. Call when done with this reader. */
  close(): void {
    this.connection.close()
  }
}
