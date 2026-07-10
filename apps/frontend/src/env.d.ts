/// <reference types="vite/client" />

import type { PlatformApi } from '@platform/shared-types'
import type { HSStaticMethods as _HSStaticMethods } from 'preline'

declare global {
  interface Window {
    /** Exposed by the Electron preload (contextBridge). */
    platform: PlatformApi
    /**
     * Preline UI static helpers — available after preline/dist/index.js loads
     * (dynamic import after app.mount). May be undefined before the chunk resolves.
     */
    HSStaticMethods: typeof _HSStaticMethods
  }
}

export {}
