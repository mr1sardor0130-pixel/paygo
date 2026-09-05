import { PaybotDashboard } from '@/components/paybot-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Boshqaruv Paneli — PayGo',
  description: 'PayGo platformasining shaxsiy boshqaruv paneli. Do‘konlarni boshqarish, webhooklarni ko‘rish va avto-to‘lov hisobotlarini real vaqtda kuzatish.',
  robots: {
    index: false, // Panel pages shouldn't be indexed by search bots for safety and security
  },
}

export default function PanelPage() {
  return <PaybotDashboard />
}
