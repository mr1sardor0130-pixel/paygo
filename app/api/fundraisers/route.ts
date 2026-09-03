import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { fundraisers, shops, donations, userProfiles } from '@/lib/db/schema'
import { eq, desc, and, count } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  await ensureDbSchema()
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shopId')
  const userId = searchParams.get('userId')

  try {
    let query = db.select({
      fundraiser: fundraisers,
      shop: {
        id: shops.id,
        name: shops.name,
        cardNumber: shops.cardNumber,
        cardBank: shops.cardBank,
        accountOwner: shops.accountOwner,
        logoUrl: shops.logoUrl,
      }
    })
    .from(fundraisers)
    .innerJoin(shops, eq(fundraisers.shopId, shops.id))
    .$dynamic()

    if (shopId) {
      query = query.where(eq(fundraisers.shopId, shopId))
    } else if (userId) {
      query = query.where(eq(fundraisers.userId, userId))
    } else {
      query = query.where(eq(fundraisers.active, true))
    }

    const list = await query.orderBy(desc(fundraisers.createdAt)).limit(50)
    return NextResponse.json({ ok: true, fundraisers: list })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  await ensureDbSchema()
  try {
    const body = await req.json()
    const { shopId, userId, title, description, goalAmount } = body

    if (!shopId || !title || !userId) {
      return NextResponse.json({ ok: false, error: 'shopId, userId va title talab qilinadi' }, { status: 400 })
    }

    const cleanUserId = String(userId).trim()

    // 1. Verify shop exists
    const shopList = await db.select().from(shops).where(and(eq(shops.id, shopId), eq(shops.userId, cleanUserId))).limit(1)
    if (shopList.length === 0) {
      return NextResponse.json({ ok: false, error: 'Do‘kon topilmadi yoki sizga tegishli emas' }, { status: 404 })
    }

    const currentShop = shopList[0]

    // 2. Check User Tier & Premium Limits
    const profileRows = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, cleanUserId)).limit(1)
    const profile = profileRows[0] || null

    const isPremium =
      profile?.tier === 'premium' ||
      currentShop.tier === 'premium' ||
      (profile?.premiumEndsAt && new Date(profile.premiumEndsAt) > new Date())

    // Check active fundraiser count
    const existingFunds = await db
      .select({ count: count() })
      .from(fundraisers)
      .where(and(eq(fundraisers.userId, cleanUserId), eq(fundraisers.active, true)))

    const activeFundCount = Number(existingFunds[0]?.count || 0)

    // FREE LIMIT: Max 1 active fundraiser, Max goal 50,000,000 UZS
    if (!isPremium) {
      if (activeFundCount >= 1) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Oddiy (Free) tarifda bir vaqtning o‘zida faqat 1 ta faol ehson havolasi yaratish mumkin. Cheksiz ehson kampaniyalari va 0% komissiya uchun Premium tarifiga o‘ting.',
            requiresPremium: true,
          },
          { status: 403 }
        )
      }

      const parsedGoal = parseInt(goalAmount, 10) || 0
      if (parsedGoal > 50000000) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Oddiy tarifda maksimal maqsad 50,000,000 UZS gacha ruxsat berilgan. Yuqoriroq summa uchun Premium tarifga o‘ting.',
            requiresPremium: true,
          },
          { status: 403 }
        )
      }
    }

    const fundId = `fund_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newFund = {
      id: fundId,
      shopId,
      userId: cleanUserId,
      title: title.trim(),
      description: description ? description.trim() : null,
      goalAmount: parseInt(goalAmount, 10) || 0,
      collectedAmount: 0,
      donorCount: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(fundraisers).values(newFund)

    return NextResponse.json({ ok: true, fundraiser: newFund, isPremium: Boolean(isPremium) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
