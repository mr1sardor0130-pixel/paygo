import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { payments, userProfiles, shops, donations, fundraisers, deliveryLogs } from '@/lib/db/schema'
import { deliverWebhook, type PaymentEvent } from '@/lib/webhook'
import { eq, and, desc, sql } from 'drizzle-orm'
import { generateReceiptPdfBuffer } from '@/lib/pdf-receipt'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram-notifier'
import { parseBankNotification } from '@/lib/telegram-humo-parser'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const workerSecret = process.env.PAYBOT_WORKER_SECRET || 'paybot-secret-dev'
  const headerSecret = request.headers.get('x-worker-secret')

  if (workerSecret && headerSecret !== workerSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    const rawText = await request.text()
    body = { sourceMessage: rawText }
  }

  let amount = typeof body.amount === 'number' ? body.amount : Number(body.amount)
  let cardLast4 = String(body.cardLast4 || '').trim()
  let sourceMessage = String(body.sourceMessage || body.raw || body.text || '').trim()
  let provider = body.provider || '@CardXabarBot'
  let cardType = body.cardType || 'UNKNOWN'

  // If amount wasn't explicitly provided or if raw text was sent, parse via universal bank parser
  if ((!amount || isNaN(amount) || amount <= 0) && sourceMessage) {
    const parsedNotification = parseBankNotification(sourceMessage)
    if (parsedNotification) {
      amount = parsedNotification.amount
      cardLast4 = parsedNotification.cardLast4 || cardLast4
      cardType = parsedNotification.cardType || cardType
      provider = parsedNotification.provider || provider
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'invalid_amount', message: 'To‘lov summasi aniqlanmadi' }, { status: 400 })
  }

  // Find the most recent pending payment matching the exact amount
  const pendingPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.amount, Math.round(amount)), eq(payments.status, 'pending')))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  const payment = pendingPayments[0]
  if (!payment || new Date(payment.expiresAt) < new Date()) {
    return NextResponse.json({ matched: false, reason: 'payment_not_found', amount, cardLast4, provider })
  }

  // Update payment status to paid
  await db
    .update(payments)
    .set({
      status: 'paid',
      matchedAt: new Date(),
      sourceMessage: sourceMessage || `Avto-to‘lov (${provider}): ${amount} UZS`,
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
        cardNumber: '9860166655238557',
        cardOwner: 'Sardor Tuyginov',
        date: new Date().toLocaleString('uz-UZ'),
        userId: payment.userId,
        status: 'PAID',
      })

      await sendTelegramMessage(
        payment.userId,
        `🎉 <b>Tabriklaymiz! To‘lovingiz Muvaffaqiyatli Tasdiqlandi!</b>\n\n` +
        `💎 <b>Aktivlashtirilgan Tarif:</b> ${name}\n` +
        `⏳ <b>Amal qilish muddati:</b> ${premiumEndsAt.toLocaleDateString('uz-UZ')} gacha\n` +
        `🤖 <b>To‘lov tizimi:</b> ${provider} (${cardType || 'Karta'})\n` +
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
        // Handle donation matching if this payment is linked to a fundraiser donation
        if (payment.id.startsWith('pay_don_')) {
          try {
            const donationId = payment.id.replace('pay_', '')
            const donRows = await db.select().from(donations).where(eq(donations.id, donationId)).limit(1)
            if (donRows.length > 0) {
              const don = donRows[0]
              if (don.status !== 'paid') {
                await db.update(donations).set({ status: 'paid' }).where(eq(donations.id, donationId))
                await db.update(fundraisers).set({
                  collectedAmount: sql`${fundraisers.collectedAmount} + ${don.amount}`,
                  donorCount: sql`${fundraisers.donorCount} + 1`,
                  updatedAt: new Date(),
                }).where(eq(fundraisers.id, don.fundraiserId))

                await sendTelegramMessage(
                  shop.userId,
                  `🎉 <b>Yangi Donat Qabul Qilindi!</b>\n\n` +
                  `👤 <b>Sahovatpesha:</b> ${don.donorName} (<code>${don.donorTempId}</code>)\n` +
                  `💰 <b>Summa:</b> <code>${don.amount.toLocaleString('uz-UZ')} UZS</code>\n` +
                  `💬 <b>Izoh:</b> ${don.comment || 'Yo‘q'}\n` +
                  `⏰ <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`
                )
              }
            }
          } catch (donErr) {
            console.error('Donation matching error in payment events:', donErr)
          }
        }

        // Send notification to shop owner
        await sendTelegramMessage(
          shop.userId,
          `🔔 <b>Yangi To‘lov Muvaffaqiyatli Qabul Qilindi!</b>\n\n` +
          `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
          `💰 <b>Summa:</b> <code>${payment.amount.toLocaleString('uz-UZ')}</code> UZS\n` +
          `💳 <b>Karta:</b> *${cardLast4 || '1641'} (${cardType})\n` +
          `🤖 <b>Tizim:</b> ${provider}\n` +
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
            `💳 <b>Karta:</b> *${cardLast4 || '1641'} (${cardType})\n` +
            `🤖 <b>Monitoring:</b> ${provider}\n` +
            `👤 <b>Mijoz ID:</b> <code>${payment.userId}</code>\n` +
            `🆔 <b>To‘lov ID:</b> <code>${payment.id}</code>\n` +
            `⏰ <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`
          )
        }

        // Webhook delivery if configured (JSON payload with userId, shopId, etc.)
        const targetWebhookUrl = payment.webhookUrl || shop.webhookUrl
        if (targetWebhookUrl) {
          const event: PaymentEvent = {
            eventId: randomUUID(),
            type: 'payment.paid',
            createdAt: new Date().toISOString(),
            payment: {
              id: payment.id,
              shopId: shop.id,
              userId: payment.userId,
              amount: payment.amount,
              currency: payment.currency || 'UZS',
              status: 'paid',
              isTest: payment.isTest || false,
              matchedAt: new Date().toISOString(),
            },
          }
          try {
            const secret = process.env.PAYBOT_WORKER_SECRET || 'paybot-secret-dev'
            const result = await deliverWebhook(targetWebhookUrl, secret, event)
            await db.insert(deliveryLogs).values({
              id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
              paymentId: payment.id,
              target: 'webhook',
              status: result.ok ? 'success' : 'failed',
              response: `HTTP ${result.status} - ${result.response}`,
              createdAt: new Date(),
            })
          } catch (webhookErr: any) {
            console.error('Real webhook dispatch error:', webhookErr)
            await db.insert(deliveryLogs).values({
              id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
              paymentId: payment.id,
              target: 'webhook',
              status: 'failed',
              response: webhookErr?.message || 'Connection failed',
              createdAt: new Date(),
            })
          }
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
  return NextResponse.json({ matched: true, event, delivery: 'queued', provider, cardType, cardLast4 })
}

