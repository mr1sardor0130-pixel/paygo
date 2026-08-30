import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })

// Ensure essential schema columns exist on production DB
let columnsEnsured = false
export async function ensureDbSchema() {
  if (columnsEnsured || !process.env.DATABASE_URL) return
  try {
    await pool.query(`
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cardNumber" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "accountOwner" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "userbotSession" text;
    `)
    columnsEnsured = true
  } catch (err) {
    console.warn('Auto schema migration warning:', err)
  }
}
