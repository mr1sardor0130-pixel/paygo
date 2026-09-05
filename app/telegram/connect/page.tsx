import { TelegramConnectView } from '@/components/telegram-connect-view'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Telegram Userbot & Chatbot Bog‘lash — PayGo',
  description: 'Kartalaringiz monitoringini faollashtirish uchun o‘z Telegram hisobingizni xavfsiz bog‘lang.',
  robots: {
    index: false,
  },
}

export default function TelegramConnectPage() {
  return <TelegramConnectView />
}
