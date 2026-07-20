import type {
  SimulatedPollParams,
  SimulatedPollResult,
  TelemetryHistoryParams,
  TelemetryPoint,
} from '@platform/shared-types'
import { defineStore } from 'pinia'

// Passthrough store — no cached state. Unlike catalog.ts (which owns lists shared
// across views), telemetry queries are always parameterized per device/metric/range,
// so there is no single shared list worth caching here.
export const useTelemetryStore = defineStore('telemetry', () => {
  async function getHistory(params: TelemetryHistoryParams): Promise<TelemetryPoint[]> {
    return await window.platform.telemetry.getHistory(params)
  }

  async function triggerSimulatedPoll(params: SimulatedPollParams): Promise<SimulatedPollResult> {
    return await window.platform.acquisition.simulatedPoll(params)
  }

  return { getHistory, triggerSimulatedPoll }
})
