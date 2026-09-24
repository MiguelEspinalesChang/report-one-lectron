import { z } from 'zod'

// Register map entry
export const RegisterEntrySchema = z.object({
  address: z.number().int().min(0).max(65535),
  function: z.enum(['holding', 'input']),
  metric: z.string().min(1),
  datatype: z.enum(['int16', 'uint16', 'int32', 'uint32', 'int64', 'float32', 'float64']),
  wordOrder: z.enum(['big_endian', 'little_endian']),
  scale: z.number().default(1),
  unit: z.string(),
})

export const RegisterMapSchema = z
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

// Transport — single source of truth for how a device's data arrives
export const TransportSchema = z.enum(['serial', 'tcp', 'simulated', 'csv'])
export type Transport = z.infer<typeof TransportSchema>

// Connection discriminated union
export const SerialConnectionSchema = z.object({
  vid: z.string(),
  pid: z.string(),
  serialNumber: z.string().optional(),
  baudrate: z.number().int().positive(),
  parity: z.enum(['N', 'E', 'O']),
  timeoutMs: z.number().int().positive(),
})

export const TcpConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  timeoutMs: z.number().int().positive(),
})

export const SimulatedConnectionSchema = z.object({}).passthrough()

// csv: no live connection — readings arrive via file import (source='csv_import')
export const CsvConnectionSchema = z.object({}).passthrough()

export const ConnectionSchema = z.discriminatedUnion('transport', [
  z.object({ transport: z.literal('serial') }).merge(SerialConnectionSchema),
  z.object({ transport: z.literal('tcp') }).merge(TcpConnectionSchema),
  z.object({ transport: z.literal('simulated') }).merge(SimulatedConnectionSchema),
  z.object({ transport: z.literal('csv') }).merge(CsvConnectionSchema),
])

// IPC input schemas (for Electron handler boundary validation)
export const CreateBrandSchema = z.object({
  name: z.string().min(1).max(128),
})

export const RenameBrandSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(128),
})

export const DeleteBrandSchema = z.object({
  id: z.number().int().positive(),
})

export const CreateMeterModelSchema = z.object({
  brandId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  registerMap: RegisterMapSchema,
  notes: z.string().optional(),
})

export const ListModelsByBrandSchema = z.object({
  brandId: z.number().int().positive(),
})

export const UpdateRegisterMapSchema = z.object({
  id: z.number().int().positive(),
  registerMap: RegisterMapSchema,
})

export const UpdateMeterModelSchema = z.object({
  id: z.number().int().positive(),
  brandId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  registerMap: RegisterMapSchema,
  notes: z.string().nullable().optional(),
})

export const DeleteMeterModelSchema = z.object({
  id: z.number().int().positive(),
})

export const CreateDeviceSchema = z.object({
  modelId: z.number().int().positive(),
  name: z.string().min(1).max(128),
  transport: TransportSchema,
  connection: z.record(z.unknown()),
  slaveId: z.number().int().min(0).max(247).default(1),
  pollingIntervalS: z.number().int().positive().default(900),
  enabled: z.boolean().default(true),
})

export const UpdateDeviceSchema = CreateDeviceSchema.partial().extend({
  id: z.number().int().positive(),
})

export const DeleteDeviceSchema = z.object({
  id: z.number().int().positive(),
})

export const EnableDeviceSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean(),
})

export type RegisterEntry = z.infer<typeof RegisterEntrySchema>
export type RegisterMap = z.infer<typeof RegisterMapSchema>
