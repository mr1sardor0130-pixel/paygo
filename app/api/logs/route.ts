import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { payments, shops, authSessions, deliveryLogs } from '@/lib/db/schema'
import { eq, inArray, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function resolveUser(request: Request) {
  await ensureDbSchema()
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  const telegramHeader = request.headers.get('x-telegram-user-id') || ''

  if (token) {
    const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
    if (rows.length && rows[0] && rows[0].userId !== 'pending') {
      return { userId: rows[0].userId, telegramId: rows[0].telegramId || rows[0].userId }
    }
  }

  if (telegramHeader) {
    return { userId: telegramHeader, telegramId: telegramHeader }
  }

  return null
}

export async function GET(request: Request) {
  try {
    await ensureDbSchema()
    const user = await resolveUser(request)

    if (!user) {
      return NextResponse.json({ error: 'unauthorized', message: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
    }

    const userShops = await db.select().from(shops).where(eq(shops.userId, user.userId))
    const userShops2 = user.telegramId && user.telegramId !== user.userId
      ? await db.select().from(shops).where(eq(shops.userId, user.telegramId))
      : []

    const allShops = [...userShops, ...userShops2]
    const shopIds = Array.from(new Set(allShops.map(s => s.id)))

    if (shopIds.length === 0) {
      return NextResponse.json({ ok: true, logs: [] })
    }

    const logs = await db
      .select({
        id: deliveryLogs.id,
        paymentId: deliveryLogs.paymentId,
        target: deliveryLogs.target,
        status: deliveryLogs.status,
        response: deliveryLogs.response,
        createdAt: deliveryLogs.createdAt,
        amount: payments.amount,
        currency: payments.currency,
        shopName: shops.name,
      })
      .from(deliveryLogs)
      .innerJoin(payments, eq(deliveryLogs.paymentId, payments.id))
      .innerJoin(shops, eq(payments.shopId, shops.id))
      .where(inArray(payments.shopId, shopIds))
      .orderBy(desc(deliveryLogs.createdAt))
      .limit(100)

    return NextResponse.json({ ok: true, logs })
  } catch (error: any) {
    console.error('Fetch logs error:', error)
    return NextResponse.json({ error: 'internal_error', message: error?.message || 'Server xatosi' }, { status: 500 })
  }
}
