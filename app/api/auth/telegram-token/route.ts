import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { authSessions } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

// Generate a new pending auth token for web login
export async function POST() {
  try {
    await ensureDbSchema()
  } catch {}

  const token = `auth_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  try {
    await db.insert(authSessions).values({
      token,
      userId: 'pending',
      expiresAt,
    })
  } catch (err: any) {
    console.warn('Auth token insert warning:', err?.message || err)
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Pay_Gouzbot'
  const botLink = `https://t.me/${botUsername.replace('@', '')}?start=${token}`

  return NextResponse.json({
    ok: true,
    token,
    botLink,
    expiresAt,
  })
}
