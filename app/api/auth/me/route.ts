import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { authSessions, shops, systemSettings, mandatoryChannels } from '@/lib/db/schema'
import { eq, or, desc } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

async function checkUserMandatorySub(telegramId: string): Promise<{ ok: boolean; missingChannels: any[] }> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN || ''
    if (!token || !telegramId) return { ok: true, missingChannels: [] }

    const isEnabledRow = await db.select().from(systemSettings).where(eq(systemSettings.key, 'mandatory_sub_enabled')).limit(1)
    const isEnabled = isEnabledRow.length > 0 ? isEnabledRow[0].value === 'true' : false
    if (!isEnabled) return { ok: true, missingChannels: [] }

    const activeChannels = await db.select().from(mandatoryChannels).where(eq(mandatoryChannels.active, true))
    if (activeChannels.length === 0) return { ok: true, missingChannels: [] }

    const missingChannels: any[] = []
    for (const ch of activeChannels) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(ch.channelId)}&user_id=${telegramId}`)
        const data = await res.json()
        if (!data.ok || !['creator', 'administrator', 'member', 'restricted'].includes(data.result?.status)) {
          missingChannels.push({
            id: ch.id,
            name: ch.name,
            channelId: ch.channelId,
            inviteUrl: ch.inviteUrl,
          })
        }
      } catch {
        // Safe bypass on transient error
      }
    }

    return {
      ok: missingChannels.length === 0,
      missingChannels,
    }
  } catch {
    return { ok: true, missingChannels: [] }
  }
}

export async function GET(request: Request) {
  await ensureDbSchema()
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  const telegramHeader = request.headers.get('x-telegram-user-id') || ''
  const { searchParams } = new URL(request.url)
  const reqShopId = searchParams.get('shopId')

  if (!token && !telegramHeader) {
    return NextResponse.json({ ok: false, error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
  }

  try {
    let userId = ''
    let telegramId = ''
    let role = 'user'

    if (token) {
      const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
      if (rows.length && rows[0]) {
        const sess = rows[0]
        if (sess.userId !== 'pending') {
          userId = sess.userId
          telegramId = sess.telegramId || sess.userId
          role = sess.role || 'user'
        }
      }
    }

    if (!userId && telegramHeader) {
      userId = telegramHeader
      telegramId = telegramHeader
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Sessiya eskirgan yoki topilmadi' }, { status: 401 })
    }

    const isAdmin = await isAdminTelegramId(telegramId || userId)

    // Search user's shops across both userId and telegramId
    const searchUserIds = Array.from(new Set([userId, telegramId].filter(Boolean)))
    const whereConditions = searchUserIds.map((id) => eq(shops.userId, id))
    let userShops = await db
      .select()
      .from(shops)
      .where(whereConditions.length > 1 ? or(...whereConditions) : whereConditions[0])
      .orderBy(desc(shops.createdAt))

    // If admin has no personal shops, allow seeing all available shops
    if (userShops.length === 0 && isAdmin) {
      userShops = await db.select().from(shops).orderBy(desc(shops.createdAt)).limit(10)
    }

    let activeShop = userShops[0] || null
    if (reqShopId) {
      const found = userShops.find((s) => s.id === reqShopId)
      if (found) {
        activeShop = found
      } else if (isAdmin) {
        const anyShop = await db.select().from(shops).where(eq(shops.id, reqShopId)).limit(1)
        if (anyShop.length) activeShop = anyShop[0]
      }
    }

    let subCheck = { ok: true, missingChannels: [] as any[] }
    if (!isAdmin && telegramId) {
      subCheck = await checkUserMandatorySub(telegramId)
    }

    return NextResponse.json({
      ok: true,
      userId,
      telegramId,
      isAdmin,
      role: isAdmin ? 'admin' : role,
      shop: activeShop,
      shops: userShops,
      mandatorySubRequired: !subCheck.ok,
      missingChannels: subCheck.missingChannels,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
