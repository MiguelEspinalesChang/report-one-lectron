import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/persistence/adapters/schema.ts',
  out: '../../database/migrations/app',
})
