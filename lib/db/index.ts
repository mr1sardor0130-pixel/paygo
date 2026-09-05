import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { PGlite } from '@electric-sql/pglite'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || ''
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

let rawPool: Pool | null = null
let pgliteInstance: PGlite | null = null

if (connectionString) {
  rawPool = new Pool({
    connectionString,
    ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 15000,
    max: 10,
  })
  rawPool.on('error', (err) => {
    console.warn('Postgres pool background error:', err.message || err)
  })
}

function getPglite(): PGlite {
  if (!pgliteInstance) {
    pgliteInstance = new PGlite('/tmp/paygo_pglite')
  }
  return pgliteInstance
}

export const pool = {
  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    if (rawPool) {
      try {
        const res = await rawPool.query(text, params)
        return { rows: res.rows || [], rowCount: res.rowCount || 0 }
      } catch (err: any) {
        console.warn('Postgres rawPool query failed, routing to PGlite:', err?.message)
      }
    }
    const client = getPglite()
    const res = await client.query(text, params)
    return { rows: res.rows || [], rowCount: res.rows?.length || 0 }
  },
}

export const db: any = connectionString && rawPool
  ? drizzlePg(rawPool, { schema })
  : drizzlePglite(getPglite(), { schema })

// Ensure essential schema columns exist on production DB
let columnsEnsured = false
export async function ensureDbSchema() {
  if (columnsEnsured) return

  const queries = [
    `CREATE TABLE IF NOT EXISTS "shops" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "logoUrl" text,
      "approved" boolean NOT NULL DEFAULT true,
      "slug" text NOT NULL UNIQUE,
      "cardLast4" text NOT NULL DEFAULT '3587',
      "cardNumber" text NOT NULL DEFAULT '9860350123453587',
      "cardBank" text DEFAULT 'HUMOCARD',
      "accountOwner" text DEFAULT 'Hisob egasi',
      "webhookUrl" text,
      "returnUrl" text,
      "telegramChannelId" text,
      "userbotSession" text,
      "tier" text NOT NULL DEFAULT 'free',
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "description" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "logoUrl" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "approved" boolean DEFAULT true;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cardNumber" text DEFAULT '9860350123453587';`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cardBank" text DEFAULT 'HUMOCARD';`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "accountOwner" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "webhookUrl" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "returnUrl" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "telegramChannelId" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "userbotSession" text;`,
    `ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free';`,

    `CREATE TABLE IF NOT EXISTS "payments" (
      "id" text PRIMARY KEY,
      "shopId" text NOT NULL,
      "userId" text NOT NULL,
      "amount" integer NOT NULL,
      "currency" text NOT NULL DEFAULT 'UZS',
      "multiplier" integer NOT NULL DEFAULT 1,
      "status" text NOT NULL DEFAULT 'pending',
      "isTest" boolean DEFAULT false,
      "returnUrl" text,
      "webhookUrl" text,
      "expiresAt" timestamp NOT NULL,
      "matchedAt" timestamp,
      "sourceMessage" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isTest" boolean DEFAULT false;`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "returnUrl" text;`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "webhookUrl" text;`,
    `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "sourceMessage" text;`,

    `CREATE TABLE IF NOT EXISTS "auth_sessions" (
      "token" text PRIMARY KEY,
      "userId" text NOT NULL,
      "telegramId" text,
      "shopId" text,
      "role" text DEFAULT 'user',
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "expiresAt" timestamp NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "user_profiles" (
      "telegramId" text PRIMARY KEY,
      "termsAccepted" boolean NOT NULL DEFAULT false,
      "tier" text DEFAULT 'free',
      "premiumEndsAt" timestamp,
      "acceptedAt" timestamp,
      "referredBy" text,
      "referralCount" integer DEFAULT 0,
      "rewardedDays" integer DEFAULT 0,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free';`,
    `ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "premiumEndsAt" timestamp;`,
    `ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "referredBy" text;`,
    `ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "referralCount" integer DEFAULT 0;`,
    `ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "rewardedDays" integer DEFAULT 0;`,

    `CREATE TABLE IF NOT EXISTS "system_roles" (
      "id" text PRIMARY KEY,
      "telegramId" text NOT NULL,
      "role" text NOT NULL DEFAULT 'admin',
      "addedBy" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS "system_tariffs" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "description" text,
      "features" text,
      "price" integer NOT NULL,
      "period" text NOT NULL DEFAULT 'month',
      "cardNumber" text NOT NULL DEFAULT '9860350123453587',
      "cardOwner" text NOT NULL DEFAULT 'AZizbek I',
      "cardBank" text DEFAULT 'HUMOCARD',
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "features" text;`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardNumber" text DEFAULT '9860166655238557';`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardOwner" text DEFAULT 'Sardor Tuyginov';`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardBank" text DEFAULT 'HUMOCARD';`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "period" text DEFAULT 'month';`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "description" text;`,
    `ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT NOW();`,

    `CREATE TABLE IF NOT EXISTS "system_settings" (
      "key" text PRIMARY KEY,
      "value" text NOT NULL,
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS "mandatory_channels" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "channelId" text NOT NULL,
      "inviteUrl" text NOT NULL,
      "type" text NOT NULL DEFAULT 'channel',
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS "paid_access_rooms" (
      "id" text PRIMARY KEY,
      "shopId" text,
      "title" text NOT NULL,
      "chatId" text NOT NULL,
      "type" text NOT NULL DEFAULT 'group',
      "mode" text NOT NULL DEFAULT 'write_permission',
      "hourlyPrice" integer NOT NULL DEFAULT 5000,
      "dailyPrice" integer NOT NULL DEFAULT 15000,
      "weeklyPrice" integer NOT NULL DEFAULT 50000,
      "monthlyPrice" integer NOT NULL DEFAULT 120000,
      "currency" text NOT NULL DEFAULT 'UZS',
      "active" boolean NOT NULL DEFAULT true,
      "welcomeMessage" text,
      "ownerTelegramId" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS "paid_access_members" (
      "id" text PRIMARY KEY,
      "roomId" text NOT NULL,
      "userId" text NOT NULL,
      "username" text,
      "fullName" text,
      "plan" text NOT NULL DEFAULT 'month',
      "amountPaid" integer NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'active',
      "startsAt" timestamp NOT NULL DEFAULT NOW(),
      "expiresAt" timestamp NOT NULL,
      "paymentId" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS "delivery_logs" (
      "id" text PRIMARY KEY,
      "paymentId" text NOT NULL,
      "target" text NOT NULL,
      "status" text NOT NULL,
      "response" text,
      "createdAt" timestamp NOT NULL DEFAULT NOW()
    );`
  ]

  for (const q of queries) {
    try {
      await pool.query(q)
    } catch (err) {
      console.warn('DB schema statement warning:', err)
    }
  }
  columnsEnsured = true
}

