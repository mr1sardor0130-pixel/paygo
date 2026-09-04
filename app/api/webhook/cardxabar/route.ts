import { NextResponse } from 'next/server'
import { parseBankNotification } from '@/lib/telegram-humo-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    let rawText = ''
    let body: any = {}

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await request.json()
      if (body?.message?.text) {
        rawText = body.message.text
      } else if (body?.channel_post?.text) {
        rawText = body.channel_post.text
      } else if (body?.text) {
        rawText = body.text
      } else if (body?.raw) {
        rawText = body.raw
      }
    } else {
      rawText = await request.text()
    }

    if (!rawText && !body.amount) {
      return NextResponse.json(
        { error: 'empty_payload', message: '@CardXabarBot yoki to‘lov xabari matni topilmadi' },
        { status: 400 }
      )
    }

    const parsed = parseBankNotification(rawText)
    const amount = body.amount || parsed?.amount
    const cardLast4 = body.cardLast4 || parsed?.cardLast4 || '1641'
    const cardType = parsed?.cardType || body.cardType || 'UNKNOWN'
    const provider = parsed?.provider || '@CardXabarBot'

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'amount_not_detected',
          message: 'To‘lov summasi topilmadi. @CardXabarBot xabar formatini tekshiring.',
        },
        { status: 400 }
      )
    }

    const internalUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/api/internal/payment-events`
      : 'http://localhost:3000/api/internal/payment-events'
    const workerSecret = process.env.PAYBOT_WORKER_SECRET || 'paybot-secret-dev'

    const res = await fetch(internalUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-worker-secret': workerSecret,
      },
      body: JSON.stringify({
        amount,
        cardLast4,
        cardType,
        provider,
        sourceMessage: rawText || JSON.stringify(body),
        terminal: parsed?.terminal,
        rrn: parsed?.rrn,
        balance: parsed?.balance,
        date: parsed?.date,
        time: parsed?.time,
      }),
    })

    const data = await res.json()
    return NextResponse.json({
      ok: true,
      message: 'CardXabar to‘lov xabari muvaffaqiyatli qabul qilindi',
      parsed: {
        amount,
        cardLast4,
        cardType,
        provider,
        terminal: parsed?.terminal,
        rrn: parsed?.rrn,
      },
      matchResult: data,
    })
  } catch (err: any) {
    console.error('CardXabar webhook error:', err)
    return NextResponse.json({ error: 'internal_error', message: err?.message || 'Server xatosi' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'PayGo CardXabar / Humo Universal Webhook Ingest',
    supportedProviders: ['@CardXabarBot', '@humocardbot', 'UZCARD', 'HUMO', 'VISA', 'Mastercard'],
  })
}
