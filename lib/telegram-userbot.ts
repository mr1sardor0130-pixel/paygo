import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage } from 'telegram/events'
import { parseBankNotification, type CardNotification } from './telegram-humo-parser'

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

export async function startBankUserbot(userId: string, config: UserbotConfig) {
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

  // Listen to incoming messages from @CardXabarBot, @humocardbot, SMS bots
  client.addEventHandler(async (event) => {
    try {
      const message = event.message
      const text = message.message ?? ''
      if (!text) return

      // If specific humoChatId is configured and doesn't match, ignore
      if (config.humoChatId && String(message.chatId) !== config.humoChatId) {
        return
      }

      const notification = parseBankNotification(text)
      if (!notification) return

      // If cardLast4 is specified and doesn't match, ignore
      if (config.cardLast4 && notification.cardLast4 && config.cardLast4 !== notification.cardLast4) {
        return
      }

      const ingestUrl =
        config.ingestUrl ||
        (process.env.APP_URL
          ? `${process.env.APP_URL}/api/internal/payment-events`
          : 'http://localhost:3000/api/internal/payment-events')
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
          cardType: notification.cardType,
          provider: notification.provider,
          terminal: notification.terminal,
          rrn: notification.rrn,
          operationId: notification.operationId,
          balance: notification.balance,
          sourceMessage: text,
          date: notification.date,
          time: notification.time,
        }),
      })
    } catch (err) {
      console.error('Bank userbot message processing error:', err)
    }
  }, new NewMessage({ incoming: true }))

  return client
}

// Backward-compatible alias
export const startHumoUserbot = startBankUserbot
export const stopBankUserbot = stopHumoUserbot

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

