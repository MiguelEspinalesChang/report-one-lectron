import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import type { User } from '../domain/user'
import type { CreateUserInput, UserRepository } from '../ports/user-repository'
import { users } from '../../persistence/adapters/schema'

type UserRow = typeof users.$inferSelect

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    roleId: row.roleId,
    isActive: row.isActive === 1,
    mustChangePassword: row.mustChangePassword === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: BetterSQLite3Database<AppSchema>) {}

  async findByUsername(username: string): Promise<User | null> {
    const row = this.db.select().from(users).where(eq(users.username, username)).get()
    return row !== undefined ? toUser(row) : null
  }

  async findById(id: number): Promise<User | null> {
    const row = this.db.select().from(users).where(eq(users.id, id)).get()
    return row !== undefined ? toUser(row) : null
  }

  async findAll(): Promise<User[]> {
    return this.db.select().from(users).all().map(toUser)
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = Date.now()
    const result = this.db
      .insert(users)
      .values({
        username: input.username,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        roleId: input.roleId,
        isActive: 1,
        mustChangePassword: (input.mustChangePassword ?? false) ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()
    return toUser(result)
  }

  async updatePasswordHash(userId: number, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: mustChangePassword ? 1 : 0, updatedAt: Date.now() })
      .where(eq(users.id, userId))
      .run()
  }

  async updateRole(userId: number, roleId: number): Promise<void> {
    this.db
      .update(users)
      .set({ roleId, updatedAt: Date.now() })
      .where(eq(users.id, userId))
      .run()
  }
}
