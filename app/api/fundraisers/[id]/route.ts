import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { fundraisers, shops, donations } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbSchema()
  const { id } = await params

  try {
    const fundRows = await db
      .select({
        fundraiser: fundraisers,
        shop: {
          id: shops.id,
          name: shops.name,
          cardNumber: shops.cardNumber,
          cardBank: shops.cardBank,
          accountOwner: shops.accountOwner,
          logoUrl: shops.logoUrl,
        },
      })
      .from(fundraisers)
      .innerJoin(shops, eq(fundraisers.shopId, shops.id))
      .where(eq(fundraisers.id, id))
      .limit(1)

    if (fundRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Xayriya loyihasi topilmadi' }, { status: 404 })
    }

    const item = fundRows[0]

    // Fetch recent donations
    const recentDonations = await db
      .select()
      .from(donations)
      .where(eq(donations.fundraiserId, id))
      .orderBy(desc(donations.createdAt))
      .limit(20)

    return NextResponse.json({
      ok: true,
      fundraiser: item.fundraiser,
      shop: item.shop,
      recentDonations,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbSchema()
  const { id } = await params

  try {
    const body = await req.json()
    const { donorName, amount, comment } = body

    if (!donorName || !amount || parseInt(amount, 10) <= 0) {
      return NextResponse.json({ ok: false, error: 'Ism va to‘lov summasi to‘g‘ri kiritilishi shart' }, { status: 400 })
    }

    const fundRows = await db.select().from(fundraisers).where(eq(fundraisers.id, id)).limit(1)
    if (fundRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Loyiha topilmadi' }, { status: 404 })
    }

    const parsedAmount = parseInt(amount, 10)
    const donorTempId = `DONOR-${Math.floor(100000 + Math.random() * 900000)}`
    const donationId = `don_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    const newDonation = {
      id: donationId,
      fundraiserId: id,
      donorTempId,
      donorName: donorName.trim(),
      amount: parsedAmount,
      comment: comment ? comment.trim() : null,
      status: 'paid', // Mark as recorded donation
      createdAt: new Date(),
    }

    await db.insert(donations).values(newDonation)

    // Update fundraiser stats
    await db
      .update(fundraisers)
      .set({
        collectedAmount: sql`${fundraisers.collectedAmount} + ${parsedAmount}`,
        donorCount: sql`${fundraisers.donorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(fundraisers.id, id))

    return NextResponse.json({
      ok: true,
      donation: newDonation,
      donorTempId,
      message: 'Ehsoningiz muvaffaqiyatli qabul qilindi!',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
