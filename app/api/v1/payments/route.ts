import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { payments } from '@/lib/db/schema'

const createPaymentSchema = z.object({
  shopId: z.string().min(1),
  amount: z.number().int().positive().max(1_000_000_000),
  orderId: z.string().min(1).max(120),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) return NextResponse.json({ error: 'missing_api_key' }, { status: 401 })
    const body = createPaymentSchema.parse(await request.json())
    const paymentId = randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await db.insert(payments).values({
      id: paymentId,
      shopId: body.shopId,
      userId: 'api-owner',
      amount: body.amount,
      expiresAt,
    })
    return NextResponse.json({
      id: paymentId,
      orderId: body.orderId,
      status: 'pending',
      amount: body.amount,
      currency: 'UZS',
      expiresAt: expiresAt.toISOString(),
      paymentUrl: `/pay/${paymentId}`,
      metadata: body.metadata ?? {},
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'invalid_request', details: error.issues }, { status: 400 })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ service: 'Pay bot API', version: 'v1', status: 'online' })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

void randomUUID
void apiKeyPlaceholder
function apiKeyPlaceholder() {}
