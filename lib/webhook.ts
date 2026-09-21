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

export function signPayload(payload: string, secret: any) {
  const cleanSecret =
    typeof secret === 'string'
      ? secret
      : typeof secret === 'object' && secret !== null
      ? (secret.secret || secret.id || JSON.stringify(secret))
      : String(secret || 'secret')
  const cleanPayload = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return crypto.createHmac('sha256', cleanSecret).update(cleanPayload).digest('hex')
}

export async function deliverWebhook(url: string, secret: any, event: PaymentEvent | any) {
  try {
    // Fail-safe handling if parameters were passed in swapped order (url, event, secret)
    let targetUrl = url
    let targetSecret = secret
    let targetEvent = event

    if (typeof secret === 'object' && secret !== null && !event) {
      targetEvent = secret
      targetSecret = 'secret'
    }

    const body = typeof targetEvent === 'string' ? targetEvent : JSON.stringify(targetEvent)
    const eventType = targetEvent?.type || targetEvent?.event || 'payment.paid'
    const eventId = targetEvent?.eventId || targetEvent?.paymentId || `evt_${Date.now()}`

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-paybot-event': eventType,
        'x-paybot-event-id': eventId,
        'x-paybot-signature': `sha256=${signPayload(body, targetSecret)}`,
      },
      body,
      signal: AbortSignal.timeout(8000),
    })

    const responseText = await response.text()
    return {
      ok: response.ok,
      success: response.ok,
      status: response.status,
      statusCode: response.status,
      response: responseText.slice(0, 500),
    }
  } catch (err: any) {
    return {
      ok: false,
      success: false,
      status: 0,
      statusCode: 0,
      error: err?.message || 'Serverga bog‘lanib bo‘lmadi',
      response: err?.message || 'Serverga bog‘lanib bo‘lmadi',
    }
  }
}
