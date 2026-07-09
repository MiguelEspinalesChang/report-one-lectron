/**
 * Idempotent seed: inserts system roles, permissions, and the initial admin user.
 * Safe to call on every startup — every insert checks for existence first.
 */
import { and, eq } from 'drizzle-orm'
import { argon2id, hash } from 'argon2'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import { permissions, rolePermissions, roles, users } from '../../persistence/adapters/schema'

interface SeedPermission {
  code: string
  description: string
}

const PERMISSIONS: SeedPermission[] = [
  { code: 'users.manage', description: 'Create, edit, and deactivate users' },
  { code: 'devices.manage', description: 'Add, configure, and remove devices' },
  { code: 'devices.view', description: 'View device list and status' },
  { code: 'telemetry.view', description: 'View telemetry readings and history' },
  { code: 'reports.generate', description: 'Generate PDF/Excel reports' },
  { code: 'reports.view', description: 'View generated reports' },
  { code: 'settings.manage', description: 'Change application settings' },
]

interface SeedRole {
  name: string
  description: string
  isSystem: 1
  permissionCodes: string[]
}

const ROLES: SeedRole[] = [
  {
    name: 'admin',
    description: 'Full access to all features',
    isSystem: 1,
    permissionCodes: PERMISSIONS.map((p) => p.code),
  },
  {
    name: 'operator',
    description: 'Manage and monitor devices',
    isSystem: 1,
    permissionCodes: ['devices.manage', 'devices.view', 'telemetry.view', 'reports.generate', 'reports.view'],
  },
  {
    name: 'viewer',
    description: 'Read-only access to devices and reports',
    isSystem: 1,
    permissionCodes: ['devices.view', 'telemetry.view', 'reports.view'],
  },
]

export async function seedAuthData(db: BetterSQLite3Database<AppSchema>): Promise<void> {
  // Seed permissions
  for (const perm of PERMISSIONS) {
    const existing = db.select().from(permissions).where(eq(permissions.code, perm.code)).get()
    if (existing === undefined) {
      db.insert(permissions).values({ code: perm.code, description: perm.description }).run()
    }
  }

  // Seed roles and their permission mappings
  for (const role of ROLES) {
    let roleRow = db.select().from(roles).where(eq(roles.name, role.name)).get()
    if (roleRow === undefined) {
      const result = db
        .insert(roles)
        .values({ name: role.name, description: role.description, isSystem: role.isSystem })
        .returning()
        .get()
      roleRow = result
    }

    for (const code of role.permissionCodes) {
      const permRow = db.select().from(permissions).where(eq(permissions.code, code)).get()
      if (permRow === undefined) continue

      const linkExists = db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleRow.id), eq(rolePermissions.permissionId, permRow.id)))
        .get()

      if (linkExists === undefined) {
        db.insert(rolePermissions).values({ roleId: roleRow.id, permissionId: permRow.id }).run()
      }
    }
  }

  // Seed initial admin user (only if no admin exists)
  const existingAdmin = db.select().from(users).where(eq(users.username, 'admin')).get()
  if (existingAdmin !== undefined) return

  const adminRole = db.select().from(roles).where(eq(roles.name, 'admin')).get()
  if (adminRole === undefined) return

  const passwordHash = await hash('admin', { type: argon2id })
  const now = Date.now()
  db.insert(users).values({
    username: 'admin',
    passwordHash,
    displayName: 'Administrator',
    roleId: adminRole.id,
    isActive: 1,
    mustChangePassword: 1,
    createdAt: now,
    updatedAt: now,
  }).run()
}
