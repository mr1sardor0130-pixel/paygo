import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || ''
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: connectionString && !isLocal ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 7000,
  idleTimeoutMillis: 15000,
  max: 10,
})

pool.on('error', (err) => {
  console.warn('Postgres pool background error:', err.message || err)
})

export const db = drizzle(pool, { schema })

// Ensure essential schema columns exist on production DB
let columnsEnsured = false
export async function ensureDbSchema() {
  if (!process.env.DATABASE_URL) return
  if (columnsEnsured) return
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
        "features" text,
        "price" integer NOT NULL,
        "period" text NOT NULL DEFAULT 'month',
        "cardNumber" text NOT NULL DEFAULT '9860350123453587',
        "cardOwner" text NOT NULL DEFAULT 'AZizbek I',
        "cardBank" text DEFAULT 'HUMOCARD',
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );

      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "features" text;
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardNumber" text DEFAULT '9860350123453587';
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardOwner" text DEFAULT 'AZizbek I';
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "cardBank" text DEFAULT 'HUMOCARD';
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "period" text DEFAULT 'month';
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "description" text;
      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "mandatory_channels" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "channelId" text NOT NULL,
        "inviteUrl" text NOT NULL,
        "type" text NOT NULL DEFAULT 'channel',
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "fundraisers" (
        "id" text PRIMARY KEY,
        "shopId" text NOT NULL,
        "userId" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "goalAmount" integer NOT NULL DEFAULT 0,
        "collectedAmount" integer NOT NULL DEFAULT 0,
        "donorCount" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "donations" (
        "id" text PRIMARY KEY,
        "fundraiserId" text NOT NULL,
        "donorTempId" text NOT NULL,
        "donorName" text NOT NULL,
        "amount" integer NOT NULL,
        "comment" text,
        "status" text NOT NULL DEFAULT 'pending',
        "paymentId" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "paid_access_rooms" (
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
      );

      CREATE TABLE IF NOT EXISTS "paid_access_members" (
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
      );

      ALTER TABLE "system_tariffs" ADD COLUMN IF NOT EXISTS "features" text;

      -- CYBER SECURITY RULES:
      -- 1. Remove all unauthorized auto-grant, auto-maintenance, and self-granted admins
      DELETE FROM "system_roles"
      WHERE "telegramId" != '8021115446'
        AND ("addedBy" IN ('auto-grant', 'auto-maintenance', 'self') OR "addedBy" IS NULL);

      -- 2. Downgrade any unauthorized superadmin to regular 'admin'
      UPDATE "system_roles"
      SET "role" = 'admin'
      WHERE "telegramId" != '8021115446' AND "role" = 'superadmin';

      -- 3. Ensure root superadmin 8021115446 is strictly superadmin
      INSERT INTO "system_roles" ("id", "telegramId", "role", "addedBy")
      VALUES ('superadmin-8021115446', '8021115446', 'superadmin', 'system')
      ON CONFLICT ("telegramId") DO UPDATE SET "role" = 'superadmin', "addedBy" = 'system';

      -- Seed default tariffs if table empty
      INSERT INTO "system_tariffs" ("id", "name", "description", "features", "price", "period", "cardNumber", "cardOwner", "cardBank", "active")
      VALUES 
        ('tariff-daily', 'Kunlik Sinov', '1 kunlik sinov, avto-to‘lov va monitoring', '["⚡️ @humocardbot orqali 1 soniyada avto-to‘lov", "🏪 3 tagacha do‘kon ochish", "🔗 Har bir do‘kon uchun alohida Webhook & Kanal", "👥 1 ta VIP Guruh (Pullik yozish / kirish)", "🎁 1 ta Donate / Ehson yig‘ish kampaniyasi", "0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga", "📄 PDF cheklar generatsiyasi"]', 5000, 'kun', '9860350123453587', 'AZizbek I', 'HUMOCARD', true),
        ('tariff-weekly', 'Haftalik Standart', '7 kunlik biznes va faol savdo imkoniyati', '["⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)", "🏪 10 tagacha mustaqil do‘konlar", "🔗 Har bir do‘kon uchun maxsus Webhook & Kanal", "👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)", "🎁 Cheksiz Donate & Xayriya yig‘ish havolalari", "0% komissiya va 24/7 avtomatik monitoring", "📄 QR-kodli rasmiy PDF kvitansiyalar", "🛠 Dasturchilar uchun REST API & SDK"]', 25000, 'hafta', '9860350123453587', 'AZizbek I', 'HUMOCARD', true),
        ('tariff-monthly', 'Oylik VIP (Cheksiz)', '30 kunlik to‘liq cheksiz imkoniyatlar to‘plami', '["⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)", "🏪 CHEKSIZ do‘konlar yaratish va ulash", "🔗 Har bir do‘konga individual Webhook & Kanal", "👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi", "🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari", "💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash", "0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga", "📄 Brendlangan PDF cheklar va to‘lov tahlillari", "🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash"]', 79000, 'oy', '9860350123453587', 'AZizbek I', 'HUMOCARD', true)
      ON CONFLICT ("id") DO UPDATE SET
        "features" = EXCLUDED."features",
        "description" = EXCLUDED."description"
      WHERE "system_tariffs"."features" IS NULL;
    `)
    columnsEnsured = true
  } catch (err) {
    console.warn('Auto schema migration warning:', err)
  }
}

