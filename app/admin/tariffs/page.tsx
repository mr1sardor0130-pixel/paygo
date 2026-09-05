import { AdminTariffsView } from '@/components/admin-tariffs-view'

export const metadata = {
  title: 'Tariflar Boshqaruvi | PayGo Admin CRM',
  description: 'PayGo tariflari va to‘lov kartalarini boshqarish paneli.',
  robots: {
    index: false,
  },
}

export default function AdminTariffsPage() {
  return <AdminTariffsView />
}

