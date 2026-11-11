// Pure UI convenience util: generates a random, human-typeable password for
// the "Generate secure password" button in the Users admin screens. This is
// NOT a business rule — the backend password policy (min length, etc.) stays
// the single source of truth and is validated independently.

export const MIN_GENERATED_LENGTH = 8
export const MAX_GENERATED_LENGTH = 20
export const DEFAULT_GENERATED_LENGTH = 16

// Ambiguous characters (0/O, 1/l/I) are excluded from every set so a
// generated password is easy to read and retype by hand if needed.
const LOWERCASE_CHARS = 'abcdefghjkmnpqrstuvwxyz'
const UPPERCASE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGIT_CHARS = '23456789'
const SYMBOL_CHARS = '!@#$%^&*-_=+?'

const REQUIRED_CHAR_SETS = [LOWERCASE_CHARS, UPPERCASE_CHARS, DIGIT_CHARS, SYMBOL_CHARS]
const ALL_CHARS = REQUIRED_CHAR_SETS.join('')

/** Minimal shape of the Web Crypto API surface this util depends on. */
export interface RandomSource {
  getRandomValues: <T extends ArrayBufferView<ArrayBuffer>>(array: T) => T
}

/**
 * Returns an unbiased random integer in [0, max) using rejection sampling
 * over `crypto.getRandomValues` — never `Math.random`, which is neither
 * cryptographically secure nor suitable for password generation.
 */
function randomIndex(source: RandomSource, max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError('max must be a positive integer')
  }
  if (max > 256) {
    throw new RangeError('max must be at most 256 (single byte sampling)')
  }

  // Largest multiple of `max` that fits in a byte — values sampled at or
  // above it are rejected so every remaining outcome has equal probability
  // (no modulo bias).
  const safeRange = 256 - (256 % max)
  const buffer = new Uint8Array(1)

  for (;;) {
    source.getRandomValues(buffer)
    const value = buffer[0]
    if (value !== undefined && value < safeRange) {
      return value % max
    }
  }
}

function pickChar(source: RandomSource, chars: string): string {
  const char = chars[randomIndex(source, chars.length)]
  /* c8 ignore next 3 -- randomIndex always returns a valid in-range index */
  if (char === undefined) {
    throw new Error('unreachable: randomIndex returned an out-of-range index')
  }
  return char
}

/** Fisher–Yates shuffle, in place, using the same unbiased random source. */
function shuffle(chars: string[], source: RandomSource): void {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(source, i + 1)
    const a = chars[i]
    const b = chars[j]
    if (a === undefined || b === undefined) continue
    chars[i] = b
    chars[j] = a
  }
}

/**
 * Generates a random secure password of the given length.
 *
 * Guarantees at least one lowercase, uppercase, digit and symbol character,
 * excludes visually ambiguous characters (0, O, 1, l, I), and shuffles the
 * result so the required characters aren't always in the same positions.
 *
 * @throws {RangeError} if `length` is not an integer between
 *   {@link MIN_GENERATED_LENGTH} and {@link MAX_GENERATED_LENGTH}.
 */
export function generatePassword(
  length: number,
  randomSource: RandomSource = globalThis.crypto,
): string {
  if (
    !Number.isInteger(length) ||
    length < MIN_GENERATED_LENGTH ||
    length > MAX_GENERATED_LENGTH
  ) {
    throw new RangeError(
      `length must be an integer between ${MIN_GENERATED_LENGTH} and ${MAX_GENERATED_LENGTH}`,
    )
  }
  if (!randomSource?.getRandomValues) {
    throw new Error('No secure random source available (crypto.getRandomValues)')
  }

  const required = REQUIRED_CHAR_SETS.map((set) => pickChar(randomSource, set))
  const rest = Array.from({ length: length - required.length }, () =>
    pickChar(randomSource, ALL_CHARS),
  )

  const chars = [...required, ...rest]
  shuffle(chars, randomSource)
  return chars.join('')
}
