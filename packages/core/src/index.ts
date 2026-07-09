/**
 * Business core. Pure TypeScript library — no HTTP server, no open ports.
 * Consumed by the Electron main process through thin IPC handlers.
 */

import { AuthService } from './auth/application/auth-service'
import { UserManagementService } from './auth/application/user-management-service'
import { Argon2Hasher } from './auth/adapters/argon2-hasher'
import { DrizzleRoleRepository } from './auth/adapters/drizzle-role-repository'
import { DrizzleUserRepository } from './auth/adapters/drizzle-user-repository'
import { seedAuthData } from './auth/adapters/seed'
import { AuthSession } from './auth/domain/auth-session'
import { DeviceService } from './devices/device-service'
import { PythonBridge } from './python-bridge/client'
import { SystemService } from './services/system-service'
import type { AppDatabaseHandle } from './persistence/ports/database-handle'
import { asSqliteAppDatabase } from './persistence/adapters/sqlite-database'
import { BrandService } from './catalog/application/brand-service'
import { MeterModelService } from './catalog/application/meter-model-service'
import { DeviceService as CatalogDeviceService } from './catalog/application/device-service'
import { DrizzleBrandRepository } from './catalog/adapters/drizzle-brand-repository'
import { DrizzleMeterModelRepository } from './catalog/adapters/drizzle-meter-model-repository'
import { DrizzleDeviceRepository } from './catalog/adapters/drizzle-device-repository'
import { seedCatalogData } from './catalog/adapters/seed'
import { AcquisitionService } from './acquisition/acquisition-service'
import { TelemetryService } from './telemetry/application/telemetry-service'
import { SqliteTelemetryReader } from './telemetry/adapters/sqlite-telemetry-reader'

export interface Core {
  bridge: PythonBridge
  system: SystemService
  devices: DeviceService
  auth: AuthService
  userManagement: UserManagementService
  catalog: {
    brands: BrandService
    models: MeterModelService
    devices: CatalogDeviceService
  }
  acquisition: AcquisitionService
  /**
   * Telemetry history reader. Null when no telemetryDbPath is provided
   * (e.g. unit tests that don't need telemetry queries).
   */
  telemetry: TelemetryService | null
}

export interface CreateCoreOptions {
  /**
   * Framework-free persistence handle. In production this is the value
   * returned by createAppDatabase(). Tests can pass a minimal double that
   * satisfies AppDatabaseHandle, but wiring drizzle-based repositories
   * requires the full SqliteAppDatabase shape (see asSqliteAppDatabase).
   */
  database: AppDatabaseHandle
  /**
   * When true (default), runs migrations and seeds auth data before wiring
   * services. Set to false only in tests that manage setup themselves.
   */
  runSetup?: boolean
  /**
   * Absolute path to telemetry.db.
   * Injected by Electron main (app.getPath('userData')/telemetry.db).
   * When omitted, core.telemetry is null (queries will throw if called).
   */
  telemetryDbPath?: string
}

/**
 * Creates and wires all core services. Async because it optionally runs
 * migrations and seeds the database before returning the ready Core object.
 */
export async function createCore(options: CreateCoreOptions): Promise<Core> {
  const { database, runSetup = true, telemetryDbPath } = options

  // Composition root: this is the ONE place that narrows the framework-free
  // port to the concrete sqlite adapter — needed to reach the drizzle `db`
  // for seeding and repository wiring. Throws a descriptive error if the
  // handle is not the value returned by createAppDatabase().
  const sqliteHandle = asSqliteAppDatabase(database)

  if (runSetup) {
    sqliteHandle.runMigrations()
    await seedAuthData(sqliteHandle.db)
    await seedCatalogData(sqliteHandle.db)
  }

  const bridge = new PythonBridge()

  const userRepository = new DrizzleUserRepository(sqliteHandle.db)
  const roleRepository = new DrizzleRoleRepository(sqliteHandle.db)
  const hasher = new Argon2Hasher()
  const session = new AuthSession()

  const brandRepository = new DrizzleBrandRepository(sqliteHandle.db)
  const meterModelRepository = new DrizzleMeterModelRepository(sqliteHandle.db)
  const catalogDeviceRepository = new DrizzleDeviceRepository(sqliteHandle.db)

  const telemetry = telemetryDbPath !== undefined
    ? new TelemetryService(new SqliteTelemetryReader(telemetryDbPath))
    : null

  return {
    bridge,
    system: new SystemService(bridge),
    devices: new DeviceService(bridge),
    auth: new AuthService(userRepository, roleRepository, hasher, session),
    userManagement: new UserManagementService(userRepository, roleRepository, hasher),
    catalog: {
      brands: new BrandService(brandRepository),
      models: new MeterModelService(meterModelRepository),
      devices: new CatalogDeviceService(catalogDeviceRepository),
    },
    acquisition: new AcquisitionService(bridge),
    telemetry,
  }
}

export { DeviceService } from './devices/device-service'
export { PythonBridge } from './python-bridge/client'
export { resolvePythonBin } from './python-bridge/resolve-python'
export { SystemService } from './services/system-service'
export { createAppDatabase } from './persistence/adapters/sqlite-database'
export type { AppDatabaseHandle } from './persistence/ports/database-handle'
export { AuthService } from './auth/application/auth-service'
export { UserManagementService } from './auth/application/user-management-service'
export { BrandService } from './catalog/application/brand-service'
export { MeterModelService } from './catalog/application/meter-model-service'
export { DeviceService as CatalogDeviceService } from './catalog/application/device-service'
export { AcquisitionService } from './acquisition/acquisition-service'
export { TelemetryService } from './telemetry/application/telemetry-service'
