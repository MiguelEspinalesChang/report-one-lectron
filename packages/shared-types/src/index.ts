/**
 * Single source of truth for every cross-boundary contract:
 * - JSON-RPC 2.0 envelopes (packages/core <-> python sidecar over stdio)
 * - IPC channel names and payloads (Vue renderer <-> Electron main)
 * - DTOs shared by all layers
 */

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 envelopes (core <-> python)
// ---------------------------------------------------------------------------

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

export interface RpcError {
  code: number
  message: string
  data?: unknown
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: RpcError
}

/** Unsolicited message pushed by the python sidecar (no `id`). */
export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

/** RPC method names spoken between core and the python sidecar. */
export const RpcMethods = {
  SystemPing: 'system.ping',
  SystemShutdown: 'system.shutdown',
  DeviceWatch: 'device.watch',
  DeviceUnwatch: 'device.unwatch',
  // Notifications emitted by python:
  DeviceReading: 'device.reading',
  DeviceStatus: 'device.status',
} as const

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface PingResult {
  status: 'ok'
  pythonVersion: string
  pid: number
}

export type DeviceState = 'connected' | 'degraded' | 'disconnected'

export interface DeviceReading {
  deviceId: number
  metric: string
  /** Epoch milliseconds. */
  timestamp: number
  value: number
}

export interface DeviceStatus {
  deviceId: number
  state: DeviceState
}

// ---------------------------------------------------------------------------
// IPC (renderer <-> main)
// ---------------------------------------------------------------------------

export const IpcChannels = {
  SystemPing: 'system:ping',
  DeviceWatch: 'device:watch',
  DeviceUnwatch: 'device:unwatch',
  // Push channels (main -> renderer):
  DeviceReading: 'device:reading',
  DeviceStatus: 'device:status',
} as const

/**
 * API exposed to the renderer through the preload contextBridge
 * (`window.platform`). The renderer never sees Node or Electron directly.
 */
export interface PlatformApi {
  system: {
    ping(): Promise<PingResult>
  }
  devices: {
    watch(deviceId: number): Promise<void>
    unwatch(deviceId: number): Promise<void>
    /** Returns an unsubscribe function. */
    onReading(callback: (reading: DeviceReading) => void): () => void
    /** Returns an unsubscribe function. */
    onStatus(callback: (status: DeviceStatus) => void): () => void
  }
}
