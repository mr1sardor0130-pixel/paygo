import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payments, shops, userbotConnections } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  beginOnboarding,
  getOnboarding,
  setApiId,
  setApiHash,
  startTelegramLogin,
  verifyTelegramCode,
  submitTelegram2FA,
  cancelOnboarding,
} from '@/lib/userbot-onboarding'
import { startHumoUserbot } from '@/lib/telegram-userbot'

const APP_URL = process.env.APP_URL || process.env.BETTER_AUTH_URL || ''
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID || '8021115446'

type Message = {
  chat: { id: number }
  text?: string
  from?: { id: number; first_name?: string }
}
type Update = { message?: Message }

type Flow = {
  step: string
  shop?: {
    name?: string
    description?: string
    cardNumber?: string
    cardLast4?: string
    owner?: string
  }
  userbot?: {
    apiId?: number
    apiHash?: string
    phone?: string
  }
  shopId?: string
}

const menu = {
  keyboard: [
    [{ text: '🛍 Do‘kon ochish' }, { text: '🏪 Mening do‘konim' }],
    [{ text: '💳 Mening kartam' }, { text: '🔐 Userbot ulash' }],
    [{ text: '📊 Statistika' }, { text: '🧪 Test to‘lov' }],
    [{ text: '🔗 Webhook sozlash' }, { text: '📣 Kanal ulash' }],
    [{ text: '📚 API hujjat' }, { text: '📄 Shartlar' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

const back = {
  keyboard: [[{ text: '↩️ Orqaga' }, { text: '❌ Bekor qilish' }]],
  resize_keyboard: true,
}

const clean = (text: string) => text.replace(/^[^\p{L}\p{N}]+/u, '').trim()

function formatCard(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 16) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`
  }
  return digits
}

const memoryStates = new Map<number, { flow: Flow; expiresAt: number }>()

async function stateGet(chatId: number): Promise<Flow | null> {
  const mem = memoryStates.get(chatId)
  if (mem && mem.expiresAt > Date.now()) {
    return mem.flow
  }
  try {
    const rows = await db.execute(
      sql`select "step", "payload" from telegram_bot_states where "chatId" = ${String(chatId)} and "expiresAt" > now()`
    )
    const row = rows.rows[0] as { step: string; payload: string } | undefined
    if (row) {
      const parsed = { ...JSON.parse(row.payload), step: row.step }
      memoryStates.set(chatId, { flow: parsed, expiresAt: Date.now() + 15 * 60 * 1000 })
      return parsed
    }
  } catch {}
  return null
}

async function stateSet(chatId: number, flow: Flow) {
  memoryStates.set(chatId, { flow, expiresAt: Date.now() + 15 * 60 * 1000 })
  try {
    await db.execute(
      sql`insert into telegram_bot_states ("chatId", "step", "payload", "expiresAt", "updatedAt") 
          values (${String(chatId)}, ${flow.step}, ${JSON.stringify(flow)}, now() + interval '15 minutes', now()) 
          on conflict ("chatId") do update set "step"=excluded."step", "payload"=excluded."payload", "expiresAt"=excluded."expiresAt", "updatedAt"=now()`
    )
  } catch (err) {
    console.warn('stateSet DB warning:', err)
  }
}

async function stateDelete(chatId: number) {
  memoryStates.delete(chatId)
  try {
    await db.execute(sql`delete from telegram_bot_states where "chatId"=${String(chatId)}`)
  } catch {}
}

async function send(token: string, chatId: number, text: string, reply_markup: any = menu) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'paygo-telegram-webhook' })
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: true })

  const update = (await request.json()) as Update
  const message = update.message
  if (!message?.chat?.id) return NextResponse.json({ ok: true })

  const chatId = message.chat.id
  const userIdStr = String(chatId)
  const raw = (message.text ?? '').trim()
  const text = clean(raw)
  let flow = await stateGet(chatId)

  // /start command
  if (/^\/start/.test(raw)) {
    await stateDelete(chatId)
    cancelOnboarding(userIdStr)
    await send(
      token,
      chatId,
      `👋 <b>PayGo avtomatlashtirilgan to‘lov botiga xush kelibsiz, ${message.from?.first_name ?? 'foydalanuvchi'}!</b>\n\n` +
      `⚡️ Ushbu bot orqali HUMO to‘lov bildirishnomalarini (@humocardbot) Telegram Userbot orqali avtomatik qabul qilib, o‘z do‘koningiz va tizimlaringizga ulashingiz mumkin.\n\n` +
      `Davom etish uchun shartlarni qabul qiling:`,
      {
        keyboard: [
          [{ text: '📄 Foydalanish shartlari' }, { text: '📜 Ommaviy oferta' }],
          [{ text: '✅ Qabul qilaman' }],
        ],
        resize_keyboard: true,
      }
    )
    return NextResponse.json({ ok: true })
  }

  // Cancel / Back
  if (text === 'Orqaga' || text === 'Bekor qilish' || raw === '/cancel') {
    await stateDelete(chatId)
    cancelOnboarding(userIdStr)
    await send(token, chatId, '🏠 Asosiy menyudasiz.', menu)
    return NextResponse.json({ ok: true })
  }

  // Terms & Conditions
  if (text === 'Foydalanish shartlari') {
    await send(
      token,
      chatId,
      `📄 <b>Foydalanish shartlari</b>\n\n` +
      `PayGo xizmati HUMO to‘lovlarini @humocardbot bildirishnomalari orqali tekshirish imkonini beradi. Barcha sessiyalar va ma’lumotlar xavfsiz himoyalangan.`,
      {
        keyboard: [[{ text: '📜 Ommaviy oferta' }], [{ text: '✅ Qabul qilaman' }, { text: '↩️ Orqaga' }]],
        resize_keyboard: true,
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Ommaviy oferta') {
    await send(
      token,
      chatId,
      `📜 <b>Ommaviy oferta</b>\n\n` +
      `PayGo tizimi orqali to‘lovlarni tekshirish, webhook va telegram kanal bildirishnomalaridan foydalanish shartlariga rozilik bildirasiz.`,
      {
        keyboard: [[{ text: '📄 Foydalanish shartlari' }], [{ text: '✅ Qabul qilaman' }, { text: '↩️ Orqaga' }]],
        resize_keyboard: true,
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Qabul qilaman') {
    await send(token, chatId, '✅ Shartlar qabul qilindi. Asosiy menyudan kerakli bo‘limni tanlang:', menu)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // USERBOT ULASH OQIMI (Multi-step interactive flow in chat)
  // -------------------------------------------------------------
  if (
    text === 'Userbot ulash' ||
    raw === '/userbot' ||
    raw.startsWith('/userbot') ||
    text.toLowerCase().includes('userbot') ||
    raw.toLowerCase().includes('userbot')
  ) {
    beginOnboarding(userIdStr)
    const newFlow: Flow = { step: 'userbot_api_id', userbot: {} }
    await stateSet(chatId, newFlow)
    await send(
      token,
      chatId,
      `🔐 <b>Telegram Userbot ulash (1/4)</b>\n\n` +
      `Userbot @humocardbot dan kelgan HUMO to‘lov xabarnomalarini avtomatik o‘qib, to‘lovlarni tasdiqlaydi.\n\n` +
      `1️⃣ Iltimos, <b>Telegram API ID</b> raqamingizni yuboring:\n` +
      `(Uni <a href="https://my.telegram.org">my.telegram.org</a> saytidan olasiz, masalan: <code>12345678</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  // 1. API ID input
  if (flow?.step === 'userbot_api_id') {
    const apiIdNum = Number(raw.replace(/\D/g, ''))
    if (!apiIdNum || isNaN(apiIdNum) || apiIdNum < 1000) {
      await send(token, chatId, '❗ Noto‘g‘ri API ID. Iltimos faqat raqamlardan iborat API ID ni yuboring (masalan: <code>12345678</code>):', back)
      return NextResponse.json({ ok: true })
    }
    setApiId(userIdStr, apiIdNum)
    flow.userbot = { ...flow.userbot, apiId: apiIdNum }
    flow.step = 'userbot_api_hash'
    await stateSet(chatId, flow)
    await send(
      token,
      chatId,
      `🔑 <b>API Hash kiritish (2/4)</b>\n\n` +
      `API ID: <code>${apiIdNum}</code> ✅\n\n` +
      `Endi <a href="https://my.telegram.org">my.telegram.org</a> dagi <b>API Hash</b> (32 xonali matn) ni yuboring:\n` +
      `(Masalan: <code>0123456789abcdef0123456789abcdef</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  // 2. API Hash input
  if (flow?.step === 'userbot_api_hash') {
    const apiHash = raw.trim()
    if (apiHash.length < 10) {
      await send(token, chatId, '❗ API Hash juda qisqa yoki noto‘g‘ri. Qaytadan yuboring:', back)
      return NextResponse.json({ ok: true })
    }
    setApiHash(userIdStr, apiHash)
    flow.userbot = { ...flow.userbot, apiHash }
    flow.step = 'userbot_phone'
    await stateSet(chatId, flow)
    await send(
      token,
      chatId,
      `📞 <b>Telefon raqami (3/4)</b>\n\n` +
      `Telegram hisobingiz telefon raqamini xalqaro formatda yuboring:\n` +
      `(Masalan: <code>+998901234567</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  // 3. Phone input -> Send code
  if (flow?.step === 'userbot_phone') {
    const phone = raw.replace(/[^0-9+]/g, '').trim()
    if (phone.length < 9) {
      await send(token, chatId, '❗ Telefon raqami noto‘g‘ri. Masalan: <code>+998901234567</code> shaklida yuboring:', back)
      return NextResponse.json({ ok: true })
    }
    await send(token, chatId, '⏳ Telegramdan tasdiqlash kodi so‘ralmoqda, kuting...')
    try {
      await startTelegramLogin(userIdStr, phone)
      flow.userbot = { ...flow.userbot, phone }
      flow.step = 'userbot_code'
      await stateSet(chatId, flow)
      await send(
        token,
        chatId,
        `📩 <b>Telegram tasdiqlash kodi yuborildi! (4/4)</b>\n\n` +
        `⚠️ <b>DIQQAT (Muhim!)</b>: Telegram rasmiy xavfsizlik filtri kodni chatga to‘g‘ridan-to‘g‘ri yuborishni bloklashi mumkin.\n` +
        `Shuning uchun kod raqamlari orasiga <b>nuqta</b> yoki <b>bo‘shliq</b> qo‘yib yuboring:\n\n` +
        `👉 Masalan: <code>2.1.2.3.4</code> yoki <code>2 1 2 3 4</code>`,
        back
      )
    } catch (err: any) {
      await send(token, chatId, `❌ Xatolik yuz berdi: ${err?.message ?? 'Telegram kod yubora olmadi'}.\n\nQaytadan boshlash uchun /userbot bosing.`, menu)
      await stateDelete(chatId)
    }
    return NextResponse.json({ ok: true })
  }

  // 4. Code verification (with dot stripping: e.g. "2.1.2.3.4")
  if (flow?.step === 'userbot_code') {
    const cleanCode = raw.replace(/\D/g, '').trim()
    if (!cleanCode) {
      await send(token, chatId, '❗ Kod topilmadi. Kodni nuqtalar bilan ajratib yuboring (masalan: <code>2.1.2.3.4</code>):', back)
      return NextResponse.json({ ok: true })
    }
    await send(token, chatId, '⏳ Kod tekshirilmoqda...')
    try {
      const res = await verifyTelegramCode(userIdStr, cleanCode)
      if (res.needsPassword) {
        flow.step = 'userbot_2fa'
        await stateSet(chatId, flow)
        await send(
          token,
          chatId,
          `🔐 <b>2FA (Ikki bosqichli Cloud Password) talab qilinadi!</b>\n\n` +
          `Sizning Telegram hisobingizda 2FA paroli yoqilgan.\n` +
          `Iltimos, <b>2FA parolingizni</b> yuboring:`,
          back
        )
        return NextResponse.json({ ok: true })
      }

      if (res.sessionString) {
        // Save to DB
        const connId = randomUUID()
        try {
          await db.insert(userbotConnections).values({
            id: connId,
            shopId: flow.shopId || 'default-shop',
            userId: userIdStr,
            sessionString: res.sessionString,
            status: 'active',
          })
          await db.update(shops).set({ userbotSession: res.sessionString }).where(eq(shops.userId, userIdStr))
        } catch (dbErr) {
          console.warn('DB save warning:', dbErr)
        }

        // Start Humocardbot monitoring
        if (flow.userbot?.apiId && flow.userbot.apiHash) {
          try {
            await startHumoUserbot(userIdStr, {
              apiId: flow.userbot.apiId,
              apiHash: flow.userbot.apiHash,
              sessionString: res.sessionString,
            })
          } catch (botErr) {
            console.error('startHumoUserbot error:', botErr)
          }
        }

        await stateDelete(chatId)
        await send(
          token,
          chatId,
          `🎉 <b>Tabriklaymiz! Telegram Userbot muvaffaqiyatli ulandi!</b>\n\n` +
          `🤖 <b>Humocardbot (@humocardbot) monitoringi faollashtirildi.</b>\n` +
          `Endi HUMO kartangizga kelgan har bir to‘lov avtomatik aniqlanadi va to‘lov sahifasi hamda webhookingizga real vaqtda yetkaziladi! ⚡️`,
          menu
        )
      }
    } catch (err: any) {
      await send(token, chatId, `❌ Kod xatosi: ${err?.message ?? 'Kod noto‘g‘ri yoki muddati o‘tgan'}.\nQaytadan urinib ko‘ring yoki /userbot bosing.`, back)
    }
    return NextResponse.json({ ok: true })
  }

  // 5. 2FA Password input
  if (flow?.step === 'userbot_2fa') {
    const password = raw.trim()
    if (!password) {
      await send(token, chatId, '❗ 2FA parolini yuboring:', back)
      return NextResponse.json({ ok: true })
    }
    await send(token, chatId, '⏳ 2FA paroli tekshirilmoqda...')
    try {
      const res = await submitTelegram2FA(userIdStr, password)
      if (res.sessionString) {
        const connId = randomUUID()
        try {
          await db.insert(userbotConnections).values({
            id: connId,
            shopId: flow.shopId || 'default-shop',
            userId: userIdStr,
            sessionString: res.sessionString,
            status: 'active',
          })
          await db.update(shops).set({ userbotSession: res.sessionString }).where(eq(shops.userId, userIdStr))
        } catch (dbErr) {
          console.warn('DB save warning:', dbErr)
        }

        if (flow.userbot?.apiId && flow.userbot.apiHash) {
          try {
            await startHumoUserbot(userIdStr, {
              apiId: flow.userbot.apiId,
              apiHash: flow.userbot.apiHash,
              sessionString: res.sessionString,
            })
          } catch (botErr) {
            console.error('startHumoUserbot error:', botErr)
          }
        }

        await stateDelete(chatId)
        await send(
          token,
          chatId,
          `🎉 <b>Tabriklaymiz! Userbot 2FA orqali muvaffaqiyatli ulandi!</b>\n\n` +
          `🤖 <b>Humocardbot (@humocardbot) monitoringi ishga tushirildi.</b>\n` +
          `Barcha HUMO to‘lovlari avtomatik qayta ishlanadi.`,
          menu
        )
      }
    } catch (err: any) {
      await send(token, chatId, `❌ 2FA paroli noto‘g‘ri: ${err?.message ?? 'Parol xato'}.\nQaytadan parolni yuboring:`, back)
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // DO'KON OCHISH OQIMI (Full 16-digit Card number storage)
  // -------------------------------------------------------------
  if (text === 'Do‘kon ochish') {
    await stateSet(chatId, { step: 'shop_name', shop: {} })
    await send(token, chatId, '🛍 <b>Do‘kon ochish (1/4)</b>\n\nDo‘koningiz nomini yuboring (masalan: <i>Online Supermarket</i>):', back)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'shop_name') {
    flow.shop = { ...flow.shop, name: raw.trim() }
    flow.step = 'shop_description'
    await stateSet(chatId, flow)
    await send(token, chatId, '📝 <b>Do‘kon tavsifi (2/4)</b>\n\nDo‘koningiz nima bilan shug‘ullanishi haqida qisqacha yozing:', back)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'shop_description') {
    flow.shop = { ...flow.shop, description: raw.trim() }
    flow.step = 'shop_card'
    await stateSet(chatId, flow)
    await send(
      token,
      chatId,
      `💳 <b>HUMO Karta raqami (3/4)</b>\n\n` +
      `To‘lovchilarga ko‘rinadigan <b>HUMO karta raqamingizni to‘liq</b> (16 ta raqam) yuboring:\n` +
      `(Masalan: <code>9860 3501 2345 3587</code> yoki <code>9860350123453587</code>)\n\n` +
      `⚠️ <i>Mijozlar to‘lov sahifasida ushbu kartani to‘liq ko‘rib pul o‘tkazishadi.</i>`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'shop_card') {
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 16) {
      await send(token, chatId, '❗ Karta raqami to‘liq emas. HUMO karta 16 ta raqamdan iborat bo‘lishi kerak (masalan: <code>9860 3501 2345 3587</code>):', back)
      return NextResponse.json({ ok: true })
    }
    flow.shop = {
      ...flow.shop,
      cardNumber: digits,
      cardLast4: digits.slice(-4),
    }
    flow.step = 'shop_owner'
    await stateSet(chatId, flow)
    await send(
      token,
      chatId,
      `👤 <b>Hisob / Karta egasi (4/4)</b>\n\n` +
      `Karta egasining ism-sharifini kiriting (to‘lov sahifasida ishonch uchun ko‘rsatiladi):\n` +
      `(Masalan: <code>AZIZBEK KARIMOV</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'shop_owner') {
    flow.shop = { ...flow.shop, owner: raw.trim() }
    const slug = `${(flow.shop?.name ?? 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${String(chatId).slice(-6)}`
    const shopId = randomUUID()

    await db.insert(shops).values({
      id: shopId,
      userId: userIdStr,
      name: flow.shop?.name ?? 'PayGo shop',
      slug,
      description: flow.shop?.description,
      cardNumber: flow.shop?.cardNumber ?? '9860350123453587',
      cardLast4: flow.shop?.cardLast4 ?? '3587',
      cardBank: 'HUMOCARD',
      accountOwner: flow.shop?.owner ?? 'Hisob egasi',
      approved: chatId === Number(ADMIN_ID) || true, // auto approve
    })

    await stateDelete(chatId)
    const formattedCardNum = formatCard(flow.shop?.cardNumber ?? '9860350123453587')
    await send(
      token,
      chatId,
      `✅ <b>Do‘kon muvaffaqiyatli ochildi!</b>\n\n` +
      `🏪 <b>Do‘kon:</b> ${flow.shop?.name}\n` +
      `💳 <b>Karta:</b> <code>${formattedCardNum}</code> (HUMO)\n` +
      `👤 <b>Karta egasi:</b> ${flow.shop?.owner}\n` +
      `🔗 <b>Do‘kon ID:</b> <code>${shopId}</code>\n\n` +
      `Endi to‘lovlarni qabul qilish uchun <b>🔐 Userbot ulash</b> tugmasini bosing!`,
      menu
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // MENING DO'KONIM & MENING KARTAM
  // -------------------------------------------------------------
  if (text === 'Mening do‘konim') {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(5)
    if (!userShops.length) {
      await send(token, chatId, '🏪 Sizda hali ochilgan do‘kon mavjud emas. "🛍 Do‘kon ochish" tugmasini bosing.', menu)
      return NextResponse.json({ ok: true })
    }
    const txt = userShops.map((s) =>
      `🏪 <b>${s.name}</b>\n` +
      `💳 <b>Karta:</b> <code>${formatCard(s.cardNumber || s.cardLast4)}</code>\n` +
      `👤 <b>Egasi:</b> ${s.accountOwner ?? 'Mavjud emas'}\n` +
      `⚡️ <b>Holat:</b> ${s.approved ? '✅ Faol' : '⏳ Kutilmoqda'}\n` +
      `🤖 <b>Userbot:</b> ${s.userbotSession ? '🟢 Ulangan (Humocardbot faol)' : '🔴 Ulanmagan'}\n` +
      `🆔 <b>Shop ID:</b> <code>${s.id}</code>`
    ).join('\n\n─────────────\n\n')

    await send(token, chatId, `📋 <b>Sizning do‘konlaringiz:</b>\n\n${txt}`, menu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Mening kartam') {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    if (userShops.length && userShops[0]) {
      const s = userShops[0]
      const formatted = formatCard(s.cardNumber || '9860350123453587')
      await send(
        token,
        chatId,
        `💳 <b>To‘lov qabul qiluvchi HUMO kartangiz:</b>\n\n` +
        `🔢 <b>To‘liq raqam:</b> <code>${formatted}</code>\n` +
        `👤 <b>Karta egasi:</b> ${s.accountOwner ?? 'Hisob egasi'}\n` +
        `🏦 <b>Tizim:</b> ${s.cardBank ?? 'HUMOCARD'}\n\n` +
        `ℹ️ <i>To‘lov sahifasida xaridorlarga ushbu to‘liq karta raqami ko‘rsatiladi.</i>`,
        menu
      )
    } else {
      await send(token, chatId, '💳 Hali karta kiritilmagan. Avval "🛍 Do‘kon ochish" orqali karta kiriting.', menu)
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // TEST TO'LOV
  // -------------------------------------------------------------
  if (text === 'Test to‘lov') {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    const shopId = userShops[0]?.id ?? 'default-shop'
    const paymentId = randomUUID()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const testAmount = 5000

    await db.insert(payments).values({
      id: paymentId,
      shopId,
      userId: userIdStr,
      amount: testAmount,
      currency: 'UZS',
      status: 'pending',
      expiresAt,
    })

    const payUrl = `${APP_URL}/pay/${paymentId}`
    await send(
      token,
      chatId,
      `🧪 <b>Test to‘lov yaratildi!</b>\n\n` +
      `💰 <b>Summa:</b> 5 000 UZS\n` +
      `💳 <b>Karta:</b> <code>${formatCard(userShops[0]?.cardNumber ?? '9860350123453587')}</code>\n` +
      `🔗 <b>To‘lov sahifasi:</b>\n<a href="${payUrl}">${payUrl}</a>\n\n` +
      `To‘lovchilar ushbu sahifada to‘liq karta raqamini ko‘rib, to‘lovni amalga oshirishi mumkin!`,
      menu
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Statistika') {
    const totalPayments = await db.select().from(payments).where(eq(payments.userId, userIdStr))
    const paid = totalPayments.filter((p) => p.status === 'paid')
    const totalSum = paid.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    await send(
      token,
      chatId,
      `📊 <b>To‘lov statistikasi:</b>\n\n` +
      `💰 <b>Jami muvaffaqiyatli tushum:</b> ${totalSum.toLocaleString()} UZS\n` +
      `✅ <b>To‘langan to‘lovlar:</b> ${paid.length} ta\n` +
      `⏳ <b>Kutilayotgan:</b> ${totalPayments.filter((p) => p.status === 'pending').length} ta\n` +
      `🌐 Boshqaruv paneli: ${APP_URL}/panel`,
      menu
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'API hujjat') {
    await send(token, chatId, `📚 <b>PayGo API Hujjati</b>\n\nTo‘lov tizimini saytingiz yoki botingizga integratsiya qilish uchun:\n🔗 ${APP_URL}/paybot-api.docx`, menu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Webhook sozlash') {
    await send(token, chatId, `🔗 <b>Webhook sozlamalari</b>\n\nTo‘lovlar muvaffaqiyatli bo‘lganda serveringizga xabar borishi uchun Webhook URL manzilini Web dashboard orqali sozlashingiz mumkin:\n${APP_URL}/panel`, menu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Kanal ulash') {
    await send(token, chatId, `📣 <b>Telegram kanal ulash</b>\n\nTo‘lov bildirishnomalari tushadigan shaxsiy yoki do‘kon kanalingizni ulash uchun botni kanalingizga admin qiling va kanal ID sini dashboardda kiriting:\n${APP_URL}/panel`, menu)
    return NextResponse.json({ ok: true })
  }

  // Fallback
  await send(token, chatId, 'Kerakli bo‘limni tanlang:', menu)
  return NextResponse.json({ ok: true })
}
