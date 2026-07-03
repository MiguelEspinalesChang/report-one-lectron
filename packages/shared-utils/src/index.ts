/** Generic utilities shared across processes. Must stay environment-agnostic. */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
