/**
 * Adapter: reads telemetry.db read-only with bucketed aggregation.
 *
 * This is the ONLY file in core that opens telemetry.db.
 * It satisfies the TelemetryReader port via structural subtyping.
 *
 * Ownership rules (ARCHITECTURE.md §11):
 * - Python is the sole WRITER of telemetry.db — it also CREATES the file on
 *   its first write. Core may boot before that happens, so the connection is
 *   opened lazily: a missing file (or a file whose migrations have not run
 *   yet) yields an empty history instead of a startup crash.
 * - core opens it read-only (PRAGMA query_only = ON) — never writes.
 * - SQLite WAL allows concurrent readers; busy_timeout guards against
 *   rare checkpoint contention.
 *
 * Note on CJS bundles: this adapter uses the same createRequire pattern
 * as the app.db adapter to keep import.meta.url safe under esbuild/CJS.
 */
import { existsSync } from 'node:fs'
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
 * Reads telemetry.db read-only and exposes an aggregated history query.
 * One instance per call site — the caller controls the lifetime.
 */
export class SqliteTelemetryReader implements TelemetryReader {
  private connection: BetterSqlite3.Database | null = null

  constructor(
    /** Absolute path to telemetry.db (injected — never hardcoded). */
    private readonly dbPath: string,
    private readonly busyTimeoutMs = 5_000,
  ) {}

  /**
   * Opens the connection on first use. Returns null while the file does not
   * exist yet (python has not written its first batch).
   */
  private connect(): BetterSqlite3.Database | null {
    if (this.connection !== null) return this.connection
    if (!existsSync(this.dbPath)) return null

    // Open read-only: prevents any accidental write from core.
    const connection = new Database(this.dbPath, { readonly: true })
    connection.pragma(`busy_timeout = ${this.busyTimeoutMs}`)
    // WAL checkpoint reads can still race; query_only is an extra safety belt.
    connection.pragma('query_only = ON')
    this.connection = connection
    return connection
  }

  getHistory(params: TelemetryHistoryParams): TelemetryPoint[] {
    const connection = this.connect()
    if (connection === null) return []

    const { deviceId, metric, fromMs, toMs, bucketMs = 60_000 } = params

    /**
     * Bucket aggregation on raw `readings` table.
     *
     * better-sqlite3 binds JS numbers as REAL, so a bare `timestamp / ?`
     * performs FLOAT division and every reading lands in its own bucket.
     * CAST both the quotient and the bucket size to INTEGER to get floor
     * division: CAST(timestamp / ? AS INTEGER) * CAST(? AS INTEGER).
     *
     * We avoid reading from readings_1m / readings_1h because the downsampling
     * job is not yet implemented — all aggregation happens on-the-fly here.
     * The idx_readings_dev_ts index makes this efficient for normal ranges.
     */
    try {
      const stmt = connection.prepare<[number, number, number, string, number, number], AggRow>(`
        SELECT
          CAST(timestamp / ? AS INTEGER) * CAST(? AS INTEGER) AS bucket,
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
      return stmt.all(bucketMs, bucketMs, deviceId, metric, fromMs, toMs)
    } catch (error) {
      // The file can exist before python finished its migrations (e.g. an
      // empty database created by a connection that never wrote). Treat a
      // missing readings table as "no data yet", not a crash.
      if (error instanceof Error && error.message.includes('no such table')) {
        return []
      }
      throw error
    }
  }

  /** Close the underlying connection. Call when done with this reader. */
  close(): void {
    this.connection?.close()
    this.connection = null
  }
}
