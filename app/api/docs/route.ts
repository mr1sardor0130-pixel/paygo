import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const docs = {
    service: 'PayGo HUMO Payment Automation API',
    version: '2.4.0',
    description: 'HUMO to‘lovlarini qabul qilish, avtomatlashtirish, webhooklar va telegram bildirishnomalari hujjati',
    endpoints: {
      create_payment: {
        method: 'POST',
        path: '/api/v1/payments',
        headers: { 'Authorization': 'Bearer YOUR_SHOP_API_KEY', 'Content-Type': 'application/json' },
        request_body: {
          amount: 25000,
          currency: 'UZS',
          order_id: 'order_12345',
          description: 'Maxsus buyurtma uchun to‘lov',
        },
        response: {
          ok: true,
          payment_id: 'pay_9f81a2bc',
          pay_url: 'https://ais-dev-...run.app/pay/pay_9f81a2bc',
          amount: 25000,
          currency: 'UZS',
          card_number: '9860350123453587',
          card_owner: 'AZIZBEK KARIMOV',
          expires_at: '2026-08-30T11:10:00Z (5 daqiqa)',
        }
      },
      check_payment: {
        method: 'GET',
        path: '/api/pay/{payment_id}',
        response: {
          id: 'pay_9f81a2bc',
          status: 'paid | pending | expired',
          amount: 25000,
          currency: 'UZS',
        }
      },
      webhook_notification: {
        method: 'POST',
        event: 'payment.paid',
        headers: {
          'Content-Type': 'application/json',
          'X-PayGo-Signature': 'sha256=<hmac_sha256_hash>',
          'X-PayGo-Event': 'payment.paid',
        },
        json_schema_url: '/api/docs/webhook-schema.json',
      }
    }
  }

  return NextResponse.json(docs)
}
