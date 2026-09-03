import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { fundraisers, donations, payments } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; donationId: string }> }
) {
  await ensureDbSchema()
  const { id, donationId } = await params

  try {
    const donationRows = await db
      .select()
      .from(donations)
      .where(and(eq(donations.id, donationId), eq(donations.fundraiserId, id)))
      .limit(1)

    if (donationRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Donat topilmadi' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, donation: donationRows[0] })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; donationId: string }> }
) {
  await ensureDbSchema()
  const { id, donationId } = await params

  try {
    const donationRows = await db
      .select()
      .from(donations)
      .where(and(eq(donations.id, donationId), eq(donations.fundraiserId, id)))
      .limit(1)

    if (donationRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Donat topilmadi' }, { status: 404 })
    }

    const donation = donationRows[0]

    if (donation.status === 'paid') {
      return NextResponse.json({ ok: true, donation, message: 'Donat allaqachon tasdiqlangan!' })
    }

    // Mark donation as paid
    await db
      .update(donations)
      .set({ status: 'paid' })
      .where(eq(donations.id, donationId))

    // Mark corresponding tracking payment as paid
    await db
      .update(payments)
      .set({ status: 'paid', matchedAt: new Date() })
      .where(eq(payments.id, `pay_${donationId}`))

    // Increment fundraiser stats
    await db
      .update(fundraisers)
      .set({
        collectedAmount: sql`${fundraisers.collectedAmount} + ${donation.amount}`,
        donorCount: sql`${fundraisers.donorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(fundraisers.id, id))

    const updatedDonation = { ...donation, status: 'paid' }

    return NextResponse.json({
      ok: true,
      donation: updatedDonation,
      message: 'Donat muvaffaqiyatli tasdiqlandi va qabul qilindi!',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
