import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
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
import { db } from '@/lib/db'
import { userbotConnections, shops } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, userId = 'dashboard-user', shopId } = body

    if (action === 'start') {
      const state = beginOnboarding(userId)
      return NextResponse.json({ ok: true, step: state.step })
    }

    if (action === 'set_api_id') {
      const apiIdNum = Number(body.apiId || body.value)
      if (!apiIdNum || isNaN(apiIdNum) || apiIdNum <= 0) {
        return NextResponse.json(
          { error: 'API ID raqam bo‘lishi kerak (masalan: 12345678)' },
          { status: 400 }
        )
      }
      const state = setApiId(userId, apiIdNum)
      return NextResponse.json({ ok: true, step: state.step, apiId: state.apiId })
    }

    if (action === 'set_api_hash') {
      const apiHash = String(body.apiHash || body.value || '').trim()
      if (!apiHash || apiHash.length < 8) {
        return NextResponse.json(
          { error: 'API Hash noto‘g‘ri kiritildi (my.telegram.org dagi 32 xonali matn)' },
          { status: 400 }
        )
      }
      const state = setApiHash(userId, apiHash)
      return NextResponse.json({ ok: true, step: state.step })
    }

    if (action === 'send_code') {
      const phone = String(body.phone || body.value || '').trim()
      if (!phone || phone.length < 9) {
        return NextResponse.json(
          { error: 'Telefon raqamini to‘liq xalqaro formatda kiriting (+998901234567)' },
          { status: 400 }
        )
      }
      const state = await startTelegramLogin(userId, phone)
      return NextResponse.json({
        ok: true,
        step: state.step,
        phone: state.phone,
        message: 'Telegram tasdiqlash kodi yuborildi. Kodni 2.1.2.3.4 yoki 2 1 2 3 4 shaklida kiriting.',
      })
    }

    if (action === 'verify_code') {
      const code = String(body.code || body.value || '').trim()
      if (!code) {
        return NextResponse.json(
          { error: 'Tasdiqlash kodini kiriting (masalan: 2.1.2.3.4)' },
          { status: 400 }
        )
      }
      const res = await verifyTelegramCode(userId, code, body.password)
      if (res.needsPassword) {
        return NextResponse.json({
          ok: true,
          step: 'awaiting_2fa',
          needsPassword: true,
          message: 'Hisobingizda 2FA (Ikki bosqichli Cloud Password) yoqilgan. 2FA parolingizni kiriting.',
        })
      }

      if (res.sessionString) {
        const state = getOnboarding(userId)
        const connectionId = randomUUID()
        const targetShopId = shopId || 'default-shop'
        try {
          await db.insert(userbotConnections).values({
            id: connectionId,
            shopId: targetShopId,
            userId,
            sessionString: res.sessionString,
            status: 'active',
          })
          await db
            .update(shops)
            .set({ userbotSession: res.sessionString })
            .where(eq(shops.userId, userId))
        } catch (dbErr) {
          console.warn('DB userbot saving:', dbErr)
        }

        // Start Humocardbot monitoring
        if (state?.apiId && state.apiHash) {
          try {
            await startHumoUserbot(userId, {
              apiId: state.apiId,
              apiHash: state.apiHash,
              sessionString: res.sessionString,
            })
          } catch (botErr) {
            console.error('Failed to start Humo userbot listener:', botErr)
          }
        }

        return NextResponse.json({
          ok: true,
          step: 'connected',
          message: 'Telegram Userbot muvaffaqiyatli ulandi va @CardXabarBot hamda @humocardbot monitoringi ishga tushdi!',
        })
      }
    }

    if (action === 'submit_2fa') {
      const password = String(body.password || body.value || '').trim()
      if (!password) {
        return NextResponse.json({ error: '2FA parolini kiriting' }, { status: 400 })
      }
      const state = getOnboarding(userId)
      const res = await submitTelegram2FA(userId, password)

      // Save connection to DB
      const connectionId = randomUUID()
      const targetShopId = shopId || 'default-shop'
      try {
        await db.insert(userbotConnections).values({
          id: connectionId,
          shopId: targetShopId,
          userId,
          sessionString: res.sessionString,
          status: 'active',
        })
        await db
          .update(shops)
          .set({ userbotSession: res.sessionString })
          .where(eq(shops.userId, userId))
      } catch (dbErr) {
        console.warn('DB userbot saving:', dbErr)
      }

      // Start Humocardbot monitoring
      if (state?.apiId && state.apiHash) {
        try {
          await startHumoUserbot(userId, {
            apiId: state.apiId,
            apiHash: state.apiHash,
            sessionString: res.sessionString,
          })
        } catch (botErr) {
          console.error('Failed to start Humo userbot listener:', botErr)
        }
      }

      return NextResponse.json({
        ok: true,
        step: 'connected',
        message: 'Telegram Userbot 2FA orqali muvaffaqiyatli ulandi va @CardXabarBot hamda @humocardbot monitoringi faollashdi!',
      })
    }

    if (action === 'cancel') {
      cancelOnboarding(userId)
      return NextResponse.json({ ok: true, message: 'Onboarding bekor qilindi' })
    }

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Xatolik yuz berdi' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId') || 'dashboard-user'
  const state = getOnboarding(userId)
  return NextResponse.json({
    step: state?.step ?? 'idle',
    apiId: state?.apiId ? '*****' : null,
    phone: state?.phone ? '*****' : null,
  })
}

