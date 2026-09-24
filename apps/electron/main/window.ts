import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow } from 'electron'
import { installNavigationGuards } from './navigation-policy'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'

export async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/bridge.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const rendererIndex = path.join(__dirname, '../../../frontend/dist/index.html')
  const allowedBase = app.isPackaged ? pathToFileURL(rendererIndex).href : DEV_SERVER_URL

  // The app never opens secondary windows, and the renderer only shows the app itself.
  installNavigationGuards(win.webContents, allowedBase)

  if (app.isPackaged) {
    await win.loadFile(rendererIndex)
  } else {
    await win.loadURL(DEV_SERVER_URL)
  }

  return win
}
