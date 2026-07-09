import { describe, expect, it, beforeEach } from 'vitest'
import { AuthService, InvalidCredentialsError, InactiveUserError, WeakPasswordError } from './auth-service'
import { AuthSession } from '../domain/auth-session'
import type { UserRepository, RoleRepository, CreateUserInput } from '../ports/user-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { User, Role } from '../domain/user'

// ---------------------------------------------------------------------------
// Fake adapters
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: 'alice',
  passwordHash: 'hashed:correct',
  displayName: 'Alice',
  roleId: 10,
  isActive: true,
  mustChangePassword: false,
  createdAt: 1_000_000,
  updatedAt: 1_000_000,
  ...overrides,
})

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 10,
  name: 'admin',
  description: null,
  isSystem: true,
  ...overrides,
})

class FakeUserRepository implements UserRepository {
  private store: User[] = []

  seed(user: User): void {
    this.store.push(user)
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.store.find((u) => u.username === username) ?? null
  }

  async findById(id: number): Promise<User | null> {
    return this.store.find((u) => u.id === id) ?? null
  }

  async findAll(): Promise<User[]> {
    return [...this.store]
  }

  async create(_input: CreateUserInput): Promise<User> {
    throw new Error('not implemented in this test')
  }

  async updatePasswordHash(userId: number, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    const user = this.store.find((u) => u.id === userId)
    if (user !== undefined) {
      user.passwordHash = passwordHash
      user.mustChangePassword = mustChangePassword
    }
  }

  async updateRole(_userId: number, _roleId: number): Promise<void> {
    // not needed for auth-service tests
  }
}

class FakeRoleRepository implements RoleRepository {
  private roles: Role[] = []
  private permMap = new Map<number, string[]>()

  seed(role: Role, permCodes: string[] = []): void {
    this.roles.push(role)
    this.permMap.set(role.id, permCodes)
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

  async getPermissionCodes(roleId: number): Promise<string[]> {
    return this.permMap.get(roleId) ?? []
  }
}

class FakeHasher implements PasswordHasher {
  // Password → stored hash is "hashed:<password>"
  async hash(password: string): Promise<string> {
    return `hashed:${password}`
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    return hashedPassword === `hashed:${password}`
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let users: FakeUserRepository
  let roles: FakeRoleRepository
  let hasher: FakeHasher
  let session: AuthSession
  let service: AuthService

  beforeEach(() => {
    users = new FakeUserRepository()
    roles = new FakeRoleRepository()
    hasher = new FakeHasher()
    session = new AuthSession()
    service = new AuthService(users, roles, hasher, session)
  })

  describe('login', () => {
    it('returns session user on valid credentials', async () => {
      const user = makeUser({ passwordHash: 'hashed:correct' })
      const role = makeRole({ id: 10, name: 'admin' })
      users.seed(user)
      roles.seed(role, ['users.manage', 'devices.view'])

      const result = await service.login('alice', 'correct')

      expect(result.username).toBe('alice')
      expect(result.roleName).toBe('admin')
      expect(result.permissionCodes).toEqual(['users.manage', 'devices.view'])
    })

    it('sets session on successful login', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:secret' }))
      roles.seed(makeRole())

      await service.login('alice', 'secret')

      expect(session.isLoggedIn()).toBe(true)
      expect(session.current?.username).toBe('alice')
    })

    it('throws InvalidCredentialsError when user is not found', async () => {
      await expect(service.login('nobody', 'pass')).rejects.toThrow(InvalidCredentialsError)
    })

    it('throws InvalidCredentialsError when password is wrong', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:correct' }))
      roles.seed(makeRole())

      await expect(service.login('alice', 'wrong')).rejects.toThrow(InvalidCredentialsError)
    })

    it('throws InactiveUserError when user is deactivated', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:pass', isActive: false }))
      roles.seed(makeRole())

      await expect(service.login('alice', 'pass')).rejects.toThrow(InactiveUserError)
    })

    it('preserves mustChangePassword flag in session', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:pass', mustChangePassword: true }))
      roles.seed(makeRole())

      const user = await service.login('alice', 'pass')

      expect(user.mustChangePassword).toBe(true)
      expect(session.current?.mustChangePassword).toBe(true)
    })
  })

  describe('logout', () => {
    it('clears the session', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:pass' }))
      roles.seed(makeRole())
      await service.login('alice', 'pass')

      service.logout()

      expect(session.isLoggedIn()).toBe(false)
      expect(session.current).toBeNull()
    })
  })

  describe('getSession', () => {
    it('returns null when not logged in', () => {
      expect(service.getSession()).toBeNull()
    })

    it('returns session user when logged in', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:pass' }))
      roles.seed(makeRole())
      await service.login('alice', 'pass')

      const sessionUser = service.getSession()
      expect(sessionUser?.username).toBe('alice')
    })
  })

  describe('changePassword', () => {
    it('updates password hash and clears mustChangePassword', async () => {
      const user = makeUser({ passwordHash: 'hashed:oldpass', mustChangePassword: true })
      users.seed(user)
      roles.seed(makeRole())
      await service.login('alice', 'oldpass')

      await service.changePassword(1, 'oldpass', 'newpass12')

      const updated = await users.findById(1)
      expect(updated?.passwordHash).toBe('hashed:newpass12')
      expect(updated?.mustChangePassword).toBe(false)
    })

    it('updates session mustChangePassword flag after change', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:oldpass', mustChangePassword: true }))
      roles.seed(makeRole())
      await service.login('alice', 'oldpass')

      await service.changePassword(1, 'oldpass', 'newpass12')

      expect(session.current?.mustChangePassword).toBe(false)
    })

    it('throws WeakPasswordError when new password is too short', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:oldpass' }))

      await expect(service.changePassword(1, 'oldpass', 'short')).rejects.toThrow(WeakPasswordError)
    })

    it('throws InvalidCredentialsError when current password is wrong', async () => {
      users.seed(makeUser({ passwordHash: 'hashed:oldpass' }))

      await expect(service.changePassword(1, 'wrongpass', 'newpass12')).rejects.toThrow(InvalidCredentialsError)
    })

    it('throws InvalidCredentialsError when user does not exist', async () => {
      await expect(service.changePassword(999, 'oldpass', 'newpass12')).rejects.toThrow(InvalidCredentialsError)
    })
  })
})
