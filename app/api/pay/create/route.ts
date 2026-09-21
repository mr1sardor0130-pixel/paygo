import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { payments, shops, authSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-telegram-user-id, x-shop-slug, x-worker-secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

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

async function handleRequest(request: Request, method: 'GET' | 'POST') {
  try {
    await ensureDbSchema()
    const url = new URL(request.url)
    const searchParams = url.searchParams

    let body: any = {}
    if (method === 'POST') {
      body = await request.json().catch(() => ({}))
    }

    const user = await resolveUser(request)

    // Parse amount: support both searchParams and body keys
    const amountVal = searchParams.get('amount') || body.amount
    let rawAmount = 15000
    if (amountVal !== undefined && amountVal !== null) {
      if (typeof amountVal === 'number') {
        rawAmount = amountVal
      } else {
        rawAmount = Number(String(amountVal).replace(/\D/g, ''))
      }
    }
    // Support minimum 100 UZS (for test payments or small transactions)
    const amount = Number.isFinite(rawAmount) && rawAmount >= 100 ? Math.min(rawAmount, 500000000) : 15000

    // Check if test payment
    const isTestVal = searchParams.get('isTest') || searchParams.get('test') || body.isTest || body.test
    const isTest = isTestVal === 'true' || isTestVal === true || isTestVal === '1' || amount <= 500

    // Parse IDs and keys
    const shopIdRequested = searchParams.get('shopId') || searchParams.get('shop_id') || body.shopId || body.shop_id || ''
    const shopSlugHeader = request.headers.get('x-shop-slug') || searchParams.get('shopSlug') || body.shopSlug || ''

    let shop = null

    // Resolve Shop by shopId or shopSlug if provided
    if (shopIdRequested) {
      const found = await db.select().from(shops).where(eq(shops.id, shopIdRequested)).limit(1)
      if (found.length > 0) shop = found[0]
    }

    if (!shop && shopSlugHeader) {
      const found = await db.select().from(shops).where(eq(shops.slug, shopSlugHeader)).limit(1)
      if (found.length > 0) shop = found[0]
    }

    // Resolve User ID
    const userId = searchParams.get('userId') || searchParams.get('user_id') || user?.userId || body.userId || (shop ? shop.userId : 'guest-merchant')

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

    const customExpiryMin = Number(searchParams.get('expiresInMinutes') || searchParams.get('expiry') || body.expiresInMinutes || body.expiry)
    const expiryMinutes = Number.isFinite(customExpiryMin) && customExpiryMin > 0 ? customExpiryMin : 30 // Default 30 minutes
    const paymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    // Parse additional URLs and custom order metadata
    const orderId = searchParams.get('merchantOrderId') || searchParams.get('orderId') || searchParams.get('order_id') || body.orderId || body.order_id || null
    const description = searchParams.get('description') || searchParams.get('comment') || body.description || body.comment || null
    const returnUrl = searchParams.get('returnUrl') || searchParams.get('return_url') || body.returnUrl || body.return_url || null
    const webhookUrl = searchParams.get('webhookUrl') || searchParams.get('webhook_url') || body.webhookUrl || body.webhook_url || null

    const sourceMessage = orderId ? `Buyurtma: #${orderId}${description ? ` - ${description}` : ''}` : null

    await db.insert(payments).values({
      id: paymentId,
      shopId: shop.id,
      userId,
      amount,
      currency: 'UZS',
      status: 'pending',
      isTest,
      expiresAt,
      sourceMessage,
      returnUrl,
      webhookUrl,
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

    // Check if caller expects JSON or a browser redirection (clicked a link on browser)
    const acceptHeader = request.headers.get('accept') || ''
    const isJsonExpected =
      searchParams.get('json') === 'true' ||
      acceptHeader.includes('application/json') ||
      method === 'POST'

    if (!isJsonExpected) {
      // Browser clicked direct link: auto-redirect to payment visual checkout screen!
      return NextResponse.redirect(payUrl)
    }

    return NextResponse.json(
      {
        ok: true,
        id: paymentId,
        amount,
        currency: 'UZS',
        status: 'pending',
        isTest,
        orderId,
        description,
        expiresAt: expiresAt.toISOString(),
        payUrl,
        paymentUrl: payUrl,
        returnUrl,
        webhookUrl,
        shop: {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          cardNumber: shop.cardNumber,
          cardOwner: shop.accountOwner || 'HUMO hisob egasi',
          cardBank: shop.cardBank || 'HUMOCARD',
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (error: any) {
    console.error('Payment create error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'To‘lov yaratishda server xatosi yuz berdi' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function GET(request: Request) {
  return handleRequest(request, 'GET')
}

export async function POST(request: Request) {
  return handleRequest(request, 'POST')
}

