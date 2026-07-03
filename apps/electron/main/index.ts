import { createCore } from '@platform/core'
import { app } from 'electron'
import { forwardCoreEvents } from './events'
import { registerHandlers } from './handlers'
import { PythonManager } from './python-manager'
import { createWindow } from './window'

const core = createCore()
const python = new PythonManager(core.bridge)

app.whenReady().then(async () => {
  await python.start()
  registerHandlers(core)
  const win = await createWindow()
  forwardCoreEvents(core.bridge, win)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  python.stop()
})
