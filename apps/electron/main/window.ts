import path from 'node:path'
import { app, BrowserWindow } from 'electron'

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

  if (app.isPackaged) {
    await win.loadFile(path.join(__dirname, '../../../frontend/dist/index.html'))
  } else {
    await win.loadURL(DEV_SERVER_URL)
  }

  return win
}
