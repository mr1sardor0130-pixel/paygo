import { headers } from 'next/headers'
import { db, ensureDbSchema, pool } from '@/lib/db'
import { systemRoles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const DEFAULT_SUPERADMIN_ID = process.env.ADMIN_TELEGRAM_ID ?? '8021115446'

/**
 * STRICT SECURITY: Only the system owner/configured Telegram ID can ever be Super Admin.
 * No user, command, or database record can ever promote another account to Super Admin.
 */
export function isSuperAdminTelegramId(telegramId: string | number | null | undefined): boolean {
  if (!telegramId) return false
  return String(telegramId).trim() === DEFAULT_SUPERADMIN_ID
}

/**
 * Checks if a Telegram ID is an authorized admin.
 * Super Admin is automatically an admin.
 * Other users are only admins if explicitly appointed by Super Admin (role = 'admin').
 * Any self-granted, auto-granted, or unauthorized roles are strictly rejected.
 */
export async function isAdminTelegramId(telegramId: string | number | null | undefined): Promise<boolean> {
  if (!telegramId) return false
  const idStr = String(telegramId).trim()
  if (idStr === DEFAULT_SUPERADMIN_ID) return true

  try {
    await ensureDbSchema()
    const rows = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, idStr)).limit(1)
    if (rows.length === 0) return false

    const roleRow = rows[0]
    // Block any auto-grant or self-appointed roles
    if (roleRow.addedBy && ['auto-grant', 'auto-maintenance', 'self'].includes(roleRow.addedBy)) {
      return false
    }

    return roleRow.role === 'admin'
  } catch (err) {
    console.warn('isAdmin check error:', err)
    return idStr === DEFAULT_SUPERADMIN_ID
  }
}

export async function requireAdminTelegramId(telegramId: string | number | null | undefined) {
  if (!(await isAdminTelegramId(telegramId))) {
    throw new Error('Forbidden')
  }
}

export async function requireSuperAdminTelegramId(telegramId: string | number | null | undefined) {
  if (!isSuperAdminTelegramId(telegramId)) {
    throw new Error('Forbidden: Super Admin access required')
  }
}

export async function getAdminIdentity() {
  const requestHeaders = await headers()
  return requestHeaders.get('x-telegram-user-id')
}

/**
 * Automatically purges any unauthorized or auto-granted roles from the database
 * and ensures that only DEFAULT_SUPERADMIN_ID is superadmin.
 */
export async function cleanBogusAdmins() {
  try {
    await pool.query(`
      DELETE FROM "system_roles" 
      WHERE "telegramId" != '${DEFAULT_SUPERADMIN_ID}' 
        AND ("addedBy" IN ('auto-grant', 'auto-maintenance', 'self') OR "addedBy" IS NULL);
      
      UPDATE "system_roles" 
      SET "role" = 'admin' 
      WHERE "telegramId" != '${DEFAULT_SUPERADMIN_ID}' AND "role" = 'superadmin';

      INSERT INTO "system_roles" ("id", "telegramId", "role", "addedBy")
      VALUES ('superadmin-${DEFAULT_SUPERADMIN_ID}', '${DEFAULT_SUPERADMIN_ID}', 'superadmin', 'system')
      ON CONFLICT ("telegramId") DO UPDATE SET "role" = 'superadmin', "addedBy" = 'system';
    `)
  } catch (err) {
    console.warn('cleanBogusAdmins error:', err)
  }
}


