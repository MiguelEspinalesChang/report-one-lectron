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

export interface FrameNavigationEvent extends NavigationEvent {
  isMainFrame: boolean
}

/** The slice of Electron's `WebContents` the guards need; kept structural so it is testable. */
export interface GuardableWebContents {
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void
  on(event: 'will-navigate', listener: (event: NavigationEvent) => void): unknown
  on(event: 'will-redirect', listener: (event: NavigationEvent) => void): unknown
  on(event: 'will-frame-navigate', listener: (event: FrameNavigationEvent) => void): unknown
}

/** Empty, same-origin documents that iframes (often inside libraries) load before real content. */
const INERT_SUBFRAME_URLS: ReadonlySet<string> = new Set(['about:blank', 'about:srcdoc'])

/**
 * Denies every `window.open` and cancels any navigation, redirect or subframe
 * navigation that leaves `allowedBase`. Each block is logged so a legitimate
 * navigation broken by the policy is visible instead of silently ignored.
 */
export function installNavigationGuards(
  contents: GuardableWebContents,
  allowedBase: string,
  log: (message: string) => void = console.warn,
): void {
  const block = (kind: string, event: NavigationEvent): void => {
    event.preventDefault()
    log(`[navigation-guard] blocked ${kind} to ${event.url}`)
  }

  contents.setWindowOpenHandler(({ url }) => {
    log(`[navigation-guard] denied window.open to ${url}`)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event) => {
    if (!isAllowedNavigation(event.url, allowedBase)) block('will-navigate', event)
  })

  contents.on('will-redirect', (event) => {
    if (!isAllowedNavigation(event.url, allowedBase)) block('will-redirect', event)
  })

  // Electron also emits this for the main frame, which `will-navigate` already guards;
  // handling it here too would block and log the same navigation twice.
  contents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame || INERT_SUBFRAME_URLS.has(event.url)) return
    if (!isAllowedNavigation(event.url, allowedBase)) block('will-frame-navigate', event)
  })
}
