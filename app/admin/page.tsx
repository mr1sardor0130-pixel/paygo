import { PaybotDashboard } from '@/components/paybot-dashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Super Admin CRM Paneli — PayGo',
  description: 'Tizim ma’murlari uchun universal boshqaruv va statistika CRM paneli.',
  robots: {
    index: false,
  },
}

export default function AdminPage() {
  return <PaybotDashboard adminOnly={true} />
}
