import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GENERATED_LENGTH,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  generatePassword,
} from './password-generator'

const AMBIGUOUS_CHARS = new Set(['0', 'O', '1', 'l', 'I'])
const ALLOWED_CHARS = /^[a-zA-Z0-9!@#$%^&*\-_=+?]+$/

describe('generatePassword', () => {
  it('accepts the boundary lengths (8 and 20)', () => {
    expect(generatePassword(MIN_GENERATED_LENGTH)).toHaveLength(MIN_GENERATED_LENGTH)
    expect(generatePassword(MAX_GENERATED_LENGTH)).toHaveLength(MAX_GENERATED_LENGTH)
  })

  it('rejects a length below the minimum', () => {
    expect(() => generatePassword(MIN_GENERATED_LENGTH - 1)).toThrow(RangeError)
  })

  it('rejects a length above the maximum', () => {
    expect(() => generatePassword(MAX_GENERATED_LENGTH + 1)).toThrow(RangeError)
  })

  it('rejects a non-integer length', () => {
    expect(() => generatePassword(8.5)).toThrow(RangeError)
  })

  it('returns a string with exactly the requested length', () => {
    for (const length of [MIN_GENERATED_LENGTH, 12, DEFAULT_GENERATED_LENGTH, MAX_GENERATED_LENGTH]) {
      expect(generatePassword(length)).toHaveLength(length)
    }
  })

  it('contains at least one char from each required class', () => {
    for (let i = 0; i < 30; i++) {
      const password = generatePassword(DEFAULT_GENERATED_LENGTH)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[!@#$%^&*\-_=+?]/)
    }
  })

  it('never contains ambiguous characters (0 O 1 l I)', () => {
    for (let i = 0; i < 30; i++) {
      const password = generatePassword(MAX_GENERATED_LENGTH)
      for (const char of password) {
        expect(AMBIGUOUS_CHARS.has(char)).toBe(false)
      }
    }
  })

  it('only contains allowed characters', () => {
    for (let i = 0; i < 10; i++) {
      expect(generatePassword(DEFAULT_GENERATED_LENGTH)).toMatch(ALLOWED_CHARS)
    }
  })

  it('produces distinct values across many runs', () => {
    const results = new Set(
      Array.from({ length: 50 }, () => generatePassword(DEFAULT_GENERATED_LENGTH)),
    )
    expect(results.size).toBeGreaterThan(45)
  })

  it('uses crypto.getRandomValues and never Math.random', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const getRandomValuesSpy = vi.spyOn(globalThis.crypto, 'getRandomValues')

    generatePassword(DEFAULT_GENERATED_LENGTH)

    expect(getRandomValuesSpy).toHaveBeenCalled()
    expect(mathRandomSpy).not.toHaveBeenCalled()

    mathRandomSpy.mockRestore()
    getRandomValuesSpy.mockRestore()
  })

  it('accepts an injectable random source', () => {
    let counter = 0
    const fakeSource = {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
        for (let i = 0; i < view.length; i++) {
          view[i] = (counter += 37) % 256
        }
        return array
      },
    }

    const password = generatePassword(DEFAULT_GENERATED_LENGTH, fakeSource)
    expect(password).toHaveLength(DEFAULT_GENERATED_LENGTH)
    expect(password).toMatch(ALLOWED_CHARS)
  })
})
