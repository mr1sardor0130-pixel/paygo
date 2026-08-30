import crypto from 'node:crypto'

export type PaymentEvent = {
  eventId: string
  type: 'payment.paid' | 'payment.expired' | 'payment.rejected'
  createdAt: string
  payment: {
    id: string
    shopId: string
    userId: string
    amount: number
    currency: string
    status: 'paid' | 'expired' | 'rejected'
    isTest?: boolean
    matchedAt?: string
  }
}

export function signPayload(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export async function deliverWebhook(url: string, secret: string, event: PaymentEvent) {
  const body = JSON.stringify(event)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paybot-event': event.type, 'x-paybot-event-id': event.eventId, 'x-paybot-signature': `sha256=${signPayload(body, secret)}` },
    body,
    signal: AbortSignal.timeout(8000),
  })
  return { ok: response.ok, status: response.status, response: (await response.text()).slice(0, 500) }
}
