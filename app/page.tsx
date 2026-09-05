import { PaybotDashboard } from '@/components/paybot-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PayGo — UZCARD va HUMO Avtomatlashtirilgan To‘lov Tizimi',
  description: 'O‘zbekistonda birinchi marta: UZCARD va HUMO kartalari uchun 1 soniyalik avtomatik monitoring, Telegram userbot va business chatbot integratsiyasi hamda 0% komissiya.',
  openGraph: {
    title: 'PayGo — UZCARD va HUMO Avtomatlashtirilgan To‘lov Tizimi',
    description: 'Kartalaringizni avtomatik monitoring qiling, telegram do‘konlar yarating va webhook ulab, to‘lovlarni 1 soniyada tasdiqlang.',
    images: ['/placeholder-logo.png'],
  },
}

export default function Page() {
  return <PaybotDashboard />
}
