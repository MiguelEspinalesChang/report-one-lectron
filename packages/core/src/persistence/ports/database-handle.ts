/**
 * Port: the persistence handle the domain sees.
 * Framework-free by design — no drizzle, no better-sqlite3 imports here.
 * The concrete adapter type (SqliteAppDatabase) carries the drizzle instance
 * and raw connection for internal wiring; future repositories are adapters
 * and receive the typed db via constructor injection, never through this port.
 */
export interface AppDatabaseHandle {
  /** Run pending migrations against this database. */
  runMigrations(): void
  /** Close the underlying database connection cleanly. */
  close(): void
}
