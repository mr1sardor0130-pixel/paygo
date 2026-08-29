import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!request.headers.get('x-api-key')) return NextResponse.json({ error: 'missing_api_key' }, { status: 401 })
  const { id } = await params
  const rows = await db.select({ id: payments.id, amount: payments.amount, currency: payments.currency, status: payments.status, expiresAt: payments.expiresAt, matchedAt: payments.matchedAt }).from(payments).where(eq(payments.id, id)).limit(1)
  if (!rows[0]) return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
  const payment = rows[0]
  const status = payment.status === 'pending' && new Date(payment.expiresAt) < new Date() ? 'expired' : payment.status
  return NextResponse.json({ ...payment, status, paymentUrl: `/pay/${payment.id}` })
}
