import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, authSessions } from '@/lib/db/schema'
import { eq, or, desc } from 'drizzle-orm'
import { deliverWebhook, signPayload } from '@/lib/webhook'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

async function resolveUser(request: Request, bodyUserId?: string) {
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

  if (bodyUserId) {
    return { userId: bodyUserId, telegramId: bodyUserId }
  }

  return null
}

// GET shop info
export async function GET(request: Request) {
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const reqShopId = searchParams.get('shopId')

  try {
    const searchUserIds = Array.from(new Set([user.userId, user.telegramId].filter(Boolean)))
    const whereConditions = searchUserIds.map((id) => eq(shops.userId, id))
    let userShops = await db
      .select()
      .from(shops)
      .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
      .orderBy(desc(shops.createdAt))

    const isAdmin = await isAdminTelegramId(user.telegramId || user.userId)
    if (userShops.length === 0 && isAdmin) {
      userShops = await db.select().from(shops).orderBy(desc(shops.createdAt)).limit(20)
    }

    let activeShop = userShops[0] || null
    if (reqShopId) {
      const found = userShops.find((s) => s.id === reqShopId)
      if (found) {
        activeShop = found
      } else if (isAdmin) {
        const anyShop = await db.select().from(shops).where(eq(shops.id, reqShopId)).limit(1)
        if (anyShop.length) activeShop = anyShop[0]
      }
    }

    return NextResponse.json({
      ok: true,
      shop: activeShop,
      shops: userShops,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// POST: Update shop info, create new shop, delete shop or test webhook / channel
export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {}

  const user = await resolveUser(request, body.userId)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  const { action, shopId } = body
  const isAdmin = await isAdminTelegramId(user.telegramId || user.userId)

  try {
    const searchUserIds = Array.from(new Set([user.userId, user.telegramId].filter(Boolean)))
    const whereConditions = searchUserIds.map((id) => eq(shops.userId, id))
    let userShops = await db
      .select()
      .from(shops)
      .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
      .orderBy(desc(shops.createdAt))

    // Handle Create New Shop
    if (action === 'create_shop') {
      const newShopId = randomUUID()
      const rawSlug = (body.name || 'shop').toLowerCase().replace(/[^a-z0-9]/g, '')
      const uniqueSlug = `${rawSlug || 'shop'}-${Date.now().toString().slice(-4)}`
      const cardDigits = (body.cardNumber || '9860350123453587').replace(/\D/g, '')

      await db.insert(shops).values({
        id: newShopId,
        userId: user.telegramId || user.userId,
        name: (body.name || 'Yangi Do‘kon').trim(),
        description: body.description?.trim() || '',
        slug: uniqueSlug,
        cardNumber: cardDigits,
        cardLast4: cardDigits.slice(-4),
        cardBank: body.cardBank || 'HUMOCARD',
        accountOwner: body.accountOwner?.trim() || 'Hisob egasi',
        logoUrl: body.logoUrl?.trim() || null,
        webhookUrl: body.webhookUrl?.trim() || null,
        telegramChannelId: body.telegramChannelId?.trim() || null,
        approved: true,
      })

      const created = await db.select().from(shops).where(eq(shops.id, newShopId)).limit(1)
      const refreshedShops = await db
        .select()
        .from(shops)
        .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
        .orderBy(desc(shops.createdAt))

      return NextResponse.json({
        ok: true,
        message: '🎉 Yangi do‘kon muvaffaqiyatli yaratildi!',
        shop: created[0],
        shops: refreshedShops,
      })
    }

    // Handle Delete Shop
    if (action === 'delete_shop') {
      const targetId = shopId || body.targetShopId
      if (!targetId) {
        return NextResponse.json({ error: 'Do‘kon ID ko‘rsatilmadi' }, { status: 400 })
      }

      // Check ownership
      const toDelete = await db.select().from(shops).where(eq(shops.id, targetId)).limit(1)
      if (!toDelete.length) {
        return NextResponse.json({ error: 'Do‘kon topilmadi' }, { status: 404 })
      }

      if (!isAdmin && toDelete[0].userId !== user.userId && toDelete[0].userId !== user.telegramId) {
        return NextResponse.json({ error: 'Ruxsat berilmadi' }, { status: 403 })
      }

      await db.delete(shops).where(eq(shops.id, targetId))

      const refreshedShops = await db
        .select()
        .from(shops)
        .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
        .orderBy(desc(shops.createdAt))

      return NextResponse.json({
        ok: true,
        message: 'Do‘kon o‘chirildi',
        shops: refreshedShops,
        shop: refreshedShops[0] || null,
      })
    }

    // Resolve Target Shop for updates & tests
    let shop: any = null
    if (shopId) {
      const found = userShops.find((s) => s.id === shopId)
      if (found) {
        shop = found
      } else if (isAdmin) {
        const anyS = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1)
        if (anyS.length) shop = anyS[0]
      }
    }
    if (!shop) {
      shop = userShops[0]
    }

    // Create if not exists
    if (!shop) {
      const newShopId = randomUUID()
      await db.insert(shops).values({
        id: newShopId,
        userId: user.telegramId || user.userId,
        name: body.name || 'Mening Do‘konim',
        slug: `shop-${(user.telegramId || user.userId).slice(-6)}`,
        cardNumber: body.cardNumber?.replace(/\D/g, '') || '9860350123453587',
        cardLast4: (body.cardNumber?.replace(/\D/g, '') || '3587').slice(-4),
        cardBank: body.cardBank || 'HUMOCARD',
        accountOwner: body.accountOwner || 'Hisob egasi',
        logoUrl: body.logoUrl || null,
        webhookUrl: body.webhookUrl || null,
        telegramChannelId: body.telegramChannelId || null,
        approved: true,
      })
      const created = await db.select().from(shops).where(eq(shops.id, newShopId)).limit(1)
      shop = created[0]
    }

    if (action === 'update_shop') {
      const updates: any = {}
      if (body.name !== undefined) updates.name = body.name.trim()
      if (body.description !== undefined) updates.description = body.description.trim()
      if (body.cardNumber !== undefined) {
        const digits = body.cardNumber.replace(/\D/g, '')
        updates.cardNumber = digits
        updates.cardLast4 = digits.slice(-4)
      }
      if (body.accountOwner !== undefined) updates.accountOwner = body.accountOwner.trim()
      if (body.cardBank !== undefined) updates.cardBank = body.cardBank.trim()
      if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl.trim()
      if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl.trim()
      if (body.telegramChannelId !== undefined) updates.telegramChannelId = body.telegramChannelId.trim()

      await db.update(shops).set(updates).where(eq(shops.id, shop.id))
      const updated = await db.select().from(shops).where(eq(shops.id, shop.id)).limit(1)

      const refreshedShops = await db
        .select()
        .from(shops)
        .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
        .orderBy(desc(shops.createdAt))

      return NextResponse.json({
        ok: true,
        message: 'Do‘kon ma’lumotlari muvaffaqiyatli saqlandi!',
        shop: updated[0],
        shops: refreshedShops,
      })
    }

    // Test Webhook
    if (action === 'test_webhook') {
      const targetUrl = body.webhookUrl || shop.webhookUrl
      if (!targetUrl) {
        return NextResponse.json({ error: 'Webhook URL kiritilmagan' }, { status: 400 })
      }

      const testEvent: any = {
        eventId: `test_${randomUUID().slice(0, 8)}`,
        type: 'payment.paid',
        createdAt: new Date().toISOString(),
        shop: {
          id: shop.id,
          name: shop.name,
          cardNumber: shop.cardNumber,
          cardOwner: shop.accountOwner,
        },
        payment: {
          id: `pay_test_${randomUUID().slice(0, 8)}`,
          amount: 15000,
          currency: 'UZS',
          status: 'paid',
          cardLast4: shop.cardLast4 || '3587',
          matchedAt: new Date().toISOString(),
          sourceMessage: 'Karta: 9860 **** **** 3587\nSumma: +15 000.00 UZS\nVaqt: 30.08.2026',
        },
        signature: signPayload(JSON.stringify({ test: true }), process.env.PAYBOT_WORKER_SECRET || 'secret'),
      }

      const res = await deliverWebhook(targetUrl, process.env.PAYBOT_WORKER_SECRET || 'secret', testEvent)
      return NextResponse.json({
        ok: res.ok,
        status: res.status,
        response: res.response,
        message: res.ok ? 'Webhook muvaffaqiyatli yetkazildi (200 OK)' : `Webhook xatosi: HTTP ${res.status}`,
      })
    }

    // Test Channel
    if (action === 'test_channel') {
      const channelId = body.telegramChannelId || shop.telegramChannelId
      if (!channelId) {
        return NextResponse.json({ error: 'Telegram kanal ID si kiritilmagan' }, { status: 400 })
      }

      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN
      if (!token) {
        return NextResponse.json({ error: 'Telegram bot token mavjud emas' }, { status: 500 })
      }

      const testText =
        `📣 <b>PayGo Test To‘lov Xabarnomasi</b>\n\n` +
        `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
        `💰 <b>Summa:</b> 15 000 UZS\n` +
        `💳 <b>Karta:</b> <code>${shop.cardNumber || '9860 3501 2345 3587'}</code>\n` +
        `👤 <b>Mijoz/Egasi:</b> ${shop.accountOwner || 'AZIZBEK KARIMOV'}\n` +
        `⚡️ <b>Holat:</b> ✅ To‘landi (Test)\n\n` +
        `📦 <b>JSON Payload Data:</b>\n` +
        `<pre><code class="language-json">{\n  "event": "payment.paid",\n  "amount": 15000,\n  "currency": "UZS",\n  "shop_id": "${shop.id}",\n  "status": "paid"\n}</code></pre>`

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: testText,
          parse_mode: 'HTML',
        }),
      })

      const tgData = await tgRes.json()
      if (tgData.ok) {
        return NextResponse.json({
          ok: true,
          message: 'Kanalga test xabar va JSON ma’lumot muvaffaqiyatli yuborildi!',
        })
      } else {
        return NextResponse.json({
          error: `Telegram xatosi: ${tgData.description || 'Bot kanalda admin emas'}`,
        }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server xatosi' }, { status: 500 })
  }
}
