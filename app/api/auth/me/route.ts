import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, systemSettings, mandatoryChannels } from '@/lib/db/schema'
import { eq, or, desc } from 'drizzle-orm'
import { isAdminTelegramId, isSuperAdminTelegramId } from '@/lib/admin'
import { resolveAuthUser } from '@/lib/auth-server'

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
  const { searchParams } = new URL(request.url)
  const reqShopId = searchParams.get('shopId')

  const authUser = await resolveAuthUser(request)
  if (!authUser) {
    return NextResponse.json({ ok: false, error: 'Sessiya eskirgan yoki xato auth_token' }, { status: 401 })
  }

  try {
    const userId = authUser.userId
    const telegramId = authUser.telegramId
    let role = authUser.role

    const effectiveTgId = telegramId || userId
    const isAdmin = await isAdminTelegramId(effectiveTgId)
    const isSuperAdmin = isSuperAdminTelegramId(effectiveTgId)

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
      isSuperAdmin,
      role: isSuperAdmin ? 'superadmin' : (isAdmin ? 'admin' : role),
      shop: activeShop,
      shops: userShops,
      mandatorySubRequired: !subCheck.ok,
      missingChannels: subCheck.missingChannels,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
