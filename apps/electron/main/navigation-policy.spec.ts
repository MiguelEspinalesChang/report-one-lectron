import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  type GuardableWebContents,
  type NavigationEvent,
  installNavigationGuards,
  isAllowedNavigation,
} from './navigation-policy'

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

    it('rejects a file URL with a host (UNC share) even when the path matches', () => {
      const unc = 'file://evil-server/Applications/App.app/Contents/Resources/frontend/dist/index.html'
      expect(isAllowedNavigation(unc, base)).toBe(false)
    })

    it('rejects remote origins', () => {
      expect(isAllowedNavigation('https://example.com/', base)).toBe(false)
    })

    it('handles install paths with spaces and non-ASCII characters', () => {
      const index = '/Volumes/Disk/Documentos /Proyectos personales/Año/frontend/dist/index.html'
      const encodedBase = pathToFileURL(index).href
      expect(encodedBase).toContain('%20')
      expect(isAllowedNavigation(encodedBase, encodedBase)).toBe(true)
      expect(isAllowedNavigation(`${encodedBase}#/devices`, encodedBase)).toBe(true)
      expect(isAllowedNavigation(pathToFileURL('/Volumes/Disk/Documentos /other.html').href, encodedBase)).toBe(false)
    })
  })

  it('rejects unparseable URLs', () => {
    expect(isAllowedNavigation('not a url', 'http://127.0.0.1:5173')).toBe(false)
    expect(isAllowedNavigation('http://127.0.0.1:5173/', 'not a url')).toBe(false)
  })
})

type NavigationListener = (event: NavigationEvent) => void

function createFakeWebContents() {
  const listeners = new Map<string, NavigationListener>()
  let windowOpenHandler: ((details: { url: string }) => { action: 'deny' }) | undefined
  const contents: GuardableWebContents = {
    setWindowOpenHandler: (handler) => {
      windowOpenHandler = handler
    },
    on: (eventName: string, listener: NavigationListener) => {
      listeners.set(eventName, listener)
    },
  }
  const emit = (eventName: string, url: string) => {
    const preventDefault = vi.fn()
    listeners.get(eventName)?.({ url, preventDefault })
    return preventDefault
  }
  return { contents, listeners, emit, openWindow: (url: string) => windowOpenHandler?.({ url }) }
}

describe('installNavigationGuards', () => {
  const base = 'http://127.0.0.1:5173'
  const guardedEvents = ['will-navigate', 'will-redirect', 'will-frame-navigate'] as const

  it('denies every window.open request', () => {
    const fake = createFakeWebContents()
    installNavigationGuards(fake.contents, base, vi.fn())
    expect(fake.openWindow('https://example.com/')).toEqual({ action: 'deny' })
    expect(fake.openWindow('http://127.0.0.1:5173/')).toEqual({ action: 'deny' })
  })

  it.each(guardedEvents)('blocks and logs off-origin %s', (eventName) => {
    const fake = createFakeWebContents()
    const log = vi.fn()
    installNavigationGuards(fake.contents, base, log)

    const preventDefault = fake.emit(eventName, 'https://evil.example/')

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toContain(eventName)
    expect(log.mock.calls[0]?.[0]).toContain('https://evil.example/')
  })

  it.each(guardedEvents)('lets same-origin %s through without logging', (eventName) => {
    const fake = createFakeWebContents()
    const log = vi.fn()
    installNavigationGuards(fake.contents, base, log)

    const preventDefault = fake.emit(eventName, 'http://127.0.0.1:5173/#/catalog')

    expect(preventDefault).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('logs window.open denials', () => {
    const fake = createFakeWebContents()
    const log = vi.fn()
    installNavigationGuards(fake.contents, base, log)
    fake.openWindow('https://example.com/')
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toContain('https://example.com/')
  })
})
