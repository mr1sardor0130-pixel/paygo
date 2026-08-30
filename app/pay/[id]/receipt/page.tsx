import { PaymentReceipt } from '@/components/payment-receipt'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rasmiy To‘lov Cheki — PayGo',
  description: 'PayGo HUMO to‘lov tizimi orqali tasdiqlangan rasmiy elektron chek va kvitansiya.',
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PaymentReceipt paymentId={id} />
}
