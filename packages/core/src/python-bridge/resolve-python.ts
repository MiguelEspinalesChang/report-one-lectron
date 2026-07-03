import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolve the Python interpreter for the sidecar.
 * Preference order: explicit override, service virtualenv, system python3.
 */
export function resolvePythonBin(serviceDir: string): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN

  const venvPython =
    process.platform === 'win32'
      ? path.join(serviceDir, '.venv', 'Scripts', 'python.exe')
      : path.join(serviceDir, '.venv', 'bin', 'python')
  if (fs.existsSync(venvPython)) return venvPython

  return 'python3'
}
