import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage } from 'telegram/events'
import { parseHumoNotification } from './telegram-humo-parser'

export type UserbotConfig = {
  apiId: number
  apiHash: string
  sessionString: string
  humoChatId?: string
  cardLast4?: string
  workerSecret?: string
  ingestUrl?: string
}

const activeClients = new Map<string, TelegramClient>()

export async function startHumoUserbot(userId: string, config: UserbotConfig) {
  // Stop existing client if running
  if (activeClients.has(userId)) {
    try {
      await activeClients.get(userId)?.disconnect()
    } catch {}
    activeClients.delete(userId)
  }

  const client = new TelegramClient(
    new StringSession(config.sessionString),
    config.apiId,
    config.apiHash,
    { connectionRetries: 5 }
  )

  await client.connect()
  activeClients.set(userId, client)

  // Listen to incoming messages, specifically from Humocardbot / banking bots
  client.addEventHandler(async (event) => {
    try {
      const message = event.message
      const text = message.message ?? ''
      if (!text) return

      // If specific humoChatId is configured and doesn't match, ignore
      if (config.humoChatId && String(message.chatId) !== config.humoChatId) {
        return
      }

      const notification = parseHumoNotification(text)
      if (!notification) return

      // If cardLast4 is specified and doesn't match, ignore
      if (config.cardLast4 && notification.cardLast4 && config.cardLast4 !== notification.cardLast4) {
        return
      }

      const ingestUrl = config.ingestUrl || (process.env.APP_URL ? `${process.env.APP_URL}/api/internal/payment-events` : 'http://localhost:3000/api/internal/payment-events')
      const workerSecret = config.workerSecret || process.env.PAYBOT_WORKER_SECRET || 'paybot-secret-dev'

      await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-worker-secret': workerSecret,
        },
        body: JSON.stringify({
          amount: notification.amount,
          cardLast4: notification.cardLast4,
          sourceMessage: text,
          date: notification.date,
          time: notification.time,
        }),
      })
    } catch (err) {
      console.error('Humo userbot message processing error:', err)
    }
  }, new NewMessage({ incoming: true }))

  return client
}

export function stopHumoUserbot(userId: string) {
  if (activeClients.has(userId)) {
    try {
      activeClients.get(userId)?.disconnect()
    } catch {}
    activeClients.delete(userId)
  }
}

export function isUserbotActive(userId: string): boolean {
  return activeClients.has(userId)
}
