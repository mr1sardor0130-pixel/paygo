import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { authSessions } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

// Generate a new pending auth token for web login
export async function POST() {
  await ensureDbSchema()
  const token = `auth_${randomUUID().replace(/-/g, '').slice(0, 24)}`
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  try {
    await db.insert(authSessions).values({
      token,
      userId: 'pending',
      expiresAt,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'humo_paybot'
  const botLink = `https://t.me/${botUsername.replace('@', '')}?start=${token}`

  return NextResponse.json({
    ok: true,
    token,
    botLink,
    expiresAt,
  })
}
