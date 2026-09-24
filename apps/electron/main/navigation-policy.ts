/**
 * Decides whether the renderer may navigate to `target`.
 *
 * The renderer only ever shows the app itself: the Vite dev server origin in
 * development, or the bundled `index.html` directory when packaged. Anything
 * else (remote sites, other local files, file shares, custom schemes) is rejected.
 * URLs are compared parsed, never by string prefix, so host tricks like
 * `127.0.0.1:5173.evil.com` or `..` segments cannot slip through.
 */
export function isAllowedNavigation(target: string, allowedBase: string): boolean {
  let targetUrl: URL
  let baseUrl: URL
  try {
    targetUrl = new URL(target)
    baseUrl = new URL(allowedBase)
  } catch {
    return false
  }

  if (targetUrl.protocol !== baseUrl.protocol) return false

  if (baseUrl.protocol === 'file:') {
    // A host on a file URL is a network share (UNC on Windows): same path, different machine.
    if (targetUrl.host !== baseUrl.host) return false
    const baseDir = baseUrl.pathname.slice(0, baseUrl.pathname.lastIndexOf('/') + 1)
    return targetUrl.pathname.startsWith(baseDir)
  }

  return targetUrl.origin === baseUrl.origin
}

export interface NavigationEvent {
  url: string
  preventDefault(): void
}

type GuardedNavigation = 'will-navigate' | 'will-redirect' | 'will-frame-navigate'

/** The slice of Electron's `WebContents` the guards need; kept structural so it is testable. */
export interface GuardableWebContents {
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void
  on(event: 'will-navigate', listener: (event: NavigationEvent) => void): unknown
  on(event: 'will-redirect', listener: (event: NavigationEvent) => void): unknown
  on(event: 'will-frame-navigate', listener: (event: NavigationEvent) => void): unknown
}

const GUARDED_NAVIGATIONS: readonly GuardedNavigation[] = [
  'will-navigate',
  'will-redirect',
  'will-frame-navigate',
]

/**
 * Denies every `window.open` and cancels any navigation, redirect or frame
 * navigation that leaves `allowedBase`. Each block is logged so a legitimate
 * navigation broken by the policy is visible instead of silently ignored.
 */
export function installNavigationGuards(
  contents: GuardableWebContents,
  allowedBase: string,
  log: (message: string) => void = console.warn,
): void {
  contents.setWindowOpenHandler(({ url }) => {
    log(`[navigation-guard] denied window.open to ${url}`)
    return { action: 'deny' }
  })

  for (const kind of GUARDED_NAVIGATIONS) {
    // Each literal is a separate overload of `on`; the cast keeps one loop for all three.
    contents.on(kind as 'will-navigate', (event) => {
      if (isAllowedNavigation(event.url, allowedBase)) return
      event.preventDefault()
      log(`[navigation-guard] blocked ${kind} to ${event.url}`)
    })
  }
}
