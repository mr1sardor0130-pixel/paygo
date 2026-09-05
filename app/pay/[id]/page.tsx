import { PaymentPage } from '@/components/payment-page'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Xavfsiz To‘lov Sahifasi — PayGo Secure Checkout',
  description: 'PayGo xavfsiz va tezkor to‘lov tizimi orqali to‘lovlarni xavfsiz amalga oshiring.',
  robots: {
    index: false,
  },
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PaymentPage paymentId={id} />
}

