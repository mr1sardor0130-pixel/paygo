import { PaybotDashboard } from '@/components/paybot-dashboard'

export default function AdminTariffsPage() {
  return <PaybotDashboard initialTab="tariffs" adminOnly={true} />
}
