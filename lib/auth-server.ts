import { db, ensureDbSchema } from '@/lib/db'
import { authSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

export interface AuthenticatedUser {
  userId: string
  telegramId: string
  role: string
  shopId?: string | null
}

/**
 * Generates a fresh, secure dynamic alphanumeric session token for a user.
 */
export async function createAuthSession(userId: string, role: string = 'user', expireDays: number = 7): Promise<string> {
  await ensureDbSchema()
  const cleanId = userId.toString().trim()
  const randomHex = randomUUID().replace(/-/g, '')
  const token = `auth_${randomHex}`
  const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)

  try {
    await db.insert(authSessions).values({
      token,
      userId: cleanId,
      telegramId: cleanId,
      role,
      expiresAt,
    })
  } catch (err) {
    console.error('Failed to create auth session:', err)
  }

  return token
}

/**
 * Verifies bearer token against auth_sessions table.
 * Strictly returns user details if token is valid and not expired.
 * Never trusts unverified request headers or query params.
 */
export async function resolveAuthUser(request: Request): Promise<AuthenticatedUser | null> {
  await ensureDbSchema()
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return null
  }

  try {
    const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
    if (!rows || rows.length === 0) {
      return null
    }

    const session = rows[0]
    if (!session || session.userId === 'pending') {
      return null
    }

    // Check expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null
    }

    return {
      userId: session.userId,
      telegramId: session.telegramId || session.userId,
      role: session.role || 'user',
      shopId: session.shopId,
    }
  } catch (err) {
    console.error('Auth verification error:', err)
    return null
  }
}
