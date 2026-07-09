/**
 * Port: the contract core uses to read telemetry history.
 *
 * Framework-free — no sqlite3, no better-sqlite3 imports here.
 * The concrete adapter (SqliteTelemetryReader) satisfies this interface.
 */
import type { TelemetryHistoryParams, TelemetryPoint } from '@platform/shared-types'

export interface TelemetryReader {
  /**
   * Returns aggregated telemetry points for a device metric in a time range.
   *
   * Aggregation is by bucket (bucketMs wide). Each bucket returns min/max/avg/count
   * computed from raw `readings` rows — no downsampling tables required.
   * Core READS telemetry.db directly; Python is the sole writer.
   */
  getHistory(params: TelemetryHistoryParams): TelemetryPoint[]
}
