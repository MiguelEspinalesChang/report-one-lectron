import type { PublicUser, Role } from '../domain/user'
import { RoleNotFoundError, UserNotFoundError, WeakPasswordError } from '../domain/errors'
import { toPublicUser, validatePasswordPolicy } from '../domain/user'
import type { PasswordHasher } from '../ports/password-hasher'
import type { CreateUserInput, RoleRepository, UserRepository } from '../ports/user-repository'

export { RoleNotFoundError, UserNotFoundError, WeakPasswordError } from '../domain/errors'

export interface CreateUserParams {
  username: string
  password: string
  displayName: string
  roleId: number
  mustChangePassword?: boolean
}

export class UserManagementService {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async createUser(params: CreateUserParams): Promise<PublicUser> {
    if (!validatePasswordPolicy(params.password)) {
      throw new WeakPasswordError()
    }

    const role = await this.roles.findById(params.roleId)
    if (role === null) {
      throw new RoleNotFoundError(params.roleId)
    }

    const passwordHash = await this.hasher.hash(params.password)
    const input: CreateUserInput = {
      username: params.username,
      passwordHash,
      displayName: params.displayName,
      roleId: params.roleId,
      mustChangePassword: params.mustChangePassword ?? false,
    }

    const created = await this.users.create(input)
    // Strip credential material: this result crosses the IPC boundary.
    return toPublicUser(created)
  }

  async listUsers(): Promise<PublicUser[]> {
    const all = await this.users.findAll()
    return all.map(toPublicUser)
  }

  async listRoles(): Promise<Role[]> {
    return this.roles.findAll()
  }

  /**
   * Assigns a role and returns the updated user so callers can refresh their
   * view without fabricating fields (e.g. `updatedAt`) on the renderer side.
   */
  async assignRole(userId: number, roleId: number): Promise<PublicUser> {
    const role = await this.roles.findById(roleId)
    if (role === null) {
      throw new RoleNotFoundError(roleId)
    }
    await this.users.updateRole(userId, roleId)

    const updated = await this.users.findById(userId)
    if (updated === null) {
      throw new UserNotFoundError(userId)
    }
    return toPublicUser(updated)
  }
}
