import type { Role, User } from '../domain/user'

export interface CreateUserInput {
  username: string
  passwordHash: string
  displayName: string
  roleId: number
  mustChangePassword?: boolean
}

export interface UserRepository {
  findByUsername(username: string): Promise<User | null>
  findById(id: number): Promise<User | null>
  findAll(): Promise<User[]>
  create(input: CreateUserInput): Promise<User>
  updatePasswordHash(userId: number, passwordHash: string, mustChangePassword: boolean): Promise<void>
  updateRole(userId: number, roleId: number): Promise<void>
}

export interface RoleRepository {
  findByName(name: string): Promise<Role | null>
  findById(id: number): Promise<Role | null>
  findAll(): Promise<Role[]>
  getPermissionCodes(roleId: number): Promise<string[]>
}
