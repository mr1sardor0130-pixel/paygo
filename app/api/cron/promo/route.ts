import { NextResponse } from 'next/server'
import { triggerAutoPromoIfNeeded } from '@/app/api/telegram/webhook/route'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 })
  }

  try {
    const result = await triggerAutoPromoIfNeeded(token)
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
