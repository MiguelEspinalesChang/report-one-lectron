import { EventEmitter } from 'node:events'
import type { Readable, Writable } from 'node:stream'
import type { RpcNotification, RpcRequest, RpcResponse } from '@platform/shared-types'

const DEFAULT_TIMEOUT_MS = 10_000

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
}

/**
 * JSON-RPC 2.0 client over newline-delimited JSON on stdio.
 *
 * The process itself (spawn, restart, shutdown) is owned by the Electron
 * shell (`python-manager.ts`); this class only speaks the protocol over
 * whatever streams it gets attached to.
 *
 * Events:
 * - `'notification'` (method: string, params: unknown) — unsolicited push
 *   from the sidecar (device readings, status changes, job progress).
 * - `'protocol-error'` (line: string) — a line that was not valid JSON.
 */
export class PythonBridge extends EventEmitter {
  private nextId = 1
  private readonly pending = new Map<number, PendingCall>()
  private stdin: Writable | null = null
  private buffer = ''

  attach(stdin: Writable, stdout: Readable): void {
    this.stdin = stdin
    this.buffer = ''
    stdout.on('data', (chunk: Buffer) => this.handleData(chunk))
  }

  detach(reason = 'python bridge detached'): void {
    this.stdin = null
    this.buffer = ''
    for (const [id, call] of this.pending) {
      clearTimeout(call.timer)
      call.reject(new Error(reason))
      this.pending.delete(id)
    }
  }

  get attached(): boolean {
    return this.stdin !== null
  }

  request<T>(method: string, params?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const stdin = this.stdin
    if (!stdin) {
      return Promise.reject(new Error('python sidecar is not attached'))
    }
    const id = this.nextId++
    const message: RpcRequest = { jsonrpc: '2.0', id, method, params }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout after ${timeoutMs}ms: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      stdin.write(JSON.stringify(message) + '\n')
    })
  }

  /** Fire-and-forget message to the sidecar (no response expected). */
  notify(method: string, params?: unknown): void {
    if (!this.stdin) return
    const message: RpcNotification = { jsonrpc: '2.0', method, params }
    this.stdin.write(JSON.stringify(message) + '\n')
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8')
    let newline = this.buffer.indexOf('\n')
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line) this.handleMessage(line)
      newline = this.buffer.indexOf('\n')
    }
  }

  private handleMessage(line: string): void {
    let message: RpcResponse | RpcNotification
    try {
      message = JSON.parse(line) as RpcResponse | RpcNotification
    } catch {
      this.emit('protocol-error', line)
      return
    }

    if ('id' in message && typeof message.id === 'number') {
      const call = this.pending.get(message.id)
      if (!call) return
      this.pending.delete(message.id)
      clearTimeout(call.timer)
      if (message.error) {
        call.reject(new Error(`[${message.error.code}] ${message.error.message}`))
      } else {
        call.resolve(message.result)
      }
      return
    }

    const notification = message as RpcNotification
    this.emit('notification', notification.method, notification.params)
  }
}
