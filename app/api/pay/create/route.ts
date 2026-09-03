import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { payments, shops, authSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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

export async function POST(request: Request) {
  try {
    await ensureDbSchema()
    const user = await resolveUser(request)
    const body = await request.json().catch(() => ({}))

    const rawAmount = body.amount ? Number(String(body.amount).replace(/\D/g, '')) : 15000
    const amount = rawAmount > 0 ? rawAmount : 15000

    const userId = user?.userId || body.userId || 'guest-user'
    
    // Find or create default shop for the user
    let userShops = await db.select().from(shops).where(eq(shops.userId, userId)).limit(1)
    let shop = userShops[0]

    if (!shop) {
      // Find any approved shop or create one
      const anyShops = await db.select().from(shops).limit(1)
      if (anyShops.length > 0) {
        shop = anyShops[0]
      } else {
        const newShopId = randomUUID()
        await db.insert(shops).values({
          id: newShopId,
          userId,
          name: 'PayGo Demo Shop',
          slug: `shop-${userId.slice(-6)}`,
          cardNumber: '9860350123453587',
          cardLast4: '3587',
          cardBank: 'HUMOCARD',
          accountOwner: 'Hisob egasi',
          approved: true,
        })
        const created = await db.select().from(shops).where(eq(shops.id, newShopId)).limit(1)
        shop = created[0]
      }
    }

    const paymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // Exactly 5 minutes

    await db.insert(payments).values({
      id: paymentId,
      shopId: shop.id,
      userId,
      amount,
      currency: 'UZS',
      status: 'pending',
      expiresAt,
    })

    const reqHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
    const reqProto = req.headers.get('x-forwarded-proto') || 'https'
    const dynamicHost = reqHost && !reqHost.includes('localhost') ? `${reqProto}://${reqHost}` : undefined

    const baseUrl =
      (process.env.APP_URL && !process.env.APP_URL.includes('paygo-pearl.vercel.app') ? process.env.APP_URL : undefined) ||
      dynamicHost ||
      'https://paygo.uz'

    const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/${paymentId}`

    return NextResponse.json({
      ok: true,
      id: paymentId,
      amount,
      currency: 'UZS',
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      payUrl,
      shop: {
        id: shop.id,
        name: shop.name,
        cardNumber: shop.cardNumber,
        cardOwner: shop.accountOwner,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server xatosi' }, { status: 500 })
  }
}
