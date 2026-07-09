import { createAppDatabase, createCore } from '@platform/core'
import { app, dialog } from 'electron'
import path from 'node:path'
import { forwardCoreEvents } from './events'
import { registerHandlers } from './handlers'
import { PythonManager } from './python-manager'
import { createWindow } from './window'

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'app.db')
  // The main bundle is CJS (esbuild): core cannot resolve the migrations
  // folder from source, so the shell injects it. Runtime __dirname is
  // apps/electron/dist/main → monorepo root is 4 levels up.
  // TODO(installer): ship database/migrations/app as extraResources and
  // resolve via process.resourcesPath in the packaged app.
  const migrationsFolder = path.resolve(__dirname, '../../../../database/migrations/app')
  const database = createAppDatabase({ filePath: dbPath, migrationsFolder })

  const telemetryDbPath = path.join(app.getPath('userData'), 'telemetry.db')

  // createCore runs migrations + seed internally (runSetup: true by default).
  const core = await createCore({ database, telemetryDbPath })
  const python = new PythonManager(core.bridge, { telemetryDbPath })

  await python.start()
  registerHandlers(core)
  const win = await createWindow()
  forwardCoreEvents(core.bridge, win)

  app.on('before-quit', () => {
    python.stop()
    database.close()
  })
}).catch((error: unknown) => {
  // Without this, a startup failure leaves a dock icon with no window and
  // the error buried in the terminal.
  const message = error instanceof Error ? error.message : String(error)
  console.error('[main] startup failed:', message)
  dialog.showErrorBox('Startup failed', message)
  app.exit(1)
})

app.on('window-all-closed', () => {
  app.quit()
})
