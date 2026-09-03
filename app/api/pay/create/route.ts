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

    // 1. Amount Validation (Security constraint: 1,000 UZS - 500,000,000 UZS)
    const rawAmount = body.amount ? Number(String(body.amount).replace(/\D/g, '')) : 15000
    const amount = Number.isFinite(rawAmount) && rawAmount >= 1000 ? Math.min(rawAmount, 500000000) : 15000

    const apiKeyHeader = request.headers.get('x-api-key') || ''
    const shopSlugHeader = request.headers.get('x-shop-slug') || body.shopSlug || ''
    const shopIdRequested = body.shopId || ''

    let shop = null

    // 2. Resolve Shop by shopId or shopSlug if provided
    if (shopIdRequested) {
      const found = await db.select().from(shops).where(eq(shops.id, shopIdRequested)).limit(1)
      if (found.length > 0) shop = found[0]
    }

    if (!shop && shopSlugHeader) {
      const found = await db.select().from(shops).where(eq(shops.slug, shopSlugHeader)).limit(1)
      if (found.length > 0) shop = found[0]
    }

    // 3. Fallback to user's shop or system default
    const userId = user?.userId || body.userId || (shop ? shop.userId : 'guest-merchant')

    if (!shop && user?.userId) {
      const userShops = await db.select().from(shops).where(eq(shops.userId, user.userId)).limit(1)
      if (userShops.length > 0) shop = userShops[0]
    }

    if (!shop) {
      const anyShops = await db.select().from(shops).limit(1)
      if (anyShops.length > 0) {
        shop = anyShops[0]
      } else {
        const newShopId = randomUUID()
        await db.insert(shops).values({
          id: newShopId,
          userId,
          name: 'PayGo Asosiy Do‘kon',
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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // Exactly 5 minutes validity

    // Store custom metadata if provided by merchant
    const orderId = body.orderId || body.order_id || null
    const description = body.description || body.comment || null
    const sourceMessage = orderId ? `Buyurtma: #${orderId}${description ? ` - ${description}` : ''}` : null

    await db.insert(payments).values({
      id: paymentId,
      shopId: shop.id,
      userId,
      amount,
      currency: 'UZS',
      status: 'pending',
      expiresAt,
      sourceMessage,
      createdAt: new Date(),
    })

    // Resolve accurate host
    const reqHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const reqProto = request.headers.get('x-forwarded-proto') || 'https'
    const dynamicHost = reqHost && !reqHost.includes('localhost') ? `${reqProto}://${reqHost}` : undefined

    const baseUrl =
      dynamicHost ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://paygo-pearl.vercel.app'

    const cleanBaseUrl = baseUrl.replace(/\/$/, '')
    const payUrl = `${cleanBaseUrl}/pay/${paymentId}`

    return NextResponse.json({
      ok: true,
      id: paymentId,
      amount,
      currency: 'UZS',
      status: 'pending',
      orderId,
      description,
      expiresAt: expiresAt.toISOString(),
      payUrl,
      paymentUrl: payUrl,
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        cardNumber: shop.cardNumber,
        cardOwner: shop.accountOwner || 'HUMO hisob egasi',
        cardBank: shop.cardBank || 'HUMOCARD',
      },
    })
  } catch (error: any) {
    console.error('Payment create error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'To‘lov yaratishda server xatosi yuz berdi' },
      { status: 500 }
    )
  }
}
