/**
 * Integration tests: real SQLite DB, real argon2, real migrations + seed.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  asSqliteAppDatabase,
  createAppDatabase,
  type SqliteAppDatabase,
} from '../../persistence/adapters/sqlite-database'
import { AuthSession } from '../domain/auth-session'
import { AuthService, InactiveUserError, InvalidCredentialsError } from '../application/auth-service'
import { UserManagementService } from '../application/user-management-service'
import { DrizzleUserRepository } from './drizzle-user-repository'
import { DrizzleRoleRepository } from './drizzle-role-repository'
import { Argon2Hasher } from './argon2-hasher'
import { seedAuthData } from './seed'

describe('auth integration', () => {
  let tmpDir: string
  let database: SqliteAppDatabase
  let service: AuthService
  let userManagement: UserManagementService
  let userRepo: DrizzleUserRepository
  let roleRepo: DrizzleRoleRepository

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-integration-'))
    database = asSqliteAppDatabase(createAppDatabase({ filePath: path.join(tmpDir, 'app.db') }))
    database.runMigrations()
    await seedAuthData(database.db)

    userRepo = new DrizzleUserRepository(database.db)
    roleRepo = new DrizzleRoleRepository(database.db)
    const hasher = new Argon2Hasher()
    const session = new AuthSession()
    service = new AuthService(userRepo, roleRepo, hasher, session)
    userManagement = new UserManagementService(userRepo, roleRepo, hasher, session)
  })

  afterEach(() => {
    database.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('admin user exists after seed', async () => {
    const user = await service.login('admin', 'admin')
    expect(user.username).toBe('admin')
    expect(user.roleName).toBe('admin')
  })

  it('admin must change password flag is set', async () => {
    const user = await service.login('admin', 'admin')
    expect(user.mustChangePassword).toBe(true)
  })

  it('admin has all permission codes', async () => {
    const user = await service.login('admin', 'admin')
    const expectedCodes = [
      'users.manage',
      'devices.manage',
      'devices.view',
      'telemetry.view',
      'reports.generate',
      'reports.view',
      'settings.manage',
    ]
    for (const code of expectedCodes) {
      expect(user.permissionCodes).toContain(code)
    }
  })

  it('login is case-insensitive for username', async () => {
    // COLLATE NOCASE on username column means ADMIN == admin
    const user = await service.login('ADMIN', 'admin')
    expect(user.username).toBe('admin')
  })

  it('throws InvalidCredentialsError on wrong password', async () => {
    await expect(service.login('admin', 'wrongpassword')).rejects.toThrow(InvalidCredentialsError)
  })

  it('throws InvalidCredentialsError for unknown user', async () => {
    await expect(service.login('ghost', 'password')).rejects.toThrow(InvalidCredentialsError)
  })

  it('seed is idempotent — re-running does not duplicate admin', async () => {
    // Run seed a second time
    await seedAuthData(database.db)

    // Login should still work (not broken by duplicate)
    const user = await service.login('admin', 'admin')
    expect(user.username).toBe('admin')
  })

  it('permission codes resolve through role_permissions join', async () => {
    const user = await service.login('admin', 'admin')
    // Must be an array (not empty)
    expect(user.permissionCodes.length).toBeGreaterThan(0)
    // Must contain devices.view
    expect(user.permissionCodes).toContain('devices.view')
  })

  it('throws InactiveUserError when a deactivated user logs in with correct credentials', async () => {
    const admin = await userRepo.findByUsername('admin')
    if (admin === null) throw new Error('seed admin user missing')

    await userRepo.setActive(admin.id, false)

    await expect(service.login('admin', 'admin')).rejects.toThrow(InactiveUserError)
  })

  it('resetting an operator password forces mustChangePassword and invalidates the old password', async () => {
    const operatorRole = await roleRepo.findByName('operator')
    if (operatorRole === null) throw new Error('seed operator role missing')

    const created = await userManagement.createUser({
      username: 'operator1',
      password: 'originalpass',
      displayName: 'Operator One',
      roleId: operatorRole.id,
    })

    const reset = await userManagement.resetPassword(created.id, 'temporarypass')
    expect(reset.mustChangePassword).toBe(true)

    const loggedIn = await service.login('operator1', 'temporarypass')
    expect(loggedIn.mustChangePassword).toBe(true)

    await expect(service.login('operator1', 'originalpass')).rejects.toThrow(InvalidCredentialsError)
  })
})
