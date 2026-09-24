import { describe, expect, it, beforeEach } from 'vitest'
import {
  UserManagementService,
  WeakPasswordError,
  RoleNotFoundError,
  UserNotFoundError,
  CannotDeactivateSelfError,
  CannotResetAdminPasswordError,
  NotAuthenticatedError,
  PermissionDeniedError,
} from './user-management-service'
import type { UserRepository, RoleRepository, CreateUserInput } from '../ports/user-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { User, Role } from '../domain/user'
import { AuthSession, type SessionUser } from '../domain/auth-session'

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

  async updatePasswordHash(userId: number, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    const user = this.store.find((u) => u.id === userId)
    if (user !== undefined) {
      user.passwordHash = passwordHash
      user.mustChangePassword = mustChangePassword
    }
  }

  async updateRole(userId: number, roleId: number): Promise<void> {
    const user = this.store.find((u) => u.id === userId)
    if (user !== undefined) {
      user.roleId = roleId
    }
  }

  async setActive(userId: number, isActive: boolean): Promise<void> {
    const user = this.store.find((u) => u.id === userId)
    if (user !== undefined) {
      user.isActive = isActive
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

const adminSessionUser: SessionUser = {
  id: 100,
  username: 'admin',
  displayName: 'Admin',
  roleId: adminRole.id,
  roleName: adminRole.name,
  mustChangePassword: false,
  permissionCodes: ['users.manage'],
}

const viewerSessionUser: SessionUser = {
  id: 101,
  username: 'viewer',
  displayName: 'Viewer',
  roleId: 3,
  roleName: 'viewer',
  mustChangePassword: false,
  permissionCodes: ['devices.view'],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserManagementService', () => {
  let usersRepo: FakeUserRepository
  let rolesRepo: FakeRoleRepository
  let hasher: FakeHasher
  let session: AuthSession
  let service: UserManagementService

  beforeEach(() => {
    usersRepo = new FakeUserRepository()
    rolesRepo = new FakeRoleRepository()
    hasher = new FakeHasher()
    session = new AuthSession()
    service = new UserManagementService(usersRepo, rolesRepo, hasher, session)
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
    it('assigns role to user and returns the updated user', async () => {
      rolesRepo.seed(adminRole)
      const viewerRole: Role = { id: 2, name: 'viewer', description: null, isSystem: true }
      rolesRepo.seed(viewerRole)

      const user = await service.createUser({
        username: 'frank',
        password: 'password123',
        displayName: 'Frank',
        roleId: 1,
      })

      const returned = await service.assignRole(user.id, 2)

      expect(returned.roleId).toBe(2)
      expect(returned).not.toHaveProperty('passwordHash')

      const updated = await usersRepo.findById(user.id)
      expect(updated?.roleId).toBe(2)
    })

    it('throws RoleNotFoundError when target role does not exist', async () => {
      await expect(service.assignRole(1, 999)).rejects.toThrow(RoleNotFoundError)
    })

    it('throws UserNotFoundError when the user does not exist', async () => {
      rolesRepo.seed(adminRole)

      await expect(service.assignRole(999, 1)).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('setActive', () => {
    beforeEach(() => {
      session.set(adminSessionUser)
    })

    it('throws NotAuthenticatedError when there is no active session', async () => {
      rolesRepo.seed(adminRole)
      const target = await service.createUser({
        username: 'noauth',
        password: 'password123',
        displayName: 'No Auth',
        roleId: 1,
      })
      session.clear()

      await expect(service.setActive(target.id, false)).rejects.toThrow(NotAuthenticatedError)

      const stored = await usersRepo.findById(target.id)
      expect(stored?.isActive).toBe(true)
    })

    it('throws PermissionDeniedError when the session lacks users.manage', async () => {
      rolesRepo.seed(adminRole)
      const target = await service.createUser({
        username: 'noperm',
        password: 'password123',
        displayName: 'No Perm',
        roleId: 1,
      })
      session.set(viewerSessionUser)

      await expect(service.setActive(target.id, false)).rejects.toThrow(PermissionDeniedError)

      const stored = await usersRepo.findById(target.id)
      expect(stored?.isActive).toBe(true)
    })

    it('deactivates another user and returns the updated user', async () => {
      rolesRepo.seed(adminRole)
      const target = await service.createUser({
        username: 'gina',
        password: 'password123',
        displayName: 'Gina',
        roleId: 1,
      })

      const returned = await service.setActive(target.id, false)

      expect(returned.isActive).toBe(false)
      const stored = await usersRepo.findById(target.id)
      expect(stored?.isActive).toBe(false)
    })

    it('reactivates a previously deactivated user', async () => {
      rolesRepo.seed(adminRole)
      const target = await service.createUser({
        username: 'harold',
        password: 'password123',
        displayName: 'Harold',
        roleId: 1,
      })
      await service.setActive(target.id, false)

      const returned = await service.setActive(target.id, true)

      expect(returned.isActive).toBe(true)
      const stored = await usersRepo.findById(target.id)
      expect(stored?.isActive).toBe(true)
    })

    it('throws CannotDeactivateSelfError when deactivating the current session user', async () => {
      rolesRepo.seed(adminRole)
      const self = await service.createUser({
        username: 'ivan',
        password: 'password123',
        displayName: 'Ivan',
        roleId: 1,
      })
      session.set({
        id: self.id,
        username: self.username,
        displayName: self.displayName,
        roleId: self.roleId,
        roleName: adminRole.name,
        mustChangePassword: false,
        permissionCodes: ['users.manage'],
      })

      await expect(service.setActive(self.id, false)).rejects.toThrow(CannotDeactivateSelfError)

      const stored = await usersRepo.findById(self.id)
      expect(stored?.isActive).toBe(true)
    })

    it('throws UserNotFoundError when the user does not exist', async () => {
      await expect(service.setActive(999, false)).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('resetPassword', () => {
    const operatorRole: Role = { id: 2, name: 'operator', description: null, isSystem: true }
    const viewerRole: Role = { id: 3, name: 'viewer', description: null, isSystem: true }

    beforeEach(() => {
      session.set(adminSessionUser)
    })

    it('throws NotAuthenticatedError when there is no active session', async () => {
      rolesRepo.seed(adminRole)
      rolesRepo.seed(operatorRole)
      const target = await service.createUser({
        username: 'noauth2',
        password: 'password123',
        displayName: 'No Auth',
        roleId: operatorRole.id,
      })
      session.clear()

      await expect(service.resetPassword(target.id, 'newpassword1')).rejects.toThrow(NotAuthenticatedError)

      const stored = await usersRepo.findById(target.id)
      expect(stored?.passwordHash).toBe('hashed:password123')
    })

    it('throws PermissionDeniedError when the session lacks users.manage', async () => {
      rolesRepo.seed(adminRole)
      rolesRepo.seed(operatorRole)
      const target = await service.createUser({
        username: 'noperm2',
        password: 'password123',
        displayName: 'No Perm',
        roleId: operatorRole.id,
      })
      session.set(viewerSessionUser)

      await expect(service.resetPassword(target.id, 'newpassword1')).rejects.toThrow(PermissionDeniedError)

      const stored = await usersRepo.findById(target.id)
      expect(stored?.passwordHash).toBe('hashed:password123')
    })

    it('resets an operator password and forces a change on next login', async () => {
      rolesRepo.seed(adminRole)
      rolesRepo.seed(operatorRole)
      const target = await service.createUser({
        username: 'oscar',
        password: 'password123',
        displayName: 'Oscar',
        roleId: operatorRole.id,
      })

      const returned = await service.resetPassword(target.id, 'newpassword1')

      expect(returned.mustChangePassword).toBe(true)
      const stored = await usersRepo.findById(target.id)
      expect(stored?.passwordHash).toBe('hashed:newpassword1')
      expect(stored?.mustChangePassword).toBe(true)
    })

    it('resets a viewer password and forces a change on next login', async () => {
      rolesRepo.seed(adminRole)
      rolesRepo.seed(viewerRole)
      const target = await service.createUser({
        username: 'vicky',
        password: 'password123',
        displayName: 'Vicky',
        roleId: viewerRole.id,
      })

      const returned = await service.resetPassword(target.id, 'newpassword1')

      expect(returned.mustChangePassword).toBe(true)
      const stored = await usersRepo.findById(target.id)
      expect(stored?.passwordHash).toBe('hashed:newpassword1')
    })

    it('throws CannotResetAdminPasswordError when the target is an admin', async () => {
      rolesRepo.seed(adminRole)
      const target = await service.createUser({
        username: 'walter',
        password: 'password123',
        displayName: 'Walter',
        roleId: adminRole.id,
      })

      await expect(service.resetPassword(target.id, 'newpassword1')).rejects.toThrow(
        CannotResetAdminPasswordError,
      )

      const stored = await usersRepo.findById(target.id)
      expect(stored?.passwordHash).toBe('hashed:password123')
      expect(stored?.mustChangePassword).toBe(false)
    })

    it('throws WeakPasswordError when the new password is too short', async () => {
      rolesRepo.seed(adminRole)
      rolesRepo.seed(operatorRole)
      const target = await service.createUser({
        username: 'xena',
        password: 'password123',
        displayName: 'Xena',
        roleId: operatorRole.id,
      })

      await expect(service.resetPassword(target.id, 'short')).rejects.toThrow(WeakPasswordError)
    })

    it('throws UserNotFoundError when the user does not exist', async () => {
      await expect(service.resetPassword(999, 'newpassword1')).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('listRoles', () => {
    it('returns all seeded roles', async () => {
      rolesRepo.seed(adminRole)
      const viewerRole: Role = { id: 2, name: 'viewer', description: null, isSystem: true }
      rolesRepo.seed(viewerRole)

      const result = await service.listRoles()

      expect(result).toEqual([adminRole, viewerRole])
    })

    it('returns empty array when no roles are seeded', async () => {
      const result = await service.listRoles()
      expect(result).toEqual([])
    })
  })
})
