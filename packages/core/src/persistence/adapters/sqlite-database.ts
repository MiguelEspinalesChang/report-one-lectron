/**
 * Adapter: opens app.db with WAL mode + busy_timeout and wires drizzle.
 * This is the ONLY layer in packages/core that imports better-sqlite3 or drizzle.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type BetterSqlite3 from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { AppDatabaseHandle } from '../ports/database-handle'
import * as schema from './schema'

// better-sqlite3 is a CommonJS native module — must be required, not imported.
// Using createRequire keeps the ESM package boundary clean.
// The module uses `export =` so the require'd value IS the DatabaseConstructor.
//
// CJS-safe: when this file is bundled into the Electron main bundle (esbuild,
// format cjs), `import.meta.url` is rewritten to undefined — fall back to the
// CJS `__filename` (the right-hand side is only evaluated in that case, so
// pure ESM runs never reference the undeclared identifier).
const require = createRequire(import.meta.url ?? __filename)
const Database = require('better-sqlite3') as typeof BetterSqlite3

// Migrations live at database/migrations/app/ (ARCHITECTURE.md repo layout §3).
// Path: packages/core/src/persistence/adapters/ → 5 levels up → monorepo root.
// Only resolvable when running from source (vitest / ESM). Bundled callers
// (Electron main, CJS) MUST inject options.migrationsFolder instead.
function defaultMigrationsFolder(): string {
  if (!import.meta.url) {
    throw new Error(
      'Cannot resolve the default migrations folder from a bundled (CJS) build. ' +
        'Pass options.migrationsFolder to createAppDatabase().',
    )
  }
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../../../../../database/migrations/app')
}

export type AppSchema = typeof schema

/**
 * Concrete adapter type returned by createAppDatabase().
 * Extends the framework-free port with the drizzle instance and raw
 * connection needed for internal wiring: future repositories (adapters)
 * receive `db` via constructor injection in the composition root, and
 * integration tests inspect pragmas through `connection`.
 */
export interface SqliteAppDatabase extends AppDatabaseHandle {
  /** Drizzle query builder, typed against the current schema. */
  readonly db: BetterSQLite3Database<AppSchema>
  /** Raw better-sqlite3 connection (pragmas, integration tests). */
  readonly connection: BetterSqlite3.Database
}

/**
 * Adapter narrowing for internal wiring.
 * The composition root (createCore) and integration specs use this to reach
 * the drizzle `db` / raw `connection` from the framework-free port. Throws a
 * descriptive error when the caller passes a handle that is not the sqlite
 * adapter (e.g. a future in-memory test double that does not carry drizzle).
 */
export function asSqliteAppDatabase(handle: AppDatabaseHandle): SqliteAppDatabase {
  if (!('db' in handle) || !('connection' in handle)) {
    throw new Error(
      'createCore() requires a SqliteAppDatabase handle (one that exposes .db and .connection). ' +
        'Pass the value returned by createAppDatabase().',
    )
  }
  return handle as SqliteAppDatabase
}

export interface CreateAppDatabaseOptions {
  /** Absolute path to the SQLite file. Injected by Electron (app.getPath('userData')). */
  filePath: string
  /**
   * Busy timeout in milliseconds.
   * @default 5000
   */
  busyTimeoutMs?: number
  /**
   * Absolute path to the drizzle migrations folder for app.db.
   * Defaults to the monorepo's database/migrations/app when running from
   * source (vitest / ESM). Bundled callers (Electron main) must provide it.
   */
  migrationsFolder?: string
}

/**
 * Opens (or creates) app.db with WAL mode and a busy_timeout, then returns
 * the persistence handle.
 *
 * The DECLARED return type is the framework-free port so the public
 * `@platform/core` surface never emits drizzle/better-sqlite3 types in its
 * `.d.ts`. Internal wiring (createCore, integration specs) narrows to the
 * concrete adapter via asSqliteAppDatabase().
 *
 * Core is a LIBRARY — it does not decide the file path. The caller
 * (Electron main) injects the path via app.getPath('userData').
 */
export function createAppDatabase(options: CreateAppDatabaseOptions): AppDatabaseHandle {
  const { filePath, busyTimeoutMs = 5_000, migrationsFolder } = options

  const connection = new Database(filePath)

  // WAL mode: allows concurrent readers while the writer is active.
  connection.pragma('journal_mode = WAL')
  // busy_timeout: instead of throwing SQLITE_BUSY immediately, wait up to N ms.
  connection.pragma(`busy_timeout = ${busyTimeoutMs}`)

  const db = drizzle(connection, { schema })

  // Built as the concrete adapter (extra properties: db, connection), returned
  // through the framework-free port declared above.
  const handle: SqliteAppDatabase = {
    db,
    connection,
    runMigrations() {
      migrate(db, { migrationsFolder: migrationsFolder ?? defaultMigrationsFolder() })
    },
    close() {
      connection.close()
    },
  }
  return handle
}
