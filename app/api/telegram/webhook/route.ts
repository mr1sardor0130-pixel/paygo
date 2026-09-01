import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, ensureDbSchema } from '@/lib/db'
import {
  payments,
  shops,
  userbotConnections,
  systemRoles,
  systemTariffs,
  authSessions,
  userProfiles,
  systemSettings,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { isAdminTelegramId, isSuperAdminTelegramId } from '@/lib/admin'
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
import { checkShopLimit, checkTransactionLimits } from '@/lib/utils/limits'
import { startHumoUserbot, stopHumoUserbot, isUserbotActive } from '@/lib/telegram-userbot'
import { deliverWebhook, signPayload } from '@/lib/webhook'
import { generateReceiptPdfBuffer } from '@/lib/pdf-receipt'

export const dynamic = 'force-dynamic'

const APP_URL =
  process.env.APP_URL ||
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  'https://paygo-pearl.vercel.app'
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || 'Pay_Gouzbot').replace('@', '')
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID || '8021115446'

type Message = {
  message_id?: number
  chat: { id: number; title?: string; type?: string }
  text?: string
  photo?: Array<{ file_id: string; file_size?: number }>
  forward_from_chat?: { id: number; title?: string; username?: string; type?: string }
  from?: { id: number; first_name?: string; username?: string }
}

type CallbackQuery = {
  id: string
  from: { id: number; first_name?: string; username?: string }
  message?: Message
  data?: string
}

type Update = {
  update_id: number
  message?: Message
  callback_query?: CallbackQuery
}

type Flow = {
  step: string
  shop?: {
    name?: string
    description?: string
    cardNumber?: string
    cardLast4?: string
    owner?: string
    cardBank?: string
    logoUrl?: string
    webhookUrl?: string
    telegramChannelId?: string
  }
  userbot?: {
    apiId?: number
    apiHash?: string
    phone?: string
  }
  testPayment?: {
    amount?: number
  }
  targetShopId?: string
  editTariffId?: string
  editTariffField?: string
}

const menu = {
  keyboard: [
    [{ text: '🛍 Do‘kon ochish' }, { text: '🏪 Mening do‘konim' }],
    [{ text: '💳 Mening kartam' }, { text: '🔐 Userbot ulash' }],
    [{ text: '🤝 Referal (Tekin Premium)' }, { text: '💎 Tariflar' }],
    [{ text: '🧪 Test to‘lov' }, { text: '📣 Kanal ulash' }],
    [{ text: '🔗 Webhook sozlash' }, { text: '🌐 Veb-panelga kirish' }],
    [{ text: '📊 Statistika' }, { text: '📜 Tarix' }],
    [{ text: '⚖️ Faoliyat va Qonuniylik' }, { text: '📚 API hujjat' }],
    [{ text: '❌ Menyuni yopish' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
  is_persistent: false,
}

const adminMenu = {
  keyboard: [
    [{ text: '🏪 Do‘konlar boshqaruvi' }, { text: '💎 Tariflar boshqaruvi' }],
    [{ text: '👥 Adminlar boshqaruvi' }, { text: '📊 Barcha statistika' }],
    [{ text: '🤖 Userbotlar holati' }, { text: '🌐 Web CRM Dashboard' }],
    [{ text: '🏠 Asosiy menyuga qaytish' }, { text: '❌ Admin panelni yopish' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
  is_persistent: false,
}

const back = {
  keyboard: [[{ text: '↩️ Orqaga' }, { text: '❌ Bekor qilish' }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

const testAmountsKeyboard = {
  keyboard: [
    [{ text: '💵 1 000 UZS' }, { text: '💵 5 000 UZS' }],
    [{ text: '💵 10 000 UZS' }, { text: '💵 50 000 UZS' }],
    [{ text: '↩️ Orqaga' }, { text: '❌ Bekor qilish' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
}

const clean = (text: string) => text.replace(/^[^\p{L}\p{N}]+/u, '').trim()

function cleanText(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[‘'’`ʻ]/g, "'")
    .replace(/[^\p{L}\p{N}\s'/_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatCard(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length >= 16) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`
  }
  return digits || '9860 3501 2345 3587'
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

async function send(token: string, chatId: number | string, text: string, reply_markup: any = menu) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
    return await res.json()
  } catch (e) {
    console.error('send error:', e)
    return { ok: false }
  }
}

async function sendPhoto(token: string, chatId: number | string, photo: string, caption: string, reply_markup: any = menu) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption,
        reply_markup,
        parse_mode: 'HTML',
      }),
    })
    return await res.json()
  } catch (e) {
    console.error('sendPhoto error:', e)
    return { ok: false }
  }
}

async function answerCallback(token: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
      }),
    })
  } catch {}
}

async function sendDocument(
  token: string,
  chatId: number | string,
  pdfBuffer: Buffer,
  fileName: string,
  caption?: string,
  reply_markup?: any
) {
  try {
    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('document', blob, fileName)
    if (caption) formData.append('caption', caption)
    if (caption) formData.append('parse_mode', 'HTML')
    if (reply_markup) formData.append('reply_markup', JSON.stringify(reply_markup))

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    })
    return await res.json()
  } catch (e) {
    console.error('sendDocument error:', e)
    return { ok: false }
  }
}

async function renderUserTariffs(token: string, chatId: number | string, userIdStr: string) {
  let profile: any = null
  try {
    const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
    profile = profs[0]
  } catch {}

  let currentTierInfo = '<b>Oddiy (Bepul)</b> — Limitlar: max 1 do‘kon, kuniga 5 ta test to‘lov.'
  if (profile?.tier === 'premium') {
    if (profile.premiumEndsAt && new Date(profile.premiumEndsAt) > new Date()) {
      const exactEndDate = new Date(profile.premiumEndsAt).toLocaleString('uz-UZ')
      currentTierInfo = `💎 <b>PREMIUM VIP</b> (Faol)\n⏳ <b>Amal qilish muddati:</b> <code>${exactEndDate}</code> gacha`
    } else {
      currentTierInfo = '<b>Oddiy (Birlamchi)</b> — Premium muddati tugagan.'
    }
  }

  let tariffs: any[] = []
  try {
    tariffs = await db.select().from(systemTariffs).where(eq(systemTariffs.active, true))
  } catch {}

  if (!tariffs.length) {
    tariffs = [
      { id: 'tariff-daily', name: 'Kunlik', price: 1000, period: 'kun', description: '1 kunlik sinov va faol monitoring', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' },
      { id: 'tariff-weekly', name: 'Haftalik', price: 6500, period: 'hafta', description: '7 kunlik do‘kon integratsiyasi va monitoring', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' },
      { id: 'tariff-monthly', name: 'Oylik VIP', price: 27858, period: 'oy', description: '30 kunlik cheksiz do‘kon va to‘liq monitoring', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' },
    ]
  }

  const text =
    `💎 <b>PayGo Maxsus Premium Tariflari</b>\n\n` +
    `👤 <b>Hozirgi maqomingiz:</b>\n${currentTierInfo}\n\n` +
    `─────────────\n\n` +
    `📋 <b>Mavjud Tariflar va Imkoniyatlar:</b>\n\n` +
    tariffs
      .map(
        (t) =>
          `💎 <b>${t.name}</b> — <code>${Number(t.price).toLocaleString('uz-UZ')}</code> UZS / ${t.period}\n` +
          `📝 <b>Xususiyat:</b> ${t.description || 'Cheksiz to‘lovlar va to‘liq monitoring'}\n` +
          `💳 <b>Karta:</b> <code>${formatCard(t.cardNumber || '9860350123453587')}</code>\n` +
          `👤 <b>Egasi:</b> ${t.cardOwner || 'AZizbek I'} (${t.cardBank || 'HUMOCARD'})`
      )
      .join('\n\n─────────────\n\n') +
    `\n\nℹ️ <i>To‘lov qilish uchun pastdagi tugmalardan birini tanlang. 5 daqiqalik to‘lov buyurtmasi yaratiladi va Userbot orqali 1 soniyada avtomatik tasdiqlanadi.</i>`

  const inlineKeyboard = tariffs.map((t) => [
    {
      text: `💳 ${t.name} (${Number(t.price).toLocaleString('uz-UZ')} UZS) ni sotib olish`,
      callback_data: `buy_tariff_${t.id}`,
    },
  ])

  const crmAuthUrl = await generateAuthUrl(userIdStr, '/admin')
  inlineKeyboard.push([
    { text: '🌐 CRM Boshqaruv Paneli', url: crmAuthUrl }
  ])

  await send(token, chatId, text, { inline_keyboard: inlineKeyboard })
}

async function isMaintenanceMode(): Promise<boolean> {
  try {
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'maintenance_mode')).limit(1)
    return rows.length > 0 && rows[0].value === 'true'
  } catch {
    return false
  }
}

async function renderLegalInfo(token: string, chatId: number | string) {
  const textLegal = `⚖️ <b>PayGo Platformasi: SaaS Infratuzilma va Shaffoflik</b>\n\n` +
    `PayGo — bu dasturchilar va tadbirkorlar uchun yaratilgan <b>SaaS (Software as a Service)</b> platformasidir. Tizimning huquqiy asoslari quyidagicha:\n\n` +
    `🛡 <b>1. Xizmatning Mohiyati:</b>\n` +
    `Platforma to'lov tashkiloti emas va pul o'tkazmalarini amalga oshirmaydi. Bizning xizmatimiz — foydalanuvchining shaxsiy Telegram notifikatsiyalarini Webhook orqali xavfsiz yo'naltirib beruvchi <b>texnik infratuzilma (SaaS)</b> hisoblanadi.\n\n` +
    `💰 <b>2. To'lovlar va Haq olish:</b>\n` +
    `Platformadagi to'lovlar (Premium tariflar) tranzaksiyalar uchun komissiya emas, balki <b>server resurslari, webhook yetkazib berish va texnik qo'llab-quvvatlash</b> uchun olinadigan abonent to'lovidir.\n\n` +
    `🏛 <b>3. Qonuniy Asos (O'zR):</b>\n` +
    `O'zR "Shaxsiy ma'lumotlar to'g'risida"gi (ZRU-547) qonuniga muvofiq, foydalanuvchi o'z ma'lumotlarini qayta ishlash uchun ixtiyoriy rozilik beradi. Platforma bank sirini buzmaydi, balki egasining ruxsati bilan ma'lumotni yetkazadi.\n\n` +
    `⚠️ <b>4. Mas'uliyat Chegarasi:</b>\n` +
    `Platformadan faqat qonuniy maqsadlarda foydalanish shart. Noqonuniy faoliyat uchun tizimdan foydalanilganda barcha huquqiy javobgarlik foydalanuvchi zimmasida qoladi.\n\n` +
    `🤝 <i>Loyiha hozirda startap bosqichida va barcha texnik imkoniyatlar dasturchilar uchun ochiq.</i>`

  await send(token, chatId, textLegal, {
    inline_keyboard: [
      [{ text: '📜 Ommaviy oferta (Public Offer)', callback_data: 'view_offer' }],
      [{ text: '📄 Maxfiylik siyosati', callback_data: 'view_terms' }],
      [{ text: '🌐 Batafsil ma\'lumot (Veb-saytda)', url: `${APP_URL}/legal` }],
    ],
  })
}

async function renderReferralInfo(token: string, chatId: number | string, userIdStr: string) {
  let profile: any = null
  try {
    const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
    profile = profs[0]
  } catch {}

  const refCount = profile?.referralCount || 0
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${userIdStr}`

  let currentTierInfo = '<b>Oddiy (Birlamchi Bepul)</b>'
  if (profile?.tier === 'premium' && profile?.premiumEndsAt && new Date(profile.premiumEndsAt) > new Date()) {
    currentTierInfo = `💎 <b>PREMIUM VIP</b> (Amal qilish muddati: <code>${new Date(profile.premiumEndsAt).toLocaleString('uz-UZ')}</code> gacha)`
  }

  const text =
    `🤝 <b>PayGo Taklif va Referal Tizimi</b>\n\n` +
    `👤 <b>Hozirgi maqomingiz:</b>\n${currentTierInfo}\n\n` +
    `🔗 <b>Sizning Shaxsiy Taklif Havolangiz:</b>\n` +
    `<code>${refLink}</code>\n\n` +
    `👥 <b>Siz taklif qilgan do‘stlar soni:</b> <code>${refCount} ta</code>\n` +
    `🎁 <b>Yig‘ilgan (hali ishlatilmagan) do‘stlar:</b> <code>${(profile?.referralCount || 0) - (profile?.rewardedDays || 0) * 3} ta</code>\n\n` +
    `─────────────\n\n` +
    `🎁 <b>Maxsus Sovg‘alar va Mukofotlar:</b>\n\n` +
    `• 👥 <b>3 ta do‘st</b> ➔ <b>+7 KUNLIK Premium VIP</b> uzaytirish!\n\n` +
    `ℹ️ <i>Ushbu havolangizni do‘stlaringizga yuboring. Ular botimizga kirib /start tugmasini bosishi bilan bazada hisoblanadi. Yeterli do‘st yig‘ilgach "Ayirboshlash" tugmasini bosing!</i>`

  await send(token, chatId, text, {
    inline_keyboard: [
      [{ text: '📢 Havolani do‘stlarga ulashish', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('🔥 PayGo - HUMO to‘lovlarini avtomatlashtirish va telegram botlar integratsiyasi botiga taklif qilaman!')}` }],
      [{ text: '💎 Premiumga ayirboshlash (3 ta do‘st = 7 kun)', callback_data: 'referral_exchange' }],
      [{ text: '💎 Tariflar bo‘limiga o‘tish', callback_data: 'tariffs_page' }],
    ],
  })
}

async function activateTariffForUser(
  token: string,
  chatId: number | string,
  userIdStr: string,
  payment: any
) {
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
  if (period === 'day' || period === 'kun') daysToAdd = 1
  else if (period === 'week' || period === 'hafta') daysToAdd = 7
  else if (period === 'month' || period === 'oy') daysToAdd = 30

  // Check if user already has an active subscription to accumulate time
  let baseDate = new Date()
  try {
    const existing = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
    if (existing.length && existing[0]?.premiumEndsAt && new Date(existing[0].premiumEndsAt) > new Date()) {
      baseDate = new Date(existing[0].premiumEndsAt)
    }
  } catch {}

  const premiumEndsAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  const formattedExactDate = premiumEndsAt.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // 1. Update user_profiles
  try {
    await db
      .insert(userProfiles)
      .values({
        telegramId: userIdStr,
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
  } catch (err) {
    console.warn('User profile tier update err:', err)
  }

  // 2. Update user's shops tier
  try {
    await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, userIdStr))
  } catch (err) {
    console.warn('Shops tier update err:', err)
  }

  // 3. Mark payment as paid
  await db.update(payments).set({ status: 'paid', matchedAt: new Date() }).where(eq(payments.id, payment.id))

  // 4. Generate PDF Receipt and send to user
  try {
    const pdfBuffer = await generateReceiptPdfBuffer({
      paymentId: payment.id,
      title: `PayGo Premium - ${name}`,
      amount: payment.amount,
      cardNumber: '9860350123453587',
      cardOwner: 'AZizbek I',
      date: new Date().toLocaleString('uz-UZ'),
      userId: userIdStr,
      status: 'PAID',
    })

    await send(
      token,
      chatId,
      `🎉 <b>Tabriklaymiz! To‘lovingiz Muvaffaqiyatli Tasdiqlandi!</b>\n\n` +
      `💎 <b>Aktivlashtirilgan Tarif:</b> ${name}\n` +
      `⏳ <b>Amal qilish muddati (daqiqa va soniyasigacha):</b>\n<code>${formattedExactDate}</code> gacha\n\n` +
      `🚀 <b>Imkoniyatlar:</b> Cheksiz do‘konlar, cheksiz to‘lovlar va to‘liq monitoring faollashtirildi!\n\n` +
      `📄 <i>Quyida rasmiy to‘lov chekingiz PDF shaklida yuborilmoqda.</i>`,
      menu
    )

    await sendDocument(
      token,
      chatId,
      pdfBuffer,
      `PayGo_Receipt_${payment.id}.pdf`,
      `📄 <b>PayGo Rasmiy To‘lov Cheki</b> (ID: <code>${payment.id}</code>)`
    )
  } catch (pdfErr) {
    console.error('PDF generation or sending error:', pdfErr)
    await send(
      token,
      chatId,
      `🎉 <b>Tabriklaymiz! To‘lovingiz Tasdiqlandi va Tarif Faollashtirildi!</b>\n\n` +
      `💎 <b>Aktivlashtirilgan Tarif:</b> ${name}\n` +
      `⏳ <b>Amal qilish muddati (daqiqa va soniyasigacha):</b>\n<code>${formattedExactDate}</code> gacha`,
      menu
    )
  }
}

// Check if user has an active userbot connection
async function isUserbotConnectedForUser(userIdStr: string): Promise<boolean> {
  try {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    if (userShops.length && userShops[0]?.userbotSession) {
      return true
    }
    const conns = await db.select().from(userbotConnections).where(eq(userbotConnections.userId, userIdStr))
    if (conns.some((c) => c.status === 'active' && Boolean(c.sessionString))) {
      return true
    }
  } catch (e) {
    console.warn('isUserbotConnectedForUser check error:', e)
  }
  return isUserbotActive(userIdStr)
}

// Render and send detailed shop information
async function showShopDetails(token: string, chatId: number, userIdStr: string, shopId?: string) {
  let userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr))
  
  if (!userShops.length) {
    await send(
      token,
      chatId,
      '🏪 <b>Sizda hali do‘kon yo‘q.</b>\n\nTo‘lovlarni qabul qilish va boshlash uchun <b>🛍 Do‘kon ochish</b> tugmasini bosing.',
      menu
    )
    return
  }

  // If there are multiple shops and no specific shopId was requested, show a list
  if (userShops.length > 1 && !shopId) {
    const inline_keyboard = userShops.map(shop => [
      { text: `🏪 ${shop.name} (${shop.id})`, callback_data: `view_my_shop_${shop.id}` }
    ])
    
    await send(
      token,
      chatId,
      '🏪 <b>Sizda bir nechta do‘kon mavjud.</b>\n\nBoshqarish uchun do‘konni tanlang:',
      { inline_keyboard }
    )
    return
  }

  // Find the selected shop or default to the first one
  let s = userShops[0]
  if (shopId) {
    const found = userShops.find(shop => shop.id === shopId)
    if (found) s = found
  }

  const isConnected = await isUserbotConnectedForUser(userIdStr)
  const formattedCard = formatCard(s.cardNumber || s.cardLast4 || '9860350123453587')
  const authUrl = await generateAuthUrl(userIdStr)

  const text = `🏪 <b>Do‘kon Ma’lumotlari va Sozlamalari:</b>\n\n` +
    `🏷 <b>Nomi:</b> ${s.name}\n` +
    `💳 <b>Karta:</b> <code>${formattedCard}</code> (${s.cardBank || 'HUMOCARD'})\n` +
    `👤 <b>Egasi:</b> ${s.accountOwner || 'Kiritilmagan'}\n` +
    `🖼 <b>Logo:</b> ${s.logoUrl ? '✅ Yuklangan' : '❌ Yo‘q'}\n` +
    `🔗 <b>Webhook URL:</b> ${s.webhookUrl ? `<code>${s.webhookUrl}</code>` : '❌ O‘rnatilmagan'}\n` +
    `📣 <b>Telegram Kanal:</b> ${s.telegramChannelId ? `<code>${s.telegramChannelId}</code>` : '❌ Ulanmagan'}\n` +
    `🤖 <b>Userbot (@humocardbot):</b> ${isConnected ? '🟢 Ulangan va Faol' : '🔴 Ulanmagan'}\n` +
    `⚡️ <b>Holat:</b> ${s.approved ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda'}\n` +
    `🆔 <b>Shop ID:</b> <code>${s.id}</code>\n\n` +
    `Tahrirlash va boshqarish uchun quyidagi tugmalardan foydalaning:`

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '✏️ Nomni o‘zgartirish', callback_data: `edit_shop_name_${s.id}` },
        { text: '💳 Karta & Egasini tahrirlash', callback_data: `edit_shop_card_${s.id}` },
      ],
      [
        { text: '🔗 Webhook sozlash', callback_data: `edit_shop_webhook_${s.id}` },
        { text: '🖼 Logo yuklash', callback_data: `edit_shop_logo_${s.id}` },
      ],
      [
        { text: '📣 Kanal ulash / test', callback_data: `edit_shop_channel_${s.id}` },
        { text: '🧪 Test to‘lov', callback_data: `test_pay_${s.id}` },
      ],
      [
        ...(isConnected
          ? [{ text: '🔴 Userbotni uzish', callback_data: `userbot_disconnect_step1` }]
          : [{ text: '🔐 Userbot ulash', callback_data: `userbot_connect_prompt` }]),
      ],
      [
        { text: '📱 Do‘kon Veb CRM (Mini App)', web_app: { url: authUrl } },
        { text: '🌐 Brauzerda ochish', url: authUrl },
      ],
    ],
  }

  if (s.logoUrl && s.logoUrl.startsWith('http')) {
    const photoRes = await sendPhoto(token, chatId, s.logoUrl, text, reply_markup)
    if (!photoRes || !photoRes.ok) {
      await send(token, chatId, text, reply_markup)
    }
  } else {
    await send(token, chatId, text, reply_markup)
  }
}

// Render and send Userbot status or onboarding flow
async function showUserbotStatus(token: string, chatId: number, userIdStr: string) {
  const isConnected = await isUserbotConnectedForUser(userIdStr)

  if (isConnected) {
    await send(
      token,
      chatId,
      `🤖 <b>Userbot Holati: 🟢 Ulangan va Faol</b>\n\n` +
      `✅ Sizning Telegram hisobingiz orqali <b>@humocardbot</b> monitoringi faol ishlamoqda.\n` +
      `⚡️ HUMO kartangizga pul tushishi bilan to‘lovlar avtomatik tasdiqlanadi va Webhook hamda Telegram kanalingizga yuboriladi.\n\n` +
      `🆔 <b>Telegram ID:</b> <code>${userIdStr}</code>\n` +
      `🔔 <b>Monitoring:</b> @humocardbot to‘lov xabarnomalari\n\n` +
      `⚙️ <i>Agar hisobingizni almashtirmoqchi bo‘lsangiz yoki userbotni to‘xtatmoqchi bo‘lsangiz, quyidagi tugma orqali uzishingiz mumkin (2 bosqichli tasdiq talab qilinadi).</i>`,
      {
        inline_keyboard: [
          [{ text: '🔴 Userbotni uzish', callback_data: 'userbot_disconnect_step1' }],
          [
            { text: '🧪 Test to‘lov', callback_data: 'test_pay' },
            { text: '🏪 Mening do‘konim', callback_data: 'view_my_shop' },
          ],
        ],
      }
    )
    return
  }

  // Not connected yet: start fresh onboarding
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
}

// Generate authenticated login URL for user
async function generateAuthUrl(userIdStr: string, path: string = '/panel'): Promise<string> {
  const token = `auth_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  try {
    await db.insert(authSessions).values({
      token,
      userId: userIdStr,
      telegramId: userIdStr,
      expiresAt,
    })
  } catch (e) {
    console.warn('Auth token insert warning:', e)
  }
  return `${APP_URL}${path}?auth_token=${token}&userId=${userIdStr}`
}

// Notify Super Admin on new or updated shop with 1-click inline buttons
async function notifyAdminNewShop(token: string, shop: any) {
  const adminId = '8021115446'
  const formatted = formatCard(shop.cardNumber || '9860350123453587')
  const text =
    `🔔 <b>Yangi Do‘kon Yaratildi / Tahrirlandi!</b>\n\n` +
    `🏪 <b>Nomi:</b> ${shop.name}\n` +
    `💳 <b>Karta:</b> <code>${formatted}</code> (${shop.cardBank || 'HUMOCARD'})\n` +
    `👤 <b>Egasi:</b> ${shop.accountOwner || 'Hisob egasi'}\n` +
    `🆔 <b>Telegram ID:</b> <code>${shop.userId}</code>\n` +
    `🔗 <b>Shop ID:</b> <code>${shop.id}</code>\n` +
    `⚡️ <b>Holat:</b> ${shop.approved ? '✅ Tasdiqlangan' : '⏳ Tasdiq kutilmoqda'}\n\n` +
    `Do‘konni boshqarish uchun quyidagi tugmalardan foydalaning:`

  try {
    const adminAuthUrl = await generateAuthUrl(adminId, '/admin')
    await send(token, adminId, text, {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `approve_shop_${shop.id}` },
          { text: '🚫 To‘xtatish', callback_data: `reject_shop_${shop.id}` },
        ],
        [{ text: '🌐 Admin CRM da ko‘rish', url: adminAuthUrl }],
      ],
    })
  } catch (e) {
    console.warn('Admin notification warning:', e)
  }
}

async function renderAdminTariffManagement(token: string, chatId: number | string) {
  let tariffs: any[] = []
  try {
    tariffs = await db.select().from(systemTariffs)
  } catch {}

  if (!tariffs.length) {
    try {
      await db.insert(systemTariffs).values([
        { id: 'tariff-daily', name: 'Kunlik', description: '1 kunlik sinov va faol monitoring', price: 1000, period: 'kun', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD', active: true },
        { id: 'tariff-weekly', name: 'Haftalik', description: '7 kunlik do‘kon integratsiyasi', price: 6500, period: 'hafta', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD', active: true },
        { id: 'tariff-monthly', name: 'Oylik VIP', description: '30 kunlik to‘liq cheksiz imkoniyat', price: 27858, period: 'oy', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD', active: true },
      ]).onConflictDoNothing()
      tariffs = await db.select().from(systemTariffs)
    } catch {}
  }

  const listText = tariffs
    .map((t, idx) =>
      `<b>${idx + 1}️⃣ ${t.name}</b> (ID: <code>${t.id}</code>)\n` +
      `💰 <b>Narxi:</b> <code>${Number(t.price).toLocaleString('uz-UZ')}</code> UZS / ${t.period}\n` +
      `💳 <b>Karta:</b> <code>${formatCard(t.cardNumber || '9860350123453587')}</code>\n` +
      `👤 <b>Egasi:</b> ${t.cardOwner || 'AZizbek I'} (${t.cardBank || 'HUMOCARD'})\n` +
      `📝 <b>Tavsif:</b> ${t.description || 'Cheksiz to‘lov qabul qilish va monitoring'}`
    )
    .join('\n\n─────────────\n\n')

  const inlineButtons: any[] = tariffs.map((t) => [
    { text: `✏️ ${t.name} ni tahrirlash`, callback_data: `adm_ed_tar_${t.id}` }
  ])

  inlineButtons.push([
    { text: `💳 Barcha kartalarni o‘zgartirish`, callback_data: `adm_tar_card_all` }
  ])

  await send(
    token,
    chatId,
    `💎 <b>PayGo Tizim Tariflari va Karta Boshqaruvi</b>\n\n` +
    `${listText}\n\n` +
    `👇 <i>Tahrirlamoqchi bo‘lgan tarifingizni tanlang yoki barcha kartalarni o‘zgartiring:</i>\n\n` +
    `🌐 Web CRM: <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
    { inline_keyboard: inlineButtons }
  )
}

async function renderAdminTariffDetail(token: string, chatId: number | string, tariffId: string) {
  let tariff: any = null
  try {
    const list = await db.select().from(systemTariffs).where(eq(systemTariffs.id, tariffId)).limit(1)
    tariff = list[0]
  } catch {}

  if (!tariff) {
    await send(token, chatId, '⚠️ Tarif topilmadi.')
    return
  }

  const text =
    `⚙️ <b>Tarif Tahrirlash: ${tariff.name}</b>\n\n` +
    `🆔 <b>ID:</b> <code>${tariff.id}</code>\n` +
    `📝 <b>Nomi:</b> ${tariff.name}\n` +
    `💰 <b>Narxi:</b> <code>${Number(tariff.price).toLocaleString('uz-UZ')}</code> UZS\n` +
    `⏱ <b>Muddati:</b> ${tariff.period}\n` +
    `💳 <b>Karta:</b> <code>${formatCard(tariff.cardNumber || '')}</code>\n` +
    `👤 <b>Egasi:</b> ${tariff.cardOwner || ''}\n` +
    `🏦 <b>Bank:</b> ${tariff.cardBank || 'HUMOCARD'}\n` +
    `📄 <b>Tavsif:</b> ${tariff.description || '-'}\n\n` +
    `Quyidagi tugmalardan birini tanlab, kerakli maydonni o‘zgartiring:`

  const buttons = [
    [
      { text: '💳 Karta raqami', callback_data: `adm_tf_field_${tariff.id}_cardNumber` },
      { text: '👤 Karta egasi', callback_data: `adm_tf_field_${tariff.id}_cardOwner` },
    ],
    [
      { text: '🏦 Bank nomi', callback_data: `adm_tf_field_${tariff.id}_cardBank` },
      { text: '💰 Narxi', callback_data: `adm_tf_field_${tariff.id}_price` },
    ],
    [
      { text: '📝 Nomi', callback_data: `adm_tf_field_${tariff.id}_name` },
      { text: '📄 Tavsif', callback_data: `adm_tf_field_${tariff.id}_description` },
    ],
    [
      { text: '🔙 Tariflar ro‘yxatiga qaytish', callback_data: 'adm_tar_list' }
    ]
  ]

  await send(token, chatId, text, { inline_keyboard: buttons })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'paygo-telegram-webhook', time: new Date().toISOString() })
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: true })

  let update: Update
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  await ensureDbSchema()

  const maintenance = await isMaintenanceMode()
  const telegramId = update.message?.from?.id || update.callback_query?.from?.id
  const isAdmin = await isAdminTelegramId(telegramId)

  if (maintenance && !isAdmin) {
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id || update.callback_query?.from.id
    if (chatId) {
      await send(
        token,
        chatId,
        '🚧 <b>Texnik ishlar olib borilmoqda</b>\n\n' +
        'Hozirda tizimda texnik sozlash ishlari ketmoqda. Bot vaqtincha faol emas.\n' +
        'Keltirilgan noqulayliklar uchun uzr so‘raymiz. Tez orada qaytamiz! 🔧'
      )
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // CALLBACK QUERY HANDLER (Inline button clicks)
  // -------------------------------------------------------------
  if (update.callback_query) {
    const cb = update.callback_query
    const chatId = cb.message?.chat.id || cb.from.id
    const userIdStr = String(cb.from.id)
    const data = cb.data || ''

    await answerCallback(token, cb.id)

    // Shop settings inline actions
    if (data.startsWith('edit_shop_name_')) {
      const shopId = data.replace('edit_shop_name_', '')
      await stateSet(chatId, { step: 'edit_shop_name', targetShopId: shopId })
      await send(token, chatId, '✏️ <b>Do‘kon nomini o‘zgartirish:</b>\n\nYangi nomni kiriting (masalan: <i>PayGo Super Market</i>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('edit_shop_card_')) {
      const shopId = data.replace('edit_shop_card_', '')
      await stateSet(chatId, { step: 'edit_shop_card_num', targetShopId: shopId })
      await send(
        token,
        chatId,
        `💳 <b>Karta raqamini o‘zgartirish:</b>\n\n` +
        `Yangi 16 ta raqamdan iborat HUMO karta raqamini yuboring:\n(Masalan: <code>9860350123453587</code>)`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'edit_shop_webhook' || data.startsWith('edit_shop_webhook_')) {
      let shopId = data.startsWith('edit_shop_webhook_') ? data.replace('edit_shop_webhook_', '') : ''
      if (!shopId) {
        const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
        if (!userShops.length) {
          await send(token, chatId, '⚠️ <b>Xatolik:</b> Sizda hali do‘kon mavjud emas. Avval <b>🛍 Do‘kon ochish</b> tugmasi orqali do‘kon yarating.', menu)
          return NextResponse.json({ ok: true })
        }
        shopId = userShops[0].id
      }

      await stateSet(chatId, { step: 'edit_shop_webhook_url', targetShopId: shopId })
      await send(
        token,
        chatId,
        `🔗 <b>Webhook URL manzilini sozlash:</b>\n\n` +
        `To‘lovlar muvaffaqiyatli bo‘lganda JSON xabarnoma yuboriladigan HTTPS URL manzilingizni kiriting:\n` +
        `(Masalan: <code>https://mysite.uz/api/paygo-webhook</code>)\n\n` +
        `Webhookni o‘chirish uchun <code>ochirish</code> deb yuboring.`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('edit_shop_channel_')) {
      const shopId = data.replace('edit_shop_channel_', '')
      await stateSet(chatId, { step: 'channel_connect', targetShopId: shopId })
      await send(
        token,
        chatId,
        `📣 <b>Telegram Kanal Ulash / O‘zgartirish:</b>\n\n` +
        `1️⃣ Botimizni kanalingizga <b>Administrator</b> qilib qo‘shing.\n` +
        `2️⃣ Kanalingiz username (@kanalingiz) yoki ID (-100...) sini yuboring, yoki kanaldan biror xabarni shu yerga <b>Forward</b> qiling:`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('edit_shop_logo_')) {
      const shopId = data.replace('edit_shop_logo_', '')
      await stateSet(chatId, { step: 'edit_shop_logo_url', targetShopId: shopId })
      await send(
        token,
        chatId,
        `🖼 <b>Do‘kon Logotipi / Rasmi:</b>\n\n` +
        `Logotip rasm havolasini (URL) yuboring yoki to‘g‘ridan-to‘g‘ri rasm faylini botga yuboring:\n` +
        `(Masalan: <code>https://mysite.uz/logo.png</code>)`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('test_channel_post_')) {
      const shopId = data.replace('test_channel_post_', '')
      const userShops = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1)
      const shop = userShops[0]
      if (!shop?.telegramChannelId) {
        await send(token, chatId, '⚠️ Sizda kanal ulanmagan. Avval "📣 Kanal ulash" orqali kanal ulang.', menu)
        return NextResponse.json({ ok: true })
      }

      const testPost =
        `📣 <b>PayGo Test To‘lov Xabarnomasi</b>\n\n` +
        `🏪 <b>Do‘kon:</b> ${shop.name}\n` +
        `💰 <b>Summa:</b> 5 000 UZS\n` +
        `💳 <b>Karta:</b> <code>${formatCard(shop.cardNumber || '9860350123453587')}</code>\n` +
        `👤 <b>Karta egasi:</b> ${shop.accountOwner || 'Hisob egasi'}\n` +
        `⚡️ <b>Holat:</b> ✅ To‘landi (Test xabar)\n\n` +
        `📦 <b>Webhook JSON Payload:</b>\n` +
        `<pre><code class="language-json">{\n  "event": "payment.paid",\n  "amount": 5000,\n  "currency": "UZS",\n  "shop_id": "${shop.id}",\n  "status": "paid"\n}</code></pre>`

      const channelRes = await send(token, shop.telegramChannelId, testPost, { inline_keyboard: [] })
      if (channelRes?.ok) {
        await send(token, chatId, `✅ <b>Kanalga test xabar va JSON ma’lumot muvaffaqiyatli yuborildi!</b>\nKanalingizni tekshiring.`, menu)
      } else {
        await send(token, chatId, `❌ <b>Kanalga xabar yuborishda xatolik:</b> ${channelRes?.description || 'Bot kanalda admin emas'}.\nIltimos botni kanalga admin qiling.`, menu)
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('view_my_shop_')) {
      const shopId = data.replace('view_my_shop_', '')
      await showShopDetails(token, chatId, userIdStr, shopId)
      return NextResponse.json({ ok: true })
    }
    
    if (data === 'view_my_shop') {
      await showShopDetails(token, chatId, userIdStr)
      return NextResponse.json({ ok: true })
    }

    if (data === 'userbot_connect_prompt') {
      await showUserbotStatus(token, chatId, userIdStr)
      return NextResponse.json({ ok: true })
    }

    // -----------------------------------------------------------
    // USERBOT 2-STEP DISCONNECT HANDLERS
    // -----------------------------------------------------------
    if (data === 'userbot_disconnect_step1') {
      await send(
        token,
        chatId,
        `⚠️ <b>1-bosqich: Haqiqatan ham Userbotni uzmoqchimisiz?</b>\n\n` +
        `Userbot uzilsa:\n` +
        `• <b>@humocardbot</b> dan keladigan HUMO to‘lov xabarnomalari o‘qilmaydi\n` +
        `• Do‘koningizdagi to‘lovlar avtomatik tasdiqlanmay qoladi\n\n` +
        `Davom etish uchun quyidagi <b>"⚠️ Ha, uzishni tasdiqlayman (1/2)"</b> tugmasini bosing:`,
        {
          inline_keyboard: [
            [{ text: '⚠️ Ha, uzishni tasdiqlayman (1/2)', callback_data: 'userbot_disconnect_step2' }],
            [{ text: '❌ Bekor qilish (qoldirish)', callback_data: 'userbot_disconnect_cancel' }],
          ],
        }
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'userbot_disconnect_step2') {
      await send(
        token,
        chatId,
        `🚨 <b>2-bosqich (Yakuniy tasdiq): Userbotni butunlay uzishga 100% aminmisiz?</b>\n\n` +
        `Sizning Telegram sessiyangiz server xotirasidan va ma’lumotlar bazasidan butunlay o‘chiriladi.\n\n` +
        `Uzishni yakunlash uchun quyidagi tugmani bosing (2/2):`,
        {
          inline_keyboard: [
            [{ text: '🔴 HA, USERBOTNI BUTUNLAY UZISH (2/2)', callback_data: 'userbot_disconnect_final' }],
            [{ text: '↩️ Bekor qilish (qoldirish)', callback_data: 'userbot_disconnect_cancel' }],
          ],
        }
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'userbot_disconnect_final') {
      stopHumoUserbot(userIdStr)
      cancelOnboarding(userIdStr)
      try {
        await db.update(shops).set({ userbotSession: null }).where(eq(shops.userId, userIdStr))
        await db.delete(userbotConnections).where(eq(userbotConnections.userId, userIdStr))
      } catch (dbErr) {
        console.warn('Disconnect DB error:', dbErr)
      }
      await stateDelete(chatId)
      await send(
        token,
        chatId,
        `✅ <b>Userbot muvaffaqiyatli uzildi va to‘xtatildi!</b>\n\n` +
        `Sizning sessiyangiz xavfsiz tarzda o‘chirildi. Endi yangi Telegram hisobini ulash uchun <b>🔐 Userbot ulash</b> tugmasini bosishingiz mumkin.`,
        menu
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'userbot_disconnect_cancel') {
      await send(
        token,
        chatId,
        `🟢 <b>Bekor qilindi.</b> Userbot faol holatda qoldirildi va @humocardbot to‘lovlari monitoringi davom etmoqda.`,
        menu
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('test_pay_')) {
      const shopId = data.replace('test_pay_', '')
      const userShops = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1)
      if (!userShops.length) {
        await send(token, chatId, '⚠️ Test to‘lov yaratishdan oldin do‘kon ochishingiz kerak. Iltimos <b>🛍 Do‘kon ochish</b> tugmasini bosing.', menu)
        return NextResponse.json({ ok: true })
      }
      await stateSet(chatId, { step: 'test_pay_amount', targetShopId: shopId })
      await send(
        token,
        chatId,
        `🧪 <b>Test To‘lov Yaratish (1/2)</b>\n\n` +
        `To‘lov tizimingizni sinash uchun test to‘lov summasini kiriting (masalan: <code>15000</code>) yoki quyidagi variantlardan birini tanlang:\n\n` +
        `⏱ <i>To‘lov muddati: <b>5 daqiqa (300 soniya)</b></i>`,
        testAmountsKeyboard
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'test_pay') {
      const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
      if (!userShops.length) {
        await send(token, chatId, '⚠️ Test to‘lov yaratishdan oldin do‘kon ochishingiz kerak. Iltimos <b>🛍 Do‘kon ochish</b> tugmasini bosing.', menu)
        return NextResponse.json({ ok: true })
      }
      await stateSet(chatId, { step: 'test_pay_amount', targetShopId: userShops[0].id })
      await send(
        token,
        chatId,
        `🧪 <b>Test To‘lov Yaratish (1/2)</b>\n\n` +
        `To‘lov tizimingizni sinash uchun test to‘lov summasini kiriting (masalan: <code>15000</code>) yoki quyidagi variantlardan birini tanlang:\n\n` +
        `⏱ <i>To‘lov muddati: <b>5 daqiqa (300 soniya)</b></i>`,
        testAmountsKeyboard
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('unlink_channel_')) {
      const shopId = data.replace('unlink_channel_', '')
      if (shopId) {
        await db.update(shops).set({ telegramChannelId: null }).where(and(eq(shops.userId, userIdStr), eq(shops.id, shopId)))
      } else {
        await db.update(shops).set({ telegramChannelId: null }).where(eq(shops.userId, userIdStr))
      }
      await send(token, chatId, '✅ Telegram kanal muvaffaqiyatli uzildi.', menu)
      return NextResponse.json({ ok: true })
    }

    if (data === 'unlink_channel') {
      await db.update(shops).set({ telegramChannelId: null }).where(eq(shops.userId, userIdStr))
      await send(token, chatId, '✅ Telegram kanal muvaffaqiyatli uzildi.', menu)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('approve_shop_')) {
      const targetId = data.replace('approve_shop_', '')
      await db.update(shops).set({ approved: true }).where(eq(shops.id, targetId))
      const targetShops = await db.select().from(shops).where(eq(shops.id, targetId)).limit(1)
      const targetShop = targetShops[0]

      await send(token, chatId, `✅ <b>Do‘kon (ID: <code>${targetId}</code>) muvaffaqiyatli tasdiqlandi!</b>`, adminMenu)

      if (targetShop?.userId) {
        const ownerAuthUrl = await generateAuthUrl(targetShop.userId)
        await send(
          token,
          targetShop.userId,
          `🎉 <b>Ajoyib yangilik!</b>\n\n` +
          `Sizning <b>${targetShop.name}</b> do‘koningiz admin tomonidan to‘liq tasdiqlandi!\n` +
          `Endi to‘lovlarni qabul qilish va boshqarish imkoniyati 100% ochiq.`,
          {
            inline_keyboard: [
              [{ text: '📱 Do‘kon Boshqaruvi (Mini App)', web_app: { url: ownerAuthUrl } }],
              [{ text: '🧪 Test To‘lov Yaratish', callback_data: 'test_pay' }],
            ],
          }
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('reject_shop_')) {
      const targetId = data.replace('reject_shop_', '')
      await db.update(shops).set({ approved: false }).where(eq(shops.id, targetId))
      const targetShops = await db.select().from(shops).where(eq(shops.id, targetId)).limit(1)
      const targetShop = targetShops[0]

      await send(token, chatId, `🚫 <b>Do‘kon (ID: <code>${targetId}</code>) to‘xtatildi.</b>`, adminMenu)

      if (targetShop?.userId) {
        await send(
          token,
          targetShop.userId,
          `⚠️ <b>Diqqat!</b>\n\n` +
          `Sizning <b>${targetShop?.name || 'Do‘kon'}</b> do‘koningiz admin tomonidan vaqtincha to‘xtatildi.\n` +
          `Qo‘shimcha ma’lumot uchun admin bilan bog‘laning.`,
          menu
        )
      }
      return NextResponse.json({ ok: true })
    }

    // -------------------------------------------------------------
    // TARIFF & REFERRAL CALLBACK HANDLERS
    // -------------------------------------------------------------
    if (data === 'tariffs_page') {
      await renderUserTariffs(token, chatId, userIdStr)
      return NextResponse.json({ ok: true })
    }

    if (data === 'referral_page') {
      await renderReferralInfo(token, chatId, userIdStr)
      return NextResponse.json({ ok: true })
    }

    if (data === 'referral_exchange') {
      const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
      const profile = profs[0]
      const refCount = profile?.referralCount || 0
      const rewardedDays = profile?.rewardedDays || 0
      const redeemedSets = Math.floor(rewardedDays / 7)
      const usedRefs = redeemedSets * 3
      const availableRefs = refCount - usedRefs

      if (availableRefs < 3) {
        await send(token, chatId, `❌ <b>Ayirboshlash uchun kamida 3 ta do‘st taklif qilingan bo‘lishi kerak!</b>\n\nSizda hozir <b>${availableRefs} ta</b> ishlatilmagan taklif bor.`, {
          inline_keyboard: [[{ text: '↩️ Orqaga', callback_data: 'referral_page' }]],
        })
        return NextResponse.json({ ok: true })
      }

      // Perform exchange
      const newRewardedDays = rewardedDays + 7
      let newEndsAt = profile?.premiumEndsAt && new Date(profile.premiumEndsAt) > new Date()
        ? new Date(profile.premiumEndsAt)
        : new Date()
      
      newEndsAt = new Date(newEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000)

      await db.update(userProfiles).set({
        tier: 'premium',
        premiumEndsAt: newEndsAt,
        rewardedDays: newRewardedDays
      }).where(eq(userProfiles.telegramId, userIdStr))

      // Also update shops to premium
      await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, userIdStr))

      await send(token, chatId, `🎉 <b>Muvaffaqiyatli ayirboshlandi!</b>\n\n3 ta do‘stingiz evaziga sizga <b>+7 KUNLIK Premium VIP</b> taqdim etildi!\n\n⏳ <b>Yangi muddat:</b> <code>${newEndsAt.toLocaleString('uz-UZ')}</code> gacha`, {
        inline_keyboard: [[{ text: '✅ Tushunarli', callback_data: 'referral_page' }]],
      })
      return NextResponse.json({ ok: true })
    }

    if (data === 'view_offer') {
      const offerText = `📜 <b>Ommaviy oferta (Public Offer)</b>\n\n` +
        `Ushbu hujjat "PayGo" platformasi va foydalanuvchi o'rtasidagi yuridik kelishuvdir.\n\n` +
        `<b>1. Xizmat turi:</b> Texnik xizmat ko'rsatish, axborotni avtomatlashtirilgan tarzda uzatish.\n` +
        `<b>2. Aksept:</b> Platformadan foydalanishni boshlash shartnoma shartlariga to'liq rozilikni bildiradi.\n` +
        `<b>3. To'lovlar:</b> Premium xizmatlar uchun to'lovlar ixtiyoriy va qaytarib berilmaydi (xizmat ko'rsatilganligi sababli).\n` +
        `<b>4. Xavfsizlik:</b> Platforma shaxsiy ma'lumotlar maxfiyligini ta'minlash uchun xalqaro standartlardan foydalanadi.\n\n` +
        `Batafsil veb-saytda: ${APP_URL}/legal`
      await send(token, chatId, offerText, {
        inline_keyboard: [[{ text: '↩️ Orqaga', callback_data: 'view_legal_info' }]],
      })
      return NextResponse.json({ ok: true })
    }

    if (data === 'view_terms') {
      const termsText = `📄 <b>Foydalanish shartlari va Maxfiylik</b>\n\n` +
        `<b>1. Shaxsiy ma'lumotlar:</b> Biz sizning Telegram API ma'lumotlaringizni uchinchi shaxslarga bermaymiz. Ma'lumotlar faqat monitoring uchun ishlatiladi.\n` +
        `<b>2. Maqsad:</b> Platformadan noqonuniy moliyaviy oqimlar (High-risk merch, qimor va b.) uchun foydalanish taqiqlanadi.\n` +
        `<b>3. Cheklovlar:</b> Tizim o'z ishini xavfsizlik nuqtai nazaridan bir tomonlama to'xtatish huquqiga ega.\n\n` +
        `Batafsil veb-saytda: ${APP_URL}/legal`
      await send(token, chatId, termsText, {
        inline_keyboard: [[{ text: '↩️ Orqaga', callback_data: 'view_legal_info' }]],
      })
      return NextResponse.json({ ok: true })
    }

    if (data === 'view_legal_info') {
      await renderLegalInfo(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('buy_tariff_')) {
      const tariffId = data.replace('buy_tariff_', '')

      let tariff: any = null
      try {
        const tariffs = await db.select().from(systemTariffs).where(eq(systemTariffs.id, tariffId)).limit(1)
        tariff = tariffs[0]
      } catch {}

      if (!tariff) {
        if (tariffId.includes('daily') || tariffId.includes('kun')) {
          tariff = { id: 'tariff-daily', name: 'Kunlik', price: 1000, period: 'kun', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
        } else if (tariffId.includes('weekly') || tariffId.includes('hafta')) {
          tariff = { id: 'tariff-weekly', name: 'Haftalik', price: 6500, period: 'hafta', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
        } else {
          tariff = { id: 'tariff-monthly', name: 'Oylik VIP', price: 27858, period: 'oy', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', cardBank: 'HUMOCARD' }
        }
      }

      const paymentId = `pay_tariff_${randomUUID().replace(/-/g, '').slice(0, 10)}`
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

      try {
        await db.insert(payments).values({
          id: paymentId,
          shopId: 'system_tariff',
          userId: userIdStr,
          amount: Number(tariff.price),
          currency: 'UZS',
          status: 'pending',
          isTest: false,
          expiresAt,
        })
      } catch (insertErr) {
        console.error('Tariff payment insert error:', insertErr)
      }

      const cardFormatted = formatCard(tariff.cardNumber || '9860350123453587')

      await send(
        token,
        chatId,
        `💎 <b>PayGo Premium — To‘lov Buyurtmasi Yaratildi</b>\n\n` +
        `📦 <b>Tarif:</b> ${tariff.name}\n` +
        `💰 <b>To‘lov summasi:</b> <code>${Number(tariff.price).toLocaleString('uz-UZ')}</code> UZS\n` +
        `💳 <b>To‘lov kartasi:</b> <code>${cardFormatted}</code>\n` +
        `👤 <b>Karta egasi:</b> ${tariff.cardOwner || 'AZizbek I'}\n` +
        `🏦 <b>Bank:</b> ${tariff.cardBank || 'HUMOCARD'}\n\n` +
        `⏱ <i>To‘lov kutilmoqda: <b>5 daqiqa (300 soniya)</b></i>\n` +
        `🆔 <b>Buyurtma ID:</b> <code>${paymentId}</code>\n\n` +
        `ℹ️ <i>To‘lovni kartaga o‘tkazgach, <b>"🔄 To‘lovni tekshirish"</b> tugmasini bosing yoki userbot avtomatik tasdiqlashini kuting.</i>`,
        {
          inline_keyboard: [
            [{ text: '🔄 To‘lovni tekshirish (Qo‘lda)', callback_data: `check_tariff_pay_${paymentId}` }],
            [{ text: '❌ Bekor qilish', callback_data: `cancel_tariff_pay_${paymentId}` }],
          ],
        }
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('check_tariff_pay_')) {
      const paymentId = data.replace('check_tariff_pay_', '')
      const payList = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
      const payment = payList[0]

      if (!payment) {
        await send(token, chatId, '⚠️ To‘lov buyurtmasi topilmadi yoki o‘chirilgan.', menu)
        return NextResponse.json({ ok: true })
      }

      if (payment.status === 'paid') {
        await activateTariffForUser(token, chatId, userIdStr, payment)
        return NextResponse.json({ ok: true })
      }

      if (payment.expiresAt < new Date() || payment.status === 'expired') {
        await db.update(payments).set({ status: 'expired' }).where(eq(payments.id, paymentId))
        await send(
          token,
          chatId,
          `❌ <b>To‘lov vaqti (5 daqiqa) tugagan.</b>\n\n` +
          `Siz ushbu to‘lov buyurtmasi vaqtida to‘lov qilmadingiz yoki vaqt o‘tib ketdi. Qaytadan <b>💎 Tariflar</b> bo‘limidan yangi to‘lov yarating.`,
          menu
        )
        return NextResponse.json({ ok: true })
      }

      // If status is still pending (payment hasn't arrived via Userbot yet)
      const isAdmin = await isAdminTelegramId(userIdStr)
      const inlineButtons: any[] = [
        [{ text: '🔄 Qayta tekshirish', callback_data: `check_tariff_pay_${paymentId}` }],
        [{ text: '❌ Bekor qilish', callback_data: `cancel_tariff_pay_${paymentId}` }],
      ]

      if (isAdmin) {
        inlineButtons.unshift([
          { text: '🧪 Admin Test Tasdiqlash (Demo)', callback_data: `admin_force_pay_${paymentId}` },
        ])
      }

      await send(
        token,
        chatId,
        `⏳ <b>To‘lov hali tizimga yetib kelmadi!</b>\n\n` +
        `💳 <b>Karta:</b> <code>${formatCard('9860350123453587')}</code>\n` +
        `💰 <b>Kutilayotgan summa:</b> <code>${Number(payment.amount).toLocaleString('uz-UZ')}</code> UZS\n` +
        `🆔 <b>Buyurtma ID:</b> <code>${paymentId}</code>\n\n` +
        `🔍 <b>To‘lovni tekshirish tartibi:</b>\n` +
        `1. Kartangizdan roppa-rosa <b>${Number(payment.amount).toLocaleString('uz-UZ')} UZS</b> o‘tkazganingizga ishonch hosil qiling.\n` +
        `2. HumoCard Telegram botidan o‘tkazma haqida xabarnoma kelishi bilan (10-60 soniya), Userbot to‘lovni avtomatik tasdiqlaydi va sizga PDF chek yuboriladi.\n\n` +
        `<i>O‘tkazma yuborgan bo‘lsangiz, bir oz kuting va qayta tekshiring:</i>`,
        { inline_keyboard: inlineButtons }
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('admin_force_pay_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })

      const paymentId = data.replace('admin_force_pay_', '')
      const payList = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
      const payment = payList[0]

      if (payment) {
        await activateTariffForUser(token, chatId, userIdStr, payment)
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('cancel_tariff_pay_')) {
      const paymentId = data.replace('cancel_tariff_pay_', '')
      await db.update(payments).set({ status: 'rejected' }).where(eq(payments.id, paymentId))
      await send(token, chatId, '❌ <b>To‘lov buyurtmasi bekor qilindi.</b>', menu)
      return NextResponse.json({ ok: true })
    }

    // -------------------------------------------------------------
    // ADMIN TARIFF MANAGEMENT CALLBACKS
    // -------------------------------------------------------------
    if (data === 'adm_tar_list') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await renderAdminTariffManagement(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_ed_tar_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      const tariffId = data.replace('adm_ed_tar_', '')
      await renderAdminTariffDetail(token, chatId, tariffId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_tf_field_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })

      const rest = data.replace('adm_tf_field_', '')
      const parts = rest.split('_')
      const fieldName = parts.pop() || ''
      const tariffId = parts.join('_')

      await stateSet(chatId, {
        step: 'admin_edit_tariff_value',
        editTariffId: tariffId,
        editTariffField: fieldName,
      })

      let label = fieldName
      let example = ''
      if (fieldName === 'cardNumber') {
        label = 'Karta raqami (14-16 xonali raqam)'
        example = '9860 3501 2345 3587'
      } else if (fieldName === 'cardOwner') {
        label = 'Karta egasining ism-sharifi'
        example = 'AZIZBEK ISMOILOV'
      } else if (fieldName === 'cardBank') {
        label = 'Bank nomi'
        example = 'HUMOCARD'
      } else if (fieldName === 'price') {
        label = 'Tarif narxi (UZS summasi)'
        example = '15000'
      } else if (fieldName === 'name') {
        label = 'Tarif nomi'
        example = 'Kunlik Premium'
      } else if (fieldName === 'description') {
        label = 'Tarif tavsifi'
        example = '30 kunlik to‘liq cheksiz imkoniyat'
      }

      await send(
        token,
        chatId,
        `✏️ <b>Tarifning ${label}ni kiriting:</b>\n\n` +
        `Misol: <code>${example}</code>\n\n` +
        `<i>Yangi qiymatni Telegram orqali yuboring:</i>`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'adm_tar_card_all') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })

      await stateSet(chatId, { step: 'admin_bulk_card' })
      await send(
        token,
        chatId,
        `💳 <b>Barcha Tariflar uchun Karta Sozlash</b>\n\n` +
        `Karta raqami, karta egasi va bank nomini ajratuvchi (<code>|</code>) bilan yuboring:\n\n` +
        `<code>KARTA_RAQAMI | ISM_FAMILYASI | BANK_NOMI</code>\n\n` +
        `Masalan:\n<code>9860 3501 2345 3587 | AZIZBEK ISMOILOV | HUMOCARD</code>`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // MESSAGE HANDLER
  // -------------------------------------------------------------
  const message = update.message
  if (!message?.chat?.id) return NextResponse.json({ ok: true })

  const chatId = message.chat.id
  const userIdStr = String(chatId)
  const raw = (message.text ?? '').trim()
  const text = clean(raw)
  const norm = cleanText(raw)
  let flow = await stateGet(chatId)

  // Top-level menu matchers for robust button and text detection
  const isMyShopCmd =
    norm.includes('mening do') ||
    norm.includes('mening dukon') ||
    norm.includes('mening do kon') ||
    norm.includes('dukon sozlamalari') ||
    norm.includes('do kon sozlamalari') ||
    norm.includes("do'kon sozlamalari") ||
    raw === '/myshop' ||
    raw === '/shop' ||
    text === 'Mening do‘konim' ||
    text === "Mening do'konim" ||
    text === 'Mening dukonim'

  const isUserbotCmd =
    norm.includes('userbot') ||
    raw === '/userbot' ||
    text === 'Userbot ulash' ||
    text === 'Userbot holati' ||
    text === 'Userbot'

  const isNewShopCmd =
    norm.includes("do'kon ochish") ||
    norm.includes('dukon ochish') ||
    norm.includes('do kon ochish') ||
    text === 'Do‘kon ochish' ||
    text === "Do'kon ochish" ||
    text === 'Dukon ochish' ||
    raw === '/newshop'

  const isMyCardCmd =
    norm.includes('mening kartam') ||
    norm.includes('kartani tahrirlash') ||
    text === 'Mening kartam' ||
    text === 'Kartani tahrirlash' ||
    raw === '/card'

  const isChannelCmd =
    norm.includes('kanal ulash') ||
    norm.includes('telegram kanal') ||
    text === 'Kanal ulash' ||
    text === 'Telegram kanal ulash' ||
    raw === '/channel'

  const isWebhookCmd =
    norm.includes('webhook sozlash') ||
    norm.includes('webhook') ||
    text === 'Webhook sozlash' ||
    raw === '/webhook'

  const isDocsCmd =
    norm.includes('api hujjat') ||
    norm.includes('hujjat') ||
    text === 'API hujjat' ||
    raw === '/docs'

  const isTestPayCmd =
    norm.includes('test to') ||
    norm.includes('test tolov') ||
    text === 'Test to‘lov' ||
    text === "Test to'lov" ||
    raw === '/testpay'

  const isTariffsCmd =
    (norm.includes('tariflar') || (norm.includes('premium') && !norm.includes('tekin'))) &&
    text !== '🤝 Referal (Tekin Premium)' &&
    text !== 'Referal' &&
    text !== '💎 Tariflar boshqaruvi' &&
    raw !== '/ref' &&
    raw !== '/referral'

  const isReferralCmd =
    norm.includes('referal') ||
    norm.includes('tekin premium') ||
    text === '🤝 Referal (Tekin Premium)' ||
    text === 'Referal' ||
    raw === '/ref' ||
    raw === '/referral'

  const isPanelCmd =
    norm.includes('veb-panel') ||
    norm.includes('veb panel') ||
    norm.includes('panel') ||
    text === 'Veb-panelga kirish' ||
    raw === '/panel'

  const isAdminCmd =
    raw === '/admin' ||
    text === 'Admin' ||
    text === 'Crm' ||
    text === 'Admin panel' ||
    norm === 'admin' ||
    norm === 'crm' ||
    norm === 'admin panel' ||
    norm === 'admin paneli'

  const isCloseCmd =
    text === '❌ Menyuni yopish' ||
    text === '❌ Admin panelni yopish' ||
    raw === '/close' ||
    raw === '/hide' ||
    norm.includes('yopish') ||
    norm.includes('keyboardni yopish')

  const isCancelCmd =
    norm.includes('orqaga') ||
    norm.includes('bekor qilish') ||
    norm.includes('asosiy menyu') ||
    text === 'Orqaga' ||
    text === 'Bekor qilish' ||
    raw === '/cancel' ||
    raw === '/back'

  // -------------------------------------------------------------
  // PHOTO UPLOAD (e.g. for Logo)
  // -------------------------------------------------------------
  if (message.photo && message.photo.length > 0) {
    if (flow?.step === 'edit_shop_logo_url') {
      const bestPhoto = message.photo[message.photo.length - 1]
      const fileId = bestPhoto.file_id
      try {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
        const fileJson = await fileRes.json()
        if (fileJson.ok && fileJson.result?.file_path) {
          const photoUrl = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`
          await db.update(shops).set({ logoUrl: photoUrl }).where(eq(shops.userId, userIdStr))
          await stateDelete(chatId)
          await send(token, chatId, `✅ <b>Do‘kon logotipi rasm orqali muvaffaqiyatli saqlandi!</b>`, menu)
          return NextResponse.json({ ok: true })
        }
      } catch (err) {
        console.warn('Photo download error:', err)
      }
    }
  }

  // -------------------------------------------------------------
  // FORWARDED MESSAGE (Channel detection)
  // -------------------------------------------------------------
  if (flow?.step === 'channel_connect' && message.forward_from_chat) {
    const fChat = message.forward_from_chat
    const channelId = String(fChat.id)
    const channelTitle = fChat.title || fChat.username || channelId

    // Test sending to channel
    const testPost =
      `✅ <b>PayGo to‘lov xabarnomasi muvaffaqiyatli ulandi!</b>\n\n` +
      `📣 Kanal: <b>${channelTitle}</b>\n` +
      `⚡️ Ushbu kanalga qabul qilingan barcha to‘lovlar va ularning to‘liq JSON ma’lumotlari avtomatik joylanadi.`

    const testRes = await send(token, channelId, testPost, { inline_keyboard: [] })
    if (testRes?.ok) {
      const targetShopId = flow.targetShopId
      const shopCondition = targetShopId 
        ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
        : eq(shops.userId, userIdStr)

      await db.update(shops).set({ telegramChannelId: channelId }).where(shopCondition)
      await stateDelete(chatId)
      await send(
        token,
        chatId,
        `🎉 <b>Tabriklaymiz! Telegram kanal muvaffaqiyatli ulandi!</b>\n\n` +
        `📣 <b>Kanal:</b> ${channelTitle} (<code>${channelId}</code>)\n\n` +
        `Endi har bir muvaffaqiyatli to‘lov haqidagi chek va JSON xabarnoma to‘g‘ridan-to‘g‘ri shu kanalingizga tushadi!`,
        {
          inline_keyboard: [
            [{ text: '📣 Test xabar yuborish', callback_data: `test_channel_post_${targetShopId || ''}` }],
            [{ text: '🗑 Kanalni uzish', callback_data: `unlink_channel_${targetShopId || ''}` }],
          ],
        }
      )
      return NextResponse.json({ ok: true })
    } else {
      await send(
        token,
        chatId,
        `⚠️ <b>Kanalga ulanish amalga oshmadi:</b>\n${testRes.description || 'Bot kanalda administrator emas'}.\n\n` +
        `Iltimos, botimizni <b>${channelTitle}</b> kanaliga administrator qilib qo‘shing va xabar yozish huquqini bering, so‘ngra qaytadan xabar forward qiling:`,
        back
      )
      return NextResponse.json({ ok: true })
    }
  }

  // -------------------------------------------------------------
  // MAINTENANCE MODE COMMANDS (Admin only)
  // -------------------------------------------------------------
  if (raw === '/maintenance_on' && isAdmin) {
    await db.insert(systemSettings)
      .values({ key: 'maintenance_mode', value: 'true' })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: 'true', updatedAt: new Date() } })
    await send(token, chatId, '✅ <b>Texnik holat yoqildi.</b>\n\nEndi bot faqat adminlar uchun ishlaydi.')
    return NextResponse.json({ ok: true })
  }

  if (raw === '/maintenance_off' && isAdmin) {
    await db.insert(systemSettings)
      .values({ key: 'maintenance_mode', value: 'false' })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: 'false', updatedAt: new Date() } })
    await send(token, chatId, '❌ <b>Texnik holat o‘chirildi.</b>\n\nBot barcha foydalanuvchilar uchun ochiq.')
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // /start command (with terms check and deep auth link)
  // -------------------------------------------------------------
  if (/^\/start/.test(raw)) {
    // Auto-promote first user to admin if no admins exist
    const adminCount = await db.select().from(systemRoles).limit(1)
    if (adminCount.length === 0) {
      await db.insert(systemRoles).values({
        telegramId: userIdStr,
        role: 'superadmin',
      })
    }
    await stateDelete(chatId)
    cancelOnboarding(userIdStr)

    // Check if this is a web login auth token: /start auth_xyz
    const startPayload = raw.replace('/start', '').trim()
    if (startPayload.startsWith('auth_')) {
      const authToken = startPayload
      try {
        const authRows = await db.select().from(authSessions).where(eq(authSessions.token, authToken)).limit(1)
        if (authRows.length && authRows[0]) {
          await db.update(authSessions).set({
            userId: userIdStr,
            telegramId: userIdStr,
          }).where(eq(authSessions.token, authToken))

          await send(
            token,
            chatId,
            `✅ <b>Veb-panelga muvaffaqiyatli kirdingiz!</b>\n\n` +
            `Brauzeringizdagi oyna avtomatik tarzda ochildi. Barcha do‘koningiz va to‘lov ma’lumotlarini boshqarishingiz mumkin.\n\n` +
            `🔗 Agar oyna ochilmagan bo‘lsa: <a href="${APP_URL}/panel?auth_token=${authToken}&userId=${userIdStr}">Veb-panelga o‘tish</a>`,
            menu
          )
          return NextResponse.json({ ok: true })
        }
      } catch (authErr) {
        console.warn('Auth session update error:', authErr)
      }
    }

    // Check if this is a referral link: /start ref_123456789
    if (startPayload.startsWith('ref_')) {
      const referrerId = startPayload.replace('ref_', '').trim()
      if (referrerId && referrerId !== userIdStr) {
        try {
          const existingProf = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
          if (!existingProf.length || !existingProf[0]?.referredBy) {
            await db
              .insert(userProfiles)
              .values({
                telegramId: userIdStr,
                referredBy: referrerId,
              })
              .onConflictDoUpdate({
                target: userProfiles.telegramId,
                set: { referredBy: referrerId },
              })

            const refProf = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, referrerId)).limit(1)
            if (refProf.length) {
              const newRefCount = (refProf[0].referralCount || 0) + 1
              
              await db
                .update(userProfiles)
                .set({
                  referralCount: newRefCount,
                })
                .where(eq(userProfiles.telegramId, referrerId))

              await send(
                token,
                referrerId,
                `👥 <b>Yangi do‘st taklif qilindi!</b>\n\n` +
                `Sizning taklif havolangiz orqali yangi foydalanuvchi botga qo‘shildi!\n` +
                `Jami taklif qilgan do‘stlaringiz: <b>${newRefCount} ta</b>\n\n` +
                `💎 To‘plangan do‘stlarni Premium VIP muddatiga almashtirish uchun <b>🤝 Referal</b> bo‘limiga o‘ting.`,
                {
                  inline_keyboard: [[{ text: '🤝 Referal bo‘limiga o‘tish', callback_data: 'referral_page' }]],
                }
              )
            }
          }
        } catch (refErr) {
          console.warn('Referral processing error:', refErr)
        }
      }
    }

    // Check if terms are already accepted by user
    let accepted = false
    try {
      const prof = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
      if (prof.length && prof[0]?.termsAccepted) {
        accepted = true
      }
    } catch {}

    if (accepted) {
      await send(
        token,
        chatId,
        `👋 <b>Xush kelibsiz, ${message.from?.first_name ?? 'foydalanuvchi'}!</b>\n\n` +
        `⚡️ <b>PayGo</b> — HUMO to‘lovlarini avtomatlashtirish, Telegram kanallar va Webhooklar tizimi.\n` +
        `Quyidagi menyudan kerakli xizmatni tanlang:`,
        menu
      )
      return NextResponse.json({ ok: true })
    }

    // First time user: show terms only once
    await send(
      token,
      chatId,
      `👋 <b>PayGo avtomatlashtirilgan to‘lov botiga xush kelibsiz, ${message.from?.first_name ?? 'foydalanuvchi'}!</b>\n\n` +
      `⚡️ Ushbu bot orqali HUMO to‘lov bildirishnomalarini (@humocardbot) Telegram Userbot orqali avtomatik qabul qilib, o‘z do‘koningiz, kanalingiz va veb-saytlaringizga ulashingiz mumkin.\n\n` +
      `Davom etish uchun foydalanish shartlarini 1 marta qabul qiling:`,
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
  if (isCancelCmd) {
    await stateDelete(chatId)
    cancelOnboarding(userIdStr)
    await send(token, chatId, '🏠 Asosiy menyudasiz.', menu)
    return NextResponse.json({ ok: true })
  }

  // Close Keyboard
  if (isCloseCmd) {
    await stateDelete(chatId)
    await send(token, chatId, '⌨️ <b>Menyu tugmalari yopildi.</b>\n\nTugmalarni qayta chiqarish uchun /start deb yozing.', {
      remove_keyboard: true,
    })
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // MENING DO'KONIM (Immediate trigger with full details & status)
  // -------------------------------------------------------------
  if (isMyShopCmd) {
    await stateDelete(chatId)
    await showShopDetails(token, chatId, userIdStr)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // USERBOT STATUS / ONBOARDING (Checks active status first!)
  // -------------------------------------------------------------
  if (isUserbotCmd) {
    await stateDelete(chatId)
    await showUserbotStatus(token, chatId, userIdStr)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // 1-CLICK WEB PANEL AUTH LINK
  // -------------------------------------------------------------
  if (isPanelCmd) {
    await stateDelete(chatId)
    const authUrl = await generateAuthUrl(userIdStr)
    await send(
      token,
      chatId,
      `🌐 <b>PayGo Veb Boshqaruv Paneli (CRM)</b>\n\n` +
      `Saytga avtomatik kirish va barcha do‘kon, to‘lovlar, webhook va karta sozlamalarini boshqarish uchun quyidagi tugmalardan birini bosing:\n\n` +
      `🔗 <i>Bir marta bosish orqali hisobingiz to‘liq taniladi va login amalga oshiriladi.</i>`,
      {
        inline_keyboard: [
          [
            { text: '📱 Veb CRM (Mini App)', web_app: { url: authUrl } },
            { text: '🌐 Brauzerda ochish', url: authUrl },
          ],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // KANAL ULASH OQIMI
  // -------------------------------------------------------------
  if (isChannelCmd) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    if (!userShops.length) {
      await send(
        token,
        chatId,
        '⚠️ Kanal ulashdan oldin do‘kon yaratishingiz kerak. Iltimos, avval <b>🛍 Do‘kon ochish</b> tugmasini bosing.',
        menu
      )
      return NextResponse.json({ ok: true })
    }

    const shop = userShops[0]
    await stateSet(chatId, { step: 'channel_connect', targetShopId: shop.id })

    let currentChannelInfo = ''
    if (shop.telegramChannelId) {
      currentChannelInfo = `\n📌 <i>Hozir ulangan kanal:</i> <code>${shop.telegramChannelId}</code>\n`
    }

    await send(
      token,
      chatId,
      `📣 <b>Telegram Kanal Ulash</b>${currentChannelInfo}\n` +
      `To‘lovlar amalga oshirilganda barcha cheklar va to‘liq <b>JSON ma’lumotlar</b> to‘g‘ridan-to‘g‘ri kanalingizga post qilib tashlanadi!\n\n` +
      `<b>Qanday ulanadi:</b>\n` +
      `1️⃣ Avval botimizni kanalingizga <b>Administrator</b> qilib qo‘shing (xabar yozish huquqi bilan).\n` +
      `2️⃣ So‘ngra kanalingiz username (<code>@mening_kanalim</code>) yoki ID (<code>-1001234567890</code>) sini shu yerga yozing, yoki kanaldan ixtiyoriy bitta xabarni shu yerga <b>Forward (Uzatish)</b> qiling:\n`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // WEBHOOK SOZLASH & DOKUMENTATSIYA
  // -------------------------------------------------------------
  if (isWebhookCmd) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    const currentWebhook = userShops[0]?.webhookUrl || 'Mavjud emas'
    const shopId = userShops[0]?.id || ''
    const authUrl = await generateAuthUrl(userIdStr, '/panel')

    await send(
      token,
      chatId,
      `🔗 <b>PayGo Webhook Sozlamalari</b>\n\n` +
      `To‘lov muvaffaqiyatli tasdiqlanganda serveringizga <code>POST</code> so‘rovi orqali to‘liq JSON ma’lumot yuboriladi.\n\n` +
      `🌐 <b>Hozirgi Webhook URL:</b> <code>${currentWebhook}</code>\n\n` +
      `📦 <b>Webhook JSON formati:</b>\n` +
      `<pre><code class="language-json">{\n  "event": "payment.paid",\n  "eventId": "evt_98f4e21a",\n  "createdAt": "2026-08-30T11:05:00Z",\n  "payment": {\n    "id": "pay_7fa83210",\n    "amount": 50000,\n    "currency": "UZS",\n    "status": "paid",\n    "cardLast4": "3587"\n  },\n  "signature": "sha256_hash"\n}</code></pre>\n\n` +
      `📄 <b>JSON Schema fayli:</b> <a href="${APP_URL}/api/docs/webhook-schema.json">${APP_URL}/api/docs/webhook-schema.json</a>\n` +
      `🌐 <b>To‘liq API Hujjati:</b> <a href="${APP_URL}/api/docs">${APP_URL}/api/docs</a>`,
      {
        inline_keyboard: [
          [{ text: '✏️ Webhook URL sozlash', callback_data: shopId ? `edit_shop_webhook_${shopId}` : 'edit_shop_webhook' }],
          [{ text: '🌐 Web Panel orqali sozlash', url: authUrl }],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (isDocsCmd) {
    const authUrl = await generateAuthUrl(userIdStr)
    await send(
      token,
      chatId,
      `📚 <b>PayGo API va Webhook Hujjatlari:</b>\n\n` +
      `🔹 <b>Webhook JSON formati va Schema:</b>\n` +
      `🔗 <a href="${APP_URL}/api/docs/webhook-schema.json">${APP_URL}/api/docs/webhook-schema.json</a>\n\n` +
      `🔹 <b>To‘liq REST API Documentation:</b>\n` +
      `🔗 <a href="${APP_URL}/api/docs">${APP_URL}/api/docs</a>\n\n` +
      `🔹 <b>Word / DOCX Formati:</b>\n` +
      `🔗 <a href="${APP_URL}/paybot-api.docx">${APP_URL}/paybot-api.docx</a>\n\n` +
      `Xavfsizlik: Barcha webhooklar <code>X-PayGo-Signature: sha256=...</code> HMAC imzosi bilan jo‘natiladi.`,
      {
        inline_keyboard: [
          [{ text: '📄 Webhook Schemani Ko‘rish', url: `${APP_URL}/api/docs/webhook-schema.json` }],
          [{ text: '📥 DOCX Hujjatni Yuklab Olish', url: `${APP_URL}/paybot-api.docx` }],
          [{ text: '📱 Developer Portal (Mini App)', web_app: { url: `${APP_URL}/docs` } }],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // REFERAL VA TEKIN PREMIUM
  // -------------------------------------------------------------
  if (isReferralCmd) {
    await stateDelete(chatId)
    await renderReferralInfo(token, chatId, userIdStr)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // TARIFLAR VA PREMIUM
  // -------------------------------------------------------------
  if (isTariffsCmd) {
    await stateDelete(chatId)
    await renderUserTariffs(token, chatId, userIdStr)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // TEST TO'LOV OQIMI
  // -------------------------------------------------------------
  if (isTestPayCmd) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    if (!userShops.length) {
      await send(
        token,
        chatId,
        '⚠️ Test to‘lov yaratishdan oldin do‘kon ochishingiz kerak. Iltimos <b>🛍 Do‘kon ochish</b> tugmasini bosing.',
        menu
      )
      return NextResponse.json({ ok: true })
    }

    await stateSet(chatId, { step: 'test_pay_amount' })
    await send(
      token,
      chatId,
      `🧪 <b>Test To‘lov Yaratish (1/2)</b>\n\n` +
      `To‘lov tizimingizni sinash uchun test to‘lov summasini kiriting (masalan: <code>15000</code>) yoki quyidagi variantlardan birini tanlang:\n\n` +
      `⏱ <i>To‘lov muddati: <b>5 daqiqa (300 soniya)</b></i>\n` +
      `To‘lov tasdiqlangach Webhook va Kanalingizga to‘liq JSON ma’lumot boradi.`,
      testAmountsKeyboard
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // MENING KARTAM
  // -------------------------------------------------------------
  if (isMyCardCmd) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
    if (userShops.length && userShops[0]) {
      const s = userShops[0]
      const formatted = formatCard(s.cardNumber || s.cardLast4 || '9860350123453587')
      await send(
        token,
        chatId,
        `💳 <b>To‘lov qabul qiluvchi HUMO kartangiz:</b>\n\n` +
        `🔢 <b>To‘liq raqam:</b> <code>${formatted}</code>\n` +
        `👤 <b>Karta egasi:</b> ${s.accountOwner ?? 'Hisob egasi'}\n` +
        `🏦 <b>Tizim:</b> ${s.cardBank ?? 'HUMOCARD'}\n\n` +
        `ℹ️ <i>To‘lov sahifasida xaridorlarga ushbu to‘liq karta raqami ko‘rsatiladi.</i>`,
        {
          inline_keyboard: [
            [{ text: '✏️ Kartani tahrirlash', callback_data: `edit_shop_card_${s.id}` }],
          ],
        }
      )
    } else {
      await send(token, chatId, '💳 Hali karta kiritilmagan. Avval "🛍 Do‘kon ochish" orqali karta kiriting.', menu)
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // DO'KON OCHISH OQIMI
  // -------------------------------------------------------------
  if (isNewShopCmd) {
    const limitCheck = await checkShopLimit(userIdStr)
    if (!limitCheck.allowed) {
      await send(token, chatId, `⚠️ <b>${limitCheck.reason}</b>\n\nTarifingizni uzaytirish yoki Premiumga o'tish uchun "💎 Tariflar" bo'limiga kiring.`, menu)
      return NextResponse.json({ ok: true })
    }
    await stateSet(chatId, { step: 'shop_name', shop: {} })
    await send(token, chatId, '🛍 <b>Do‘kon ochish (1/4)</b>\n\nDo‘koningiz nomini yuboring (masalan: <i>Online Supermarket</i>):', back)
    return NextResponse.json({ ok: true })
  }

  // Terms & Conditions acceptance (Persisted permanently!)
  if (text === 'Foydalanish shartlari') {
    await send(
      token,
      chatId,
      `📄 <b>Foydalanish shartlari</b>\n\n` +
      `PayGo xizmati HUMO to‘lovlarini @humocardbot bildirishnomalari orqali tekshirish va kanallarga uzatish imkonini beradi. Barcha sessiyalar va ma’lumotlar xavfsiz shifrlangan.`,
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
      `PayGo tizimi orqali to‘lovlarni tekshirish, webhook va telegram kanal bildirishnomalaridan foydalanish shartlariga to‘liq rozilik bildirasiz.`,
      {
        keyboard: [[{ text: '📄 Foydalanish shartlari' }], [{ text: '✅ Qabul qilaman' }, { text: '↩️ Orqaga' }]],
        resize_keyboard: true,
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Qabul qilaman') {
    try {
      await db
        .insert(userProfiles)
        .values({
          telegramId: userIdStr,
          termsAccepted: true,
          acceptedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userProfiles.telegramId,
          set: { termsAccepted: true, acceptedAt: new Date() },
        })
    } catch (profErr) {
      console.warn('Profile save warning:', profErr)
    }

    await send(token, chatId, '✅ <b>Shartlar qabul qilindi!</b> Endi botdan to‘liq foydalanishingiz mumkin:', menu)
    return NextResponse.json({ ok: true })
  }

  // Test payment amount input step
  if (flow?.step === 'test_pay_amount') {
    const rawAmt = Number(raw.replace(/\D/g, ''))
    if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0) {
      await send(
        token,
        chatId,
        '❗ Iltimos, to‘g‘ri summa kiriting (masalan: <code>1000</code>, <code>5000</code>, <code>15000</code>):',
        testAmountsKeyboard
      )
      return NextResponse.json({ ok: true })
    }

    const txLimit = await checkTransactionLimits(userIdStr)
    if (!txLimit.allowed) {
      await stateDelete(chatId)
      await send(token, chatId, `⚠️ <b>${txLimit.reason}</b>\n\nLimitni oshirish uchun Premium tarifga o'ting: "💎 Tariflar" tugmasini bosing.`, menu)
      return NextResponse.json({ ok: true })
    }

    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)

    const userShops = await db.select().from(shops).where(shopCondition).limit(1)
    const shop = userShops[0]
    if (!shop) {
      await stateDelete(chatId)
      await send(token, chatId, '⚠️ Do‘kon topilmadi. Avval <b>🛍 Do‘kon ochish</b> orqali do‘kon yarating.', menu)
      return NextResponse.json({ ok: true })
    }

    const paymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    try {
      await db.insert(payments).values({
        id: paymentId,
        shopId: shop.id,
        userId: userIdStr,
        amount: rawAmt,
        currency: 'UZS',
        status: 'pending',
        isTest: true,
        expiresAt,
      })
    } catch (insertErr) {
      console.warn('Test payment DB insert warning:', insertErr)
    }

    await stateDelete(chatId)
    const payUrl = `${APP_URL}/pay/${paymentId}`
    const formattedCard = formatCard(shop.cardNumber || '9860350123453587')

    await send(
      token,
      chatId,
      `🎉 <b>5 Daqiqalik Test To‘lov Yaratildi!</b>\n\n` +
      `💰 <b>Summa:</b> ${rawAmt.toLocaleString('uz-UZ')} UZS\n` +
      `💳 <b>Karta:</b> <code>${formattedCard}</code>\n` +
      `👤 <b>Egasi:</b> ${shop.accountOwner || 'Hisob egasi'}\n` +
      `⏱ <b>Muddati:</b> 5 daqiqa (300 soniya)\n` +
      `🆔 <b>ID:</b> <code>${paymentId}</code>\n\n` +
      `🔗 <b>To‘lov havolasi:</b>\n<a href="${payUrl}">${payUrl}</a>\n\n` +
      `ℹ️ <i>Xaridor sahifani ochganda aynan <b>${rawAmt.toLocaleString('uz-UZ')} UZS</b> summasi va to‘liq karta ko‘rsatiladi.</i>`,
      {
        inline_keyboard: [
          [{ text: '💳 To‘lov Sahifasini Ochish', url: payUrl }],
          [{ text: '⚡️ Test Tasdiqlash (Simulyatsiya)', url: payUrl }],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  // Channel ID / Username text input
  if (flow?.step === 'channel_connect') {
    let targetChannel = raw.trim()
    if (!targetChannel.startsWith('@') && !targetChannel.startsWith('-100') && !/^\d+$/.test(targetChannel)) {
      targetChannel = `@${targetChannel}`
    }

    const testPost =
      `✅ <b>PayGo to‘lov xabarnomasi muvaffaqiyatli ulandi!</b>\n\n` +
      `⚡️ Ushbu kanalga qabul qilingan barcha to‘lovlar va ularning to‘liq JSON ma’lumotlari avtomatik yuboriladi.`

    const testRes = await send(token, targetChannel, testPost, { inline_keyboard: [] })
    if (testRes?.ok) {
      const targetShopId = flow.targetShopId
      const shopCondition = targetShopId 
        ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
        : eq(shops.userId, userIdStr)

      const channelId = String(testRes.result?.chat?.id || targetChannel)
      await db.update(shops).set({ telegramChannelId: channelId }).where(shopCondition)
      await stateDelete(chatId)

      await send(
        token,
        chatId,
        `🎉 <b>Tabriklaymiz! Telegram kanal muvaffaqiyatli ulandi!</b>\n\n` +
        `📣 <b>Kanal ID:</b> <code>${channelId}</code>\n\n` +
        `Endi har bir muvaffaqiyatli to‘lov haqidagi chek va JSON xabarnoma to‘g‘ridan-to‘g‘ri shu kanalingizga tushadi!`,
        {
          inline_keyboard: [
            [{ text: '📣 Test xabar yuborish', callback_data: `test_channel_post_${targetShopId || ''}` }],
            [{ text: '🗑 Kanalni uzish', callback_data: `unlink_channel_${targetShopId || ''}` }],
          ],
        }
      )
    } else {
      await send(
        token,
        chatId,
        `⚠️ <b>Kanalga xabar yuborib bo‘lmadi:</b> ${testRes?.description || 'Bot kanalda admin emas'}.\n\n` +
        `Iltimos, avval botni kanalingizga <b>Administrator</b> qilib qo‘shing va qaytadan kanal username/ID sini yuboring:`,
        back
      )
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // SHOP CREATION FLOW STEPS
  // -------------------------------------------------------------
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
      `(Masalan: <code>9860 3501 2345 3587</code>)\n\n` +
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

    await ensureDbSchema()
    try {
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
        approved: true,
      })
    } catch (insertErr) {
      console.warn('DB insert fallback:', insertErr)
    }

    await stateDelete(chatId)
    const formattedCardNum = formatCard(flow.shop?.cardNumber ?? '9860350123453587')
    const createdShop = {
      id: shopId,
      userId: userIdStr,
      name: flow.shop?.name ?? 'PayGo shop',
      cardNumber: flow.shop?.cardNumber ?? '9860350123453587',
      cardBank: 'HUMOCARD',
      accountOwner: flow.shop?.owner ?? 'Hisob egasi',
      approved: true,
    }
    notifyAdminNewShop(token, createdShop)

    await send(
      token,
      chatId,
      `✅ <b>Do‘kon muvaffaqiyatli ochildi!</b>\n\n` +
      `🏪 <b>Do‘kon:</b> ${flow.shop?.name}\n` +
      `💳 <b>Karta:</b> <code>${formattedCardNum}</code> (HUMO)\n` +
      `👤 <b>Karta egasi:</b> ${flow.shop?.owner}\n` +
      `🔗 <b>Do‘kon ID:</b> <code>${shopId}</code>\n\n` +
      `Endi to‘lovlarni qabul qilish uchun <b>🔐 Userbot ulash</b> yoki <b>📣 Kanal ulash</b> tugmasini bosing!`,
      menu
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // SHOP EDIT FLOW STEPS (Edit Name, Card, Owner, Webhook, Logo)
  // -------------------------------------------------------------
  if (flow?.step === 'edit_shop_name') {
    const newName = raw.trim()
    if (!newName) {
      await send(token, chatId, '❗ Iltimos, do‘kon nomini kiriting:', back)
      return NextResponse.json({ ok: true })
    }
    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)
      
    await db.update(shops).set({ name: newName }).where(shopCondition)
    await stateDelete(chatId)
    await send(token, chatId, `✅ <b>Do‘kon nomi muvaffaqiyatli o‘zgartirildi:</b> <i>${newName}</i>`, menu)
    const updated = await db.select().from(shops).where(shopCondition).limit(1)
    if (updated[0]) notifyAdminNewShop(token, updated[0])
    await showShopDetails(token, chatId, userIdStr, targetShopId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'edit_shop_card_num') {
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 16) {
      await send(
        token,
        chatId,
        '❗ HUMO karta raqami to‘liq 16 ta raqam bo‘lishi kerak (masalan: <code>9860 3501 2345 3587</code>):',
        back
      )
      return NextResponse.json({ ok: true })
    }

    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)

    await db
      .update(shops)
      .set({
        cardNumber: digits,
        cardLast4: digits.slice(-4),
      })
      .where(shopCondition)

    await stateSet(chatId, { step: 'edit_shop_card_owner', tempCard: digits, targetShopId })
    await send(
      token,
      chatId,
      `💳 <b>Karta raqami qabul qilindi:</b> <code>${formatCard(digits)}</code>\n\n` +
      `👤 Endi karta egasining ism-sharifini yuboring (masalan: <code>AZIZBEK KARIMOV</code>):\n` +
      `<i>(Agar o‘zgartirishni xohlamasangiz, <code>0</code> deb yuboring)</i>`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'edit_shop_card_owner') {
    const ownerName = raw.trim()
    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)

    if (ownerName !== '0' && ownerName.length > 1) {
      await db.update(shops).set({ accountOwner: ownerName }).where(shopCondition)
    }
    await stateDelete(chatId)
    await send(token, chatId, '✅ <b>Karta va hisob egasi ma’lumotlari muvaffaqiyatli saqlandi!</b>', menu)
    const updated = await db.select().from(shops).where(shopCondition).limit(1)
    if (updated[0]) notifyAdminNewShop(token, updated[0])
    await showShopDetails(token, chatId, userIdStr, targetShopId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'edit_shop_webhook_url') {
    const val = raw.trim()
    let newUrl: string | null = val
    if (val.toLowerCase() === 'ochirish' || val === '0' || val.toLowerCase() === "o'chirish") {
      newUrl = null
    } else if (!val.startsWith('http://') && !val.startsWith('https://')) {
      newUrl = `https://${val}`
    }

    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)

    await db.update(shops).set({ webhookUrl: newUrl }).where(shopCondition)
    await stateDelete(chatId)
    await send(
      token,
      chatId,
      newUrl
        ? `✅ <b>Webhook URL muvaffaqiyatli saqlandi:</b>\n<code>${newUrl}</code>`
        : `✅ <b>Webhook URL o‘chirildi.</b>`,
      menu
    )
    const updated = await db.select().from(shops).where(shopCondition).limit(1)
    if (updated[0]) notifyAdminNewShop(token, updated[0])
    await showShopDetails(token, chatId, userIdStr, targetShopId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'edit_shop_logo_url') {
    let logoUrl = raw.trim()
    if (message.photo && message.photo.length > 0) {
      const highestPhoto = message.photo[message.photo.length - 1]
      try {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${highestPhoto.file_id}`)
        const fileData = await fileRes.json()
        if (fileData.ok && fileData.result?.file_path) {
          logoUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`
        }
      } catch {}
    }

    const targetShopId = flow.targetShopId
    const shopCondition = targetShopId 
      ? and(eq(shops.userId, userIdStr), eq(shops.id, targetShopId))
      : eq(shops.userId, userIdStr)

    if (logoUrl.toLowerCase() === 'ochirish' || logoUrl === '0') {
      await db.update(shops).set({ logoUrl: null }).where(shopCondition)
      await send(token, chatId, '✅ Logotip o‘chirildi.', menu)
    } else {
      await db.update(shops).set({ logoUrl }).where(shopCondition)
      await send(token, chatId, '✅ Logotip muvaffaqiyatli yangilandi!', menu)
    }

    await stateDelete(chatId)
    const updated = await db.select().from(shops).where(shopCondition).limit(1)
    if (updated[0]) notifyAdminNewShop(token, updated[0])
    await showShopDetails(token, chatId, userIdStr, targetShopId)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // ADMIN TARIFF EDIT STEP HANDLERS
  // -------------------------------------------------------------
  if (flow?.step === 'admin_edit_tariff_value') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }

    const tariffId = flow.editTariffId
    const field = flow.editTariffField
    let val = raw.trim()

    if (!tariffId || !field) {
      await stateDelete(chatId)
      await send(token, chatId, '⚠️ Tahrirlash ma’lumotlari topilmadi.', adminMenu)
      return NextResponse.json({ ok: true })
    }

    const updateData: any = { updatedAt: new Date() }

    if (field === 'cardNumber') {
      const cleanCard = val.replace(/\s+/g, '')
      if (cleanCard.length < 14 || !/^\d+$/.test(cleanCard)) {
        await send(token, chatId, '❌ Noto‘g‘ri karta raqami. Iltimos kamida 14-16 xonali raqam yuboring:', back)
        return NextResponse.json({ ok: true })
      }
      updateData.cardNumber = cleanCard
    } else if (field === 'price') {
      const num = parseInt(val.replace(/\D/g, ''), 10)
      if (isNaN(num) || num <= 0) {
        await send(token, chatId, '❌ Noto‘g‘ri narx. Iltimos musbat raqam kiriting (masalan: 15000):', back)
        return NextResponse.json({ ok: true })
      }
      updateData.price = num
    } else if (field === 'cardOwner') {
      updateData.cardOwner = val
    } else if (field === 'cardBank') {
      updateData.cardBank = val
    } else if (field === 'name') {
      updateData.name = val
    } else if (field === 'description') {
      updateData.description = val
    }

    try {
      await db.update(systemTariffs).set(updateData).where(eq(systemTariffs.id, tariffId))
    } catch (dbErr) {
      console.error('Tariff update err:', dbErr)
    }

    await stateDelete(chatId)

    await send(
      token,
      chatId,
      `✅ <b>Tarif ma’lumoti muvaffaqiyatli yangilandi!</b>\n\n` +
      `📌 <b>Maydon:</b> <code>${field}</code>\n` +
      `✨ <b>Yangi qiymat:</b> <code>${val}</code>`,
      adminMenu
    )

    await renderAdminTariffManagement(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'admin_bulk_card') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }

    const parts = raw.split('|').map((s) => s.trim())
    if (parts.length < 2) {
      await send(
        token,
        chatId,
        `❌ Noto‘g‘ri format.\nIltimos quyidagicha yuboring:\n<code>KARTA_RAQAMI | ISM FAMILYASI | BANK_NOMI</code>`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    const rawCard = parts[0].replace(/\s+/g, '')
    const cardOwner = parts[1]
    const cardBank = parts[2] || 'HUMOCARD'

    if (rawCard.length < 14 || !/^\d+$/.test(rawCard)) {
      await send(token, chatId, '❌ Noto‘g‘ri karta raqami. Minimum 14-16 xonali raqam bo‘lishi kerak.', back)
      return NextResponse.json({ ok: true })
    }

    try {
      await db.update(systemTariffs).set({
        cardNumber: rawCard,
        cardOwner: cardOwner,
        cardBank: cardBank,
        updatedAt: new Date(),
      })
    } catch (dbErr) {
      console.error('Bulk card update err:', dbErr)
    }

    await stateDelete(chatId)
    await send(
      token,
      chatId,
      `🎉 <b>Barcha tariflar uchun karta ma’lumotlari muvaffaqiyatli yangilandi!</b>\n\n` +
      `💳 <b>Karta:</b> <code>${formatCard(rawCard)}</code>\n` +
      `👤 <b>Egasi:</b> ${cardOwner}\n` +
      `🏦 <b>Bank:</b> ${cardBank}`,
      adminMenu
    )

    await renderAdminTariffManagement(token, chatId)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // USERBOT ULASH OQIMI
  // -------------------------------------------------------------
  if (text === 'Userbot ulash' || raw === '/userbot') {
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
      `🔑 <b>Telegram API Hash (2/4)</b>\n\n` +
      `Endi <b>API Hash</b> kalitini yuboring:\n(Masalan: <code>a1b2c3d4e5f60718293a4b5c6d7e8f90</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'userbot_api_hash') {
    const hash = raw.trim()
    if (hash.length < 10) {
      await send(token, chatId, '❗ Noto‘g‘ri API Hash. Iltimos to‘g‘ri API Hash kalitini yuboring:', back)
      return NextResponse.json({ ok: true })
    }
    setApiHash(userIdStr, hash)
    flow.userbot = { ...flow.userbot, apiHash: hash }
    flow.step = 'userbot_phone'
    await stateSet(chatId, flow)
    await send(
      token,
      chatId,
      `📱 <b>Telefon raqam (3/4)</b>\n\n` +
      `Telegram hisobingiz telefon raqamini xalqaro formatda yuboring:\n(Masalan: <code>+998901234567</code>)`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'userbot_phone') {
    const phone = raw.trim().replace(/[^\d+]/g, '')
    if (phone.length < 9) {
      await send(token, chatId, '❗ Noto‘g‘ri telefon raqami. Masalan: <code>+998901234567</code>', back)
      return NextResponse.json({ ok: true })
    }
    flow.userbot = { ...flow.userbot, phone }
    flow.step = 'userbot_waiting_login'
    await stateSet(chatId, flow)

    await send(token, chatId, `⏳ Telegramga ulanilmoqda va <b>${phone}</b> raqamiga tasdiqlash kodi jo‘natilmoqda...`)

    try {
      const res = await startTelegramLogin(userIdStr, phone)
      flow.step = 'userbot_code'
      await stateSet(chatId, flow)
      await send(
        token,
        chatId,
        `📩 <b>Telegram Tasdiqlash Kodi (4/4)</b>\n\n` +
        `Telegram ilovangizga kelgan <b>5 xonali tasdiqlash kodi</b>ni yuboring:\n` +
        `(Masalan: <code>1 2 3 4 5</code> yoki <code>12345</code>)\n\n` +
        `🔒 <i>Kod Telegram rasmiy chatiga keladi.</i>`,
        back
      )
    } catch (err: any) {
      flow.step = 'userbot_phone'
      await stateSet(chatId, flow)
      await send(token, chatId, `❌ Ulanishda xatolik: ${err?.message ?? 'Noma’lum xatolik'}.\nQaytadan telefon raqamingizni yuboring:`, back)
    }
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'userbot_code') {
    const code = raw.trim().replace(/\D/g, '')
    if (code.length < 3) {
      await send(token, chatId, '❗ Kod noto‘g‘ri. Iltimos Telegramdan kelgan kodni yuboring:', back)
      return NextResponse.json({ ok: true })
    }

    try {
      const res = await verifyTelegramCode(userIdStr, code)
      if (res.requires2FA) {
        flow.step = 'userbot_2fa'
        await stateSet(chatId, flow)
        await send(
          token,
          chatId,
          `🔐 <b>Ikki bosqichli autentifikatsiya (2FA)</b>\n\n` +
          `Hisobingizda 2FA yoqilgan. Telegram <b>2FA parolingiz</b>ni yuboring:\n` +
          `(Masalan: <code>MeningParolim123</code>)`,
          back
        )
        return NextResponse.json({ ok: true })
      }

      if (res.sessionString) {
        const connId = randomUUID()
        try {
          const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
          const targetShopId = userShops[0]?.id || `shop-${userIdStr}`
          await db.insert(userbotConnections).values({
            id: connId,
            shopId: targetShopId,
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
          `🎉 <b>Tabriklaymiz! Userbot muvaffaqiyatli ulandi!</b>\n\n` +
          `🤖 <b>Humocardbot (@humocardbot) monitoringi faollashtirildi.</b>\n` +
          `Barcha HUMO to‘lovlari endi real vaqtda tasdiqlanadi va tizimingizga xabar beriladi!`,
          menu
        )
      }
    } catch (err: any) {
      await send(token, chatId, `❌ Kod noto‘g‘ri yoki eskirgan: ${err?.message ?? 'Xato'}.\nQaytadan kodni kiriting:`, back)
    }
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'userbot_2fa') {
    const password = raw.trim()
    try {
      const res = await submitTelegram2FA(userIdStr, password)
      if (res.sessionString) {
        const connId = randomUUID()
        try {
          const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
          const targetShopId = userShops[0]?.id || `shop-${userIdStr}`
          await db.insert(userbotConnections).values({
            id: connId,
            shopId: targetShopId,
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
  // TARIFLAR
  // -------------------------------------------------------------
  if (text === 'Tariflar' || text === 'Premium' || text === '💎 Tariflar' || raw === '/tariffs') {
    let tariffList: any[] = []
    try {
      tariffList = await db.select().from(systemTariffs).where(eq(systemTariffs.active, true))
    } catch {}

    if (!tariffList.length) {
      tariffList = [
        { id: 'tariff-daily', name: 'Kunlik', price: 1000, period: 'kun', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', description: '1 kunlik sinov va faol monitoring' },
        { id: 'tariff-weekly', name: 'Haftalik', price: 6500, period: 'hafta', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', description: '7 kunlik do‘kon integratsiyasi' },
        { id: 'tariff-monthly', name: 'Oylik VIP', price: 27858, period: 'oy', cardNumber: '9860350123453587', cardOwner: 'AZizbek I', description: '30 kunlik to‘liq cheksiz imkoniyat' },
      ]
    }

    const tTxt = tariffList.map((t) =>
      `💎 <b>${t.name}</b> — <b>${Number(t.price).toLocaleString('uz-UZ')} UZS</b> / ${t.period}\n` +
      `📝 ${t.description || 'Cheksiz to‘lov qabul qilish va monitoring'}\n` +
      `💳 <b>To‘lov kartasi:</b> <code>${formatCard(t.cardNumber || '9860350123453587')}</code>\n` +
      `👤 <b>Egasi:</b> ${t.cardOwner || 'AZizbek I'}`
    ).join('\n\n─────────────\n\n')

    const inlineButtons = tariffList.map((t) => [
      { text: `💳 ${t.name} (${Number(t.price).toLocaleString('uz-UZ')} UZS) — To‘lov yaratish`, callback_data: `buy_tariff_${t.id}` }
    ])

    await send(
      token,
      chatId,
      `💎 <b>PayGo Maxsus Premium Tariflari:</b>\n\n${tTxt}\n\n` +
      `ℹ️ <i>Tarifga to‘lov qilish uchun quyidagi tugmalardan birini bosing va 5 daqiqalik to‘lov buyurtmasini yarating. Userbot orqali to‘lovingiz avtomatik tasdiqlanadi yoki qo‘lda tekshirishingiz mumkin:</i>\n\n` +
      `🌐 Boshqaruv CRM: <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
      { inline_keyboard: inlineButtons }
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // ADMIN PANEL (/admin & Admin Keyboard)
  // -------------------------------------------------------------
  if (raw === '/admin' || text === 'Admin' || text === 'Crm' || text === 'Admin panel') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await send(token, chatId, '⛔️ Siz admin emassiz. Boshqaruv faqat tasdiqlangan adminlar uchun.', menu)
      return NextResponse.json({ ok: true })
    }

    const allShops = await db.select().from(shops)
    const pendingShops = allShops.filter((s) => !s.approved)
    const allPayments = await db.select().from(payments)
    const paidPayments = allPayments.filter((p) => p.status === 'paid')
    const totalVolume = paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0)

    let pendingTxt = ''
    if (pendingShops.length > 0) {
      pendingTxt = `\n\n⚠️ <b>Tasdiqlash kutilayotgan do‘konlar:</b>\n` + pendingShops.map((s) => `• <b>${s.name}</b> (ID: <code>${s.id}</code>)`).join('\n')
    }

    await send(
      token,
      chatId,
      `👑 <b>PayGo Admin CRM Boshqaruvi</b>\n\n` +
      `🏪 <b>Jami do‘konlar:</b> ${allShops.length} ta (Faol: ${allShops.length - pendingShops.length})\n` +
      `💰 <b>Jami tushum hajmi:</b> ${totalVolume.toLocaleString()} UZS (${paidPayments.length} ta to‘lov)\n` +
      `🤖 <b>Userbot holati:</b> Faol monitoringda\n` +
      `${pendingTxt}\n\n` +
      `Quyidagi admin boshqaruv tugmalaridan foydalaning:`,
      adminMenu
    )
    return NextResponse.json({ ok: true })
  }

  // Admin sub-menus
  if (text === 'Do‘konlar boshqaruvi') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })

    const allShops = await db.select().from(shops).orderBy(desc(shops.createdAt)).limit(10)
    const inlineButtons = allShops.map((s) => [
      { text: `${s.approved ? '✅' : '⏳'} ${s.name}`, callback_data: `view_shop_${s.id}` },
      ...(!s.approved ? [{ text: 'Tasdiqlash', callback_data: `approve_shop_${s.id}` }] : []),
    ])

    await send(
      token,
      chatId,
      `🏪 <b>Barcha Do‘konlar Ro‘yxati (${allShops.length} ta):</b>\n\n` +
      allShops.map((s) => `• <b>${s.name}</b> | Karta: <code>${formatCard(s.cardNumber || '')}</code> | ${s.approved ? '✅ Faol' : '⏳ Kutilmoqda'}`).join('\n'),
      { inline_keyboard: inlineButtons.slice(0, 10) }
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Tariflar boshqaruvi') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })
    await renderAdminTariffManagement(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Adminlar boshqaruvi') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })

    const roles = await db.select().from(systemRoles)
    await send(
      token,
      chatId,
      `👥 <b>Tizim Adminlari:</b>\n\n` +
      roles.map((r) => `• <code>${r.telegramId}</code> (${r.role}) - Qo‘shdi: ${r.addedBy}`).join('\n') +
      `\n\n⚙️ <i>Yangi admin qo‘shish uchun: <code>/addadmin &lt;telegram_id&gt;</code></i>\n` +
      `⚙️ <i>Adminni o‘chirish: <code>/removeadmin &lt;telegram_id&gt;</code></i>`,
      adminMenu
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Barcha statistika') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })

    const allPayments = await db.select().from(payments)
    const paid = allPayments.filter((p) => p.status === 'paid')
    const totalVolume = paid.reduce((s, p) => s + (p.amount || 0), 0)

    await send(
      token,
      chatId,
      `📊 <b>Umumiy Tizim Statistikasi:</b>\n\n` +
      `💰 <b>Jami tushum:</b> ${totalVolume.toLocaleString()} UZS\n` +
      `✅ <b>Muvaffaqiyatli to‘lovlar:</b> ${paid.length} ta\n` +
      `⏳ <b>Kutilayotgan to‘lovlar:</b> ${allPayments.filter((p) => p.status === 'pending').length} ta\n` +
      `🌐 <b>Web CRM Dashboard:</b> <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
      adminMenu
    )
    return NextResponse.json({ ok: true })
  }

  // /addadmin <telegramId>
  if (raw.startsWith('/addadmin')) {
    const isSuper = await isSuperAdminTelegramId(userIdStr)
    if (!isSuper) {
      await send(token, chatId, '⛔️ Yangi adminni faqat Bosh Superadmin (8021115446) qo‘sha oladi.', menu)
      return NextResponse.json({ ok: true })
    }
    const newAdminId = raw.replace('/addadmin', '').trim()
    if (!newAdminId) {
      await send(token, chatId, '❗ Telegram ID kiritilmadi: <code>/addadmin 123456789</code>', menu)
      return NextResponse.json({ ok: true })
    }

    await db
      .insert(systemRoles)
      .values({
        id: randomUUID(),
        telegramId: newAdminId,
        role: 'admin',
        addedBy: userIdStr,
      })
      .onConflictDoUpdate({
        target: systemRoles.telegramId,
        set: { role: 'admin' },
      })

    await send(token, chatId, `✅ <b>Foydalanuvchi ${newAdminId} admin etib tayinlandi!</b>`, adminMenu)
    return NextResponse.json({ ok: true })
  }

  // /removeadmin <telegramId>
  if (raw.startsWith('/removeadmin')) {
    const isSuper = await isSuperAdminTelegramId(userIdStr)
    if (!isSuper) {
      await send(token, chatId, '⛔️ Adminni faqat Bosh Superadmin o‘chira oladi.', menu)
      return NextResponse.json({ ok: true })
    }
    const remAdminId = raw.replace('/removeadmin', '').trim()
    if (remAdminId === '8021115446') {
      await send(token, chatId, '⛔️ Asosiy superadminni o‘chirib bo‘lmaydi.', menu)
      return NextResponse.json({ ok: true })
    }

    await db.delete(systemRoles).where(eq(systemRoles.telegramId, remAdminId))
    await send(token, chatId, `✅ <b>Admin ${remAdminId} o‘chirildi.</b>`, adminMenu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Statistika' || text === '📊 Statistika') {
    const totalPayments = await db.select().from(payments).where(eq(payments.userId, userIdStr))
    const paid = totalPayments.filter((p) => p.status === 'paid')
    const totalSum = paid.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    const authUrl = await generateAuthUrl(userIdStr)

    await send(
      token,
      chatId,
      `📊 <b>Sizning To‘lov Statistikangiz:</b>\n\n` +
      `💰 <b>Jami tushum:</b> ${totalSum.toLocaleString()} UZS\n` +
      `✅ <b>Muvaffaqiyatli to‘lovlar:</b> ${paid.length} ta\n` +
      `⏳ <b>Kutilayotgan:</b> ${totalPayments.filter((p) => p.status === 'pending').length} ta\n\n` +
      `🌐 <b>Batafsil Veb CRM:</b> <a href="${authUrl}">${APP_URL}/panel</a>`,
      {
        inline_keyboard: [
          [
            { text: '📱 Batafsil CRM (Mini App)', web_app: { url: authUrl } },
            { text: '🌐 Brauzerda ochish', url: authUrl },
          ],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (text === 'Tarix' || text === '📜 Tarix') {
    const userPayments = await db.select().from(payments).where(eq(payments.userId, userIdStr)).orderBy(desc(payments.createdAt)).limit(5)
    if (!userPayments.length) {
      await send(token, chatId, '📭 Hozircha to‘lovlar tarixi bo‘sh.', menu)
      return NextResponse.json({ ok: true })
    }
    
    let historyText = '📜 <b>So‘nggi 5 ta to‘lov tarixi:</b>\n\n'
    for (const p of userPayments) {
      const statusIcon = p.status === 'paid' ? '✅' : (p.status === 'pending' ? '⏳' : '❌')
      const typeLabel = p.isTest ? '🧪 Test' : '💳 Real'
      const dt = new Date(p.createdAt).toLocaleString('uz-UZ')
      historyText += `${statusIcon} <b>${p.amount.toLocaleString()} UZS</b> (${typeLabel})\n📅 ${dt}\n🆔 <code>${p.id}</code>\n\n`
    }
    historyText += '<i>To‘liq tarixni Veb CRM panelida ko‘rishingiz mumkin.</i>'
    await send(token, chatId, historyText, menu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Qoidalar' || text === 'Faoliyat va Qonuniylik' || raw === '⚖️ Qoidalar' || raw === '⚖️ Faoliyat va Qonuniylik') {
    await renderLegalInfo(token, chatId)
    return NextResponse.json({ ok: true })
  }

  // Fallback
  await send(token, chatId, 'Kerakli bo‘limni tanlang:', menu)
  return NextResponse.json({ ok: true })
}
