import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asSqliteAppDatabase, createAppDatabase, type SqliteAppDatabase } from './adapters/sqlite-database'

describe('createAppDatabase (integration)', () => {
  let tmpDir: string
  let handle: SqliteAppDatabase

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-core-test-'))
  })

  afterEach(() => {
    handle.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('opens the db, applies WAL mode and busy_timeout', () => {
    handle = asSqliteAppDatabase(createAppDatabase({ filePath: path.join(tmpDir, 'app.db') }))

    // journal_mode must be WAL after opening
    const journalMode = handle.connection.pragma('journal_mode', { simple: true })
    expect(journalMode).toBe('wal')

    // busy_timeout must be set (non-zero)
    const busyTimeout = handle.connection.pragma('busy_timeout', { simple: true })
    expect(Number(busyTimeout)).toBeGreaterThan(0)
  })

  it('runs migrations and creates schema_meta table', () => {
    handle = asSqliteAppDatabase(createAppDatabase({ filePath: path.join(tmpDir, 'app.db') }))
    handle.runMigrations()

    // The drizzle migrator creates __drizzle_migrations to track applied migrations.
    const migrationTable = handle.connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
      )
      .get() as { name: string } | undefined

    expect(migrationTable).toBeDefined()
    expect(migrationTable?.name).toBe('__drizzle_migrations')

    // The baseline schema_meta table must exist.
    const schemaMetaTable = handle.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'")
      .get() as { name: string } | undefined

    expect(schemaMetaTable).toBeDefined()
    expect(schemaMetaTable?.name).toBe('schema_meta')
  })

  it('accepts a custom busyTimeoutMs', () => {
    handle = asSqliteAppDatabase(
      createAppDatabase({
        filePath: path.join(tmpDir, 'custom.db'),
        busyTimeoutMs: 3_000,
      }),
    )

    const busyTimeout = handle.connection.pragma('busy_timeout', { simple: true })
    expect(Number(busyTimeout)).toBe(3_000)
  })

  it('accepts an in-memory db path for quick unit checks', () => {
    handle = asSqliteAppDatabase(createAppDatabase({ filePath: ':memory:' }))
    handle.runMigrations()

    const journalMode = handle.connection.pragma('journal_mode', { simple: true })
    // WAL is silently ignored on :memory: — SQLite falls back to 'memory' mode.
    // We just verify it does not throw.
    expect(['wal', 'memory']).toContain(journalMode)
  })
})
