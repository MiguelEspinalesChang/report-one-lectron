/**
 * Zod schemas for IPC boundary validation.
 * All IPC handlers must parse incoming payloads through these schemas.
 */
import { z } from 'zod'

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const ChangePasswordSchema = z.object({
  userId: z.number().int().positive(),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const CreateUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  displayName: z.string().min(1).max(128),
  roleId: z.number().int().positive(),
  mustChangePassword: z.boolean().optional(),
})

export const AssignRoleSchema = z.object({
  userId: z.number().int().positive(),
  roleId: z.number().int().positive(),
})
