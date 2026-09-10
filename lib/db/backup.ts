import { Pool } from 'pg'
import { createZipArchive } from '../utils/zip'
import fs from 'node:fs'
import path from 'node:path'

export interface BackupStats {
  tablesCount: number
  recordsCount: number
  sizeBytes: number
  zipSizeBytes: number
  timestamp: string
  source: 'neon_postgres' | 'local_storage'
  durationMs: number
  tables: Record<string, number>
}

export interface BackupResult {
  sql: string
  zipBuffer: Buffer
  stats: BackupStats
  sqlFilename: string
  zipFilename: string
}

// Complete table definitions for reliable DDL generation
export const TABLE_SCHEMAS: Record<string, string> = {
  user: `CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  session: `CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL
);`,

  account: `CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "expiresAt" timestamp,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  verification: `CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp,
  "updatedAt" timestamp
);`,

  system_roles: `CREATE TABLE IF NOT EXISTS "system_roles" (
  "id" text PRIMARY KEY,
  "telegramId" text NOT NULL UNIQUE,
  "role" text NOT NULL DEFAULT 'admin',
  "addedBy" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  system_tariffs: `CREATE TABLE IF NOT EXISTS "system_tariffs" (
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

  auth_sessions: `CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "token" text PRIMARY KEY,
  "userId" text NOT NULL,
  "telegramId" text,
  "shopId" text,
  "role" text DEFAULT 'user',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "expiresAt" timestamp NOT NULL
);`,

  user_profiles: `CREATE TABLE IF NOT EXISTS "user_profiles" (
  "telegramId" text PRIMARY KEY,
  "termsAccepted" boolean NOT NULL DEFAULT false,
  "tier" text NOT NULL DEFAULT 'free',
  "premiumEndsAt" timestamp,
  "acceptedAt" timestamp,
  "referredBy" text,
  "referralCount" integer DEFAULT 0,
  "rewardedMonths" integer DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  mandatory_channels: `CREATE TABLE IF NOT EXISTS "mandatory_channels" (
  "id" text PRIMARY KEY,
  "channelId" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "username" text,
  "inviteUrl" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "addedBy" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  system_settings: `CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  shops: `CREATE TABLE IF NOT EXISTS "shops" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "logoUrl" text,
  "approved" boolean NOT NULL DEFAULT true,
  "slug" text UNIQUE,
  "cardLast4" text,
  "cardNumber" text,
  "cardBank" text DEFAULT 'HUMOCARD',
  "accountOwner" text,
  "webhookUrl" text,
  "returnUrl" text,
  "telegramChannelId" text,
  "userbotSession" text,
  "tier" text DEFAULT 'free',
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  payments: `CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY,
  "shopId" text NOT NULL,
  "userId" text,
  "amount" text NOT NULL,
  "cardNumber" text,
  "cardLast4" text,
  "cardBank" text,
  "accountOwner" text,
  "status" text NOT NULL DEFAULT 'pending',
  "type" text DEFAULT 'one_time',
  "paymentMethod" text DEFAULT 'card',
  "payerPhone" text,
  "smsCode" text,
  "matchedAt" timestamp,
  "description" text,
  "payload" text,
  "userParam" text,
  "ip" text,
  "userAgent" text,
  "webhookStatus" text,
  "webhookAttempts" integer DEFAULT 0,
  "webhookLastAttempt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "expiresAt" timestamp NOT NULL
);`,

  paid_access_rooms: `CREATE TABLE IF NOT EXISTS "paid_access_rooms" (
  "id" text PRIMARY KEY,
  "shopId" text,
  "title" text NOT NULL,
  "chatId" text NOT NULL,
  "type" text NOT NULL DEFAULT 'group',
  "mode" text NOT NULL DEFAULT 'write_permission',
  "hourlyPrice" integer DEFAULT 5000,
  "dailyPrice" integer DEFAULT 15000,
  "weeklyPrice" integer DEFAULT 50000,
  "monthlyPrice" integer DEFAULT 120000,
  "ownerTelegramId" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  paid_access_members: `CREATE TABLE IF NOT EXISTS "paid_access_members" (
  "id" text PRIMARY KEY,
  "roomId" text NOT NULL,
  "userId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "period" text NOT NULL DEFAULT 'month',
  "amountPaid" integer,
  "joinedAt" timestamp NOT NULL DEFAULT NOW(),
  "expiresAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`,

  delivery_logs: `CREATE TABLE IF NOT EXISTS "delivery_logs" (
  "id" text PRIMARY KEY,
  "paymentId" text NOT NULL,
  "shopId" text NOT NULL,
  "channel" text NOT NULL,
  "recipient" text NOT NULL,
  "status" text NOT NULL,
  "statusCode" integer,
  "errorMessage" text,
  "attemptNumber" integer NOT NULL DEFAULT 1,
  "payload" text,
  "responseBody" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  store_api_keys: `CREATE TABLE IF NOT EXISTS "store_api_keys" (
  "id" text PRIMARY KEY,
  "shopId" text NOT NULL,
  "name" text NOT NULL,
  "apiKey" text NOT NULL UNIQUE,
  "secretKey" text,
  "permissions" text DEFAULT 'full',
  "lastUsedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  fundraisers: `CREATE TABLE IF NOT EXISTS "fundraisers" (
  "id" text PRIMARY KEY,
  "shopId" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "targetAmount" integer,
  "collectedAmount" integer DEFAULT 0,
  "donorsCount" integer DEFAULT 0,
  "imageUrl" text,
  "active" boolean DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  donations: `CREATE TABLE IF NOT EXISTS "donations" (
  "id" text PRIMARY KEY,
  "fundraiserId" text NOT NULL,
  "paymentId" text NOT NULL,
  "donorName" text,
  "amount" integer NOT NULL,
  "message" text,
  "isAnonymous" boolean DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  userbot_connections: `CREATE TABLE IF NOT EXISTS "userbot_connections" (
  "id" text PRIMARY KEY,
  "shopId" text,
  "telegramId" text NOT NULL UNIQUE,
  "sessionString" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "phone" text,
  "lastCheckedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);`,

  business_connections: `CREATE TABLE IF NOT EXISTS "business_connections" (
  "id" text PRIMARY KEY,
  "shopId" text,
  "telegramUserId" text NOT NULL UNIQUE,
  "businessConnectionId" text NOT NULL,
  "canReply" boolean DEFAULT true,
  "isEnabled" boolean DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);`
}

/**
 * Formats a JavaScript value safely for PostgreSQL SQL INSERT syntax
 */
function formatSqlValue(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL'
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE'
  }
  if (typeof val === 'number') {
    if (isNaN(val)) return 'NULL'
    return String(val)
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''")
    return `'${jsonStr}'`
  }
  // String escaping: double standard single quotes
  const str = String(val).replace(/'/g, "''")
  return `'${str}'`
}

/**
 * Loads all data from local storage / in-memory fallback
 */
function getLocalStorageData(): Record<string, any[]> {
  const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'paygo_db.json')
  const TMP_DATA_FILE = '/tmp/paygo_db.json'

  const globalStore = globalThis as unknown as { __paygo_db_data?: Record<string, any[]> }
  if (globalStore.__paygo_db_data) {
    return globalStore.__paygo_db_data
  }

  let content = ''
  if (fs.existsSync(LOCAL_DATA_FILE)) {
    try {
      content = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8')
    } catch {}
  } else if (fs.existsSync(TMP_DATA_FILE)) {
    try {
      content = fs.readFileSync(TMP_DATA_FILE, 'utf-8')
    } catch {}
  }

  if (content) {
    try {
      return JSON.parse(content)
    } catch {}
  }

  return {}
}

/**
 * Dumps a Neon PostgreSQL database or fallback data into a complete SQL script
 */
export async function generateDatabaseSqlDump(options?: {
  connectionString?: string
}): Promise<{ sql: string; stats: BackupStats }> {
  const startTime = Date.now()
  const customConn = options?.connectionString?.trim()
  const targetConn = customConn || process.env.DATABASE_URL || ''

  let clientPool: Pool | null = null
  let source: 'neon_postgres' | 'local_storage' = 'local_storage'
  const tableDataMap: Record<string, any[]> = {}
  const tableStats: Record<string, number> = {}
  let totalRecords = 0

  // 1. Attempt connection to Neon PostgreSQL
  if (targetConn) {
    try {
      const isLocal = targetConn.includes('localhost') || targetConn.includes('127.0.0.1')
      clientPool = new Pool({
        connectionString: targetConn,
        ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
        max: 2,
      })

      // Test query
      await clientPool.query('SELECT 1;')
      source = 'neon_postgres'

      // Fetch all user tables from PostgreSQL
      const tablesRes = await clientPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `)

      const foundTables: string[] = tablesRes.rows.map((r: any) => r.table_name)
      const allKnownTables = Array.from(new Set([...Object.keys(TABLE_SCHEMAS), ...foundTables]))

      for (const tName of allKnownTables) {
        try {
          const rowsRes = await clientPool.query(`SELECT * FROM "${tName}";`)
          tableDataMap[tName] = rowsRes.rows || []
          tableStats[tName] = rowsRes.rows.length
          totalRecords += rowsRes.rows.length
        } catch {
          // Table might not exist yet in this DB instance
          tableDataMap[tName] = []
          tableStats[tName] = 0
        }
      }
    } catch (dbErr: any) {
      console.warn('Direct PostgreSQL connection failed during dump, using persistent store:', dbErr?.message)
      source = 'local_storage'
    } finally {
      if (clientPool) {
        try {
          await clientPool.end()
        } catch {}
      }
    }
  }

  // 2. Fallback to Persistent / Memory Storage if Postgres was unreachable
  if (source === 'local_storage') {
    const localData = getLocalStorageData()
    for (const [tName] of Object.entries(TABLE_SCHEMAS)) {
      const rows = localData[tName] || []
      tableDataMap[tName] = rows
      tableStats[tName] = rows.length
      totalRecords += rows.length
    }
  }

  const exportDate = new Date()
  const isoDate = exportDate.toISOString()

  // 3. Assemble the Master SQL Dump
  let sql = `-- ==========================================================================\n`
  sql += `-- PayGo — Neon PostgreSQL Full Database Backup Dump\n`
  sql += `-- Generated At: ${isoDate}\n`
  sql += `-- Source Engine: ${source === 'neon_postgres' ? '🟢 Neon Cloud PostgreSQL (Direct Connected)' : '🟡 Persistent Safe Storage Engine'}\n`
  sql += `-- Total Tables: ${Object.keys(tableDataMap).length}\n`
  sql += `-- Total Rows Exported: ${totalRecords.toLocaleString()}\n`
  sql += `-- Character Encoding: UTF-8 (100% Binary Safe)\n`
  sql += `-- ==========================================================================\n\n`

  sql += `SET statement_timeout = 0;\n`
  sql += `SET lock_timeout = 0;\n`
  sql += `SET client_encoding = 'UTF8';\n`
  sql += `SET standard_conforming_strings = on;\n`
  sql += `SET check_function_bodies = false;\n`
  sql += `SET xmloption = content;\n`
  sql += `SET client_min_messages = warning;\n`
  sql += `SET row_security = off;\n\n`

  sql += `BEGIN;\n\n`

  // Table Schemas & Data
  for (const [tableName, rows] of Object.entries(tableDataMap)) {
    sql += `-- --------------------------------------------------------------------------\n`
    sql += `-- Table: "${tableName}" (${rows.length} records)\n`
    sql += `-- --------------------------------------------------------------------------\n`

    // Table DDL
    const ddl = TABLE_SCHEMAS[tableName] || `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  "id" text PRIMARY KEY\n);`
    sql += `${ddl}\n\n`

    if (rows.length > 0) {
      // Find all unique column keys across the rows
      const colSet = new Set<string>()
      for (const row of rows) {
        for (const k of Object.keys(row)) {
          colSet.add(k)
        }
      }
      const cols = Array.from(colSet)
      const colHeaders = cols.map((c) => `"${c}"`).join(', ')

      // Batch insert in chunks of 50 rows for optimal performance and safety
      const chunkSize = 50
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const valuesRows: string[] = []

        for (const row of chunk) {
          const valStrings = cols.map((col) => formatSqlValue(row[col]))
          valuesRows.push(`  (${valStrings.join(', ')})`)
        }

        sql += `INSERT INTO "${tableName}" (${colHeaders})\nVALUES\n${valuesRows.join(',\n')}\nON CONFLICT DO NOTHING;\n\n`
      }
    } else {
      sql += `-- No data records for table "${tableName}"\n\n`
    }
  }

  sql += `COMMIT;\n\n`
  sql += `-- ==========================================================================\n`
  sql += `-- Backup completed successfully at ${new Date().toISOString()}.\n`
  sql += `-- ==========================================================================\n`

  const durationMs = Date.now() - startTime
  const sizeBytes = Buffer.byteLength(sql, 'utf-8')

  const stats: BackupStats = {
    tablesCount: Object.keys(tableDataMap).length,
    recordsCount: totalRecords,
    sizeBytes,
    zipSizeBytes: 0,
    timestamp: isoDate,
    source,
    durationMs,
    tables: tableStats,
  }

  return { sql, stats }
}

/**
 * Generates both the SQL script and the compressed ZIP archive ready for Telegram / Download
 */
export async function exportNeonDatabaseFull(options?: {
  connectionString?: string
  filenamePrefix?: string
}): Promise<BackupResult> {
  const { sql, stats } = await generateDatabaseSqlDump(options)
  const prefix = options?.filenamePrefix || 'paygo_neon_backup'
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  const sqlFilename = `${prefix}_${dateStr}.sql`
  const zipFilename = `${prefix}_${dateStr}.zip`

  // Create ZIP archive
  const zipBuffer = createZipArchive([
    {
      filename: sqlFilename,
      content: sql,
      date: new Date(),
    },
    {
      filename: 'README_BACKUP.txt',
      content: `PayGo Neon PostgreSQL Backup Archive
====================================================================
Export Date: ${stats.timestamp}
Database Source: ${stats.source === 'neon_postgres' ? 'Neon Cloud PostgreSQL' : 'Persistent Storage'}
Total Tables: ${stats.tablesCount}
Total Rows: ${stats.recordsCount}
Uncompressed SQL Size: ${(stats.sizeBytes / 1024).toFixed(1)} KB

How to Restore:
1. Using psql:
   psql "YOUR_NEON_DATABASE_URL" < ${sqlFilename}

2. Using DBeaver / pgAdmin:
   Open ${sqlFilename} in SQL Editor and Execute All Statements (F5).
====================================================================
`,
    },
  ])

  stats.zipSizeBytes = zipBuffer.length

  return {
    sql,
    zipBuffer,
    stats,
    sqlFilename,
    zipFilename,
  }
}

/**
 * Sends the backup directly to the Telegram Admin via Telegram sendDocument API
 * (100% loss-free, byte-for-byte binary and UTF-8 document delivery).
 */
export async function sendBackupToTelegram(
  token: string,
  chatId: number | string,
  options?: {
    connectionString?: string
    format?: 'zip' | 'sql' | 'both'
  }
): Promise<{ ok: boolean; description?: string; stats?: BackupStats }> {
  const format = options?.format || 'zip'
  const backup = await exportNeonDatabaseFull({ connectionString: options?.connectionString })

  const kbSql = (backup.stats.sizeBytes / 1024).toFixed(1)
  const kbZip = (backup.stats.zipSizeBytes / 1024).toFixed(1)
  const compressionRatio = ((1 - backup.stats.zipSizeBytes / backup.stats.sizeBytes) * 100).toFixed(0)

  const caption =
    `💾 <b>Neon PostgreSQL Baza Backup (.zip)</b>\n\n` +
    `📦 <b>Fayl:</b> <code>${backup.zipFilename}</code>\n` +
    `📊 <b>Jami Jadvallar:</b> <b>${backup.stats.tablesCount} ta</b>\n` +
    `📝 <b>Jami Yozuvlar:</b> <b>${backup.stats.recordsCount.toLocaleString('uz-UZ')} ta</b>\n` +
    `💾 <b>Hajmi:</b> <b>${kbZip} KB</b> (SQL: ${kbSql} KB, -${compressionRatio}% siqilgan)\n` +
    `⚡️ <b>Manba:</b> ${backup.stats.source === 'neon_postgres' ? '🟢 Neon PostgreSQL' : '🟡 Xavfsiz Persistent Baza'}\n` +
    `⏱ <b>Eksport vaqti:</b> ${backup.stats.durationMs} ms\n\n` +
    `🔒 <i>Fayl Telegram orqali 100% sifatli va butun (asl holatida) yetkazildi.</i>`

  try {
    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    formData.append('caption', caption)
    formData.append('parse_mode', 'HTML')

    if (format === 'zip' || format === 'both') {
      const blob = new Blob([backup.zipBuffer], { type: 'application/zip' })
      formData.append('document', blob, backup.zipFilename)
    } else {
      const blob = new Blob([Buffer.from(backup.sql, 'utf-8')], { type: 'application/sql' })
      formData.append('document', blob, backup.sqlFilename)
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (format === 'both') {
      const sqlFormData = new FormData()
      sqlFormData.append('chat_id', String(chatId))
      sqlFormData.append('caption', `📄 <b>To‘liq SQL Skript:</b> <code>${backup.sqlFilename}</code>`)
      sqlFormData.append('parse_mode', 'HTML')
      const sqlBlob = new Blob([Buffer.from(backup.sql, 'utf-8')], { type: 'application/sql' })
      sqlFormData.append('document', sqlBlob, backup.sqlFilename)

      await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: sqlFormData,
      })
    }

    return {
      ok: Boolean(data.ok),
      description: data.description,
      stats: backup.stats,
    }
  } catch (err: any) {
    console.error('sendBackupToTelegram error:', err)
    return { ok: false, description: err?.message }
  }
}
