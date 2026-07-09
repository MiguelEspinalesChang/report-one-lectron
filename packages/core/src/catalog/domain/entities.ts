/**
 * Catalog domain entities. Pure types — no framework imports.
 *
 * RegisterEntry and RegisterMap are type-only imports from @platform/shared-types.
 * A type import is a contract declaration, not a runtime dependency — HEXAGONAL.md §8.
 */
import type { RegisterEntry, RegisterMap, Transport } from '@platform/shared-types'

export type { RegisterEntry, RegisterMap, Transport }

export interface Brand {
  id: number
  name: string
}

export interface MeterModel {
  id: number
  brandId: number
  name: string
  /** Validated JSON register map. Already parsed from the TEXT column. */
  registerMap: RegisterMap
  notes: string | null
}

export interface Device {
  id: number
  modelId: number
  name: string
  transport: Transport
  /** Parsed connection parameters. */
  connection: Record<string, unknown>
  slaveId: number
  pollingIntervalS: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}
