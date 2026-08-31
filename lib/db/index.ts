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
      CREATE TABLE IF NOT EXISTS "shops" (
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
        "telegramChannelId" text,
        "userbotSession" text,
        "tier" text NOT NULL DEFAULT 'free',
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "payments" (
        "id" text PRIMARY KEY,
        "shopId" text NOT NULL,
        "userId" text NOT NULL,
        "amount" integer NOT NULL,
        "currency" text NOT NULL DEFAULT 'UZS',
        "multiplier" integer NOT NULL DEFAULT 1,
        "status" text NOT NULL DEFAULT 'pending',
        "expiresAt" timestamp NOT NULL,
        "matchedAt" timestamp,
        "sourceMessage" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "delivery_logs" (
        "id" text PRIMARY KEY,
        "paymentId" text NOT NULL,
        "target" text NOT NULL,
        "status" text NOT NULL,
        "response" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cardNumber" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "cardBank" text DEFAULT 'HUMOCARD';
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "accountOwner" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "logoUrl" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "webhookUrl" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "telegramChannelId" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "userbotSession" text;
      ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free';
      
      ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN DEFAULT false;
      
      CREATE TABLE IF NOT EXISTS "auth_sessions" (
        "token" text PRIMARY KEY,
        "userId" text NOT NULL,
        "telegramId" text,
        "shopId" text,
        "role" text DEFAULT 'user',
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "expiresAt" timestamp NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "user_profiles" (
        "telegramId" text PRIMARY KEY,
        "termsAccepted" boolean NOT NULL DEFAULT false,
        "tier" text DEFAULT 'free',
        "premiumEndsAt" timestamp,
        "acceptedAt" timestamp,
        "referredBy" text,
        "referralCount" integer DEFAULT 0,
        "rewardedDays" integer DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );
      
      ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free';
      ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "premiumEndsAt" timestamp;
      ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "referredBy" text;
      ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "referralCount" integer DEFAULT 0;
      ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "rewardedDays" integer DEFAULT 0;

      CREATE TABLE IF NOT EXISTS "userbot_connections" (
        "id" text PRIMARY KEY,
        "shopId" text NOT NULL,
        "userId" text NOT NULL,
        "sessionString" text NOT NULL,
        "chatId" text,
        "status" text NOT NULL DEFAULT 'active',
        "lastEventAt" timestamp,
        "error" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "system_roles" (
        "id" text PRIMARY KEY,
        "telegramId" text NOT NULL UNIQUE,
        "role" text NOT NULL DEFAULT 'admin',
        "addedBy" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "system_tariffs" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "description" text,
        "price" integer NOT NULL,
        "period" text NOT NULL DEFAULT 'month',
        "cardNumber" text NOT NULL DEFAULT '9860350123453587',
        "cardOwner" text NOT NULL DEFAULT 'AZizbek I',
        "cardBank" text DEFAULT 'HUMOCARD',
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );

      -- Ensure default superadmin 8021115446 exists
      INSERT INTO "system_roles" ("id", "telegramId", "role", "addedBy")
      VALUES ('superadmin-8021115446', '8021115446', 'superadmin', 'system')
      ON CONFLICT ("telegramId") DO NOTHING;

      -- Seed default tariffs if table empty
      INSERT INTO "system_tariffs" ("id", "name", "description", "price", "period", "cardNumber", "cardOwner", "cardBank", "active")
      VALUES 
        ('tariff-daily', 'Kunlik', '1 kunlik sinov va faol monitoring', 1000, 'day', '9860350123453587', 'AZizbek I', 'HUMOCARD', true),
        ('tariff-weekly', 'Haftalik', '7 kunlik do‘kon integratsiyasi', 6500, 'week', '9860350123453587', 'AZizbek I', 'HUMOCARD', true),
        ('tariff-monthly', 'Oylik VIP', '30 kunlik to‘liq cheksiz imkoniyat', 27858, 'month', '9860350123453587', 'AZizbek I', 'HUMOCARD', true)
      ON CONFLICT ("id") DO NOTHING;
    `)
    columnsEnsured = true
  } catch (err) {
    console.warn('Auto schema migration warning:', err)
  }
}

