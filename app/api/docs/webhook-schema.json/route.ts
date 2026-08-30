import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'PayGo Webhook Payment Event',
    description: 'PayGo HUMO to‘lov xabarnomasi Webhook JSON formati',
    type: 'object',
    required: ['event', 'eventId', 'createdAt', 'payment', 'signature'],
    properties: {
      event: {
        type: 'string',
        enum: ['payment.paid', 'payment.expired', 'payment.failed'],
        description: 'Hodisa turi (muvaffaqiyatli to‘lov uchun payment.paid)',
      },
      eventId: {
        type: 'string',
        description: 'Takrorlanmas hodisa ID si',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'To‘lov tasdiqlangan vaqt (ISO 8601)',
      },
      shop: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          cardNumber: { type: 'string' },
          cardOwner: { type: 'string' },
        },
      },
      payment: {
        type: 'object',
        required: ['id', 'amount', 'currency', 'status'],
        properties: {
          id: { type: 'string', description: 'To‘lov tranzaksiya ID si' },
          amount: { type: 'integer', description: 'To‘langan summa (UZS)' },
          currency: { type: 'string', default: 'UZS' },
          status: { type: 'string', enum: ['paid', 'pending', 'expired'] },
          cardLast4: { type: 'string', description: 'HUMO karta oxirgi 4 raqami' },
          matchedAt: { type: 'string', format: 'date-time' },
          sourceMessage: { type: 'string', description: 'Humocardbot dagi asl xabar' },
        },
      },
      signature: {
        type: 'string',
        description: 'HMAC-SHA256 imzosi (X-PayGo-Signature headerida ham uzatiladi)',
      },
    },
    example: {
      event: 'payment.paid',
      eventId: 'evt_98f4e21a_0c9b',
      createdAt: '2026-08-30T11:05:00.000Z',
      shop: {
        id: 'shop_a1b2c3d4',
        name: 'Online Do‘kon',
        cardNumber: '9860350123453587',
        cardOwner: 'AZIZBEK KARIMOV',
      },
      payment: {
        id: 'pay_7fa83210b3',
        amount: 50000,
        currency: 'UZS',
        status: 'paid',
        cardLast4: '3587',
        matchedAt: '2026-08-30T11:05:00.000Z',
        sourceMessage: 'Karta: 9860 **** **** 3587\nSumma: +50 000.00 UZS\nVaqt: 30.08.2026 16:05',
      },
      signature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  }

  return NextResponse.json(schema, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'inline; filename="paygo-webhook-schema.json"',
    },
  })
}
