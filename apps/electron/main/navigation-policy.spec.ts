import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  type GuardableWebContents,
  type FrameNavigationEvent,
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
type FrameNavigationListener = (event: FrameNavigationEvent) => void

function createFakeWebContents() {
  const listeners = new Map<string, NavigationListener | FrameNavigationListener>()
  let windowOpenHandler: ((details: { url: string }) => { action: 'deny' }) | undefined
  const contents: GuardableWebContents = {
    setWindowOpenHandler: (handler) => {
      windowOpenHandler = handler
    },
    on: (eventName: string, listener: NavigationListener | FrameNavigationListener) => {
      listeners.set(eventName, listener)
    },
  }
  /** `isMainFrame` only matters for `will-frame-navigate`; the other events ignore it. */
  const emit = (eventName: string, url: string, isMainFrame = true) => {
    const preventDefault = vi.fn()
    listeners.get(eventName)?.({ url, isMainFrame, preventDefault })
    return preventDefault
  }
  return { contents, emit, openWindow: (url: string) => windowOpenHandler?.({ url }) }
}

describe('installNavigationGuards', () => {
  const base = 'http://127.0.0.1:5173'
  const mainFrameEvents = ['will-navigate', 'will-redirect'] as const

  function setup() {
    const fake = createFakeWebContents()
    const log = vi.fn()
    installNavigationGuards(fake.contents, base, log)
    return { ...fake, log }
  }

  it('denies every window.open request', () => {
    const { openWindow } = setup()
    expect(openWindow('https://example.com/')).toEqual({ action: 'deny' })
    expect(openWindow('http://127.0.0.1:5173/')).toEqual({ action: 'deny' })
  })

  it('logs window.open denials', () => {
    const { openWindow, log } = setup()
    openWindow('https://example.com/')
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toContain('https://example.com/')
  })

  it.each(mainFrameEvents)('blocks and logs off-origin %s', (eventName) => {
    const { emit, log } = setup()

    const preventDefault = emit(eventName, 'https://evil.example/')

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toContain(eventName)
    expect(log.mock.calls[0]?.[0]).toContain('https://evil.example/')
  })

  it.each(mainFrameEvents)('lets same-origin %s through without logging', (eventName) => {
    const { emit, log } = setup()

    const preventDefault = emit(eventName, 'http://127.0.0.1:5173/#/catalog')

    expect(preventDefault).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  describe('will-frame-navigate', () => {
    it('blocks and logs an off-origin subframe navigation', () => {
      const { emit, log } = setup()

      const preventDefault = emit('will-frame-navigate', 'https://evil.example/', false)

      expect(preventDefault).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledOnce()
      expect(log.mock.calls[0]?.[0]).toContain('will-frame-navigate')
    })

    it('lets a same-origin subframe navigation through', () => {
      const { emit, log } = setup()
      expect(emit('will-frame-navigate', 'http://127.0.0.1:5173/embed', false)).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })

    it.each(['about:blank', 'about:srcdoc'])('lets a subframe load inert %s', (url) => {
      const { emit, log } = setup()
      expect(emit('will-frame-navigate', url, false)).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })

    it('ignores main-frame events, which will-navigate already guards', () => {
      const { emit, log } = setup()
      expect(emit('will-frame-navigate', 'https://evil.example/', true)).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })

    it('logs a blocked main-frame navigation once, not once per event', () => {
      const { emit, log } = setup()
      // Electron emits both events for one main-frame navigation.
      emit('will-navigate', 'https://evil.example/')
      emit('will-frame-navigate', 'https://evil.example/', true)
      expect(log).toHaveBeenCalledOnce()
    })
  })

  it('does not treat about:blank as allowed for the main frame', () => {
    const { emit } = setup()
    expect(emit('will-navigate', 'about:blank')).toHaveBeenCalledOnce()
  })
})
