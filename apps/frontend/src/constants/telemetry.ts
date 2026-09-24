// Mirrors packages/shared-types/src/telemetry-schemas.ts SimulatedPollParamsSchema
// (ticks: z.number().int().min(1).max(1000)) — UX prevalidation only, backend re-validates.
export const SIMULATED_POLL_MIN_TICKS = 1
export const SIMULATED_POLL_MAX_TICKS = 1000
export const SIMULATED_POLL_DEFAULT_TICKS = '10'
