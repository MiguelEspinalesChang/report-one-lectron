import type { AuthSession, SessionUser } from '../domain/auth-session'
import {
  InactiveUserError,
  InvalidCredentialsError,
  WeakPasswordError,
} from '../domain/errors'
import { validatePasswordPolicy } from '../domain/user'
import type { PasswordHasher } from '../ports/password-hasher'
import type { RoleRepository, UserRepository } from '../ports/user-repository'

export { InactiveUserError, InvalidCredentialsError, WeakPasswordError } from '../domain/errors'

/**
 * Pre-computed, VALID argon2id hash of a throwaway string. Used to equalize
 * timing when the username does not exist: the dummy verify must run the full
 * argon2 computation. A malformed hash string would make verify() throw and
 * short-circuit in microseconds, reintroducing the timing oracle.
 */
const TIMING_EQUALIZER_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$YufikN9oMV2Goe46Z+uRbA$VkzkOICDChiVozrXHD6DeZrnXk6U0Ew3RW5WCJ1+VV8'

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: AuthSession,
  ) {}

  async login(username: string, password: string): Promise<SessionUser> {
    const user = await this.users.findByUsername(username)

    if (user === null) {
      // Run a real verify against a valid dummy hash to prevent timing attacks
      await this.hasher.verify(password, TIMING_EQUALIZER_HASH)
      throw new InvalidCredentialsError()
    }

    const valid = await this.hasher.verify(password, user.passwordHash)
    if (!valid) {
      throw new InvalidCredentialsError()
    }

    // Deliberate ordering: the inactive state is only revealed AFTER the
    // password verified — so only someone who already holds the correct
    // credentials (i.e. the legitimate user) learns the account is disabled.
    // Wrong credentials on an inactive account still get the generic error.
    if (!user.isActive) {
      throw new InactiveUserError()
    }

    const role = await this.roles.findById(user.roleId)
    if (role === null) {
      throw new InvalidCredentialsError()
    }

    const permissionCodes = await this.roles.getPermissionCodes(user.roleId)

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roleId: user.roleId,
      roleName: role.name,
      mustChangePassword: user.mustChangePassword,
      permissionCodes,
    }

    this.session.set(sessionUser)
    return sessionUser
  }

  logout(): void {
    this.session.clear()
  }

  getSession(): SessionUser | null {
    return this.session.current
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    if (!validatePasswordPolicy(newPassword)) {
      throw new WeakPasswordError()
    }

    const user = await this.users.findById(userId)
    if (user === null) {
      throw new InvalidCredentialsError()
    }

    const valid = await this.hasher.verify(currentPassword, user.passwordHash)
    if (!valid) {
      throw new InvalidCredentialsError()
    }

    const newHash = await this.hasher.hash(newPassword)
    await this.users.updatePasswordHash(userId, newHash, false)

    // Update the in-memory session if it's the current user
    if (this.session.current?.id === userId) {
      const current = this.session.current
      this.session.set({ ...current, mustChangePassword: false })
    }
  }
}
