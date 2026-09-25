import { PaybotDashboard } from '@/components/paybot-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PayGo V0 — UZCARD va HUMO Avtomatlashtirilgan To‘lov Tizimi',
  description: 'O‘zbekistonda birinchi marta: UZCARD va HUMO kartalari uchun 1 soniyalik avtomatik monitoring, Telegram userbot va business chatbot integratsiyasi hamda 0% komissiya. V0 Edition.',
  openGraph: {
    title: 'PayGo V0 — UZCARD va HUMO Avtomatlashtirilgan To‘lov Tizimi',
    description: 'Kartalaringizni avtomatik monitoring qiling, telegram do‘konlar yarating va webhook ulab, to‘lovlarni 1 soniyada tasdiqlang.',
    images: ['/paygo-og-banner.svg'],
  },
}

export default function Page() {
  return <PaybotDashboard />
}
