import { argon2id, hash, verify } from 'argon2'
import type { PasswordHasher } from '../ports/password-hasher'

export class Argon2Hasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return hash(password, { type: argon2id })
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await verify(hashedPassword, password)
    } catch {
      return false
    }
  }
}
