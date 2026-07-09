import { describe, expect, it, beforeEach } from 'vitest'
import { UserManagementService, WeakPasswordError, RoleNotFoundError } from './user-management-service'
import type { UserRepository, RoleRepository, CreateUserInput } from '../ports/user-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { User, Role } from '../domain/user'

// ---------------------------------------------------------------------------
// Fake adapters
// ---------------------------------------------------------------------------

class FakeUserRepository implements UserRepository {
  private store: User[] = []
  private nextId = 1

  async findByUsername(username: string): Promise<User | null> {
    return this.store.find((u) => u.username === username) ?? null
  }

  async findById(id: number): Promise<User | null> {
    return this.store.find((u) => u.id === id) ?? null
  }

  async findAll(): Promise<User[]> {
    return [...this.store]
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = Date.now()
    const user: User = {
      id: this.nextId++,
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      roleId: input.roleId,
      isActive: true,
      mustChangePassword: input.mustChangePassword ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.store.push(user)
    return user
  }

  async updatePasswordHash(_userId: number, _hash: string, _mustChange: boolean): Promise<void> {
    // not needed
  }

  async updateRole(userId: number, roleId: number): Promise<void> {
    const user = this.store.find((u) => u.id === userId)
    if (user !== undefined) {
      user.roleId = roleId
    }
  }

  seed(user: User): void {
    this.store.push(user)
  }
}

class FakeRoleRepository implements RoleRepository {
  private roles: Role[] = []

  seed(role: Role): void {
    this.roles.push(role)
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roles.find((r) => r.name === name) ?? null
  }

  async findById(id: number): Promise<Role | null> {
    return this.roles.find((r) => r.id === id) ?? null
  }

  async findAll(): Promise<Role[]> {
    return [...this.roles]
  }

  async getPermissionCodes(_roleId: number): Promise<string[]> {
    return []
  }
}

class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    return hashedPassword === `hashed:${password}`
  }
}

const adminRole: Role = { id: 1, name: 'admin', description: null, isSystem: true }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserManagementService', () => {
  let usersRepo: FakeUserRepository
  let rolesRepo: FakeRoleRepository
  let hasher: FakeHasher
  let service: UserManagementService

  beforeEach(() => {
    usersRepo = new FakeUserRepository()
    rolesRepo = new FakeRoleRepository()
    hasher = new FakeHasher()
    service = new UserManagementService(usersRepo, rolesRepo, hasher)
  })

  describe('createUser', () => {
    it('creates user with hashed password', async () => {
      rolesRepo.seed(adminRole)

      const user = await service.createUser({
        username: 'bob',
        password: 'password123',
        displayName: 'Bob',
        roleId: 1,
      })

      expect(user.username).toBe('bob')
      expect(user.roleId).toBe(1)
      expect(user.mustChangePassword).toBe(false)
      // The stored user carries the hash; the RETURNED shape must not —
      // this result crosses the IPC boundary.
      expect(user).not.toHaveProperty('passwordHash')
      const stored = await usersRepo.findByUsername('bob')
      expect(stored?.passwordHash).toBe('hashed:password123')
    })

    it('respects mustChangePassword flag', async () => {
      rolesRepo.seed(adminRole)

      const user = await service.createUser({
        username: 'carol',
        password: 'password123',
        displayName: 'Carol',
        roleId: 1,
        mustChangePassword: true,
      })

      expect(user.mustChangePassword).toBe(true)
    })

    it('throws WeakPasswordError when password is too short', async () => {
      rolesRepo.seed(adminRole)

      await expect(
        service.createUser({ username: 'dave', password: 'short', displayName: 'Dave', roleId: 1 }),
      ).rejects.toThrow(WeakPasswordError)
    })

    it('throws RoleNotFoundError when role does not exist', async () => {
      await expect(
        service.createUser({ username: 'eve', password: 'password123', displayName: 'Eve', roleId: 999 }),
      ).rejects.toThrow(RoleNotFoundError)
    })
  })

  describe('listUsers', () => {
    it('returns empty array when no users', async () => {
      const result = await service.listUsers()
      expect(result).toEqual([])
    })

    it('returns all users', async () => {
      rolesRepo.seed(adminRole)
      await service.createUser({ username: 'alice', password: 'password123', displayName: 'Alice', roleId: 1 })
      await service.createUser({ username: 'bob', password: 'password456', displayName: 'Bob', roleId: 1 })

      const result = await service.listUsers()
      expect(result).toHaveLength(2)
    })
  })

  describe('assignRole', () => {
    it('assigns role to user', async () => {
      rolesRepo.seed(adminRole)
      const viewerRole: Role = { id: 2, name: 'viewer', description: null, isSystem: true }
      rolesRepo.seed(viewerRole)

      const user = await service.createUser({
        username: 'frank',
        password: 'password123',
        displayName: 'Frank',
        roleId: 1,
      })

      await service.assignRole(user.id, 2)

      const updated = await usersRepo.findById(user.id)
      expect(updated?.roleId).toBe(2)
    })

    it('throws RoleNotFoundError when target role does not exist', async () => {
      await expect(service.assignRole(1, 999)).rejects.toThrow(RoleNotFoundError)
    })
  })
})
