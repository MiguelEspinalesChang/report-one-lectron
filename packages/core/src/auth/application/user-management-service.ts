import type { PublicUser, Role } from '../domain/user'
import {
  CannotDeactivateSelfError,
  CannotResetAdminPasswordError,
  NotAuthenticatedError,
  PermissionDeniedError,
  RoleNotFoundError,
  UserNotFoundError,
  WeakPasswordError,
} from '../domain/errors'
import { toPublicUser, validatePasswordPolicy } from '../domain/user'
import type { AuthSession, SessionUser } from '../domain/auth-session'
import type { PasswordHasher } from '../ports/password-hasher'
import type { CreateUserInput, RoleRepository, UserRepository } from '../ports/user-repository'

export {
  CannotDeactivateSelfError,
  CannotResetAdminPasswordError,
  NotAuthenticatedError,
  PermissionDeniedError,
  RoleNotFoundError,
  UserNotFoundError,
  WeakPasswordError,
} from '../domain/errors'

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
    private readonly session: AuthSession,
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

  /**
   * Requires an active session holding `code`. Throws `NotAuthenticatedError`
   * when nobody is logged in, `PermissionDeniedError` when the session lacks
   * the permission. Returns the session user so callers can reuse it.
   */
  private requirePermission(code: string): SessionUser {
    const current = this.session.current
    if (current === null) {
      throw new NotAuthenticatedError()
    }
    if (!current.permissionCodes.includes(code)) {
      throw new PermissionDeniedError(code)
    }
    return current
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

  /**
   * Reversible toggle — an admin can also reactivate a user they (or someone
   * else) deactivated earlier. Deactivating the currently logged-in session's
   * own account is rejected: it would lock out the only signed-in admin with
   * no way to reverse it.
   */
  async setActive(userId: number, isActive: boolean): Promise<PublicUser> {
    const currentUser = this.requirePermission('users.manage')

    if (!isActive && currentUser.id === userId) {
      throw new CannotDeactivateSelfError()
    }

    const user = await this.users.findById(userId)
    if (user === null) {
      throw new UserNotFoundError(userId)
    }

    await this.users.setActive(userId, isActive)

    const updated = await this.users.findById(userId)
    if (updated === null) {
      throw new UserNotFoundError(userId)
    }
    return toPublicUser(updated)
  }

  /**
   * Admin-issued temporary password. Reuses `updatePasswordHash` (the same
   * repository write `AuthService.changePassword` uses) with
   * `mustChangePassword = true`, so the target is forced to set their own
   * password on next login. Rejects admin targets: an admin's password is
   * never reset by another admin, only changed by the admin themself.
   */
  async resetPassword(userId: number, newPassword: string): Promise<PublicUser> {
    this.requirePermission('users.manage')

    if (!validatePasswordPolicy(newPassword)) {
      throw new WeakPasswordError()
    }

    const user = await this.users.findById(userId)
    if (user === null) {
      throw new UserNotFoundError(userId)
    }

    const role = await this.roles.findById(user.roleId)
    if (role?.name === 'admin') {
      throw new CannotResetAdminPasswordError()
    }

    const newHash = await this.hasher.hash(newPassword)
    await this.users.updatePasswordHash(userId, newHash, true)

    const updated = await this.users.findById(userId)
    if (updated === null) {
      throw new UserNotFoundError(userId)
    }
    return toPublicUser(updated)
  }
}
