import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import type { Role } from '../domain/user'
import type { RoleRepository } from '../ports/user-repository'
import { permissions, rolePermissions, roles } from '../../persistence/adapters/schema'

type RoleRow = typeof roles.$inferSelect

function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem === 1,
  }
}

export class DrizzleRoleRepository implements RoleRepository {
  constructor(private readonly db: BetterSQLite3Database<AppSchema>) {}

  async findByName(name: string): Promise<Role | null> {
    const row = this.db.select().from(roles).where(eq(roles.name, name)).get()
    return row !== undefined ? toRole(row) : null
  }

  async findById(id: number): Promise<Role | null> {
    const row = this.db.select().from(roles).where(eq(roles.id, id)).get()
    return row !== undefined ? toRole(row) : null
  }

  async findAll(): Promise<Role[]> {
    return this.db.select().from(roles).all().map(toRole)
  }

  async getPermissionCodes(roleId: number): Promise<string[]> {
    const rows = this.db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId))
      .all()
    return rows.map((r) => r.code)
  }
}
