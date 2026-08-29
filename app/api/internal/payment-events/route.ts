import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { payments } from '@/lib/db/schema'
import { deliverWebhook, type PaymentEvent } from '@/lib/webhook'
import { eq, and } from 'drizzle-orm'

const eventSchema = z.object({ amount: z.number().int().positive(), cardLast4: z.string().regex(/^\d{4}$/), sourceMessage: z.string().min(1) })
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const workerSecret = process.env.PAYBOT_WORKER_SECRET
  if (!workerSecret || request.headers.get('x-worker-secret') !== workerSecret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = eventSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  const [payment] = await db.select().from(payments).where(and(eq(payments.amount, parsed.data.amount), eq(payments.status, 'pending'))).limit(1)
  if (!payment || new Date(payment.expiresAt) < new Date()) return NextResponse.json({ matched: false, reason: 'payment_not_found' })
  await db.update(payments).set({ status: 'paid', matchedAt: new Date(), sourceMessage: parsed.data.sourceMessage }).where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
  const event: PaymentEvent = { eventId: randomUUID(), type: 'payment.paid', createdAt: new Date().toISOString(), payment: { id: payment.id, amount: payment.amount, currency: payment.currency, status: 'paid' } }
  return NextResponse.json({ matched: true, event, delivery: 'queued' })
}
