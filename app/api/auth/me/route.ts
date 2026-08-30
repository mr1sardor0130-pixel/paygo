import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { authSessions, shops } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  await ensureDbSchema()
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  const telegramHeader = request.headers.get('x-telegram-user-id') || ''

  if (!token && !telegramHeader) {
    return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
  }

  try {
    let userId = ''
    let telegramId = ''
    let role = 'user'

    if (token) {
      const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
      if (rows.length && rows[0]) {
        const sess = rows[0]
        if (sess.userId !== 'pending') {
          userId = sess.userId
          telegramId = sess.telegramId || sess.userId
          role = sess.role || 'user'
        }
      }
    }

    if (!userId && telegramHeader) {
      userId = telegramHeader
      telegramId = telegramHeader
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Sessiya eskirgan yoki topilmadi' }, { status: 401 })
    }

    const isAdmin = await isAdminTelegramId(telegramId || userId)
    const userShops = await db.select().from(shops).where(eq(shops.userId, userId))

    return NextResponse.json({
      ok: true,
      userId,
      telegramId,
      isAdmin,
      role: isAdmin ? 'admin' : role,
      shop: userShops[0] || null,
      shops: userShops,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
