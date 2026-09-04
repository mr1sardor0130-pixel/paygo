import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, ensureDbSchema, pool } from '@/lib/db'
import {
  payments,
  shops,
  userbotConnections,
  systemRoles,
  systemTariffs,
  authSessions,
  userProfiles,
  systemSettings,
  fundraisers,
  donations,
  mandatoryChannels,
  paidAccessRooms,
  paidAccessMembers,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { isAdminTelegramId, isSuperAdminTelegramId } from '@/lib/admin'
import { getSystemTariffs, getTariffById, DEFAULT_TARIFFS } from '@/lib/tariffs'
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
import { checkShopLimit, checkTransactionLimits, getUserLimitsStatus } from '@/lib/utils/limits'
import { startHumoUserbot, stopHumoUserbot, isUserbotActive } from '@/lib/telegram-userbot'
import { deliverWebhook, signPayload } from '@/lib/webhook'
import { generateReceiptPdfBuffer } from '@/lib/pdf-receipt'

export const dynamic = 'force-dynamic'

let APP_URL =
  process.env.APP_URL && !process.env.APP_URL.includes('paygo-pearl.vercel.app')
    ? process.env.APP_URL
    : 'https://paygo.uz'

function resolveAppUrl(req?: Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes('paygo-pearl.vercel.app')) {
    return process.env.APP_URL
  }
  if (req) {
    try {
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
      const proto = req.headers.get('x-forwarded-proto') || 'https'
      if (host && !host.includes('localhost')) {
        return `${proto}://${host}`
      }
    } catch {}
  }
  return APP_URL
}
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
  mchanName?: string
  mchanId?: string
  mchanUrl?: string
}

const menu = {
  keyboard: [
    [{ text: '🛍 Do‘kon ochish' }, { text: '🏪 Mening do‘konim' }],
    [{ text: '💳 Mening kartam' }, { text: '🔐 Userbot ulash' }],
    [{ text: '🤝 Referal (Tekin Premium)' }, { text: '💎 Tariflar' }],
    [{ text: '💎 VIP Guruhlar' }, { text: '📣 Kanal ulash' }],
    [{ text: '🧪 Webhook Test' }, { text: '🔗 Webhook sozlash' }],
    [{ text: '🌐 Veb-panelga kirish' }, { text: '📊 Statistika' }],
    [{ text: '🏆 Liderlar' }, { text: '❤️ Qo‘llab-quvvatlash (Ehson)' }],
    [{ text: '🤖 Bot haqida & FAQ' }, { text: '📚 API hujjat' }],
    [{ text: '❌ Menyuni yopish' }],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
  is_persistent: false,
}

const adminMenu = {
  keyboard: [
    [{ text: '🏪 Do‘konlar boshqaruvi' }, { text: '💎 Tariflar boshqaruvi' }],
    [{ text: '📣 Rasmiy Kanal & Majburiy Obuna' }, { text: '👥 Adminlar boshqaruvi' }],
    [{ text: '📢 Reklama & Broadcast' }, { text: '🛑 Faoliyat boshqaruvi' }],
    [{ text: '📊 Barcha statistika' }, { text: '🤖 Userbotlar holati' }],
    [{ text: '🏠 Asosiy menyuga qaytish' }, { text: '🌐 Web CRM Dashboard' }],
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

function formatTariffFeatures(featuresInput?: string | any[] | null): string {
  if (!featuresInput) return ''
  if (Array.isArray(featuresInput)) {
    return featuresInput
      .map((item: any) => String(item).trim())
      .filter(Boolean)
      .map((s: string) => (s.startsWith('✓') || s.startsWith('•') || s.startsWith('-') ? `  ${s}` : `  ✓ ${s}`))
      .join('\n')
  }
  if (typeof featuresInput === 'string') {
    try {
      const parsed = JSON.parse(featuresInput)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => String(item).trim())
          .filter(Boolean)
          .map((s: string) => (s.startsWith('✓') || s.startsWith('•') || s.startsWith('-') ? `  ${s}` : `  ✓ ${s}`))
          .join('\n')
      }
    } catch {}
    return featuresInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith('✓') || s.startsWith('•') || s.startsWith('-') ? `  ${s}` : `  ✓ ${s}`))
      .join('\n')
  }
  return ''
}

async function renderUserTariffs(token: string, chatId: number | string, userIdStr: string) {
  let profile: any = null
  try {
    const profs = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userIdStr)).limit(1)
    profile = profs[0]
  } catch {}

  let currentTierInfo = '<b>Oddiy (Bepul)</b> — Limit: 1 ta do‘kon, test to‘lovlar.'
  try {
    const limits = await getUserLimitsStatus(userIdStr)
    if (limits.isAdmin) {
      currentTierInfo = '👑 <b>Bosh Admin</b> — Cheksiz barcha imkoniyatlar faol.'
    } else if (limits.isPremium && profile?.premiumEndsAt && new Date(profile.premiumEndsAt) > new Date()) {
      const exactEndDate = new Date(profile.premiumEndsAt).toLocaleString('uz-UZ')
      currentTierInfo = `💎 <b>PREMIUM VIP</b> (Faol)\n⏳ <b>Amal qilish muddati:</b> <code>${exactEndDate}</code> gacha\n🏪 Do‘konlar: Cheksiz | ⚡️ To‘lovlar: Cheksiz`
    } else {
      currentTierInfo =
        `<b>Oddiy (Bepul)</b>:\n` +
        `  • 🧪 Test to‘lovlar: <b>${limits.testUsed}/50 ta</b>\n` +
        `  • 💳 Haqiqiy to‘lovlar: <b>${limits.realUsed}/30 ta</b>\n` +
        `  • 🏪 Do‘konlar: <b>${limits.shopsCount}/1 ta</b>\n` +
        `<i>Cheksiz test va cheksiz to‘lovlar uchun quyidagi Premium tariflarga o‘ting.</i>`
    }
  } catch {}

  const tariffs = await getSystemTariffs()

  const text =
    `💎 <b>PayGo Mukammal Premium Obunalar</b>\n\n` +
    `⚡️ <i>Avto to‘lov (@humocardbot), Donate jamg‘armalari, VIP Guruhlar (Pullik yozish) va cheksiz do‘konlar tizimi!</i>\n\n` +
    `🛡 <b>0% Komissiya — Qonuniy Kafolat:</b>\n` +
    `Biz hech qachon to‘lovlardan foiz olmaymiz va foydalanuvchilar mablag‘larini saqlamaymiz! Barcha pullar 100% to‘g‘ridan-to‘g‘ri sizning o‘z bank kartangizga tushadi. PayGo — faqatgina xavfsiz SaaS texnik avtomatlashtirish platformasidir.\n\n` +
    `👤 <b>Hozirgi maqomingiz:</b>\n${currentTierInfo}\n\n` +
    `─────────────\n\n` +
    `📋 <b>Mavjud Tariflar va Imkoniyatlar:</b>\n\n` +
    tariffs
      .map((t) => {
        const featText = formatTariffFeatures(t.features)
        return (
          `💎 <b>${t.name}</b> — <code>${Number(t.price).toLocaleString('uz-UZ')}</code> UZS / ${t.period}\n` +
          `📝 <i>${t.description || 'Cheksiz to‘lovlar va to‘liq monitoring'}</i>\n` +
          (featText ? `✨ <b>Imkoniyatlar:</b>\n${featText}\n` : '') +
          `💳 <b>Karta:</b> <code>${formatCard(t.cardNumber || '9860166655238557')}</code>\n` +
          `👤 <b>Egasi:</b> ${t.cardOwner || 'Sardor Tuyginov'} (${t.cardBank || 'HUMOCARD'})`
        )
      })
      .join('\n\n─────────────\n\n') +
    `\n\nℹ️ <i>To‘lov qilish uchun quyidagi tugmalardan birini bosing. 5 daqiqalik xavfsiz to‘lov hisobi ochiladi va kartaga o‘tkazganingizdan so‘ng tizim to‘lovni avtomatik tasdiqlaydi.</i>`

  const inlineKeyboard: any[] = tariffs.map((t) => [
    {
      text: `💳 ${t.name} (${Number(t.price).toLocaleString('uz-UZ')} UZS)`,
      callback_data: `buy_tariff_${t.id}`,
    },
  ])

  const crmAuthUrl = await generateAuthUrl(userIdStr, '/tariffs')
  inlineKeyboard.push([
    { text: '🌐 Saytda 💎 Tariflar & Premium', url: crmAuthUrl }
  ])

  await send(token, chatId, text, { inline_keyboard: inlineKeyboard })
}

async function isMaintenanceMode(): Promise<boolean> {
  try {
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'maintenance_mode')).limit(1)
    return rows.length > 0 && rows[0].value === 'true'
  } catch {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "key" text PRIMARY KEY,
          "value" text NOT NULL,
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        );
      `)
    } catch {}
    return false
  }
}

export async function getServiceShutdownData(): Promise<{ active: boolean; reason: string }> {
  try {
    const rows = await db.select().from(systemSettings).where(or(eq(systemSettings.key, 'service_shutdown_mode'), eq(systemSettings.key, 'service_shutdown_reason')))
    let active = false
    let reason = 'Muayyan sabablarga ko‘ra loyiha o‘z faoliyatini vaqtincha to‘xtatdi.'
    for (const r of rows) {
      if (r.key === 'service_shutdown_mode' && r.value === 'true') active = true
      if (r.key === 'service_shutdown_reason' && r.value) reason = r.value
    }
    return { active, reason }
  } catch {
    return { active: false, reason: '' }
  }
}

export const PROMO_MESSAGES = [
  `🚀 <b>PayGo bilan biznesingizni avtomatlashtiring!</b>\n\n` +
  `Siz hali ham HUMO to‘lovlarini qo‘lda tekshiryapsizmi? PayGo Webhook xizmati orqali to‘lov xabarnomalari 1 soniyada serveringizga yetib boradi!\n\n` +
  `💡 <i>Veb-saytingiz yoki Telegram botingizga atigi 2 daqiqada ulashingiz mumkin.</i>\n\n` +
  ` Boshlash uchun menyudan <b>"🏪 Do‘kon ochish"</b> bo‘limiga o‘ting!`,

  `🎁 <b>PayGo Premium — 15 kun BEPUL Oling!</b>\n\n` +
  `Do‘stlaringiz va hamkasblaringizga o‘zingizning taklif havolangizni yuboring. Har bir taklif qilingan 3 ta do‘stingiz uchun sizga <b>15 kunlik Premium</b> sovg‘a qilinadi!\n\n` +
  ` Taklif havolangizni olish uchun botdagi <b>"🤝 Referal (Tekin Premium)"</b> tugmasini bosing!`,

  `🔒 <b>Qonuniylik va Maxfiylik Kafolati</b>\n\n` +
  `PayGo — O‘zbekiston Respublikasi qonunchiligi (ZRU-547, ZRU-530-II, ZRU-792) doirasida ishlovchi ishonchli SaaS infratuzilmasi.\n\n` +
  ` Biz pul mablag‘lariga tegmaymiz va saqlamaymiz, faqatgina texnik xabarnomalarni xavfsiz yetkazamiz.\n📜 Batafsil ma'lumot: /legal`,

  `⚡️ <b>Dasturchilar va API Integratsiyasi</b>\n\n` +
  `PayGo API & Webhook orqali to‘lovlarni avtomatik tasdiqlang. Har bir muvaffaqiyatli HUMO to‘lovi haqida lahzalik JSON notifikatsiya oling va xizmatlarni avtomatik faollashtiring!\n\n` +
  ` Webhook test qilish uchun botda <b>/test_webhook</b> deb yuboring!`,

  `📊 <b>Veb CRM Dashboard orqali Tushumlarni Kuzating</b>\n\n` +
  `PayGo Web CRM paneli orqali barcha tushumlaringiz, do‘konlaringiz va tranzaksiyalar statistikasini real vaqt rejimida qulay vizual grafiklarda kuzatishingiz mumkin.\n\n` +
  ` Panelga kirish uchun botda <b>"🌐 Veb-panelga kirish"</b> tugmasini bosing!`
]

export async function broadcastToAllUsers(token: string, messageText: string, replyMarkup: any = menu) {
  try {
    await ensureDbSchema()
    const allUsers = await db.select({ telegramId: userProfiles.telegramId }).from(userProfiles)
    let successCount = 0
    let failCount = 0

    for (const u of allUsers) {
      if (!u.telegramId) continue
      try {
        const res = await send(token, u.telegramId, messageText, replyMarkup)
        if (res && res.ok) {
          successCount++
        } else {
          failCount++
        }
        await new Promise((r) => setTimeout(r, 40))
      } catch {
        failCount++
      }
    }
    return { successCount, failCount, total: allUsers.length }
  } catch (err) {
    console.error('Broadcast error:', err)
    return { successCount: 0, failCount: 0, total: 0 }
  }
}

export async function triggerAutoPromoIfNeeded(token: string) {
  try {
    await ensureDbSchema()
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      );
    `)

    // Check status
    const statusRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'autopromo_status')).limit(1)
    if (statusRow.length > 0 && statusRow[0].value === 'disabled') {
      return { triggered: false, reason: 'disabled' }
    }

    // Check interval (1 hour = 3,600,000 ms)
    const lastSentRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'autopromo_last_sent')).limit(1)
    const now = Date.now()
    const lastSent = lastSentRow.length > 0 ? Number(lastSentRow[0].value) || 0 : 0

    if (now - lastSent < 3600000) {
      return { triggered: false, reason: 'interval_not_reached', nextInMinutes: Math.round((3600000 - (now - lastSent)) / 60000) }
    }

    // Get current index
    const indexRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'autopromo_index')).limit(1)
    const currentIndex = indexRow.length > 0 ? Number(indexRow[0].value) || 0 : 0

    const messageText = PROMO_MESSAGES[currentIndex % PROMO_MESSAGES.length]
    const nextIndex = (currentIndex + 1) % PROMO_MESSAGES.length

    // Update settings FIRST
    await db.insert(systemSettings).values({ key: 'autopromo_last_sent', value: String(now) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: String(now), updatedAt: new Date() } })
    await db.insert(systemSettings).values({ key: 'autopromo_index', value: String(nextIndex) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: String(nextIndex), updatedAt: new Date() } })

    // Broadcast
    const res = await broadcastToAllUsers(token, messageText)
    return { triggered: true, index: currentIndex, stats: res }
  } catch (err) {
    console.error('triggerAutoPromoIfNeeded error:', err)
    return { triggered: false, error: String(err) }
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
      cardNumber: '9860166655238557',
      cardOwner: 'Sardor Tuyginov',
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
  const tariffs = await getSystemTariffs()

  const listText = tariffs
    .map((t, idx) => {
      const featText = formatTariffFeatures(t.features)
      return (
        `<b>${idx + 1}️⃣ ${t.name}</b> ${t.active !== false ? '🟢 (Faol)' : '🔴 (Nofaol)'} (ID: <code>${t.id}</code>)\n` +
        `💰 <b>Narxi:</b> <code>${Number(t.price).toLocaleString('uz-UZ')}</code> UZS / ${t.period}\n` +
        `💳 <b>Karta:</b> <code>${formatCard(t.cardNumber || '9860166655238557')}</code>\n` +
        `👤 <b>Egasi:</b> ${t.cardOwner || 'Sardor Tuyginov'} (${t.cardBank || 'HUMOCARD'})\n` +
        `📝 <b>Tavsif:</b> ${t.description || 'Cheksiz to‘lov qabul qilish va monitoring'}\n` +
        (featText ? `✨ <b>Xususiyatlar:</b>\n${featText}` : '')
      )
    })
    .join('\n\n─────────────\n\n')

  const inlineButtons: any[] = tariffs.map((t) => [
    { text: `✏️ ${t.name} (${Number(t.price).toLocaleString('uz-UZ')} UZS) ni tahrirlash`, callback_data: `adm_ed_tar_${t.id}` }
  ])

  inlineButtons.push([
    { text: `💳 Barcha kartalarni o‘zgartirish`, callback_data: `adm_tar_card_all` }
  ])

  const adminAuthUrl = await generateAuthUrl(chatId, '/admin?tab=tariffs_mgmt')
  inlineButtons.push([
    { text: `🌐 Web CRM da Tariflar Boshqaruvi`, url: adminAuthUrl }
  ])

  await send(
    token,
    chatId,
    `💎 <b>PayGo Tizim Tariflari va Karta Boshqaruvi</b>\n\n` +
    `${listText}\n\n` +
    `👇 <i>Tahrirlamoqchi bo‘lgan tarifingizni tanlang yoki barcha kartalarni o‘zgartiring:</i>`,
    { inline_keyboard: inlineButtons }
  )
}

async function renderAdminTariffDetail(token: string, chatId: number | string, tariffId: string) {
  const tariff = await getTariffById(tariffId)

  if (!tariff) {
    await send(token, chatId, '⚠️ Tarif topilmadi.')
    return
  }

  const featText = formatTariffFeatures(tariff.features)

  const text =
    `⚙️ <b>Tarif Tahrirlash: ${tariff.name}</b>\n\n` +
    `🆔 <b>ID:</b> <code>${tariff.id}</code>\n` +
    `⚡️ <b>Holati:</b> ${tariff.active ? '🟢 Faol' : '🔴 Nofaol'}\n` +
    `📝 <b>Nomi:</b> ${tariff.name}\n` +
    `💰 <b>Narxi:</b> <code>${Number(tariff.price).toLocaleString('uz-UZ')}</code> UZS\n` +
    `⏱ <b>Muddati:</b> ${tariff.period}\n` +
    `💳 <b>Karta:</b> <code>${formatCard(tariff.cardNumber || '')}</code>\n` +
    `👤 <b>Egasi:</b> ${tariff.cardOwner || ''}\n` +
    `🏦 <b>Bank:</b> ${tariff.cardBank || 'HUMOCARD'}\n` +
    `📄 <b>Tavsif:</b> ${tariff.description || '-'}\n\n` +
    `✨ <b>Xususiyatlar (Avto to‘lov, Donate, VIP guruhlar):</b>\n${featText || '  (Kiritilmagan)'}\n\n` +
    `Quyidagi tugmalardan birini tanlab, kerakli maydonni o‘zgartiring:`

  const buttons = [
    [
      { text: '💰 Narxi', callback_data: `adm_tf_field_${tariff.id}_price` },
      { text: '📝 Nomi', callback_data: `adm_tf_field_${tariff.id}_name` },
    ],
    [
      { text: '✨ Xususiyatlar', callback_data: `adm_tf_field_${tariff.id}_features` },
      { text: '⏱ Muddati (kun/oy)', callback_data: `adm_tf_field_${tariff.id}_period` },
    ],
    [
      { text: '💳 Karta raqami', callback_data: `adm_tf_field_${tariff.id}_cardNumber` },
      { text: '👤 Karta egasi', callback_data: `adm_tf_field_${tariff.id}_cardOwner` },
    ],
    [
      { text: '🏦 Bank nomi', callback_data: `adm_tf_field_${tariff.id}_cardBank` },
      { text: '📄 Tavsif', callback_data: `adm_tf_field_${tariff.id}_description` },
    ],
    [
      { text: tariff.active ? '🔴 Nofaol qilish' : '🟢 Faollashtirish', callback_data: `adm_tf_toggle_${tariff.id}` },
      { text: '🗑 O‘chirish', callback_data: `adm_tf_del_${tariff.id}` },
    ],
    [
      { text: '🔙 Tariflar ro‘yxatiga qaytish', callback_data: 'adm_tar_list' }
    ]
  ]

  await send(token, chatId, text, { inline_keyboard: buttons })
}

// Check Mandatory Subscription for User
async function checkMandatorySubscription(token: string, userIdStr: string): Promise<{ ok: boolean; missingChannels: any[] }> {
  try {
    const isSubEnabledSetting = await db.select().from(systemSettings).where(eq(systemSettings.key, 'mandatory_sub_enabled')).limit(1)
    const isEnabled = isSubEnabledSetting.length > 0 && isSubEnabledSetting[0].value === 'true'
    if (!isEnabled) {
      return { ok: true, missingChannels: [] }
    }

    const allChans = await db.select().from(mandatoryChannels).where(eq(mandatoryChannels.active, true))
    if (!allChans.length) {
      return { ok: true, missingChannels: [] }
    }

    const missingChannels: any[] = []

    for (const ch of allChans) {
      try {
        const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(ch.channelId)}&user_id=${userIdStr}`
        const res = await fetch(url, { method: 'GET' })
        const data = await res.json()
        if (data.ok && data.result) {
          const status = data.result.status
          if (['creator', 'administrator', 'member', 'restricted'].includes(status)) {
            // Subscribed!
            continue
          }
        }
        missingChannels.push(ch)
      } catch (err) {
        console.warn(`Error checking sub for ${ch.channelId}:`, err)
        missingChannels.push(ch)
      }
    }

    return {
      ok: missingChannels.length === 0,
      missingChannels,
    }
  } catch (e) {
    console.error('checkMandatorySubscription error:', e)
    return { ok: true, missingChannels: [] }
  }
}

// Render Admin Official Channels & Mandatory Subscription Management
async function renderAdminOfficialChannels(token: string, chatId: number | string) {
  let offChan = '@Pay_Gouzbot'
  let offGrp = ''
  let isMandSub = false
  let chans: any[] = []

  try {
    const sets = await db.select().from(systemSettings)
    const offChanSet = sets.find((s) => s.key === 'official_channel')
    if (offChanSet?.value) offChan = offChanSet.value
    const offGrpSet = sets.find((s) => s.key === 'official_group')
    if (offGrpSet?.value) offGrp = offGrpSet.value
    const mandSubSet = sets.find((s) => s.key === 'mandatory_sub_enabled')
    if (mandSubSet?.value === 'true') isMandSub = true

    chans = await db.select().from(mandatoryChannels)
  } catch {}

  let chansListTxt = ''
  if (chans.length === 0) {
    chansListTxt = '<i>Hozircha majburiy kanallar qo‘shilmagan.</i>'
  } else {
    chansListTxt = chans
      .map((c, idx) => {
        const typeIcon = c.type === 'group' ? '👥 Guruh' : '📢 Kanal'
        const statusIcon = c.active ? '🟢 Faol' : '⚪️ Nofaol'
        return (
          `<b>${idx + 1}️⃣ ${c.name}</b> (${typeIcon})\n` +
          `• 🆔: <code>${c.channelId}</code>\n` +
          `• 🔗: <a href="${c.inviteUrl}">${c.inviteUrl}</a>\n` +
          `• Holat: <b>${statusIcon}</b>`
        )
      })
      .join('\n\n')
  }

  const text =
    `📣 <b>Rasmiy Resurslar va Majburiy Obuna Boshqaruvi</b>\n\n` +
    `📢 <b>Rasmiy Kanal:</b> <code>${offChan}</code>\n` +
    `👥 <b>Rasmiy Guruh:</b> <code>${offGrp || 'Mavjud emas'}</code>\n` +
    `🛡 <b>Majburiy Obuna Holati:</b> ${isMandSub ? '🟢 <b>YOQILGAN (FAOL)</b>' : '🔴 <b>O‘CHIRILGAN</b>'}\n\n` +
    `─────────────\n` +
    `📋 <b>Majburiy Kanallar Ro‘yxati (${chans.length} ta):</b>\n\n` +
    `${chansListTxt}\n\n` +
    `ℹ️ <i>Bot barcha ko‘rsatilgan kanallarda <b>Administrator</b> bo‘lishi shart.</i>`

  const inline_keyboard: any[] = [
    [
      {
        text: isMandSub ? '🔴 Majburiy obunani o‘chirish' : '🟢 Majburiy obunani yoqish',
        callback_data: 'adm_toggle_mand_sub',
      },
    ],
    [
      { text: '📢 Rasmiy kanalni o‘zgartirish', callback_data: 'adm_set_off_chan' },
      { text: '👥 Rasmiy guruhni o‘zgartirish', callback_data: 'adm_set_off_grp' },
    ],
    [
      { text: '➕ Yangi majburiy kanal qo‘shish', callback_data: 'adm_add_mchan' },
    ],
  ]

  if (chans.length > 0) {
    for (const c of chans) {
      inline_keyboard.push([
        { text: `${c.active ? '⚪️ O‘chirish (Faolsiz)' : '🟢 Yoqish'}: ${c.name}`, callback_data: `adm_tog_mchan_${c.id}` },
        { text: `🗑 O‘chirish`, callback_data: `adm_del_mchan_${c.id}` },
      ])
    }
  }

  inline_keyboard.push([
    { text: '🌐 Web CRM orqali boshqarish', url: `${APP_URL}/admin` },
    { text: '🔙 Admin Menyuga qaytish', callback_data: 'admin_back_main' },
  ])

  await send(token, chatId, text, { inline_keyboard })
}

let cachedBotUsername = ''
async function getBotUsername(token: string): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json()
    if (data.ok && data.result?.username) {
      cachedBotUsername = data.result.username
      return cachedBotUsername
    }
  } catch {}
  return 'Pay_Gouzbot'
}

async function renderVipRooms(token: string, chatId: number | string) {
  let rooms: any[] = []
  try {
    await ensureDbSchema()
    rooms = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.active, true))
  } catch {}

  if (!rooms.length) {
    const userVipPanelUrl = await generateAuthUrl(chatId, '/panel?tab=vip_rooms')
    await send(
      token,
      chatId,
      `💎 <b>VIP Guruhlar va Pullik Yozish Xizmatlari</b>\n\n` +
      `Hozircha tizimda ochiq VIP guruhlar qo‘shilmagan.\n\n` +
      `ℹ️ <i>Agar siz o‘z guruhingizda pullik yozish yoki VIP a’zolik tizimini yoqmoqchi bo‘lsangiz, Sayt Veb CRM paneli orqali yangi guruh qo‘shishingiz mumkin.</i>`,
      {
        inline_keyboard: [
          [{ text: '📱 VIP Guruhlar Boshqaruvi', web_app: { url: userVipPanelUrl } }],
          [{ text: '🌐 Sayt Veb CRM ga o‘tish', url: userVipPanelUrl }],
        ],
      }
    )
    return
  }

  const roomListText = rooms
    .map(
      (r, idx) =>
        `<b>${idx + 1}️⃣ ${r.title}</b>\n` +
        `• Turi: ${r.type === 'channel' ? '📢 Kanal' : '👥 Guruh'}\n` +
        `• Xizmat: ${r.mode === 'write_permission' ? '✍️ Xabar yozish ruxsati' : '🚪 Maxfiy guruhga kirish'}\n` +
        `• ⏱ 1 Soat: <code>${Number(r.hourlyPrice).toLocaleString('uz-UZ')} UZS</code>\n` +
        `• 📅 1 Kun: <code>${Number(r.dailyPrice).toLocaleString('uz-UZ')} UZS</code>\n` +
        `• ⭐️ 1 Oy: <code>${Number(r.monthlyPrice).toLocaleString('uz-UZ')} UZS</code>`
    )
    .join('\n\n─────────────\n\n')

  const buttons = rooms.map((r) => [
    { text: `💎 ${r.title} (Tariflar)`, callback_data: `view_room_tariffs_${r.id}` },
  ])

  await send(
    token,
    chatId,
    `💎 <b>PayGo VIP Guruhlar va Pullik Yozish Xizmatlari</b>\n\n` +
    `${roomListText}\n\n` +
    `👇 <i>Tariflar va kirish huquqini sotib olish uchun kerakli guruhni tanlang:</i>`,
    { inline_keyboard: buttons }
  )
}

async function renderRoomTariffs(token: string, chatId: number | string, roomId: string) {
  let room: any = null
  try {
    await ensureDbSchema()
    const rows = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, roomId)).limit(1)
    if (rows.length) room = rows[0]
  } catch {}

  if (!room) {
    await send(token, chatId, '⚠️ Guruh topilmadi.')
    return
  }

  const text =
    `💎 <b>${room.title} — VIP Kirish & Yozish Huquqi</b>\n\n` +
    `• Turi: <b>${room.type === 'channel' ? '📢 Telegram Kanal' : '👥 Telegram Guruh'}</b>\n` +
    `• Xizmat: <b>${room.mode === 'write_permission' ? '✍️ Guruhda xabar yozish ruxsati' : '🚪 VIP guruhga kirish'}</b>\n\n` +
    `Mavjud tariflar:\n` +
    `• ⏱ <b>1 Soat:</b> <code>${Number(room.hourlyPrice).toLocaleString('uz-UZ')} UZS</code>\n` +
    `• 📅 <b>1 Kun:</b> <code>${Number(room.dailyPrice).toLocaleString('uz-UZ')} UZS</code>\n` +
    `• 🗓 <b>1 Hafta:</b> <code>${Number(room.weeklyPrice).toLocaleString('uz-UZ')} UZS</code>\n` +
    `• ⭐️ <b>1 Oy:</b> <code>${Number(room.monthlyPrice).toLocaleString('uz-UZ')} UZS</code>\n\n` +
    `To‘lov qilganingizdan so‘ng guruhda yozish huquqi yoki maxsus taklif havolasi avtomatik ravishda taqdim etiladi. Kerakli muddatni tanlang: 👇`

  const buttons = [
    [
      { text: `⏱ 1 Soat (${Number(room.hourlyPrice).toLocaleString()} UZS)`, callback_data: `buy_room_${room.id}_hour` },
      { text: `📅 1 Kun (${Number(room.dailyPrice).toLocaleString()} UZS)`, callback_data: `buy_room_${room.id}_day` },
    ],
    [
      { text: `🗓 1 Hafta (${Number(room.weeklyPrice).toLocaleString()} UZS)`, callback_data: `buy_room_${room.id}_week` },
      { text: `⭐️ 1 Oy (${Number(room.monthlyPrice).toLocaleString()} UZS)`, callback_data: `buy_room_${room.id}_month` },
    ],
    [{ text: '🔙 Guruhlar ro‘yxatiga qaytish', callback_data: 'view_vip_rooms' }],
  ]

  await send(token, chatId, text, { inline_keyboard: buttons })
}

async function handleRoomPaymentSuccess(
  token: string,
  chatId: number | string,
  userIdStr: string,
  payment: any,
  roomId: string,
  period: 'hour' | 'day' | 'week' | 'month'
) {
  try {
    await ensureDbSchema()
    const roomRows = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, roomId)).limit(1)
    if (!roomRows.length) return
    const room = roomRows[0]

    const now = Date.now()
    let durationMs = 30 * 24 * 60 * 60 * 1000
    if (period === 'hour') durationMs = 60 * 60 * 1000
    else if (period === 'day') durationMs = 24 * 60 * 60 * 1000
    else if (period === 'week') durationMs = 7 * 24 * 60 * 60 * 1000
    else if (period === 'month') durationMs = 30 * 24 * 60 * 60 * 1000

    const expiresAt = new Date(now + durationMs)

    await db.update(payments).set({ status: 'paid', matchedAt: new Date() }).where(eq(payments.id, payment.id))

    const existingMem = await db
      .select()
      .from(paidAccessMembers)
      .where(and(eq(paidAccessMembers.roomId, room.id), eq(paidAccessMembers.userId, userIdStr)))
      .limit(1)

    if (existingMem.length > 0) {
      await db
        .update(paidAccessMembers)
        .set({
          status: 'active',
          period,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(paidAccessMembers.id, existingMem[0].id))
    } else {
      await db.insert(paidAccessMembers).values({
        id: `pmem_${randomUUID().slice(0, 10)}`,
        roomId: room.id,
        userId: userIdStr,
        status: 'active',
        period,
        expiresAt,
      })
    }

    let inviteLink = ''
    if (room.mode === 'write_permission') {
      try {
        await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: room.chatId,
            user_id: Number(userIdStr),
            permissions: {
              can_send_messages: true,
              can_send_media_messages: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true,
            },
          }),
        })
      } catch (tgErr) {
        console.warn('restrictChatMember err:', tgErr)
      }
    } else if (room.mode === 'invite_only') {
      try {
        const linkRes = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: room.chatId,
            member_limit: 1,
            name: `VIP-${userIdStr}`,
          }),
        })
        const linkData = await linkRes.json()
        if (linkData.ok && linkData.result?.invite_link) {
          inviteLink = linkData.result.invite_link
        }
      } catch (tgErr) {
        console.warn('createChatInviteLink err:', tgErr)
      }
    }

    const expiryStr = expiresAt.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const buttons: any[] = []
    if (inviteLink) {
      buttons.push([{ text: '🚪 Guruhga kirish (Bir martalik havola)', url: inviteLink }])
    }
    buttons.push([{ text: '💎 VIP Guruhlar', callback_data: 'view_vip_rooms' }])

    await send(
      token,
      chatId,
      `🎉 <b>To‘lov Muvaffaqiyatli Tasdiqlandi!</b>\n\n` +
      `💎 <b>Guruh/Kanal:</b> ${room.title}\n` +
      `⏱ <b>Muddati:</b> ${period === 'hour' ? '1 Soat' : period === 'day' ? '1 Kun' : period === 'week' ? '1 Hafta' : '1 Oy'}\n` +
      `⏳ <b>Amal qilish vaqti:</b> <code>${expiryStr}</code> gacha\n\n` +
      `✅ <b>Sizga guruhda erkin yozish ruxsati muvaffaqiyatli faollashtirildi!</b>\n` +
      `Endi guruhda cheklovlarsiz muloqot qilishingiz mumkin.`,
      { inline_keyboard: buttons }
    )
  } catch (err) {
    console.error('handleRoomPaymentSuccess error:', err)
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'paygo-telegram-webhook', time: new Date().toISOString() })
}

export async function POST(request: Request) {
  APP_URL = resolveAppUrl(request)
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: true })

  let update: Update
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  await ensureDbSchema()

  // Non-blocking hourly auto-promo trigger check
  triggerAutoPromoIfNeeded(token).catch((err) => console.error('AutoPromo background trigger error:', err))

  const maintenance = await isMaintenanceMode()
  const shutdownData = await getServiceShutdownData()
  const telegramId = update.message?.from?.id || update.callback_query?.from?.id
  const isAdmin = await isAdminTelegramId(telegramId)

  if (shutdownData.active && !isAdmin) {
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id || update.callback_query?.from.id
    if (chatId) {
      await send(
        token,
        chatId,
        '🛑 <b>Loyiha faoliyati vaqtincha to‘xtatilgan</b>\n\n' +
        `<b>Sababi:</b>\n${shutdownData.reason}\n\n` +
        'Keltirilgan noqulayliklar uchun chin dildan uzr so‘raymiz. Faoliyatimiz qayta tiklanishi bilanoq sizga e’lon qilinadi. 🙏'
      )
    }
    return NextResponse.json({ ok: true })
  }

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

    // Mandatory subscription enforcement for non-admin callback queries
    const isExemptCb =
      data === 'check_mandatory_sub' ||
      data === 'accept_terms' ||
      data === 'view_terms' ||
      data === 'view_offer' ||
      data === 'view_legal' ||
      data.startsWith('admin_') ||
      data.startsWith('adm_')

    if (!isAdmin && !isExemptCb) {
      const subCheck = await checkMandatorySubscription(token, userIdStr)
      if (!subCheck.ok && subCheck.missingChannels.length > 0) {
        const buttons = subCheck.missingChannels.map((ch) => [
          { text: `📢 ${ch.name}`, url: ch.inviteUrl },
        ])
        buttons.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_mandatory_sub' }])
        await send(
          token,
          chatId,
          `⚠️ <b>Hurmatli foydalanuvchi!</b>\n\n` +
          `Bot xizmatlaridan to‘liq foydalanish uchun quyidagi rasmiy kanallarimizga obuna bo‘lishingiz shart:\n\n` +
          subCheck.missingChannels.map((c, i) => `${i + 1}. <b>${c.name}</b>`).join('\n') +
          `\n\nObuna bo‘lgach, <b>"✅ Obunani tekshirish"</b> tugmasini bosing:`,
          { inline_keyboard: buttons }
        )
        return NextResponse.json({ ok: true })
      }
    }

    // VIP Rooms Callbacks
    if (data === 'view_vip_rooms') {
      await renderVipRooms(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('view_room_tariffs_')) {
      const rId = data.replace('view_room_tariffs_', '')
      await renderRoomTariffs(token, chatId, rId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('buy_room_')) {
      const parts = data.replace('buy_room_', '').split('_')
      const period = parts.pop() as 'hour' | 'day' | 'week' | 'month'
      const rId = parts.join('_')

      const roomRows = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, rId)).limit(1)
      if (!roomRows.length) {
        await send(token, chatId, '⚠️ Guruh topilmadi.')
        return NextResponse.json({ ok: true })
      }
      const room = roomRows[0]
      let price = room.monthlyPrice
      if (period === 'hour') price = room.hourlyPrice
      else if (period === 'day') price = room.dailyPrice
      else if (period === 'week') price = room.weeklyPrice
      else if (period === 'month') price = room.monthlyPrice

      const paymentId = `proom_${randomUUID().replace(/-/g, '').slice(0, 10)}`
      const expAt = new Date(Date.now() + 5 * 60 * 1000)

      let shop = null
      if (room.shopId) {
        const shRows = await db.select().from(shops).where(eq(shops.id, room.shopId)).limit(1)
        if (shRows.length) shop = shRows[0]
      }
      if (!shop) {
        const anySh = await db.select().from(shops).limit(1)
        if (anySh.length) shop = anySh[0]
      }

      const cardNum = shop?.cardNumber || '9860350123453587'
      const cardOwner = shop?.accountOwner || 'Hisob egasi'
      const cardBank = shop?.cardBank || 'HUMOCARD'

      await db.insert(payments).values({
        id: paymentId,
        shopId: shop?.id || 'default',
        userId: userIdStr,
        amount: String(price),
        cardNumber: cardNum,
        cardLast4: cardNum.slice(-4),
        cardBank,
        accountOwner: cardOwner,
        status: 'pending',
        expiresAt: expAt,
      })

      const payText =
        `💎 <b>VIP Guruh Uchun To‘lov Yaratildi:</b>\n\n` +
        `• Guruh: <b>${room.title}</b>\n` +
        `• Tarif: <b>${period === 'hour' ? '1 Soat' : period === 'day' ? '1 Kun' : period === 'week' ? '1 Hafta' : '1 Oy'}</b>\n` +
        `• Summa: <code>${Number(price).toLocaleString('uz-UZ')} UZS</code>\n` +
        `• Karta: <code>${formatCard(cardNum)}</code> (${cardBank})\n` +
        `• Egasi: <b>${cardOwner}</b>\n` +
        `⏱ <b>Amal qilish vaqti:</b> 5 daqiqa\n\n` +
        `To‘lovni amalga oshirgach, HUMO to‘lov xabarnomasi avtomatik ravishda tasdiqlanadi yoki quyidagi tugma orqali tekshirishingiz mumkin:`

      const payMarkup = {
        inline_keyboard: [
          [{ text: '💳 To‘lov sahifasini ochish (Web)', url: `${APP_URL}/pay/${paymentId}` }],
          [{ text: '⚡️ To‘lovni tasdiqlash (Test/Simulyatsiya)', callback_data: `confirm_room_pay_${paymentId}_${room.id}_${period}` }],
          [{ text: '🔙 Tariflarga qaytish', callback_data: `view_room_tariffs_${room.id}` }],
        ],
      }

      await send(token, chatId, payText, payMarkup)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('confirm_room_pay_')) {
      const rawRest = data.replace('confirm_room_pay_', '')
      const parts = rawRest.split('_')
      const period = parts.pop() as 'hour' | 'day' | 'week' | 'month'
      const rId = parts.pop() || ''
      const paymentId = parts.join('_')

      const payRows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
      if (!payRows.length) {
        await send(token, chatId, '⚠️ To‘lov topilmadi.')
        return NextResponse.json({ ok: true })
      }

      await handleRoomPaymentSuccess(token, chatId, userIdStr, payRows[0], rId, period)
      return NextResponse.json({ ok: true })
    }

    // Admin inline button actions for shutdown and maintenance
    if (data === 'admin_shutdown_on') {
      if (!isAdmin) return NextResponse.json({ ok: true })
      await stateSet(chatId, { step: 'awaiting_shutdown_reason' })
      await send(
        token,
        chatId,
        `🛑 <b>Loyiha Faoliyatini To‘xtatish Rejimi</b>\n\n` +
        `Ushbu rejim yoqilganda bot oddiy foydalanuvchilar uchun yopiladi va barcha mijozlarga uzr so‘rash matni bilan e’lon yuboriladi.\n\n` +
        `Iltimos, faoliyat to‘xtatilish sababini kiriting (masalan: <i>Profilaktika va server infratuzilmasini yangilash munosabati bilan...</i>):`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'admin_shutdown_off') {
      if (!isAdmin) return NextResponse.json({ ok: true })
      try {
        await ensureDbSchema()
        await db.insert(systemSettings).values({ key: 'service_shutdown_mode', value: 'false' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'false', updatedAt: new Date() } })
        await stateDelete(chatId)

        await send(token, chatId, `🟢 <b>Loyiha faoliyati qayta tiklandi!</b>\n\n📢 Barcha mijozlarga faoliyat tiklangani haqida xabar yuborilmoqda...`, adminMenu)

        const resumeBroadcastMsg = `🟢 <b>Xushxabar! PayGo loyihasi o‘z faoliyatini to‘liq qayta tikladi!</b>\n\n` +
          `Barcha xizmatlar, Webhooklar va to‘lov bildirishnomalari uzluksiz va to‘liq shtat rejimida ishlamoqda.\n\n` +
          `Biz bilan birga ekanligingiz uchun tashakkur! Tizimdan foydalanish uchun menyuni bosing. 👇`

        const broadcastRes = await broadcastToAllUsers(token, resumeBroadcastMsg)

        await send(token, chatId, `📢 <b>Faoliyat tiklangani haqidagi xabar barcha mijozlarga yuborildi!</b>\n\n` +
          `• Muvaffaqiyatli yetkazildi: <b>${broadcastRes.successCount}</b> ta\n` +
          `• Xatolik: <b>${broadcastRes.failCount}</b> ta\n` +
          `• Jami mijozlar: <b>${broadcastRes.total}</b> ta`, adminMenu)
      } catch (err: any) {
        await send(token, chatId, `⚠️ Xatolik: ${err?.message}`, adminMenu)
      }
      return NextResponse.json({ ok: true })
    }

    if (data === 'admin_maint_on') {
      if (!isAdmin) return NextResponse.json({ ok: true })
      try {
        await ensureDbSchema()
        await db.insert(systemSettings).values({ key: 'maintenance_mode', value: 'true' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'true', updatedAt: new Date() } })
        await send(token, chatId, '✅ <b>Texnik holat yoqildi.</b>\n\nEndi bot faqat adminlar uchun ishlaydi.', adminMenu)
      } catch (err: any) {
        await send(token, chatId, `⚠️ Xatolik: ${err?.message}`, adminMenu)
      }
      return NextResponse.json({ ok: true })
    }

    if (data === 'admin_maint_off') {
      if (!isAdmin) return NextResponse.json({ ok: true })
      try {
        await ensureDbSchema()
        await db.insert(systemSettings).values({ key: 'maintenance_mode', value: 'false' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'false', updatedAt: new Date() } })
        await send(token, chatId, '❌ <b>Texnik holat o‘chirildi.</b>\n\n📢 Barcha mijozlarga xabarnoma yuborilmoqda...', adminMenu)

        const maintenanceOffMsg = `🟢 <b>PayGo Botimiz Qayta Ishga Tushdi!</b>\n\n` +
          `Texnik profilaktika va sozlash ishlari muvaffaqiyatli yakunlandi.\n\n` +
          `⚡️ Endi barcha xizmatlar, Webhooklar va HUMO to‘lov xabarnomalaridan cheklovlarsiz va to‘liq tezlikda foydalanishingiz mumkin!`

        const broadcastRes = await broadcastToAllUsers(token, maintenanceOffMsg)

        await send(token, chatId, `📢 <b>Texnik holat tugagani haqidagi xabarnoma yuborildi!</b>\n\n` +
          `• Muvaffaqiyatli yetkazildi: <b>${broadcastRes.successCount}</b> ta\n` +
          `• Xatolik: <b>${broadcastRes.failCount}</b> ta\n` +
          `• Jami mijozlar: <b>${broadcastRes.total}</b> ta`, adminMenu)
      } catch (err: any) {
        await send(token, chatId, `⚠️ Xatolik: ${err?.message}`, adminMenu)
      }
      return NextResponse.json({ ok: true })
    }

    if (data === 'menu_fundraiser') {
      const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr))
      if (userShops.length === 0) {
        await send(token, chatId, `⚠️ Qo‘llab-quvvatlash (Crowdfunding) sahifasi yaratish uchun avval do‘koningiz bo‘lishi kerak!`, menu)
        return NextResponse.json({ ok: true })
      }
      const myFunds = await db.select().from(fundraisers).where(eq(fundraisers.userId, userIdStr)).orderBy(desc(fundraisers.createdAt))
      let fundTxt = `❤️ <b>Sizning Qo‘llab-quvvatlash va Jamg‘arma Sahifalaringiz</b>\n\n`
      if (myFunds.length === 0) {
        fundTxt += `<i>Hali hech qanday jamg‘arma sahifasi yaratmadingiz.</i>`
      } else {
        fundTxt += `📌 <b>Joriy loyihalaringiz:</b>\n`
        for (const f of myFunds) {
          fundTxt += `\n• <b>${f.title}</b>\n  Yig‘ildi: <b>${(f.collectedAmount || 0).toLocaleString('uz-UZ')} UZS</b> (${f.donorCount || 0} ta ehson)\n  🔗 Havola: <code>${APP_URL}/fund/${f.id}</code>\n`
        }
      }
      const inlineButtons: any[] = myFunds.map((f) => [{ text: `🔗 ${f.title.slice(0, 20)}...`, url: `${APP_URL}/fund/${f.id}` }])
      inlineButtons.push([{ text: '➕ Yangi Jamg‘arma / Loyiha yaratish', callback_data: 'create_new_fundraiser' }])
      await send(token, chatId, fundTxt, { inline_keyboard: inlineButtons })
      return NextResponse.json({ ok: true })
    }

    if (data === 'create_new_fundraiser') {
      const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr))
      if (userShops.length === 0) {
        await send(token, chatId, `⚠️ Avval "🛍 Do‘kon ochish" bo‘limidan do‘kon yarating.`, menu)
        return NextResponse.json({ ok: true })
      }
      if (userShops.length === 1) {
        const targetShop = userShops[0]
        await stateSet(chatId, { step: 'awaiting_fund_title', targetShopId: targetShop.id })
        await send(token, chatId, `❤️ <b>Yangi Qo‘llab-quvvatlash / Jamg‘arma yaratish</b>\n\nKollaboratsiya do‘koni: <b>${targetShop.name}</b>\n\nIltimos, loyiha yoki jamg‘arma sarlavhasini kiriting (masalan: <i>Startup loyihamiz uchun qo‘llab-quvvatlash</i>):`, back)
      } else {
        const shopButtons = userShops.map((s) => [{ text: `🏪 ${s.name}`, callback_data: `select_fund_shop_${s.id}` }])
        await send(token, chatId, `❤️ <b>Yangi Qo‘llab-quvvatlash / Jamg‘arma yaratish</b>\n\nQaysi do‘koningiz bilan bog‘laysiz? (To‘lovlar ushbu do‘kon kartasiga tushadi va Userbot orqali o‘qiladi):`, { inline_keyboard: shopButtons })
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('select_fund_shop_')) {
      const shopId = data.replace('select_fund_shop_', '')
      const shopRow = await db.select().from(shops).where(and(eq(shops.id, shopId), eq(shops.userId, userIdStr))).limit(1)
      if (shopRow.length === 0) {
        await send(token, chatId, `⚠️ Do‘kon topilmadi.`, menu)
        return NextResponse.json({ ok: true })
      }
      await stateSet(chatId, { step: 'awaiting_fund_title', targetShopId: shopId })
      await send(token, chatId, `❤️ <b>Yangi Qo‘llab-quvvatlash / Jamg‘arma yaratish</b>\n\nKollaboratsiya do‘koni: <b>${shopRow[0].name}</b>\n\nIltimos, loyiha yoki jamg‘arma sarlavhasini kiriting (masalan: <i>IT Maktabimiz uchun ehson yig‘ish</i>):`, back)
      return NextResponse.json({ ok: true })
    }

    if (data === 'start_create_shop') {
      await stateSet(chatId, { step: 'awaiting_shop_name' })
      await send(token, chatId, '🛍 <b>Yangi do‘kon nomini kiriting:</b>\n\n(Masalan: <i>PayGo Super Market</i>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data === 'view_referral') {
      await send(token, chatId, `🤝 <b>Referal va Bepul Premium Tizimi</b>\n\nSiz o‘z taklif havolangiz orqali do‘stlaringizni taklif qilib, mutlaqo tekin VIP Premium tarifiga ega bo‘lishingiz mumkin!\n\n🔗 <b>Sizning taklif havolangiz:</b>\n<code>https://t.me/${BOT_USERNAME}?start=ref_${userIdStr}</code>`, menu)
      return NextResponse.json({ ok: true })
    }

    if (data === 'view_legal') {
      await send(token, chatId, `⚖️ <b>PayGo Qonuniylik va Xavfsizlik</b>\n\nPayGo platformasi O‘zbekiston Respublikasining Amaldagi qonunchiligi (ZRU-547 "Shaxsga doir ma'lumotlar to'g'risida", ZRU-530-II "Aborotlashtirish to'g'risida") doirasida ishlaydi.\n\nSizning pulingiz va bank hisoblaringizga daxl qilinmaydi, faqatgina kelgan to'lov SMSlari avtomatlashtiriladi.`, menu)
      return NextResponse.json({ ok: true })
    }

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
      const tariff = (await getTariffById(tariffId)) || DEFAULT_TARIFFS[0]

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

      const cardFormatted = formatCard(tariff.cardNumber || '9860166655238557')

      await send(
        token,
        chatId,
        `💎 <b>PayGo Premium — To‘lov Buyurtmasi Yaratildi</b>\n\n` +
        `📦 <b>Tarif:</b> ${tariff.name}\n` +
        `💰 <b>To‘lov summasi:</b> <code>${Number(tariff.price).toLocaleString('uz-UZ')}</code> UZS\n` +
        `💳 <b>To‘lov kartasi:</b> <code>${cardFormatted}</code>\n` +
        `👤 <b>Karta egasi:</b> ${tariff.cardOwner || 'Sardor Tuyginov'}\n` +
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
      } else if (fieldName === 'features') {
        label = 'Tarif xususiyatlari (har bir qator yangi xususiyat)'
        example = '⚡️ 1 soniyada avto-to‘lov\n❤️ Donate sahifalari\n👥 VIP guruhlar (Pullik yozish)\n🏪 Cheksiz do‘konlar'
      } else if (fieldName === 'period') {
        label = 'Tarif amal qilish muddati (kun, hafta, oy)'
        example = 'oy'
      }

      await send(
        token,
        chatId,
        `✏️ <b>Tarifning ${label}ni kiriting:</b>\n\n` +
        `Misol:\n<code>${example}</code>\n\n` +
        `<i>Yangi qiymatni Telegram orqali yuboring:</i>`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_tf_toggle_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      const tariffId = data.replace('adm_tf_toggle_', '')
      const cur = await db.select().from(systemTariffs).where(eq(systemTariffs.id, tariffId)).limit(1)
      if (cur.length) {
        const nextActive = !cur[0].active
        await db.update(systemTariffs).set({ active: nextActive, updatedAt: new Date() }).where(eq(systemTariffs.id, tariffId))
        await send(token, chatId, `Tarif holati: ${nextActive ? '🟢 Faol' : '🔴 Nofaol'} qilindi.`)
        await renderAdminTariffDetail(token, chatId, tariffId)
      }
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_tf_del_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      const tariffId = data.replace('adm_tf_del_', '')
      await db.delete(systemTariffs).where(eq(systemTariffs.id, tariffId))
      await send(token, chatId, `🗑 Tarif o‘chirildi.`)
      await renderAdminTariffManagement(token, chatId)
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

    // -------------------------------------------------------------
    // OFFICIAL CHANNELS & MANDATORY SUBSCRIPTION CALLBACKS
    // -------------------------------------------------------------
    if (data === 'check_mandatory_sub') {
      const subCheck = await checkMandatorySubscription(token, userIdStr)
      if (subCheck.ok) {
        await answerCallback(token, cb.id, '✅ Barcha kanallarga obuna tasdiqlandi! Xush kelibsiz!', true)
        await send(token, chatId, '✅ <b>Obuna muvaffaqiyatli tasdiqlandi!</b>\n\nPayGo tizimidan foydalanishingiz mumkin:', menu)
      } else {
        await answerCallback(token, cb.id, '❌ Hali barcha kanallarga a’zo bo‘lmadingiz!', true)
        const buttons = subCheck.missingChannels.map((ch) => [
          { text: `📢 ${ch.name}`, url: ch.inviteUrl },
        ])
        buttons.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_mandatory_sub' }])
        await send(
          token,
          chatId,
          `⚠️ <b>Botdan to‘liq foydalanish uchun rasmiy kanallarimizga obuna bo‘ling:</b>\n\n` +
          subCheck.missingChannels.map((c, i) => `${i + 1}. <b>${c.name}</b>`).join('\n') +
          `\n\nObuna bo‘lgach, <b>"✅ Obunani tekshirish"</b> tugmasini bosing:`,
          { inline_keyboard: buttons }
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (data === 'admin_official_channels') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await renderAdminOfficialChannels(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data === 'adm_toggle_mand_sub') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      try {
        const cur = await db.select().from(systemSettings).where(eq(systemSettings.key, 'mandatory_sub_enabled')).limit(1)
        const newVal = cur[0]?.value === 'true' ? 'false' : 'true'
        await db.insert(systemSettings).values({ key: 'mandatory_sub_enabled', value: newVal }).onConflictDoUpdate({ target: systemSettings.key, set: { value: newVal, updatedAt: new Date() } })
        await answerCallback(token, cb.id, newVal === 'true' ? '🟢 Majburiy obuna YOQILDI' : '🔴 Majburiy obuna O‘CHIRILDI', true)
      } catch (err: any) {
        console.error('Toggle mandatory sub err:', err)
      }
      await renderAdminOfficialChannels(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data === 'adm_set_off_chan') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await stateSet(chatId, { step: 'admin_set_off_chan' })
      await send(token, chatId, '📢 <b>Rasmiy Telegram Kanalni Sozlash</b>\n\nKanal username yoki havolasini yuboring (masalan: <code>@Pay_Gouzbot</code> yoki <code>https://t.me/PayGoChannel</code>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data === 'adm_set_off_grp') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await stateSet(chatId, { step: 'admin_set_off_grp' })
      await send(token, chatId, '👥 <b>Rasmiy Telegram Guruhni Sozlash</b>\n\nGuruh username yoki havolasini yuboring (masalan: <code>@PayGoGroup</code> yoki <code>https://t.me/PayGoCommunity</code>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data === 'adm_add_mchan') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await stateSet(chatId, { step: 'admin_add_mchan_name' })
      await send(token, chatId, '➕ <b>Yangi Majburiy Kanal Qo‘shish (1/3)</b>\n\nKanal nomini kiriting (masalan: <i>PayGo Rasmiy Yangiliklar</i>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_tog_mchan_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      const mId = data.replace('adm_tog_mchan_', '')
      try {
        const row = await db.select().from(mandatoryChannels).where(eq(mandatoryChannels.id, mId)).limit(1)
        if (row.length) {
          const newStatus = !row[0].active
          await db.update(mandatoryChannels).set({ active: newStatus }).where(eq(mandatoryChannels.id, mId))
          await answerCallback(token, cb.id, newStatus ? '🟢 Faollashtirildi' : '⚪️ Faolsizlantirildi')
        }
      } catch (err: any) {
        console.error('adm_tog_mchan_ err:', err)
      }
      await renderAdminOfficialChannels(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('adm_del_mchan_')) {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      const mId = data.replace('adm_del_mchan_', '')
      try {
        await db.delete(mandatoryChannels).where(eq(mandatoryChannels.id, mId))
        await answerCallback(token, cb.id, '🗑 O‘chirildi')
      } catch (err: any) {
        console.error('adm_del_mchan_ err:', err)
      }
      await renderAdminOfficialChannels(token, chatId)
      return NextResponse.json({ ok: true })
    }

    if (data === 'admin_back_main') {
      const isAdmin = await isAdminTelegramId(userIdStr)
      if (!isAdmin) return NextResponse.json({ ok: true })
      await send(token, chatId, '🛠 <b>Admin Boshqaruv Paneli:</b>', adminMenu)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // MESSAGE HANDLER
  // -------------------------------------------------------------
  const message = update.message
  if (!message?.chat?.id) return NextResponse.json({ ok: true })

  // -------------------------------------------------------------
  // GROUP / SUPERGROUP HANDLER (VIP Paid Rooms & Write Permissions)
  // -------------------------------------------------------------
  if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
    const groupIdStr = String(message.chat.id)
    const senderIdStr = String(message.from?.id || '')
    const isBot = Boolean(message.from?.is_bot)

    // Check if group is linked to VIP Paid Rooms
    try {
      await ensureDbSchema()
      const roomRows = await db
        .select()
        .from(paidAccessRooms)
        .where(and(eq(paidAccessRooms.chatId, groupIdStr), eq(paidAccessRooms.active, true)))
        .limit(1)

      if (roomRows.length > 0 && !isBot && senderIdStr) {
        const room = roomRows[0]
        let isGroupAdmin = false
        try {
          const memberRes = await fetch(
            `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(groupIdStr)}&user_id=${senderIdStr}`
          )
          const memberData = await memberRes.json()
          if (memberData.ok && memberData.result) {
            const status = memberData.result.status
            if (status === 'creator' || status === 'administrator') {
              isGroupAdmin = true
            }
          }
        } catch {}

        const isSysAdmin = await isAdminTelegramId(senderIdStr)

        if (!isGroupAdmin && !isSysAdmin && room.mode === 'write_permission') {
          // Check if sender has active paid access
          const memRows = await db
            .select()
            .from(paidAccessMembers)
            .where(
              and(
                eq(paidAccessMembers.roomId, room.id),
                eq(paidAccessMembers.userId, senderIdStr),
                eq(paidAccessMembers.status, 'active')
              )
            )
            .limit(1)

          const hasActive =
            memRows.length > 0 &&
            memRows[0].expiresAt &&
            new Date(memRows[0].expiresAt) > new Date()

          if (!hasActive) {
            // 1. Delete the unauthorized message
            try {
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: message.chat.id,
                  message_id: message.message_id,
                }),
              })
            } catch {}

            // 2. Restrict user in group
            try {
              await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: message.chat.id,
                  user_id: Number(senderIdStr),
                  permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false,
                  },
                }),
              })
            } catch {}

            // 3. Send warning in group
            const botUser = await getBotUsername(token)
            const botLink = `https://t.me/${botUser}?start=pay_room_${room.id}`
            const warnText =
              `🚫 <b><a href="tg://user?id=${senderIdStr}">${message.from?.first_name || 'Foydalanuvchi'}</a></b>, ushbu guruhda yozish uchun ruxsat kerak!\n\n` +
              `• ⏱ 1 Soat: <b>${Number(room.hourlyPrice).toLocaleString('uz-UZ')} UZS</b>\n` +
              `• 📅 1 Kun: <b>${Number(room.dailyPrice).toLocaleString('uz-UZ')} UZS</b>\n` +
              `• ⭐️ 1 Oy: <b>${Number(room.monthlyPrice).toLocaleString('uz-UZ')} UZS</b>\n\n` +
              `Yozish huquqini sotib olish va darhol ochish uchun quyidagi tugmani bosing 👇`

            await send(token, message.chat.id, warnText, {
              inline_keyboard: [[{ text: '💎 Yozish huquqini sotib olish (Botda)', url: botLink }]],
            })

            return NextResponse.json({ ok: true })
          }
        }
      }
    } catch (gErr) {
      console.warn('Group check error:', gErr)
    }

    const rawGrp = (message.text ?? '').trim()
    if (rawGrp === '/link_vip' || rawGrp === '/setup_vip') {
      const senderIdStr = String(message.from?.id || '')
      const isSysAdmin = await isAdminTelegramId(senderIdStr)
      if (isSysAdmin) {
        const vipAuthUrl = await generateAuthUrl(senderIdStr, '/panel?tab=vip_rooms')
        await send(
          token,
          message.chat.id,
          `👑 <b>Guruhni VIP Tizimiga Ulash:</b>\n\n` +
          `• Guruh ID: <code>${message.chat.id}</code>\n` +
          `• Nomi: <b>${message.chat.title || 'Telegram Guruh'}</b>\n\n` +
          `Ushbu guruhni Veb panelida "VIP Guruh & Pullik Yozish" bo‘limida osongina sozlab, narxlarni belgilashingiz mumkin:`,
          { inline_keyboard: [[{ text: '🌐 Web Panelda sozlash', url: vipAuthUrl }]] }
        )
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  }

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
    text !== 'Tariflar boshqaruvi' &&
    !norm.includes('boshqaruv') &&
    !norm.includes('admin') &&
    raw !== '/ref' &&
    raw !== '/referral' &&
    raw !== '/admin_tariffs' &&
    raw !== '/adm_tariffs'

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

  const isVipRoomsCmd =
    norm.includes('vip guruh') ||
    norm.includes('pullik yozish') ||
    text === '💎 VIP Guruhlar' ||
    raw === '/viprooms' ||
    raw === '/vip'

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
  // MAINTENANCE MODE COMMANDS (Super Admin only)
  // -------------------------------------------------------------
  if (raw === '/make_me_admin') {
    await send(
      token,
      chatId,
      '⛔️ <b>Xavfsizlik qoidasi:</b> Foydalanuvchilar o‘zlarini admin qila olmaydi.\n\nFaqat Bosh Superadmin (8021115446) yangi admin tayinlay oladi.'
    )
    return NextResponse.json({ ok: true })
  }

  if (raw === '/maintenance_on') {
    const isSuper = isSuperAdminTelegramId(userIdStr)
    if (!isSuper) {
      await send(token, chatId, `⛔️ <b>Ruxsat yo‘q:</b> Texnik holatni faqat Bosh Superadmin (8021115446) yoqa oladi.`)
      return NextResponse.json({ ok: true })
    }

    try {
      await ensureDbSchema()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "key" text PRIMARY KEY,
          "value" text NOT NULL,
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        );
      `)
      await db.insert(systemSettings)
        .values({ key: 'maintenance_mode', value: 'true' })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: 'true', updatedAt: new Date() } })
      await send(token, chatId, '✅ <b>Texnik holat yoqildi.</b>\n\nEndi bot faqat adminlar uchun ishlaydi.\nFoydalanuvchilarga texnik ishlar xabari ko‘rsatiladi.')
    } catch (err: any) {
      console.error('Maintenance mode update error:', err)
      await send(token, chatId, `⚠️ <b>Xatolik yuz berdi:</b> ${err?.message || 'Noma\'lum xato'}`)
    }
    return NextResponse.json({ ok: true })
  }

  if (raw === '/maintenance_off') {
    const isSuper = isSuperAdminTelegramId(userIdStr)
    if (!isSuper) {
      await send(token, chatId, `⛔️ <b>Ruxsat yo‘q:</b> Texnik holatni faqat Bosh Superadmin (8021115446) o‘chira oladi.`)
      return NextResponse.json({ ok: true })
    }

    try {
      await ensureDbSchema()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "key" text PRIMARY KEY,
          "value" text NOT NULL,
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        );
      `)
      await db.insert(systemSettings)
        .values({ key: 'maintenance_mode', value: 'false' })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: 'false', updatedAt: new Date() } })

      await send(token, chatId, '❌ <b>Texnik holat o‘chirildi.</b>\n\nBot barcha foydalanuvchilar uchun ochildi.\n📢 <b>Barcha foydalanuvchilarga xabarnoma yuborilmoqda...</b>')

      // Broadcast maintenance finish message to all registered users!
      const maintenanceOffMsg = `🟢 <b>PayGo Botimiz Qayta Ishga Tushdi!</b>\n\n` +
        `Texnik profilaktika va sozlash ishlari muvaffaqiyatli yakunlandi.\n\n` +
        `⚡️ Endi barcha xizmatlar, Webhooklar va HUMO to‘lov xabarnomalaridan cheklovlarsiz va to‘liq tezlikda foydalanishingiz mumkin!\n\n` +
        `Tizimdan foydalanish uchun quyidagi menyudan foydalaning 👇`

      const broadcastRes = await broadcastToAllUsers(token, maintenanceOffMsg)

      await send(token, chatId, `📢 <b>Texnik holat tugagani haqidagi xabarnoma yuborildi!</b>\n\n` +
        `• Muvaffaqiyatli yetkazildi: <b>${broadcastRes.successCount}</b> ta\n` +
        `• Xatolik: <b>${broadcastRes.failCount}</b> ta\n` +
        `• Jami foydalanuvchilar: <b>${broadcastRes.total}</b> ta`)
    } catch (err: any) {
      console.error('Maintenance mode update error:', err)
      await send(token, chatId, `⚠️ <b>Xatolik yuz berdi:</b> ${err?.message || 'Noma\'lum xato'}`)
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // ADVERTISING & BROADCAST COMMANDS (Admin)
  // -------------------------------------------------------------
  if (raw === '/send_promo') {
    if (!isAdmin) {
      await send(token, chatId, `⚠️ <b>Ruxsat yo‘q:</b> Siz admin emassiz.`)
      return NextResponse.json({ ok: true })
    }
    await send(token, chatId, '⏳ <b>Navbatdagi reklama xabari barcha mijozlarga yuborilmoqda...</b>')
    
    const indexRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'autopromo_index')).limit(1)
    const currentIndex = indexRow.length > 0 ? Number(indexRow[0].value) || 0 : 0
    const promoText = PROMO_MESSAGES[currentIndex % PROMO_MESSAGES.length]
    const nextIndex = (currentIndex + 1) % PROMO_MESSAGES.length

    await db.insert(systemSettings).values({ key: 'autopromo_last_sent', value: String(Date.now()) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: String(Date.now()), updatedAt: new Date() } })
    await db.insert(systemSettings).values({ key: 'autopromo_index', value: String(nextIndex) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: String(nextIndex), updatedAt: new Date() } })

    const res = await broadcastToAllUsers(token, promoText)
    await send(token, chatId, `✅ <b>Reklama muvaffaqiyatli yuborildi!</b>\n\n` +
      `• Reklama №: <b>${(currentIndex % PROMO_MESSAGES.length) + 1}/${PROMO_MESSAGES.length}</b>\n` +
      `• Muvaffaqiyatli: <b>${res.successCount}</b> ta\n` +
      `• Xatolik: <b>${res.failCount}</b> ta\n` +
      `• Jami: <b>${res.total}</b> ta`)
    return NextResponse.json({ ok: true })
  }

  if (raw === '/autopromo_on') {
    if (!isAdmin) return NextResponse.json({ ok: true })
    await db.insert(systemSettings).values({ key: 'autopromo_status', value: 'enabled' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'enabled', updatedAt: new Date() } })
    await send(token, chatId, '✅ <b>Har 1 soatlik avto-reklama yoqildi!</b>\n\nEndi bot har 1 soatda avtomatik ravishda turli xil reklama va foydali xabarlarni barcha mijozlarga yuborib turadi.')
    return NextResponse.json({ ok: true })
  }

  if (raw === '/autopromo_off') {
    if (!isAdmin) return NextResponse.json({ ok: true })
    await db.insert(systemSettings).values({ key: 'autopromo_status', value: 'disabled' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'disabled', updatedAt: new Date() } })
    await send(token, chatId, '❌ <b>Avto-reklama o‘chirildi!</b>\n\nSoatlik reklama xabarlari to‘xtatildi.')
    return NextResponse.json({ ok: true })
  }

  if (raw.startsWith('/broadcast')) {
    if (!isAdmin) return NextResponse.json({ ok: true })
    const textToBroadcast = raw.replace('/broadcast', '').trim()
    if (!textToBroadcast) {
      await send(token, chatId, '✍️ <b>Barcha mijozlarga xabar yuborish:</b>\n\nFoydalanish: <code>/broadcast Sizning xabar matningiz</code>\n\nYoki shunchaki rasmiy e’lonlar yuborish uchun ishlatiladi.')
      return NextResponse.json({ ok: true })
    }
    await send(token, chatId, '⏳ <b>Xabaringiz barcha mijozlarga yuborilmoqda...</b>')
    const res = await broadcastToAllUsers(token, textToBroadcast)
    await send(token, chatId, `✅ <b>Xabar yuborildi!</b>\n\n• Yetkazildi: <b>${res.successCount}</b> ta\n• Yetib bormadi: <b>${res.failCount}</b> ta`)
    return NextResponse.json({ ok: true })
  }

  if (text === '📢 Reklama & Broadcast') {
    if (!isAdmin) return NextResponse.json({ ok: true })
    const statusRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'autopromo_status')).limit(1)
    const isAutoOn = statusRow.length === 0 || statusRow[0].value !== 'disabled'

    await send(
      token,
      chatId,
      `📢 <b>Reklama va Avto-Broadcast Boshqaruvi</b>\n\n` +
      `⏱ <b>Soatlik Avto-reklama holati:</b> ${isAutoOn ? '🟢 Yoqilgan (Har 1 soatda)' : '🔴 O‘chirilgan'}\n\n` +
      `🛠 <b>Mavjud buyruqlar:</b>\n` +
      `• <code>/send_promo</code> — Hozirroq navbatdagi reklamani barcha mijozlarga yuborish\n` +
      `• <code>/autopromo_on</code> — Soatlik avto-reklamani yoqish\n` +
      `• <code>/autopromo_off</code> — Soatlik avto-reklamani o‘chirish\n` +
      `• <code>/broadcast xabar_matni</code> — Istalgan shaxsiy e’loningizni tarqatish`,
      adminMenu
    )
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // FUNDRAISER / CROWDFUNDING WIZARD STEPS
  // -------------------------------------------------------------
  if (flow?.step === 'awaiting_fund_title') {
    const titleText = raw.trim()
    if (!titleText) {
      await send(token, chatId, '⚠️ Iltimos, loyiha sarlavhasini matn ko‘rinishida kiriting:', back)
      return NextResponse.json({ ok: true })
    }
    await stateSet(chatId, {
      step: 'awaiting_fund_desc',
      targetShopId: flow.targetShopId,
      fundTitle: titleText,
    })
    await send(
      token,
      chatId,
      `📝 <b>Loyiha haqida tavsif kiriting:</b>\n\n` +
      `Mijozlar to‘lov qilishi uchun loyiha maqsadi yoki foydali jihatlarini yozing (yoki o‘tkazib yuborish uchun '.' deb yozing):`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'awaiting_fund_desc') {
    const descText = raw.trim() === '.' ? '' : raw.trim()
    await stateSet(chatId, {
      step: 'awaiting_fund_goal',
      targetShopId: flow.targetShopId,
      fundTitle: flow.fundTitle,
      fundDesc: descText,
    })
    await send(
      token,
      chatId,
      `🎯 <b>Maqsad qilingan to‘lov summasini kiriting (UZSda):</b>\n\n` +
      `Masalan: <code>5000000</code> (5 million UZS)\n` +
      `Agar maqsad cheksiz / ochiq bo‘lsa, <code>0</code> deb yozing:`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'awaiting_fund_goal') {
    const goalNum = parseInt(raw.trim(), 10) || 0
    const fundId = `fund_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    try {
      await ensureDbSchema()
      await db.insert(fundraisers).values({
        id: fundId,
        shopId: flow.targetShopId,
        userId: userIdStr,
        title: flow.fundTitle,
        description: flow.fundDesc || null,
        goalAmount: goalNum,
        collectedAmount: 0,
        donorCount: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await stateDelete(chatId)

      const fundUrl = `${APP_URL}/fund/${fundId}`

      await send(
        token,
        chatId,
        `🎉 <b>Qo‘llab-quvvatlash / Jamg‘arma Sahifasi Muvaffaqiyatli Yaratildi!</b>\n\n` +
        `📌 <b>Loyiha:</b> ${flow.fundTitle}\n` +
        `🎯 <b>Maqsad:</b> ${goalNum > 0 ? `${goalNum.toLocaleString('uz-UZ')} UZS` : 'Ochiq ehson'}\n\n` +
        `🔗 <b>Sizning shaxsiy to‘lov havolangiz:</b>\n<code>${fundUrl}</code>\n\n` +
        `💡 Ushbu havolani kanalingizga, ijtimoiy tarmoqlarga yoki hamkorlaringizga yuboring. Odamlar kirib ism-sharifini yozadi va kartangizga pul o‘tkazadi. Userbot har bir to‘lovni lahzada aniqlaydi!`,
        {
          inline_keyboard: [
            [{ text: '🌐 Veb-sahifani ochish', url: fundUrl }],
            [{ text: '❤️ Mening jamg‘armalarim', callback_data: 'menu_fundraiser' }],
          ]
        }
      )
    } catch (err: any) {
      await send(token, chatId, `⚠️ Jamg‘arma yaratishda xatolik: ${err?.message}`, menu)
    }
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // SERVICE SHUTDOWN & MAINTENANCE MANAGEMENT (Super Admin Only)
  // -------------------------------------------------------------
  const isSuperForShutdown = isSuperAdminTelegramId(userIdStr)

  if (flow?.step === 'awaiting_shutdown_reason') {
    if (!isSuperForShutdown) return NextResponse.json({ ok: true })
    const reasonText = raw.trim()
    if (!reasonText) {
      await send(token, chatId, '⚠️ Iltimos, faoliyat to‘xtatilishining sababini matn ko‘rinishida kiriting:', back)
      return NextResponse.json({ ok: true })
    }

    try {
      await ensureDbSchema()
      await db.insert(systemSettings).values({ key: 'service_shutdown_mode', value: 'true' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'true', updatedAt: new Date() } })
      await db.insert(systemSettings).values({ key: 'service_shutdown_reason', value: reasonText }).onConflictDoUpdate({ target: systemSettings.key, set: { value: reasonText, updatedAt: new Date() } })
      await stateDelete(chatId)

      await send(token, chatId, `🛑 <b>Faoliyatni to‘xtatish rejimi yoqildi!</b>\n\n<b>Sababi:</b> ${reasonText}\n\n📢 <b>Barcha mijozlarga rasmiy e’lon va uzr so‘rash xabari yuborilmoqda...</b>`, adminMenu)

      const shutdownBroadcastMsg = `🚫 <b>Hurmatli PayGo foydalanuvchilari!</b>\n\n` +
        `Loyiha ma’muriyati shuni ma’lum qiladiki, xizmatimiz o‘z faoliyatini vaqtincha to‘xtatdi.\n\n` +
        `<b>Sababi:</b>\n${reasonText}\n\n` +
        `Keltirilgan noqulayliklar uchun barcha mijozlarimizdan samimiy uzr so‘raymiz! Faoliyatimiz qayta tiklanishi bilanoq sizga xabar beramiz. 🙏`

      const broadcastRes = await broadcastToAllUsers(token, shutdownBroadcastMsg)

      await send(token, chatId, `📢 <b>Faoliyat to‘xtatilgani haqidagi e’lon barcha mijozlarga yetkazildi!</b>\n\n` +
        `• Muvaffaqiyatli yetkazildi: <b>${broadcastRes.successCount}</b> ta\n` +
        `• Xatolik: <b>${broadcastRes.failCount}</b> ta\n` +
        `• Jami mijozlar: <b>${broadcastRes.total}</b> ta`, adminMenu)
    } catch (err: any) {
      await send(token, chatId, `⚠️ Xatolik: ${err?.message}`, adminMenu)
    }
    return NextResponse.json({ ok: true })
  }

  if (raw === '/shutdown_on' || text === '🛑 Faoliyatni to‘xtatish') {
    if (!isSuperForShutdown) {
      await send(token, chatId, '⛔️ <b>Ruxsat yo‘q:</b> Faoliyatni to‘xtatish faqat Bosh Superadmin (8021115446) tomonidan amalga oshiriladi.')
      return NextResponse.json({ ok: true })
    }
    await stateSet(chatId, { step: 'awaiting_shutdown_reason' })
    await send(
      token,
      chatId,
      `🛑 <b>Loyiha Faoliyatini To‘xtatish Rejimi</b>\n\n` +
      `Ushbu rejim yoqilganda bot oddiy foydalanuvchilar uchun yopiladi va barcha mijozlarga uzr so‘rash matni bilan e’lon yuboriladi.\n\n` +
      `Iltimos, faoliyat to‘xtatilish sababini kiriting (masalan: <i>Profilaktika va server infratuzilmasini yangilash munosabati bilan...</i>):`,
      back
    )
    return NextResponse.json({ ok: true })
  }

  if (raw === '/shutdown_off' || text === '🟢 Faoliyatni qayta tiklash') {
    if (!isSuperForShutdown) {
      await send(token, chatId, '⛔️ <b>Ruxsat yo‘q:</b> Faoliyatni qayta tiklash faqat Bosh Superadmin (8021115446) tomonidan amalga oshiriladi.')
      return NextResponse.json({ ok: true })
    }
    try {
      await ensureDbSchema()
      await db.insert(systemSettings).values({ key: 'service_shutdown_mode', value: 'false' }).onConflictDoUpdate({ target: systemSettings.key, set: { value: 'false', updatedAt: new Date() } })
      await stateDelete(chatId)

      await send(token, chatId, `🟢 <b>Loyiha faoliyati qayta tiklandi!</b>\n\n📢 Barcha mijozlarga faoliyat tiklangani haqida xabar yuborilmoqda...`, adminMenu)

      const resumeBroadcastMsg = `🟢 <b>Xushxabar! PayGo loyihasi o‘z faoliyatini to‘liq qayta tikladi!</b>\n\n` +
        `Barcha xizmatlar, Webhooklar va to‘lov bildirishnomalari uzluksiz va to‘liq shtat rejimida ishlamoqda.\n\n` +
        `Biz bilan birga ekanligingiz uchun tashakkur! Tizimdan foydalanish uchun menyuni bosing. 👇`

      const broadcastRes = await broadcastToAllUsers(token, resumeBroadcastMsg)

      await send(token, chatId, `📢 <b>Faoliyat tiklangani haqidagi xabar barcha mijozlarga yuborildi!</b>\n\n` +
        `• Muvaffaqiyatli yetkazildi: <b>${broadcastRes.successCount}</b> ta\n` +
        `• Xatolik: <b>${broadcastRes.failCount}</b> ta\n` +
        `• Jami mijozlar: <b>${broadcastRes.total}</b> ta`, adminMenu)
    } catch (err: any) {
      await send(token, chatId, `⚠️ Xatolik: ${err?.message}`, adminMenu)
    }
    return NextResponse.json({ ok: true })
  }

  if (raw === '/shutdown_status' || text === '🛑 Faoliyat boshqaruvi') {
    if (!isSuperForShutdown) {
      await send(token, chatId, '⛔️ <b>Ruxsat yo‘q:</b> Faoliyat boshqaruvi faqat Bosh Superadmin (8021115446) uchun ochiq.')
      return NextResponse.json({ ok: true })
    }
    const shutdownData = await getServiceShutdownData()
    const maintenanceActive = await isMaintenanceMode()

    const shutdownStatusText = `🛠 <b>Loyiha va Texnik Rejim Boshqaruvi</b>\n\n` +
      `1️⃣ <b>Faoliyat holati (Service Shutdown):</b> ${shutdownData.active ? '🔴 TO‘XTATILGAN' : '🟢 FAOL'}\n` +
      `${shutdownData.active ? `<b>Sababi:</b> ${shutdownData.reason}\n` : ''}\n` +
      `2️⃣ <b>Texnik rejim (Maintenance Mode):</b> ${maintenanceActive ? '🔴 YOQILGAN' : '🟢 O‘CHIRILGAN'}\n\n` +
      `<b>Buyruqlar va boshqaruv:</b>\n` +
      `• <code>/shutdown_on</code> — Faoliyatni to‘xtatish (sabab so‘raydi va hammaga uzrli e’lon yuboradi)\n` +
      `• <code>/shutdown_off</code> — Faoliyatni qayta tiklash (hammaga qayta ishga tushganini xabar qiladi)\n` +
      `• <code>/maintenance_on</code> — Texnik rejimni yoqish\n` +
      `• <code>/maintenance_off</code> — Texnik rejimni o‘chirish (hammaga xabar yuboradi)`

    await send(token, chatId, shutdownStatusText, {
      inline_keyboard: [
        [
          shutdownData.active
            ? { text: '🟢 Faoliyatni qayta tiklash', callback_data: 'admin_shutdown_off' }
            : { text: '🛑 Faoliyatni to‘xtatish', callback_data: 'admin_shutdown_on' }
        ],
        [
          maintenanceActive
            ? { text: '❌ Texnik rejimni o‘chirish', callback_data: 'admin_maint_off' }
            : { text: '🚧 Texnik rejimni yoqish', callback_data: 'admin_maint_on' }
        ]
      ]
    })
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // BOT HAQIDA & FAQ & QO‘LLAB-QUVVATLASH COMMANDS / BUTTONS
  // -------------------------------------------------------------
  if (
    raw === '🤖 Bot haqida & FAQ' ||
    text === 'Bot haqida & FAQ' ||
    text === '🤖 Bot haqida & FAQ' ||
    norm.includes('bot haqida') ||
    norm.includes('faq') ||
    raw === '/about' ||
    raw === '/faq'
  ) {
    const faqText = `🤖 <b>PayGo Bot Haqida va FAQ (Ko‘p beriladigan savollar)</b>\n\n` +
      `⚡️ <b>PayGo nima?</b>\n` +
      `PayGo — HUMO bank kartalariga kelib tushadigan to‘lov xabarnomalarini 1 soniya ichida avtomatik ravishda Webhook va Telegram kanallarga yetkazib beruvchi zamonaviy SaaS platformasi.\n\n` +
      `🔄 <b>Tizim qanday ishlaydi?</b>\n` +
      `1️⃣ <b>Do‘kon ochasiz:</b> Karta raqamingiz va Webhook URL manzilingizni kiritasiz.\n` +
      `2️⃣ <b>Userbot ulaysiz:</b> Telegram raqamingiz orqali 1 marta SMS kod bilan ulaysiz.\n` +
      `3️⃣ <b>Avto-xabarnoma:</b> Kartangizga o‘tkazma tushishi bilan SMS/Push ma’lumoti Webhook va Kanalingizga 1 soniyada yetib boradi!\n\n` +
      `❓ <b>Tez-tez beriladigan savollar:</b>\n\n` +
      `• <b>PayGo xavfsizmi? Pulimga tegadimi?</b>\n` +
      `Yo‘q! PayGo platformasi bank hisobingizga yoki pulingizga daxl qilmaydi. Userbot faqat kelgan SMS va Push xabarnomalarni o‘qiydi.\n\n` +
      `• <b>Qonuniy asos bormi?</b>\n` +
      `Ha! O‘zR ZRU-547, ZRU-530-II va ZRU-792 qonunlariga to‘liq mos keladi.\n\n` +
      `• <b>To‘lovlar uchun komissiya bormi?</b>\n` +
      `0% komissiya! Barcha to‘lovlar to‘g‘ridan-to‘g‘ri kartangizga o‘tadi.\n\n` +
      `• <b>Qo‘llab-quvvatlash va Jamg‘arma (Ehson) sahifalari nima?</b>\n` +
      `Siz o‘z startapingiz, biznesingiz yoki ehson jamg‘armangiz uchun chiroyli veb-sahifa va QR-kod yaratib, barchadan to‘lov va ehson yig‘ishingiz mumkin!`

    await send(token, chatId, faqText, {
      inline_keyboard: [
        [{ text: '🛍 Do‘kon ochish', callback_data: 'start_create_shop' }, { text: '🤝 Tekin Premium olish', callback_data: 'view_referral' }],
        [{ text: '❤️ Qo‘llab-quvvatlash sahifasi', callback_data: 'menu_fundraiser' }, { text: '⚖️ Qonuniylik', callback_data: 'view_legal' }],
      ]
    })
    return NextResponse.json({ ok: true })
  }

  if (
    raw === '❤️ Qo‘llab-quvvatlash (Ehson)' ||
    raw === '❤️ Qo‘llab-quvvatlash' ||
    text === 'Qo‘llab-quvvatlash (Ehson)' ||
    text === 'Qo‘llab-quvvatlash' ||
    text === '❤️ Qo‘llab-quvvatlash (Ehson)' ||
    norm.includes('qollab quvvatlash') ||
    norm.includes('qollab') ||
    norm.includes('ehson') ||
    raw === '/fundraisers' ||
    raw === '/create_fund' ||
    raw === '/fund'
  ) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr))
    if (userShops.length === 0) {
      await send(
        token,
        chatId,
        `⚠️ <b>Qo‘llab-quvvatlash (Crowdfunding) sahifasi yaratish uchun avval do‘koningiz bo‘lishi kerak!</b>\n\n` +
        `Do‘kon kartangiz va Userbot to‘lovlarni nazorat qiladi. Avval "🛍 Do‘kon ochish" bo‘limidan do‘kon yarating.`,
        menu
      )
      return NextResponse.json({ ok: true })
    }

    const myFunds = await db.select().from(fundraisers).where(eq(fundraisers.userId, userIdStr)).orderBy(desc(fundraisers.createdAt))

    let fundTxt = `❤️ <b>Sizning Qo‘llab-quvvatlash va Jamg‘arma Sahifalaringiz</b>\n\n` +
      `Loyiha yoki startapingiz uchun barchadan ochiq to‘lov va ehson yig‘ish uchun unikal havola va QR code yarating.\n\n`

    if (myFunds.length === 0) {
      fundTxt += `<i>Hali hech qanday jamg‘arma sahifasi yaratmadingiz.</i>`
    } else {
      fundTxt += `📌 <b>Joriy loyihalaringiz:</b>\n`
      for (const f of myFunds) {
        const pUrl = `${APP_URL}/fund/${f.id}`
        fundTxt += `\n• <b>${f.title}</b>\n` +
          `  Yig‘ildi: <b>${(f.collectedAmount || 0).toLocaleString('uz-UZ')} UZS</b> (${f.donorCount || 0} ta ehson)\n` +
          `  🔗 Havola: <code>${pUrl}</code>\n`
      }
    }

    const inlineButtons: any[] = myFunds.map((f) => [
      { text: `🔗 ${f.title.slice(0, 20)}... (Havola)`, url: `${APP_URL}/fund/${f.id}` }
    ])

    inlineButtons.push([{ text: '➕ Yangi Jamg‘arma / Loyiha yaratish', callback_data: 'create_new_fundraiser' }])

    await send(token, chatId, fundTxt, { inline_keyboard: inlineButtons })
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // WEBHOOK TESTER & LEADERBOARD & MY STATS
  // -------------------------------------------------------------
  if (raw === '/test_webhook' || raw === '/test_wh' || raw === '🧪 Webhook Test' || text === 'Webhook Test' || text === '🧪 Webhook Test' || norm.includes('webhook test')) {
    const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr))
    if (userShops.length === 0) {
      await send(token, chatId, '⚠️ Sizda hali do‘kon yo‘q. Webhook test qilish uchun avval "🛍 Do‘kon ochish" bo‘limidan do‘kon yarating.')
      return NextResponse.json({ ok: true })
    }
    const myShop = userShops[0]
    if (!myShop.webhookUrl) {
      await send(token, chatId, `⚠️ <b>${myShop.name}</b> do‘koningizda Webhook URL o‘rnatilmagan.\n\nAvval "🏪 Mening do‘konim" bo‘limida Webhook URL manzilini kiriting.`)
      return NextResponse.json({ ok: true })
    }

    await send(token, chatId, `🧪 <b>Webhook Sinov Simulyatsiyasi:</b>\n\n📍 URL: <code>${myShop.webhookUrl}</code>\n\nTest to‘lov payload yuborilmoqda...`)

    const testPayload = {
      event: 'payment.success',
      paymentId: `test_${randomUUID().slice(0, 8)}`,
      amount: 100000,
      currency: 'UZS',
      shopId: myShop.id,
      shopName: myShop.name,
      cardLast4: myShop.cardLast4 || '3587',
      timestamp: new Date().toISOString(),
      isTest: true
    }

    try {
      const whResult = await deliverWebhook(myShop.webhookUrl, testPayload, myShop.id)
      if (whResult.success) {
        await send(token, chatId, `✅ <b>Webhook Test Muvaffaqiyatli!</b>\n\n` +
          `• HTTP Status: <code>${whResult.statusCode} OK</code>\n` +
          `• Serveringiz to‘lov xabarnomasini qabul qildi va to‘g‘ri javob qaytardi. 🚀`)
      } else {
        await send(token, chatId, `❌ <b>Webhook Testda Xatolik:</b>\n\n` +
          `• HTTP Status: <code>${whResult.statusCode || 'Ulanib bo‘lmadi'}</code>\n` +
          `• Xato: <code>${whResult.error || 'Server javob bermadi'}</code>\n\n` +
          `Iltimos, serveringizda ushbu URL ochiq va tayyor ekanligini tekshiring: <code>${myShop.webhookUrl}</code>`)
      }
    } catch (err: any) {
      await send(token, chatId, `⚠️ <b>Xatolik:</b> ${err?.message || 'Serverga bog‘lanib bo‘lmadi'}`)
    }
    return NextResponse.json({ ok: true })
  }

  if (raw === '/leaderboard' || raw === '🏆 Liderlar' || text === 'Liderlar' || text === '🏆 Liderlar' || norm.includes('liderlar')) {
    const topUsers = await db.select()
      .from(userProfiles)
      .orderBy(desc(userProfiles.referralCount))
      .limit(10)

    let leaderboardTxt = `🏆 <b>Eng Faol Taklif Qiluvchilar (Liderlar Jadvali):</b>\n\n`
    if (topUsers.length === 0) {
      leaderboardTxt += `Hozircha faol taklif qiluvchilar yo‘q. Birinchi bo‘ling!`
    } else {
      topUsers.forEach((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤'
        const maskedId = u.telegramId ? `${u.telegramId.slice(0, 4)}***${u.telegramId.slice(-2)}` : 'Foydalanuvchi'
        leaderboardTxt += `${medal} <b>${i + 1}-o‘rin:</b> ${maskedId} — <b>${u.referralCount} ta</b> taklif (${u.rewardedDays} kun Premium)\n`
      })
    }
    leaderboardTxt += `\n🎁 Siz ham do‘stlaringizni taklif qilib bepul Premium va sovg‘alar yutib oling!\nTaklif havolangizni olish uchun <b>"🤝 Referal (Tekin Premium)"</b> tugmasini bosing.`

    await send(token, chatId, leaderboardTxt)
    return NextResponse.json({ ok: true })
  }

  // -------------------------------------------------------------
  // /start command (with terms check and deep auth link)
  // -------------------------------------------------------------
  if (/^\/start/.test(raw)) {
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

    // Check if this is a VIP room pay deep link: /start pay_room_xyz
    if (startPayload.startsWith('pay_room_')) {
      const roomId = startPayload.replace('pay_room_', '').trim()
      await renderRoomTariffs(token, chatId, roomId)
      return NextResponse.json({ ok: true })
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
      const isSubAdmin = await isAdminTelegramId(userIdStr)
      if (!isSubAdmin) {
        const subCheck = await checkMandatorySubscription(token, userIdStr)
        if (!subCheck.ok && subCheck.missingChannels.length > 0) {
          const buttons = subCheck.missingChannels.map((ch) => [
            { text: `📢 ${ch.name}`, url: ch.inviteUrl },
          ])
          buttons.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_mandatory_sub' }])
          await send(
            token,
            chatId,
            `👋 <b>Xush kelibsiz, ${message.from?.first_name ?? 'foydalanuvchi'}!</b>\n\n` +
            `⚠️ <b>Botdan to‘liq foydalanish uchun rasmiy kanallarimizga obuna bo‘ling:</b>\n\n` +
            subCheck.missingChannels.map((c, i) => `${i + 1}. <b>${c.name}</b>`).join('\n') +
            `\n\nObuna bo‘lgach, quyidagi tugmani bosing:`,
            { inline_keyboard: buttons }
          )
          return NextResponse.json({ ok: true })
        }
      }

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
  // MANDATORY SUBSCRIPTION GLOBAL GUARD FOR REGULAR COMMANDS
  // -------------------------------------------------------------
  const isGlobalAdmin = await isAdminTelegramId(userIdStr)
  if (!isGlobalAdmin && !flow) {
    const subCheck = await checkMandatorySubscription(token, userIdStr)
    if (!subCheck.ok && subCheck.missingChannels.length > 0) {
      const buttons = subCheck.missingChannels.map((ch) => [
        { text: `📢 ${ch.name}`, url: ch.inviteUrl },
      ])
      buttons.push([{ text: '✅ Obunani tekshirish', callback_data: 'check_mandatory_sub' }])
      await send(
        token,
        chatId,
        `⚠️ <b>Hurmatli foydalanuvchi!</b>\n\n` +
        `Bot xizmatlaridan foydalanish uchun quyidagi rasmiy kanallarimizga a’zo bo‘lishingiz lozim:\n\n` +
        subCheck.missingChannels.map((c, i) => `${i + 1}. <b>${c.name}</b>`).join('\n') +
        `\n\nObuna bo‘lgach, <b>"✅ Obunani tekshirish"</b> tugmasini bosing:`,
        { inline_keyboard: buttons }
      )
      return NextResponse.json({ ok: true })
    }
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
  // VIP GURUHLAR & PULLIK YOZISH
  // -------------------------------------------------------------
  if (isVipRoomsCmd) {
    await stateDelete(chatId)
    await renderVipRooms(token, chatId)
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

    const txLimit = await checkTransactionLimits(userIdStr, true)
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
    } else if (field === 'features') {
      updateData.features = val
    } else if (field === 'period') {
      updateData.period = val
    }

    try {
      const existing = await db.select().from(systemTariffs).where(eq(systemTariffs.id, tariffId)).limit(1)
      if (existing.length > 0) {
        await db.update(systemTariffs).set(updateData).where(eq(systemTariffs.id, tariffId))
      } else {
        await db.insert(systemTariffs).values({
          id: tariffId,
          name: tariffId.includes('daily') ? 'Kunlik' : tariffId.includes('weekly') ? 'Haftalik' : 'Oylik VIP',
          price: tariffId.includes('daily') ? 1000 : tariffId.includes('weekly') ? 6500 : 27858,
          period: tariffId.includes('daily') ? 'kun' : tariffId.includes('weekly') ? 'hafta' : 'oy',
          cardNumber: '9860166655238557',
          cardOwner: 'Sardor Tuyginov',
          cardBank: 'HUMOCARD',
          active: true,
          ...updateData,
        })
      }
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
  // ADMIN OFFICIAL CHANNELS & MANDATORY SUBSCRIPTION STEPS
  // -------------------------------------------------------------
  if (flow?.step === 'admin_set_off_chan') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }
    let val = raw.trim()
    if (message.forward_from_chat) {
      const fChat = message.forward_from_chat
      val = fChat.username ? `@${fChat.username}` : String(fChat.id)
    }
    try {
      await db.insert(systemSettings).values({ key: 'official_channel', value: val }).onConflictDoUpdate({ target: systemSettings.key, set: { value: val, updatedAt: new Date() } })
    } catch (err) {
      console.error('Save official_channel err:', err)
    }
    await stateDelete(chatId)
    await send(token, chatId, `✅ <b>Rasmiy kanal saqlandi:</b> <code>${val}</code>`, adminMenu)
    await renderAdminOfficialChannels(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'admin_set_off_grp') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }
    let val = raw.trim()
    if (message.forward_from_chat) {
      const fChat = message.forward_from_chat
      val = fChat.username ? `@${fChat.username}` : String(fChat.id)
    }
    try {
      await db.insert(systemSettings).values({ key: 'official_group', value: val }).onConflictDoUpdate({ target: systemSettings.key, set: { value: val, updatedAt: new Date() } })
    } catch (err) {
      console.error('Save official_group err:', err)
    }
    await stateDelete(chatId)
    await send(token, chatId, `✅ <b>Rasmiy guruh saqlandi:</b> <code>${val}</code>`, adminMenu)
    await renderAdminOfficialChannels(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'admin_add_mchan_name') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }
    let name = raw.trim()
    let autoId = ''
    let autoUrl = ''
    if (message.forward_from_chat) {
      const fChat = message.forward_from_chat
      name = fChat.title || fChat.username || 'Kanal'
      autoId = fChat.username ? `@${fChat.username}` : String(fChat.id)
      if (fChat.username) autoUrl = `https://t.me/${fChat.username}`
    }

    if (!name) {
      await send(token, chatId, '❗ Iltimos, kanal nomini kiriting yoki kanaldan biror xabarni botga forward qiling:', back)
      return NextResponse.json({ ok: true })
    }

    if (autoId) {
      await stateSet(chatId, { step: 'admin_add_mchan_url', mchanName: name, mchanId: autoId })
      await send(
        token,
        chatId,
        `✅ <b>Kanal aniqlandi:</b> ${name} (<code>${autoId}</code>)\n\n` +
        `Endi foydalanuvchilar obuna bo‘lishi uchun taklif havolasini (URL) yuboring` +
        (autoUrl ? ` (yoki <code>${autoUrl}</code> bo‘lsa shuni yuboring):` : ':'),
        back
      )
      return NextResponse.json({ ok: true })
    }

    await stateSet(chatId, { step: 'admin_add_mchan_id', mchanName: name })
    await send(token, chatId, `📢 <b>Kanal ID yoki Username (2/3)</b>\n\nKanal username (<code>@kanal</code>) yoki ID raqamini (<code>-100...</code>) yuboring:`, back)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'admin_add_mchan_id') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }
    let chId = raw.trim()
    if (!chId.startsWith('@') && !chId.startsWith('-100') && !/^\d+$/.test(chId)) {
      chId = `@${chId}`
    }
    await stateSet(chatId, { step: 'admin_add_mchan_url', mchanName: flow.mchanName, mchanId: chId })
    await send(token, chatId, `🔗 <b>Taklif havolasi (3/3)</b>\n\nFoydalanuvchilar obuna bo‘lishi uchun havola (URL) yuboring (masalan: <code>https://t.me/kanal_nomi</code>):`, back)
    return NextResponse.json({ ok: true })
  }

  if (flow?.step === 'admin_add_mchan_url') {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) {
      await stateDelete(chatId)
      return NextResponse.json({ ok: true })
    }
    let inviteUrl = raw.trim()
    if (!inviteUrl.startsWith('http://') && !inviteUrl.startsWith('https://')) {
      inviteUrl = `https://${inviteUrl}`
    }
    const mId = `mchan_${randomUUID().replace(/-/g, '').slice(0, 10)}`
    try {
      await db.insert(mandatoryChannels).values({
        id: mId,
        name: flow.mchanName || 'Kanal',
        channelId: flow.mchanId || '@channel',
        inviteUrl,
        type: 'channel',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (dbErr) {
      console.error('Insert mandatory channel err:', dbErr)
    }

    await stateDelete(chatId)
    await send(token, chatId, `🎉 <b>Yangi majburiy kanal muvaffaqiyatli qo‘shildi!</b>\n\n📌 <b>Nomi:</b> ${flow.mchanName}\n🆔 <b>ID:</b> <code>${flow.mchanId}</code>\n🔗 <b>Havola:</b> <a href="${inviteUrl}">${inviteUrl}</a>`, adminMenu)
    await renderAdminOfficialChannels(token, chatId)
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
    const tariffList = await getSystemTariffs()

    const tTxt = tariffList
      .map((t) => {
        const featText = formatTariffFeatures(t.features)
        return (
          `💎 <b>${t.name}</b> — <b>${Number(t.price).toLocaleString('uz-UZ')} UZS</b> / ${t.period}\n` +
          `📝 ${t.description || 'Cheksiz to‘lov qabul qilish va monitoring'}\n` +
          `💳 <b>To‘lov kartasi:</b> <code>${formatCard(t.cardNumber || '9860166655238557')}</code>\n` +
          `👤 <b>Egasi:</b> ${t.cardOwner || 'Sardor Tuyginov'} (${t.cardBank || 'HUMOCARD'})\n` +
          (featText ? `✨ <b>Imkoniyatlari:</b>\n${featText}` : '')
        )
      })
      .join('\n\n─────────────\n\n')

    const inlineButtons = tariffList.map((t) => [
      { text: `💳 ${t.name} (${Number(t.price).toLocaleString('uz-UZ')} UZS) — To‘lov yaratish`, callback_data: `buy_tariff_${t.id}` },
    ])

    try {
      const userTariffUrl = await generateAuthUrl(chatId, '/tariffs')
      inlineButtons.push([{ text: '🌐 Saytda 💎 Tariflar & Premium Ko‘rish', url: userTariffUrl }])
    } catch {}

    await send(
      token,
      chatId,
      `💎 <b>PayGo Maxsus Premium Tariflari:</b>\n\n${tTxt}\n\n` +
      `ℹ️ <i>Tarifga to‘lov qilish uchun quyidagi tugmalardan birini bosing va 5 daqiqalik to‘lov buyurtmasini yarating. Userbot orqali to‘lovingiz avtomatik tasdiqlanadi yoki qo‘lda tekshirishingiz mumkin:</i>\n\n` +
      `🌐 Sayt orqali to‘lov: <a href="${APP_URL}/tariffs">${APP_URL}/tariffs</a>`,
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
  if (
    text === 'Do‘konlar boshqaruvi' ||
    text === "Do'konlar boshqaruvi" ||
    text === '🏪 Do‘konlar boshqaruvi' ||
    text === 'Jami do‘konlar' ||
    text === 'Barcha do‘konlar' ||
    norm === 'dukonlar boshqaruvi' ||
    norm === "do'konlar boshqaruvi" ||
    norm === 'jami dukonlar' ||
    norm === 'barcha dukonlar' ||
    raw === '/shops' ||
    raw === '/dukonlar'
  ) {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })

    const allShops = await db.select().from(shops).orderBy(desc(shops.createdAt)).limit(25)
    const inlineButtons: any[] = allShops.map((s) => [
      { text: `${s.approved ? '✅' : '⏳'} ${s.name}`, callback_data: `view_shop_${s.id}` },
      ...(!s.approved ? [{ text: 'Tasdiqlash', callback_data: `approve_shop_${s.id}` }] : []),
    ])

    const adminCrmUrl = await generateAuthUrl(userIdStr, '/admin')
    inlineButtons.push([
      { text: '🌐 Web CRM da Jami Do‘konlarni Ko‘rish', url: adminCrmUrl }
    ])

    await send(
      token,
      chatId,
      `🏪 <b>Barcha Do‘konlar Ro‘yxati (${allShops.length} ta):</b>\n\n` +
      allShops.map((s, idx) => `${idx + 1}. <b>${s.name}</b> | Karta: <code>${formatCard(s.cardNumber || '')}</code> | ${s.approved ? '✅ Faol' : '⏳ Kutilmoqda'}`).join('\n') +
      `\n\n<i>Batafsil ma’lumot va boshqarish uchun do‘kon ustiga bosing yoki Web CRM ga o‘ting:</i>`,
      { inline_keyboard: inlineButtons.slice(0, 15) }
    )
    return NextResponse.json({ ok: true })
  }

  if (
    text === 'Tariflar boshqaruvi' ||
    text === '💎 Tariflar boshqaruvi' ||
    norm === 'tariflar boshqaruvi' ||
    norm === 'tarif boshqaruvi' ||
    raw === '/tariffs_admin' ||
    raw === '/admin_tariffs' ||
    raw === '/adm_tariffs'
  ) {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })
    await renderAdminTariffManagement(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (
    text === 'Rasmiy Kanal & Majburiy Obuna' ||
    text === '📣 Rasmiy Kanal & Majburiy Obuna' ||
    raw === '/official_channels' ||
    raw === '/channels'
  ) {
    const isAdmin = await isAdminTelegramId(userIdStr)
    if (!isAdmin) return NextResponse.json({ ok: true })
    await renderAdminOfficialChannels(token, chatId)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Adminlar boshqaruvi') {
    const isSuper = isSuperAdminTelegramId(userIdStr)
    if (!isSuper) {
      await send(token, chatId, '⛔️ <b>Ruxsat etilmagan:</b> Adminlar boshqaruvi faqat Bosh Superadmin (8021115446) uchun ochiq.', adminMenu)
      return NextResponse.json({ ok: true })
    }

    const roles = await db.select().from(systemRoles)
    await send(
      token,
      chatId,
      `👥 <b>Tizim Adminlari:</b>\n\n` +
      roles.map((r) => `• <code>${r.telegramId}</code> (${r.role}) - Qo‘shdi: ${r.addedBy}`).join('\n') +
      `\n\n⚙️ <i>Yangi admin tayinlash: <code>/addadmin &lt;telegram_id&gt;</code></i>\n` +
      `⚙️ <i>Adminni bekor qilish: <code>/removeadmin &lt;telegram_id&gt;</code></i>\n\n` +
      `ℹ️ <i>Eslatma: Faqat Superadmin admin tayinlay oladi. Tayinlangan yangi shaxslar 'admin' maqomini oladi (super admin bo‘la olmaydi).</i>`,
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
