import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { payments, shops, deliveryLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { deliverWebhook, signPayload } from '@/lib/webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatCard(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length >= 16) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`
  }
  return digits || '9860 3501 2345 3587'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema()
    const { id } = await params
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1)

    if (!paymentRows[0]) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
    }

    const payment = paymentRows[0]
    let shop = null
    if (payment.shopId) {
      const shopRows = await db
        .select()
        .from(shops)
        .where(eq(shops.id, payment.shopId))
        .limit(1)
      shop = shopRows[0] || null
    }

    const isExpired =
      payment.status === 'pending' && new Date(payment.expiresAt) < new Date()
    const status = isExpired ? 'expired' : payment.status

    const cardNumber =
      shop?.cardNumber ||
      (shop?.cardLast4 ? `986035012345${shop.cardLast4}` : '9860350123453587')

    return NextResponse.json({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency || 'UZS',
      status,
      expiresAt: payment.expiresAt,
      matchedAt: payment.matchedAt,
      shop: {
        id: shop?.id ?? 'default-shop',
        name: shop?.name ?? 'HUMO To‘lov tizimi',
        cardNumber,
        cardLast4: shop?.cardLast4 ?? cardNumber.slice(-4),
        cardBank: shop?.cardBank ?? 'HUMOCARD',
        accountOwner: shop?.accountOwner ?? 'Hisob egasi',
        logoUrl: shop?.logoUrl || null,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server xatosi' },
      { status: 500 }
    )
  }
}

// POST: Simulate or confirm payment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema()
    const { id } = await params
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1)

    if (!paymentRows[0]) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
    }

    const payment = paymentRows[0]
    if (payment.status === 'paid') {
      return NextResponse.json({ ok: true, status: 'already_paid' })
    }

    const matchedAt = new Date()
    await db
      .update(payments)
      .set({
        status: 'paid',
        matchedAt,
        sourceMessage: `HUMO To‘lov Tasdiqlandi\nSumma: +${payment.amount} UZS\nVaqt: ${matchedAt.toISOString()}`,
      })
      .where(eq(payments.id, payment.id))

    // Get shop info
    const shopRows = await db.select().from(shops).where(eq(shops.id, payment.shopId)).limit(1)
    const shop = shopRows[0] || null

    const token = process.env.TELEGRAM_BOT_TOKEN
    const eventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`
    const secret = process.env.PAYBOT_WORKER_SECRET || 'secret'

    const webhookPayload: any = {
      event: 'payment.paid',
      eventId,
      createdAt: matchedAt.toISOString(),
      shop: {
        id: shop?.id || payment.shopId,
        name: shop?.name || 'Do‘kon',
        cardNumber: shop?.cardNumber || '9860350123453587',
        cardOwner: shop?.accountOwner || 'Hisob egasi',
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency || 'UZS',
        status: 'paid',
        cardLast4: shop?.cardLast4 || '3587',
        matchedAt: matchedAt.toISOString(),
      },
      signature: signPayload(JSON.stringify({ id: payment.id, amount: payment.amount }), secret),
    }

    // 1. Deliver Webhook if shop has webhookUrl
    if (shop?.webhookUrl) {
      try {
        await deliverWebhook(shop.webhookUrl, secret, webhookPayload)
      } catch (webhookErr) {
        console.warn('Webhook delivery error:', webhookErr)
      }
    }

    // 2. Deliver to Telegram Channel if shop has telegramChannelId
    if (token && shop?.telegramChannelId) {
      try {
        const postText =
          `💸 <b>Yangi To‘lov Tasdiqlandi!</b>\n\n` +
          `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
          `💰 <b>Summa:</b> ${payment.amount.toLocaleString('uz-UZ')} UZS\n` +
          `💳 <b>Karta:</b> <code>${formatCard(shop.cardNumber || '9860350123453587')}</code>\n` +
          `👤 <b>Hisob egasi:</b> ${shop.accountOwner || 'HUMO hisob egasi'}\n` +
          `⚡️ <b>Holat:</b> ✅ To‘landi\n` +
          `🆔 <b>Tranzaksiya ID:</b> <code>${payment.id}</code>\n\n` +
          `📦 <b>Webhook JSON Data:</b>\n` +
          `<pre><code class="language-json">${JSON.stringify(webhookPayload, null, 2)}</code></pre>`

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: shop.telegramChannelId,
            text: postText,
            parse_mode: 'HTML',
          }),
        })
      } catch (chanErr) {
        console.warn('Channel delivery error:', chanErr)
      }
    }

    // 3. Deliver to Merchant Telegram DM
    if (token && shop?.userId) {
      try {
        const dmText =
          `🎉 <b>To‘lov Muvaffaqiyatli Qabul Qilindi!</b>\n\n` +
          `💰 <b>Summa:</b> ${payment.amount.toLocaleString('uz-UZ')} UZS\n` +
          `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
          `🆔 <b>To‘lov ID:</b> <code>${payment.id}</code>\n` +
          `⚡️ <b>Holat:</b> ✅ To‘landi (Sessiya yopildi)\n\n` +
          `📦 <i>Webhook va Kanalingizga to‘liq ma’lumot yetkazildi.</i>`

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: shop.userId,
            text: dmText,
            parse_mode: 'HTML',
          }),
        })
      } catch (dmErr) {
        console.warn('Merchant DM delivery error:', dmErr)
      }
    }

    return NextResponse.json({
      ok: true,
      status: 'paid',
      matchedAt: matchedAt.toISOString(),
      webhookSent: Boolean(shop?.webhookUrl),
      channelSent: Boolean(shop?.telegramChannelId),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server xatosi' },
      { status: 500 }
    )
  }
}
