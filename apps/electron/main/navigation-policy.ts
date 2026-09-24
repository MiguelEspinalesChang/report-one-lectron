/**
 * Decides whether the renderer may navigate to `target`.
 *
 * The renderer only ever shows the app itself: the Vite dev server origin in
 * development, or the bundled `index.html` directory when packaged. Anything
 * else (remote sites, other local files, custom schemes) is rejected.
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
    const baseDir = baseUrl.pathname.slice(0, baseUrl.pathname.lastIndexOf('/') + 1)
    return targetUrl.pathname.startsWith(baseDir)
  }

  return targetUrl.origin === baseUrl.origin
}
