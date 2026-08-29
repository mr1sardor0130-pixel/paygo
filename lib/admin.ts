import { headers } from 'next/headers'

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID ?? '8021115446'

export async function isAdminTelegramId(telegramId: string | number | null | undefined) {
  return Boolean(telegramId && String(telegramId) === ADMIN_TELEGRAM_ID)
}

export async function requireAdminTelegramId(telegramId: string | number | null | undefined) {
  if (!(await isAdminTelegramId(telegramId))) {
    throw new Error('Forbidden')
  }
}

export async function getAdminIdentity() {
  const requestHeaders = await headers()
  return requestHeaders.get('x-telegram-user-id')
}
