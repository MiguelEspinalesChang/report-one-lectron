/**
 * Telemetry read service.
 *
 * Orchestrates history queries on behalf of the rest of core.
 * Receives TelemetryReader as a port (injected by the composition root).
 * Business rule: fromMs must be before toMs; bucket cannot be zero.
 */
import type { TelemetryHistoryParams, TelemetryPoint } from '@platform/shared-types'
import type { TelemetryReader } from '../ports/telemetry-reader'

const DEFAULT_BUCKET_MS = 60_000 // 1 minute

export class TelemetryService {
  constructor(private readonly reader: TelemetryReader) {}

  /**
   * Returns aggregated history for a device metric in a time range.
   * fromMs must be <= toMs; throws otherwise.
   */
  getHistory(params: TelemetryHistoryParams): TelemetryPoint[] {
    const { deviceId, metric, fromMs, toMs, bucketMs = DEFAULT_BUCKET_MS } = params

    if (fromMs > toMs) {
      throw new RangeError(`fromMs (${fromMs}) must be <= toMs (${toMs})`)
    }
    if (bucketMs <= 0) {
      throw new RangeError(`bucketMs must be positive, got ${bucketMs}`)
    }

    return this.reader.getHistory({ deviceId, metric, fromMs, toMs, bucketMs })
  }
}
