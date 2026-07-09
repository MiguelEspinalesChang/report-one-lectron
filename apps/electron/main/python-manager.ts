import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import { resolvePythonBin, type PythonBridge } from '@platform/core'
import { app } from 'electron'

const RESTART_DELAY_MS = 1_000
const MAX_RESTARTS = 5

/**
 * Owns the python sidecar process: spawn, supervise, restart on crash,
 * clean shutdown. The RPC protocol itself lives in packages/core.
 */
export interface PythonManagerOptions {
  /**
   * Absolute path to telemetry.db, injected into the sidecar via the
   * TELEMETRY_DB_PATH env var. Python is the sole writer of this file
   * (ARCHITECTURE.md §11); the sidecar reads this env var to locate it.
   */
  telemetryDbPath: string
}

export class PythonManager {
  private child: ChildProcessWithoutNullStreams | null = null
  private restarts = 0
  private stopping = false

  constructor(
    private readonly bridge: PythonBridge,
    private readonly options: PythonManagerOptions,
  ) {}

  private get serviceDir(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'python-service')
      : path.resolve(__dirname, '../../../python-service')
  }

  async start(): Promise<void> {
    if (this.child) return
    const serviceDir = this.serviceDir
    const child = spawn(resolvePythonBin(serviceDir), ['main.py'], {
      cwd: serviceDir,
      // The sidecar reads TELEMETRY_DB_PATH from its environment to locate
      // telemetry.db. Without this, acquisition.simulatedPoll fails.
      env: { ...process.env, TELEMETRY_DB_PATH: this.options.telemetryDbPath },
    })
    this.child = child

    child.stderr.on('data', (chunk: Buffer) => {
      console.error('[python]', chunk.toString().trimEnd())
    })
    child.on('exit', (code) => this.handleExit(code))

    this.bridge.attach(child.stdin, child.stdout)
  }

  stop(): void {
    this.stopping = true
    this.bridge.detach('application shutting down')
    this.child?.kill()
    this.child = null
  }

  private handleExit(code: number | null): void {
    this.bridge.detach(`python sidecar exited with code ${code}`)
    this.child = null
    if (this.stopping) return

    if (this.restarts >= MAX_RESTARTS) {
      console.error('[python] sidecar crashed too many times, giving up')
      return
    }
    this.restarts += 1
    console.error(`[python] sidecar exited (code ${code}), restart ${this.restarts}/${MAX_RESTARTS}`)
    setTimeout(() => void this.start(), RESTART_DELAY_MS)
  }
}
