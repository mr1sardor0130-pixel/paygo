import { headers } from 'next/headers'
import { db, ensureDbSchema } from '@/lib/db'
import { systemRoles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_SUPERADMIN_ID = process.env.ADMIN_TELEGRAM_ID ?? '8021115446'

export async function isAdminTelegramId(telegramId: string | number | null | undefined): Promise<boolean> {
  if (!telegramId) return false
  const idStr = String(telegramId).trim()
  if (idStr === DEFAULT_SUPERADMIN_ID) return true

  try {
    await ensureDbSchema()
    const rows = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, idStr)).limit(1)
    return rows.length > 0
  } catch (err) {
    console.warn('isAdmin check error:', err)
    return idStr === DEFAULT_SUPERADMIN_ID
  }
}

export async function isSuperAdminTelegramId(telegramId: string | number | null | undefined): Promise<boolean> {
  if (!telegramId) return false
  const idStr = String(telegramId).trim()
  if (idStr === DEFAULT_SUPERADMIN_ID) return true

  try {
    await ensureDbSchema()
    const rows = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, idStr)).limit(1)
    return rows[0]?.role === 'superadmin'
  } catch {
    return idStr === DEFAULT_SUPERADMIN_ID
  }
}

export async function requireAdminTelegramId(telegramId: string | number | null | undefined) {
  if (!(await isAdminTelegramId(telegramId))) {
    throw new Error('Forbidden')
  }
}

export async function getAdminIdentity() {
  const requestHeaders = await headers()
  return requestHeaders.get('x-telegram-user-id')
}

