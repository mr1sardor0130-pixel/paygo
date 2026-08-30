import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, authSessions, deliveryLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { deliverWebhook, signPayload } from '@/lib/webhook'

export const dynamic = 'force-dynamic'

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

// GET shop info
export async function GET(request: Request) {
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  try {
    const userShops = await db.select().from(shops).where(eq(shops.userId, user.userId)).limit(1)
    return NextResponse.json({
      ok: true,
      shop: userShops[0] || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// POST: Update shop info or test webhook / channel
export async function POST(request: Request) {
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  try {
    const userShops = await db.select().from(shops).where(eq(shops.userId, user.userId)).limit(1)
    let shop = userShops[0]

    // Create if not exists
    if (!shop) {
      const newShopId = randomUUID()
      await db.insert(shops).values({
        id: newShopId,
        userId: user.userId,
        name: body.name || 'Mening Do‘konim',
        slug: `shop-${user.userId.slice(-6)}`,
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

      return NextResponse.json({
        ok: true,
        message: 'Do‘kon ma’lumotlari muvaffaqiyatli saqlandi!',
        shop: updated[0],
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

      const token = process.env.TELEGRAM_BOT_TOKEN
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
