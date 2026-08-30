import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { authSessions, shops, systemRoles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

// Poll if token has been verified by Telegram Bot
export async function GET(request: Request) {
  await ensureDbSchema()
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token kiritilmadi' }, { status: 400 })
  }

  try {
    const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
    if (!rows.length || !rows[0]) {
      return NextResponse.json({ ok: false, error: 'Sessiya topilmadi' }, { status: 404 })
    }

    const sess = rows[0]
    if (new Date(sess.expiresAt) < new Date()) {
      return NextResponse.json({ ok: false, error: 'Token muddati tugagan' }, { status: 410 })
    }

    if (sess.userId === 'pending') {
      return NextResponse.json({ ok: false, status: 'waiting_for_telegram' })
    }

    // Authenticated!
    const isAdmin = await isAdminTelegramId(sess.telegramId || sess.userId)

    return NextResponse.json({
      ok: true,
      status: 'authenticated',
      token: sess.token,
      userId: sess.userId,
      telegramId: sess.telegramId,
      role: isAdmin ? 'admin' : (sess.role || 'user'),
      isAdmin,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
