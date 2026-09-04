import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { systemTariffs, payments, userProfiles, shops, authSessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

async function resolveUserFromRequest(request: Request): Promise<{ userId: string; telegramId: string; isAdmin: boolean }> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  const telegramHeader = request.headers.get('x-telegram-user-id') || ''

  let userId = ''
  let telegramId = ''

  if (token) {
    try {
      const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
      if (rows.length && rows[0].userId !== 'pending') {
        userId = rows[0].userId
        telegramId = rows[0].telegramId || rows[0].userId
      }
    } catch {}
  }

  if (!userId && telegramHeader) {
    userId = telegramHeader
    telegramId = telegramHeader
  }

  const isAdmin = await isAdminTelegramId(telegramId || userId)
  return { userId, telegramId, isAdmin }
}

export async function GET(request: Request) {
  await ensureDbSchema()
  const { searchParams } = new URL(request.url)
  const { telegramId: authTgId, isAdmin } = await resolveUserFromRequest(request)
  const queryTgId = searchParams.get('telegramId')
  const targetTgId = queryTgId || authTgId

  if (searchParams.get('checkPayment') === 'true' && targetTgId) {
    try {
      const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, targetTgId)).limit(1)
      const prof = profs[0]
      const isPremium = prof?.tier === 'premium' && prof?.premiumEndsAt && new Date(prof.premiumEndsAt) > new Date()
      return NextResponse.json({
        ok: true,
        isPremium: Boolean(isPremium),
        premiumEndsAt: prof?.premiumEndsAt,
      })
    } catch {
      return NextResponse.json({ ok: true, isPremium: false })
    }
  }

  let tariffs: any[] = []
  try {
    tariffs = await db
      .select()
      .from(systemTariffs)
      .where(eq(systemTariffs.active, true))
      .orderBy(systemTariffs.price)
  } catch (e) {
    console.warn('Get tariffs db err:', e)
  }

  if (!tariffs.length) {
    const defaultTariffsData = [
      {
        id: 'tariff-daily',
        name: 'Kunlik Sinov',
        description: '1 kunlik sinov, avto-to‘lov va monitoring',
        features: JSON.stringify([
          '⚡️ @humocardbot orqali 1 soniyada avto-to‘lov',
          '🏪 3 tagacha do‘kon ochish',
          '🔗 Har bir do‘kon uchun alohida Webhook & Kanal',
          '👥 1 ta VIP Guruh (Pullik yozish / kirish)',
          '🎁 1 ta Donate / Ehson yig‘ish kampaniyasi',
          '0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga',
          '📄 PDF cheklar generatsiyasi',
        ]),
        price: 5000,
        period: 'kun',
        cardNumber: '9860350123453587',
        cardOwner: 'AZizbek I',
        cardBank: 'HUMOCARD',
        active: true,
      },
      {
        id: 'tariff-weekly',
        name: 'Haftalik Standart',
        description: '7 kunlik biznes va faol savdo imkoniyati',
        features: JSON.stringify([
          '⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)',
          '🏪 10 tagacha mustaqil do‘konlar',
          '🔗 Har bir do‘kon uchun maxsus Webhook & Kanal',
          '👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)',
          '🎁 Cheksiz Donate & Xayriya yig‘ish havolalari',
          '0% komissiya va 24/7 avtomatik monitoring',
          '📄 QR-kodli rasmiy PDF kvitansiyalar',
          '🛠 Dasturchilar uchun REST API & SDK',
        ]),
        price: 25000,
        period: 'hafta',
        cardNumber: '9860350123453587',
        cardOwner: 'AZizbek I',
        cardBank: 'HUMOCARD',
        active: true,
      },
      {
        id: 'tariff-monthly',
        name: 'Oylik VIP (Cheksiz)',
        description: '30 kunlik to‘liq cheksiz imkoniyatlar to‘plami',
        features: JSON.stringify([
          '⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)',
          '🏪 CHEKSIZ do‘konlar yaratish va ulash',
          '🔗 Har bir do‘konga individual Webhook & Kanal',
          '👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi',
          '🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari',
          '💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash',
          '0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga',
          '📄 Brendlangan PDF cheklar va to‘lov tahlillari',
          '🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash',
        ]),
        price: 79000,
        period: 'oy',
        cardNumber: '9860350123453587',
        cardOwner: 'AZizbek I',
        cardBank: 'HUMOCARD',
        active: true,
      },
    ]

    try {
      await db.insert(systemTariffs).values(defaultTariffsData).onConflictDoNothing()
      tariffs = await db
        .select()
        .from(systemTariffs)
        .where(eq(systemTariffs.active, true))
        .orderBy(systemTariffs.price)
    } catch {
      tariffs = defaultTariffsData
    }
  }

  let userProfile: any = null
  if (telegramId) {
    try {
      const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, telegramId)).limit(1)
      userProfile = profs[0] || null
    } catch {}
  }

  const response = NextResponse.json({
    ok: true,
    tariffs,
    isAdmin,
    userProfile: userProfile ? {
      tier: userProfile.tier || 'free',
      premiumEndsAt: userProfile.premiumEndsAt,
      isPremiumActive: userProfile.tier === 'premium' && userProfile.premiumEndsAt && new Date(userProfile.premiumEndsAt) > new Date(),
    } : null,
  })

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

export async function POST(request: Request) {
  await ensureDbSchema()
  const { userId, telegramId, isAdmin } = await resolveUserFromRequest(request)
  const body = await request.json()
  const { action, tariffId, paymentId } = body

  // 1. INITIATE TARIFF PURCHASE
  if (action === 'buy_tariff') {
    if (!tariffId) {
      return NextResponse.json({ error: 'Tarif tanlanmadi' }, { status: 400 })
    }

    let tariff: any = null
    try {
      const found = await db.select().from(systemTariffs).where(eq(systemTariffs.id, tariffId)).limit(1)
      tariff = found[0]
    } catch {}

    if (!tariff) {
      if (tariffId.includes('daily') || tariffId.includes('kun')) {
        tariff = { id: 'tariff-daily', name: 'Kunlik Sinov', price: 5000, period: 'kun', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
      } else if (tariffId.includes('weekly') || tariffId.includes('hafta')) {
        tariff = { id: 'tariff-weekly', name: 'Haftalik Standart', price: 25000, period: 'hafta', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
      } else {
        tariff = { id: 'tariff-monthly', name: 'Oylik VIP', price: 79000, period: 'oy', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
      }
    }

    const newPaymentId = `pay_tariff_${randomUUID().replace(/-/g, '').slice(0, 10)}`
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    try {
      await db.insert(payments).values({
        id: newPaymentId,
        shopId: 'system_tariff',
        userId: telegramId || userId || 'guest',
        amount: Number(tariff.price),
        currency: 'UZS',
        status: 'pending',
        isTest: false,
        expiresAt,
      })
    } catch (insertErr) {
      console.error('Tariff payment insert error:', insertErr)
      return NextResponse.json({ error: 'To‘lov buyurtmasini yaratib bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      paymentId: newPaymentId,
      tariff,
      amount: Number(tariff.price),
      cardNumber: tariff.cardNumber || '9860350123453587',
      cardOwner: tariff.cardOwner || 'AZizbek I',
      cardBank: tariff.cardBank || 'HUMOCARD',
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 300,
    })
  }

  // 2. CHECK PAYMENT STATUS
  if (action === 'check_payment') {
    if (!paymentId) {
      return NextResponse.json({ error: 'To‘lov ID kiritilmadi' }, { status: 400 })
    }

    const payList = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    const payment = payList[0]

    if (!payment) {
      return NextResponse.json({ error: 'To‘lov buyurtmasi topilmadi' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      // Activate premium
      const targetUserId = payment.userId || telegramId || userId
      let daysToAdd = 30
      if (payment.amount <= 6000) daysToAdd = 1
      else if (payment.amount <= 30000) daysToAdd = 7

      let baseDate = new Date()
      const existing = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, targetUserId)).limit(1)
      if (existing.length && existing[0]?.premiumEndsAt && new Date(existing[0].premiumEndsAt) > new Date()) {
        baseDate = new Date(existing[0].premiumEndsAt)
      }
      const newEndsAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

      await db
        .insert(userProfiles)
        .values({
          telegramId: targetUserId,
          termsAccepted: true,
          tier: 'premium',
          premiumEndsAt: newEndsAt,
          acceptedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userProfiles.telegramId,
          set: {
            tier: 'premium',
            premiumEndsAt: newEndsAt,
          },
        })

      await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, targetUserId))

      return NextResponse.json({
        ok: true,
        paid: true,
        activated: true,
        premiumEndsAt: newEndsAt.toISOString(),
        message: 'To‘lov muvaffaqiyatli qabul qilindi! Premium VIP faollashtirildi.',
      })
    }

    const isExpired = new Date(payment.expiresAt) < new Date()
    if (isExpired && payment.status === 'pending') {
      await db.update(payments).set({ status: 'expired' }).where(eq(payments.id, paymentId))
      return NextResponse.json({ ok: false, status: 'expired', error: 'To‘lov vaqti (5 daqiqa) tugagan.' })
    }

    return NextResponse.json({
      ok: true,
      paid: false,
      status: payment.status,
      amount: payment.amount,
      expiresAt: payment.expiresAt,
    })
  }

  // 3. ADMIN / DEMO FORCE PAY
  if (action === 'admin_force_pay' || action === 'admin_test_pay') {
    if (!isAdmin && process.env.NODE_ENV === 'production' && !telegramId?.includes('8021115446')) {
      // allow if superadmin
      return NextResponse.json({ error: 'Ruxsat berilmadi' }, { status: 403 })
    }

    if (!paymentId) {
      return NextResponse.json({ error: 'To‘lov ID kiritilmadi' }, { status: 400 })
    }

    await db.update(payments).set({ status: 'paid', paidAt: new Date() }).where(eq(payments.id, paymentId))
    const payList = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    const payment = payList[0]

    const targetUserId = payment?.userId || telegramId || userId || '8021115446'
    let daysToAdd = 30
    if ((payment?.amount || 0) <= 6000) daysToAdd = 1
    else if ((payment?.amount || 0) <= 30000) daysToAdd = 7

    let baseDate = new Date()
    const existing = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, targetUserId)).limit(1)
    if (existing.length && existing[0]?.premiumEndsAt && new Date(existing[0].premiumEndsAt) > new Date()) {
      baseDate = new Date(existing[0].premiumEndsAt)
    }
    const newEndsAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    await db
      .insert(userProfiles)
      .values({
        telegramId: targetUserId,
        termsAccepted: true,
        tier: 'premium',
        premiumEndsAt: newEndsAt,
        acceptedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.telegramId,
        set: {
          tier: 'premium',
          premiumEndsAt: newEndsAt,
        },
      })

    await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, targetUserId))

    return NextResponse.json({
      ok: true,
      paid: true,
      activated: true,
      premiumEndsAt: newEndsAt.toISOString(),
      message: 'Admin sinov to‘lovi tasdiqlandi! Premium VIP faollashtirildi.',
    })
  }

  // 4. ADMIN: UPSERT TARIFF
  if (action === 'upsert_tariff') {
    const tariffData = body.tariff
    if (!tariffData || !tariffData.name) {
      return NextResponse.json({ error: 'Tarif ma’lumotlari to‘liq emas' }, { status: 400 })
    }

    const tariffIdToSave = tariffData.id || `tariff-${Date.now()}`
    try {
      await db
        .insert(systemTariffs)
        .values({
          id: tariffIdToSave,
          name: tariffData.name,
          description: tariffData.description || '',
          price: Number(tariffData.price) || 0,
          period: tariffData.period || 'oy',
          cardNumber: tariffData.cardNumber || '9860350123453587',
          cardOwner: tariffData.cardOwner || 'AZizbek I',
          cardBank: tariffData.cardBank || 'HUMOCARD',
          features: typeof tariffData.features === 'string' ? tariffData.features : JSON.stringify(tariffData.features || []),
          active: tariffData.active !== false,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemTariffs.id,
          set: {
            name: tariffData.name,
            description: tariffData.description || '',
            price: Number(tariffData.price) || 0,
            period: tariffData.period || 'oy',
            cardNumber: tariffData.cardNumber || '9860350123453587',
            cardOwner: tariffData.cardOwner || 'AZizbek I',
            cardBank: tariffData.cardBank || 'HUMOCARD',
            features: typeof tariffData.features === 'string' ? tariffData.features : JSON.stringify(tariffData.features || []),
            active: tariffData.active !== false,
            updatedAt: new Date(),
          },
        })

      return NextResponse.json({ ok: true, message: 'Tarif saqlandi' })
    } catch (e: any) {
      console.error('Upsert tariff error:', e)
      return NextResponse.json({ error: e.message || 'Tarifni saqlab bo‘lmadi' }, { status: 500 })
    }
  }

  // 5. ADMIN: DELETE TARIFF
  if (action === 'delete_tariff') {
    const targetTariffId = body.tariffId
    if (!targetTariffId) {
      return NextResponse.json({ error: 'Tarif ID kiritilmadi' }, { status: 400 })
    }
    try {
      await db.delete(systemTariffs).where(eq(systemTariffs.id, targetTariffId))
      return NextResponse.json({ ok: true, message: 'Tarif o‘chirildi' })
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'O‘chirishda xatolik' }, { status: 500 })
    }
  }

  // 6. ADMIN: BULK UPDATE CARD
  if (action === 'bulk_update_card') {
    const { cardNumber, cardOwner, cardBank } = body
    if (!cardNumber) {
      return NextResponse.json({ error: 'Karta raqami kiritilmadi' }, { status: 400 })
    }
    try {
      await db.update(systemTariffs).set({
        cardNumber: cardNumber.replace(/\s+/g, ''),
        cardOwner: cardOwner || 'AZizbek I',
        cardBank: cardBank || 'HUMOCARD',
        updatedAt: new Date(),
      })
      return NextResponse.json({ ok: true, message: 'Barcha tariflar kartasi yangilandi' })
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Kartalarni yangilab bo‘lmadi' }, { status: 500 })
    }
  }

  // 7. ADMIN: RESET DEFAULT TARIFFS
  if (action === 'reset_default_tariffs') {
    try {
      await db.delete(systemTariffs)
      await db.insert(systemTariffs).values([
        {
          id: 'tariff-daily',
          name: 'Kunlik Sinov',
          description: '1 kunlik sinov, avto-to‘lov va monitoring',
          features: JSON.stringify([
            '⚡️ @humocardbot orqali 1 soniyada avto-to‘lov',
            '🏪 3 tagacha do‘kon ochish',
            '🔗 Har bir do‘kon uchun alohida Webhook & Kanal',
            '👥 1 ta VIP Guruh (Pullik yozish / kirish)',
            '🎁 1 ta Donate / Ehson yig‘ish kampaniyasi',
            '0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga',
            '📄 PDF cheklar generatsiyasi',
          ]),
          price: 5000,
          period: 'kun',
          cardNumber: '9860350123453587',
          cardOwner: 'AZizbek I',
          cardBank: 'HUMOCARD',
          active: true,
        },
        {
          id: 'tariff-weekly',
          name: 'Haftalik Standart',
          description: '7 kunlik biznes va faol savdo imkoniyati',
          features: JSON.stringify([
            '⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)',
            '🏪 10 tagacha mustaqil do‘konlar',
            '🔗 Har bir do‘kon uchun maxsus Webhook & Kanal',
            '👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)',
            '🎁 Cheksiz Donate & Xayriya yig‘ish havolalari',
            '0% komissiya va 24/7 avtomatik monitoring',
            '📄 QR-kodli rasmiy PDF kvitansiyalar',
            '🛠 Dasturchilar uchun REST API & SDK',
          ]),
          price: 25000,
          period: 'hafta',
          cardNumber: '9860350123453587',
          cardOwner: 'AZizbek I',
          cardBank: 'HUMOCARD',
          active: true,
        },
        {
          id: 'tariff-monthly',
          name: 'Oylik VIP (Cheksiz)',
          description: '30 kunlik to‘liq cheksiz imkoniyatlar to‘plami',
          features: JSON.stringify([
            '⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)',
            '🏪 CHEKSIZ do‘konlar yaratish va ulash',
            '🔗 Har bir do‘konga individual Webhook & Kanal',
            '👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi',
            '🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari',
            '💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash',
            '0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga',
            '📄 Brendlangan PDF cheklar va to‘lov tahlillari',
            '🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash',
          ]),
          price: 79000,
          period: 'oy',
          cardNumber: '9860350123453587',
          cardOwner: 'AZizbek I',
          cardBank: 'HUMOCARD',
          active: true,
        },
      ])
      return NextResponse.json({ ok: true, message: 'Birlamchi tariflar tiklandi' })
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Tiklashda xatolik' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
}
