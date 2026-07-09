import { PASSWORD_MIN_LENGTH } from './user'

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export class InactiveUserError extends Error {
  constructor() {
    super('Account is inactive')
    this.name = 'InactiveUserError'
  }
}

export class WeakPasswordError extends Error {
  constructor() {
    super(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    this.name = 'WeakPasswordError'
  }
}

export class RoleNotFoundError extends Error {
  constructor(roleId: number) {
    super(`Role not found: ${roleId}`)
    this.name = 'RoleNotFoundError'
  }
}
