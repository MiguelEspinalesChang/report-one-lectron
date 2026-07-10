/**
 * Zod schemas for IPC boundary validation.
 * All IPC handlers must parse incoming payloads through these schemas.
 */
import { z } from 'zod'

/**
 * Boundary contract for the password policy. Core enforces the same minimum
 * in its domain (PASSWORD_MIN_LENGTH in auth/domain); the UI pre-validates
 * with this constant for UX only — core remains the authority.
 */
export const PASSWORD_MIN_LENGTH = 8

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const ChangePasswordSchema = z.object({
  userId: z.number().int().positive(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
})

export const CreateUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  displayName: z.string().min(1).max(128),
  roleId: z.number().int().positive(),
  mustChangePassword: z.boolean().optional(),
})

export const AssignRoleSchema = z.object({
  userId: z.number().int().positive(),
  roleId: z.number().int().positive(),
})
