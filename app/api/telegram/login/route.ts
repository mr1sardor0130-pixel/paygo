import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

function isValidAuth(data: Record<string, string>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !data.hash || !data.auth_date) return false
  if (Date.now() / 1000 - Number(data.auth_date) > 86400) return false
  const checkString = Object.keys(data).filter((key) => key !== 'hash').sort().map((key) => `${key}=${data[key]}`).join('\n')
  const secret = createHash('sha256').update(token).digest()
  const expected = createHmac('sha256', secret).update(checkString).digest('hex')
  const received = Buffer.from(data.hash, 'hex')
  return received.length === expected.length && timingSafeEqual(received, Buffer.from(expected))
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'Telegram bot sozlanmagan' }, { status: 503 })
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' })
  const result = await response.json() as { ok?: boolean; result?: { username?: string } }
  return NextResponse.json({ username: result.result?.username ?? null })
}

export async function POST(request: Request) {
  const data = await request.json() as Record<string, string>
  if (!isValidAuth(data)) return NextResponse.json({ error: 'Telegram authorization invalid' }, { status: 401 })
  return NextResponse.json({ ok: true, telegramId: data.id, username: data.username ?? null, firstName: data.first_name ?? null })
}
