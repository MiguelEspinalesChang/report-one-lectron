/**
 * Drizzle schema for app.db.
 * Phase 0: baseline table only. Phase 1: auth tables (users, roles, permissions).
 * Phase 2: catalog tables (brands, meter_models, devices).
 */
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

/**
 * Metadata table used to track the schema version.
 * Follows the same pattern as telemetry.db (ARCHITECTURE.md §6).
 */
export const schemaMeta = sqliteTable('schema_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'number' }).notNull().default(0),
})

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description'),
})

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  /** Case-insensitive unique username. COLLATE NOCASE enforced via migration SQL. */
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  isActive: integer('is_active', { mode: 'number' }).notNull().default(1),
  mustChangePassword: integer('must_change_password', { mode: 'number' }).notNull().default(0),
  /** Epoch milliseconds. */
  createdAt: integer('created_at').notNull(),
  /** Epoch milliseconds. */
  updatedAt: integer('updated_at').notNull(),
})

// ---------------------------------------------------------------------------
// Catalog tables (Phase 2)
// ---------------------------------------------------------------------------

export const brands = sqliteTable('brands', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
})

export const meterModels = sqliteTable(
  'meter_models',
  {
    id: integer('id').primaryKey(),
    brandId: integer('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    /** JSON: validated RegisterMap */
    registerMap: text('register_map').notNull(),
    notes: text('notes'),
  },
  (table) => [unique().on(table.brandId, table.name)],
)

export const devices = sqliteTable('devices', {
  id: integer('id').primaryKey(),
  modelId: integer('model_id')
    .notNull()
    .references(() => meterModels.id),
  name: text('name').notNull().unique(),
  /** 'serial' | 'tcp' | 'simulated' */
  transport: text('transport').notNull(),
  /** JSON: discriminated by transport */
  connection: text('connection').notNull(),
  slaveId: integer('slave_id').notNull().default(1),
  pollingIntervalS: integer('polling_interval_s').notNull().default(900),
  enabled: integer('enabled', { mode: 'number' }).notNull().default(1),
  /** Epoch milliseconds. */
  createdAt: integer('created_at').notNull(),
  /** Epoch milliseconds. */
  updatedAt: integer('updated_at').notNull(),
})
