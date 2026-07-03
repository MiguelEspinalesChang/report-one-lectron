/// <reference types="vite/client" />

import type { PlatformApi } from '@platform/shared-types'

declare global {
  interface Window {
    /** Exposed by the Electron preload (contextBridge). */
    platform: PlatformApi
  }
}

export {}
