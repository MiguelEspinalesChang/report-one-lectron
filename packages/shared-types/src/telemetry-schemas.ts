import { z } from 'zod'
import { RegisterMapSchema } from './catalog-schemas'

export const TelemetryHistoryParamsSchema = z.object({
  deviceId: z.number().int().positive(),
  metric: z.string().min(1),
  fromMs: z.number().int(),
  toMs: z.number().int(),
  bucketMs: z.number().int().positive().optional(),
})

export const SimulatedPollParamsSchema = z.object({
  deviceId: z.number().int().positive(),
  registerMap: RegisterMapSchema,
  ticks: z.number().int().min(1).max(1000).optional(),
})
