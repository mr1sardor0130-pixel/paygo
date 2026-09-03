import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { fundraisers, shops, donations } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'

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

    // Verify shop exists
    const shopList = await db.select().from(shops).where(and(eq(shops.id, shopId), eq(shops.userId, String(userId)))).limit(1)
    if (shopList.length === 0) {
      return NextResponse.json({ ok: false, error: 'Do‘kon topilmadi yoki sizga tegishli emas' }, { status: 404 })
    }

    const fundId = `fund_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newFund = {
      id: fundId,
      shopId,
      userId: String(userId),
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

    return NextResponse.json({ ok: true, fundraiser: newFund })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
