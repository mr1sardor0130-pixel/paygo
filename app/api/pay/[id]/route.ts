import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payments, shops } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1)

    if (!paymentRows[0]) {
      return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
    }

    const payment = paymentRows[0]
    let shop = null
    if (payment.shopId) {
      const shopRows = await db
        .select()
        .from(shops)
        .where(eq(shops.id, payment.shopId))
        .limit(1)
      shop = shopRows[0] || null
    }

    const isExpired =
      payment.status === 'pending' && new Date(payment.expiresAt) < new Date()
    const status = isExpired ? 'expired' : payment.status

    const cardNumber =
      shop?.cardNumber ||
      (shop?.cardLast4 ? `986035012345${shop.cardLast4}` : '9860350123453587')

    return NextResponse.json({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency || 'UZS',
      status,
      expiresAt: payment.expiresAt,
      matchedAt: payment.matchedAt,
      shop: {
        id: shop?.id ?? 'default-shop',
        name: shop?.name ?? 'HUMO To‘lov tizimi',
        cardNumber,
        cardLast4: shop?.cardLast4 ?? cardNumber.slice(-4),
        cardBank: shop?.cardBank ?? 'HUMOCARD',
        accountOwner: shop?.accountOwner ?? 'Hisob egasi',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Server xatosi' },
      { status: 500 }
    )
  }
}
