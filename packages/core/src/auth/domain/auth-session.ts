/**
 * In-memory session holder for the current logged-in user.
 * Cleared on logout. No sessions table — session dies with the process.
 */

export interface SessionUser {
  id: number
  username: string
  displayName: string
  roleId: number
  roleName: string
  mustChangePassword: boolean
  permissionCodes: string[]
}

export class AuthSession {
  private _current: SessionUser | null = null

  get current(): SessionUser | null {
    return this._current
  }

  set(user: SessionUser): void {
    this._current = user
  }

  clear(): void {
    this._current = null
  }

  isLoggedIn(): boolean {
    return this._current !== null
  }

  hasPermission(code: string): boolean {
    return this._current?.permissionCodes.includes(code) ?? false
  }
}
