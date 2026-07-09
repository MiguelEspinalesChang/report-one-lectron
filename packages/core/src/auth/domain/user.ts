/**
 * Auth domain entities. Pure types — no framework imports.
 */

export interface User {
  id: number
  username: string
  passwordHash: string
  displayName: string
  roleId: number
  isActive: boolean
  mustChangePassword: boolean
  /** Epoch milliseconds. */
  createdAt: number
  /** Epoch milliseconds. */
  updatedAt: number
}

/**
 * User without credential material — the ONLY user shape allowed to cross
 * process boundaries (IPC). Never return `User` from a use case that feeds
 * an IPC handler: `passwordHash` must not reach the renderer.
 */
export type PublicUser = Omit<User, 'passwordHash'>

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roleId: user.roleId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export interface Role {
  id: number
  name: string
  description: string | null
  isSystem: boolean
}

export interface Permission {
  id: number
  code: string
  description: string | null
}

/** Minimum password length enforced by policy. */
export const PASSWORD_MIN_LENGTH = 8

export function validatePasswordPolicy(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
}
