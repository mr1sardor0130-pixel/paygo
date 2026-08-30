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
import { startHumoUserbot, stopHumoUserbot, isUserbotActive } from '@/lib/telegram-userbot'
import { deliverWebhook, signPayload } from '@/lib/webhook'

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
}

const menu = {
  keyboard: [
    [{ text: '🛍 Do‘kon ochish' }, { text: '🏪 Mening do‘konim' }],
    [{ text: '💳 Mening kartam' }, { text: '🔐 Userbot ulash' }],
    [{ text: '🧪 Test to‘lov' }, { text: '📣 Kanal ulash' }],
    [{ text: '🔗 Webhook sozlash' }, { text: '💎 Tariflar' }],
    [{ text: '📊 Statistika' }, { text: '🌐 Veb-panelga kirish' }],
    [{ text: '📚 API hujjat' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

const adminMenu = {
  keyboard: [
    [{ text: '🏪 Do‘konlar boshqaruvi' }, { text: '💎 Tariflar boshqaruvi' }],
    [{ text: '👥 Adminlar boshqaruvi' }, { text: '📊 Barcha statistika' }],
    [{ text: '🤖 Userbotlar holati' }, { text: '🌐 Web CRM Dashboard' }],
    [{ text: '🏠 Asosiy menyuga qaytish' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

const back = {
  keyboard: [[{ text: '↩️ Orqaga' }, { text: '❌ Bekor qilish' }]],
  resize_keyboard: true,
}

const testAmountsKeyboard = {
  keyboard: [
    [{ text: '💵 1 000 UZS' }, { text: '💵 5 000 UZS' }],
    [{ text: '💵 10 000 UZS' }, { text: '💵 50 000 UZS' }],
    [{ text: '↩️ Orqaga' }, { text: '❌ Bekor qilish' }],
  ],
  resize_keyboard: true,
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
async function showShopDetails(token: string, chatId: number, userIdStr: string) {
  const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
  if (!userShops.length || !userShops[0]) {
    await send(
      token,
      chatId,
      '🏪 <b>Sizda hali do‘kon yo‘q.</b>\n\nTo‘lovlarni qabul qilish va boshlash uchun <b>🛍 Do‘kon ochish</b> tugmasini bosing.',
      menu
    )
    return
  }

  const s = userShops[0]
  const isConnected = await isUserbotConnectedForUser(userIdStr)
  const formattedCard = formatCard(s.cardNumber || s.cardLast4 || '9860350123453587')
  const authUrl = await generateAuthUrl(userIdStr)

  await send(
    token,
    chatId,
    `🏪 <b>Do‘kon Ma’lumotlari va Sozlamalari:</b>\n\n` +
    `🏷 <b>Nomi:</b> ${s.name}\n` +
    `💳 <b>Karta:</b> <code>${formattedCard}</code> (${s.cardBank || 'HUMOCARD'})\n` +
    `👤 <b>Egasi:</b> ${s.accountOwner || 'Kiritilmagan'}\n` +
    `🖼 <b>Logo:</b> ${s.logoUrl ? '✅ Yuklangan' : '❌ Yo‘q'}\n` +
    `🔗 <b>Webhook URL:</b> ${s.webhookUrl ? `<code>${s.webhookUrl}</code>` : '❌ O‘rnatilmagan'}\n` +
    `📣 <b>Telegram Kanal:</b> ${s.telegramChannelId ? `<code>${s.telegramChannelId}</code>` : '❌ Ulanmagan'}\n` +
    `🤖 <b>Userbot (@humocardbot):</b> ${isConnected ? '🟢 Ulangan va Faol' : '🔴 Ulanmagan'}\n` +
    `⚡️ <b>Holat:</b> ${s.approved ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda'}\n` +
    `🆔 <b>Shop ID:</b> <code>${s.id}</code>\n\n` +
    `Tahrirlash va boshqarish uchun quyidagi tugmalardan foydalaning:`,
    {
      inline_keyboard: [
        [
          { text: '✏️ Nomni o‘zgartirish', callback_data: 'edit_shop_name' },
          { text: '💳 Karta & Egasini tahrirlash', callback_data: 'edit_shop_card' },
        ],
        [
          { text: '🔗 Webhook sozlash', callback_data: 'edit_shop_webhook' },
          { text: '🖼 Logo yuklash', callback_data: 'edit_shop_logo' },
        ],
        [
          { text: '📣 Kanal ulash / test', callback_data: 'edit_shop_channel' },
          { text: '🧪 Test to‘lov', callback_data: 'test_pay' },
        ],
        [
          ...(isConnected
            ? [{ text: '🔴 Userbotni uzish', callback_data: 'userbot_disconnect_step1' }]
            : [{ text: '🔐 Userbot ulash', callback_data: 'userbot_connect_prompt' }]),
        ],
        [{ text: '🌐 Web CRM Dashboardni ochish', url: authUrl }],
      ],
    }
  )
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
async function generateAuthUrl(userIdStr: string): Promise<string> {
  const token = `auth_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
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
  return `${APP_URL}/panel?auth_token=${token}&userId=${userIdStr}`
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
    if (data === 'edit_shop_name') {
      await stateSet(chatId, { step: 'edit_shop_name' })
      await send(token, chatId, '✏️ <b>Do‘kon nomini o‘zgartirish:</b>\n\nYangi nomni kiriting (masalan: <i>PayGo Super Market</i>):', back)
      return NextResponse.json({ ok: true })
    }

    if (data === 'edit_shop_card') {
      await stateSet(chatId, { step: 'edit_shop_card_num' })
      await send(
        token,
        chatId,
        `💳 <b>Karta raqamini o‘zgartirish:</b>\n\n` +
        `Yangi 16 ta raqamdan iborat HUMO karta raqamini yuboring:\n(Masalan: <code>9860350123453587</code>)`,
        back
      )
      return NextResponse.json({ ok: true })
    }

    if (data === 'edit_shop_webhook') {
      await stateSet(chatId, { step: 'edit_shop_webhook_url' })
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

    if (data === 'edit_shop_channel') {
      await stateSet(chatId, { step: 'channel_connect' })
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

    if (data === 'edit_shop_logo') {
      await stateSet(chatId, { step: 'edit_shop_logo_url' })
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

    if (data === 'test_channel_post') {
      const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
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
      if (channelRes.ok) {
        await send(token, chatId, `✅ <b>Kanalga test xabar va JSON ma’lumot muvaffaqiyatli yuborildi!</b>\nKanalingizni tekshiring.`, menu)
      } else {
        await send(token, chatId, `❌ <b>Kanalga xabar yuborishda xatolik:</b> ${channelRes.description || 'Bot kanalda admin emas'}.\nIltimos botni kanalga admin qiling.`, menu)
      }
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

    if (data === 'test_pay') {
      const userShops = await db.select().from(shops).where(eq(shops.userId, userIdStr)).limit(1)
      if (!userShops.length) {
        await send(token, chatId, '⚠️ Test to‘lov yaratishdan oldin do‘kon ochishingiz kerak. Iltimos <b>🛍 Do‘kon ochish</b> tugmasini bosing.', menu)
        return NextResponse.json({ ok: true })
      }
      await stateSet(chatId, { step: 'test_pay_amount' })
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

    if (data === 'unlink_channel') {
      await db.update(shops).set({ telegramChannelId: null }).where(eq(shops.userId, userIdStr))
      await send(token, chatId, '✅ Telegram kanal muvaffaqiyatli uzildi.', menu)
      return NextResponse.json({ ok: true })
    }

    if (data.startsWith('approve_shop_')) {
      const targetId = data.replace('approve_shop_', '')
      await db.update(shops).set({ approved: true }).where(eq(shops.id, targetId))
      await send(token, chatId, `✅ Do‘kon (ID: <code>${targetId}</code>) tasdiqlandi!`, adminMenu)
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
    norm.includes('tariflar') ||
    norm.includes('premium') ||
    text === 'Tariflar' ||
    text === 'Premium' ||
    raw === '/tariffs'

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
    if (testRes.ok) {
      await db.update(shops).set({ telegramChannelId: channelId }).where(eq(shops.userId, userIdStr))
      await stateDelete(chatId)
      await send(
        token,
        chatId,
        `🎉 <b>Tabriklaymiz! Telegram kanal muvaffaqiyatli ulandi!</b>\n\n` +
        `📣 <b>Kanal:</b> ${channelTitle} (<code>${channelId}</code>)\n\n` +
        `Endi har bir muvaffaqiyatli to‘lov haqidagi chek va JSON xabarnoma to‘g‘ridan-to‘g‘ri shu kanalingizga tushadi!`,
        {
          inline_keyboard: [
            [{ text: '📣 Test xabar yuborish', callback_data: 'test_channel_post' }],
            [{ text: '🗑 Kanalni uzish', callback_data: 'unlink_channel' }],
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
      `Saytga avtomatik kirish va barcha do‘kon, to‘lovlar, webhook va karta sozlamalarini boshqarish uchun quyidagi havola orqali kiring:\n\n` +
      `🔗 <a href="${authUrl}"><b>Veb-panelni ochish (1-klikda kirish)</b></a>\n\n` +
      `<i>Eslatma: Ushbu havola sizning shaxsiy xavfsiz kalitingiz bilan yaratilgan.</i>`,
      menu
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
          [{ text: '✏️ Webhook URL sozlash', callback_data: 'edit_shop_webhook' }],
          [{ text: '🌐 Web Panel orqali sozlash', url: `${APP_URL}/panel` }],
        ],
      }
    )
    return NextResponse.json({ ok: true })
  }

  if (isDocsCmd) {
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
      menu
    )
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
            [{ text: '✏️ Kartani tahrirlash', callback_data: 'edit_shop_card' }],
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
    if (testRes.ok) {
      const channelId = String(testRes.result?.chat?.id || targetChannel)
      await db.update(shops).set({ telegramChannelId: channelId }).where(eq(shops.userId, userIdStr))
      await stateDelete(chatId)

      await send(
        token,
        chatId,
        `🎉 <b>Tabriklaymiz! Telegram kanal muvaffaqiyatli ulandi!</b>\n\n` +
        `📣 <b>Kanal ID:</b> <code>${channelId}</code>\n\n` +
        `Endi har bir muvaffaqiyatli to‘lov haqidagi chek va JSON xabarnoma to‘g‘ridan-to‘g‘ri shu kanalingizga tushadi!`,
        {
          inline_keyboard: [
            [{ text: '📣 Test xabar yuborish', callback_data: 'test_channel_post' }],
            [{ text: '🗑 Kanalni uzish', callback_data: 'unlink_channel' }],
          ],
        }
      )
    } else {
      await send(
        token,
        chatId,
        `⚠️ <b>Kanalga xabar yuborib bo‘lmadi:</b> ${testRes.description || 'Bot kanalda admin emas'}.\n\n` +
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
  if (text === 'Tariflar' || text === 'Premium' || raw === '/tariffs') {
    let tariffList: any[] = []
    try {
      tariffList = await db.select().from(systemTariffs).where(eq(systemTariffs.active, true))
    } catch {}

    if (!tariffList.length) {
      tariffList = [
        { name: 'Kunlik', price: 1000, period: 'kun', cardNumber: '9860350123453587', cardOwner: 'AZizbek I' },
        { name: 'Haftalik', price: 6500, period: 'hafta', cardNumber: '9860350123453587', cardOwner: 'AZizbek I' },
        { name: 'Oylik VIP', price: 27858, period: 'oy', cardNumber: '9860350123453587', cardOwner: 'AZizbek I' },
      ]
    }

    const tTxt = tariffList.map((t) =>
      `💎 <b>${t.name}</b> — <b>${Number(t.price).toLocaleString()} UZS</b> / ${t.period}\n` +
      `📝 ${t.description || 'Cheksiz to‘lov qabul qilish va monitoring'}\n` +
      `💳 <b>To‘lov kartasi:</b> <code>${formatCard(t.cardNumber || '9860350123453587')}</code>\n` +
      `👤 <b>Egasi:</b> ${t.cardOwner || 'AZizbek I'}`
    ).join('\n\n─────────────\n\n')

    await send(
      token,
      chatId,
      `💎 <b>PayGo Maxsus Premium Tariflari:</b>\n\n${tTxt}\n\n` +
      `ℹ️ <i>Tarifga to‘lov qilish uchun yuqoridagi kartaga o‘tkazma qiling. Userbot orqali to‘lovingiz avtomatik tasdiqlanadi.</i>\n\n` +
      `🌐 Boshqaruv CRM: <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
      menu
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

    const tariffs = await db.select().from(systemTariffs)
    await send(
      token,
      chatId,
      `💎 <b>Mavjud Tariflar Boshqaruvi:</b>\n\n` +
      tariffs.map((t) => `• <b>${t.name}</b>: ${t.price.toLocaleString()} UZS / ${t.period} (Karta: <code>${t.cardNumber}</code> - ${t.cardOwner})`).join('\n\n') +
      `\n\n🌐 Tariflarni to‘liq tahrirlash uchun Web CRM: <a href="${APP_URL}/admin">${APP_URL}/admin</a>`,
      adminMenu
    )
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

  if (text === 'Statistika') {
    const totalPayments = await db.select().from(payments).where(eq(payments.userId, userIdStr))
    const paid = totalPayments.filter((p) => p.status === 'paid')
    const totalSum = paid.reduce((acc, curr) => acc + (curr.amount || 0), 0)
    await send(
      token,
      chatId,
      `📊 <b>Sizning To‘lov Statistikangiz:</b>\n\n` +
      `💰 <b>Jami tushum:</b> ${totalSum.toLocaleString()} UZS\n` +
      `✅ <b>Muvaffaqiyatli to‘lovlar:</b> ${paid.length} ta\n` +
      `⏳ <b>Kutilayotgan:</b> ${totalPayments.filter((p) => p.status === 'pending').length} ta\n\n` +
      `🌐 <b>Batafsil Veb CRM:</b> ${APP_URL}/panel`,
      menu
    )
    return NextResponse.json({ ok: true })
  }

  // Fallback
  await send(token, chatId, 'Kerakli bo‘limni tanlang:', menu)
  return NextResponse.json({ ok: true })
}
