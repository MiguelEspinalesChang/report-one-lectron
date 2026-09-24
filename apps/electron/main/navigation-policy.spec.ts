import { describe, expect, it } from 'vitest'
import { isAllowedNavigation } from './navigation-policy'

describe('isAllowedNavigation', () => {
  describe('dev server base (http)', () => {
    const base = 'http://127.0.0.1:5173'

    it('allows URLs on the same origin', () => {
      expect(isAllowedNavigation('http://127.0.0.1:5173/', base)).toBe(true)
      expect(isAllowedNavigation('http://127.0.0.1:5173/#/devices', base)).toBe(true)
    })

    it('rejects other origins', () => {
      expect(isAllowedNavigation('https://example.com/', base)).toBe(false)
      expect(isAllowedNavigation('http://127.0.0.1:5174/', base)).toBe(false)
      expect(isAllowedNavigation('https://127.0.0.1:5173/', base)).toBe(false)
    })

    it('rejects host-prefix tricks', () => {
      expect(isAllowedNavigation('http://127.0.0.1:5173.evil.com/', base)).toBe(false)
      expect(isAllowedNavigation('http://127.0.0.1:5173@evil.com/', base)).toBe(false)
    })

    it('rejects non-http schemes', () => {
      expect(isAllowedNavigation('file:///etc/passwd', base)).toBe(false)
      expect(isAllowedNavigation('javascript:alert(1)', base)).toBe(false)
    })
  })

  describe('packaged base (file)', () => {
    const base = 'file:///Applications/App.app/Contents/Resources/frontend/dist/index.html'

    it('allows files inside the renderer directory', () => {
      expect(isAllowedNavigation(base, base)).toBe(true)
      expect(isAllowedNavigation(`${base}#/catalog`, base)).toBe(true)
    })

    it('rejects files outside the renderer directory', () => {
      expect(isAllowedNavigation('file:///etc/passwd', base)).toBe(false)
      expect(isAllowedNavigation('file:///Applications/App.app/Contents/Resources/frontend/dist-evil/x.html', base)).toBe(false)
      expect(isAllowedNavigation('file:///Applications/App.app/Contents/Resources/frontend/dist/../../secret.html', base)).toBe(false)
    })

    it('rejects remote origins', () => {
      expect(isAllowedNavigation('https://example.com/', base)).toBe(false)
    })
  })

  it('rejects unparseable URLs', () => {
    expect(isAllowedNavigation('not a url', 'http://127.0.0.1:5173')).toBe(false)
    expect(isAllowedNavigation('http://127.0.0.1:5173/', 'not a url')).toBe(false)
  })
})
