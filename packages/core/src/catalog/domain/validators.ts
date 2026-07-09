/**
 * Internal domain validators for the catalog bounded context.
 *
 * Core owns its own validation and must NOT import runtime schema objects
 * from @platform/shared-types (those are IPC-boundary guards, not domain rules).
 * Core already depends on zod (see package.json), so we use it here for
 * the same ergonomics — but this schema lives in the domain, not the adapter.
 */
import { z } from 'zod'
import type { RegisterMap } from './entities'
import { InvalidConnectionError, InvalidRegisterMapError, TransportMismatchError } from './errors'

// ---------------------------------------------------------------------------
// Register map
// ---------------------------------------------------------------------------

const RegisterEntrySchema = z.object({
  address: z.number().int().min(0).max(65535),
  function: z.enum(['holding', 'input']),
  metric: z.string().min(1),
  datatype: z.enum(['int16', 'uint16', 'int32', 'uint32', 'int64', 'float32', 'float64']),
  wordOrder: z.enum(['big_endian', 'little_endian']),
  scale: z.number().default(1),
  unit: z.string(),
})

const RegisterMapSchema = z
  .object({
    version: z.literal(1),
    registers: z.array(RegisterEntrySchema).min(1),
  })
  .refine(
    (map) => {
      const metrics = map.registers.map((r) => r.metric)
      return new Set(metrics).size === metrics.length
    },
    { message: 'Duplicate metric names in register map' },
  )

/**
 * Validates a raw unknown value as a RegisterMap.
 * Throws InvalidRegisterMapError if invalid.
 */
export function validateRegisterMap(raw: unknown): RegisterMap {
  const result = RegisterMapSchema.safeParse(raw)
  if (!result.success) {
    throw new InvalidRegisterMapError(result.error.message)
  }
  return result.data as RegisterMap
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const SerialConnectionSchema = z.object({
  transport: z.literal('serial'),
  vid: z.string(),
  pid: z.string(),
  serialNumber: z.string().optional(),
  baudrate: z.number().int().positive(),
  parity: z.enum(['N', 'E', 'O']),
  timeoutMs: z.number().int().positive(),
})

const TcpConnectionSchema = z.object({
  transport: z.literal('tcp'),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  timeoutMs: z.number().int().positive(),
})

const SimulatedConnectionSchema = z.object({
  transport: z.literal('simulated'),
}).passthrough()

const ConnectionSchema = z.discriminatedUnion('transport', [
  SerialConnectionSchema,
  TcpConnectionSchema,
  SimulatedConnectionSchema,
])

/**
 * Validates a connection config against its transport discriminant.
 * Returns the connection WITHOUT the transport field (it lives in the devices.transport column).
 * Throws TransportMismatchError or InvalidConnectionError if invalid.
 */
export function validateConnection(transport: string, connection: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...connection, transport }
  const result = ConnectionSchema.safeParse(payload)
  if (!result.success) {
    if (result.error.issues.some((i) => i.path.includes('transport'))) {
      throw new TransportMismatchError(transport)
    }
    throw new InvalidConnectionError(result.error.message)
  }
  const { transport: _t, ...conn } = result.data
  return conn as Record<string, unknown>
}
