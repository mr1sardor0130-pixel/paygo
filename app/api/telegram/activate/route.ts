import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleWebhookSetup(req)
}

export async function POST(req: NextRequest) {
  return handleWebhookSetup(req)
}

async function handleWebhookSetup(req: NextRequest) {
  const urlObj = new URL(req.url)
  const token =
    urlObj.searchParams.get('token') || process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN sozlanmagan. Iltimos bot tokenini kiriting yoki .env da ko‘rsating.',
      },
      { status: 400 }
    )
  }

  // Detect origin
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    urlObj.host
  const detectedOrigin = `${proto}://${host}`

  const customUrl = urlObj.searchParams.get('url')
  const webhookUrl = customUrl || `${process.env.APP_URL || detectedOrigin}/api/telegram/webhook`

  try {
    // 1. Set Webhook
    const setRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        }),
      }
    )
    const setResult = await setRes.json()

    // 2. Get Webhook Info to verify
    const infoRes = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    )
    const infoResult = await infoRes.json()

    return NextResponse.json({
      ok: setResult.ok,
      webhookUrl,
      setWebhookResponse: setResult,
      currentWebhookInfo: infoResult.result || infoResult,
      message: setResult.ok
        ? `✅ Telegram Webhook muvaffaqiyatli ${webhookUrl} manziliga ulandi!`
        : `❌ Telegram xatosi: ${setResult.description}`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Telegram serveriga ulanib bo‘lmadi' },
      { status: 500 }
    )
  }
}

