import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AppSchema } from '../../persistence/adapters/sqlite-database'
import { brands, meterModels } from '../../persistence/adapters/schema'
import type { Brand } from '../domain/entities'
import type { BrandRepository, CreateBrandInput } from '../ports/repositories'

type BrandRow = typeof brands.$inferSelect

function toBrand(row: BrandRow): Brand {
  return { id: row.id, name: row.name }
}

export class DrizzleBrandRepository implements BrandRepository {
  constructor(private readonly db: BetterSQLite3Database<AppSchema>) {}

  async findById(id: number): Promise<Brand | null> {
    const row = this.db.select().from(brands).where(eq(brands.id, id)).get()
    return row !== undefined ? toBrand(row) : null
  }

  async findAll(): Promise<Brand[]> {
    return this.db.select().from(brands).all().map(toBrand)
  }

  async create(input: CreateBrandInput): Promise<Brand> {
    const result = this.db.insert(brands).values({ name: input.name }).returning().get()
    return toBrand(result)
  }

  async rename(id: number, name: string): Promise<void> {
    this.db.update(brands).set({ name }).where(eq(brands.id, id)).run()
  }

  async delete(id: number): Promise<void> {
    this.db.delete(brands).where(eq(brands.id, id)).run()
  }

  async hasModels(id: number): Promise<boolean> {
    const row = this.db.select({ id: meterModels.id }).from(meterModels).where(eq(meterModels.brandId, id)).get()
    return row !== undefined
  }
}
