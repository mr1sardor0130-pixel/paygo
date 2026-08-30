import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { payments, userProfiles, shops } from '@/lib/db/schema'
import { deliverWebhook, type PaymentEvent } from '@/lib/webhook'
import { eq, and, desc } from 'drizzle-orm'
import { generateReceiptPdfBuffer } from '@/lib/pdf-receipt'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram-notifier'

const eventSchema = z.object({
  amount: z.number().int().positive(),
  cardLast4: z.string().regex(/^\d{4}$/),
  sourceMessage: z.string().min(1),
})
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const workerSecret = process.env.PAYBOT_WORKER_SECRET || 'paybot-secret-dev'
  const headerSecret = request.headers.get('x-worker-secret')

  if (workerSecret && headerSecret !== workerSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const parsed = eventSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })

  // Find the most recent pending payment matching the exact amount
  const pendingPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.amount, parsed.data.amount), eq(payments.status, 'pending')))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  const payment = pendingPayments[0]
  if (!payment || new Date(payment.expiresAt) < new Date()) {
    return NextResponse.json({ matched: false, reason: 'payment_not_found' })
  }

  // Update payment status to paid
  await db
    .update(payments)
    .set({
      status: 'paid',
      matchedAt: new Date(),
      sourceMessage: parsed.data.sourceMessage,
    })
    .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))

  // System tariff payment handling
  if (payment.shopId === 'system_tariff') {
    let period = 'month'
    let name = 'Premium Paket'
    if (payment.amount === 1000) {
      period = 'day'
      name = 'Kunlik'
    } else if (payment.amount === 6500) {
      period = 'week'
      name = 'Haftalik'
    } else if (payment.amount === 27858) {
      period = 'month'
      name = 'Oylik VIP'
    }

    let daysToAdd = 30
    if (period === 'day') daysToAdd = 1
    else if (period === 'week') daysToAdd = 7
    else if (period === 'month') daysToAdd = 30

    const premiumEndsAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000)

    try {
      await db
        .insert(userProfiles)
        .values({
          telegramId: payment.userId,
          termsAccepted: true,
          tier: 'premium',
          premiumEndsAt,
          acceptedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userProfiles.telegramId,
          set: {
            tier: 'premium',
            premiumEndsAt,
          },
        })

      await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, payment.userId))
    } catch (err) {
      console.error('System tariff profile update error:', err)
    }

    // Generate & send PDF receipt to user via Telegram
    try {
      const pdfBuffer = await generateReceiptPdfBuffer({
        paymentId: payment.id,
        title: `PayGo Premium - ${name}`,
        amount: payment.amount,
        cardNumber: '9860350123453587',
        cardOwner: 'AZizbek I',
        date: new Date().toLocaleString('uz-UZ'),
        userId: payment.userId,
        status: 'PAID',
      })

      await sendTelegramMessage(
        payment.userId,
        `🎉 <b>Tabriklaymiz! To‘lovingiz Muvaffaqiyatli Tasdiqlandi!</b>\n\n` +
        `💎 <b>Aktivlashtirilgan Tarif:</b> ${name}\n` +
        `⏳ <b>Amal qilish muddati:</b> ${premiumEndsAt.toLocaleDateString('uz-UZ')} gacha\n` +
        `🚀 <b>Imkoniyatlar:</b> Cheksiz do‘konlar, cheksiz to‘lovlar va to‘liq monitoring faollashtirildi!\n\n` +
        `📄 <i>Quyida rasmiy to‘lov chekingiz PDF shaklida yuborilmoqda.</i>`
      )

      await sendTelegramDocument(
        payment.userId,
        pdfBuffer,
        `PayGo_Receipt_${payment.id}.pdf`,
        `📄 <b>PayGo Rasmiy To‘lov Cheki</b> (ID: <code>${payment.id}</code>)`
      )
    } catch (pdfErr) {
      console.error('Userbot PDF send error:', pdfErr)
    }
  } else {
    // Standard shop payment handling
    try {
      const shopList = await db.select().from(shops).where(eq(shops.id, payment.shopId)).limit(1)
      const shop = shopList[0]

      if (shop) {
        // Send notification to shop owner
        await sendTelegramMessage(
          shop.userId,
          `🔔 <b>Yangi To‘lov Muvaffaqiyatli Qabul Qilindi!</b>\n\n` +
          `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
          `💰 <b>Summa:</b> <code>${payment.amount.toLocaleString('uz-UZ')}</code> UZS\n` +
          `🆔 <b>To‘lov ID:</b> <code>${payment.id}</code>\n` +
          `👤 <b>Mijoz Telegram ID:</b> <code>${payment.userId}</code>\n` +
          `⏰ <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`
        )

        // If shop has Telegram Channel configured, send message to channel
        if (shop.telegramChannelId) {
          await sendTelegramMessage(
            shop.telegramChannelId,
            `📢 <b>[${shop.name}] Yangi To‘lov Tasdiqlandi!</b>\n\n` +
            `💰 <b>Summa:</b> <code>${payment.amount.toLocaleString('uz-UZ')} UZS</code>\n` +
            `👤 <b>Mijoz ID:</b> <code>${payment.userId}</code>\n` +
            `🆔 <b>To‘lov ID:</b> <code>${payment.id}</code>\n` +
            `⏰ <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`
          )
        }

        // Webhook delivery if configured (JSON payload with userId, shopId, etc.)
        if (shop.webhookUrl) {
          const event: PaymentEvent = {
            eventId: randomUUID(),
            type: 'payment.paid',
            createdAt: new Date().toISOString(),
            payment: {
              id: payment.id,
              shopId: shop.id,
              userId: payment.userId,
              amount: payment.amount,
              currency: payment.currency,
              status: 'paid',
              isTest: payment.isTest || false,
              matchedAt: new Date().toISOString(),
            },
          }
          await deliverWebhook(shop.webhookUrl, shop.id, event)
        }
      }
    } catch (shopErr) {
      console.error('Shop payment post-processing error:', shopErr)
    }
  }

  const event: PaymentEvent = {
    eventId: randomUUID(),
    type: 'payment.paid',
    createdAt: new Date().toISOString(),
    payment: { id: payment.id, amount: payment.amount, currency: payment.currency, status: 'paid' },
  }
  return NextResponse.json({ matched: true, event, delivery: 'queued' })
}

