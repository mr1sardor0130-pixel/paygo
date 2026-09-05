import { FundraiserPage } from '@/components/fundraiser-page'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Xayriya va Ehson Kampaniyasi — PayGo',
  description: 'PayGo universal to‘lov va ehson tizimi orqali xayriya loyihalarini qo‘llab-quvvatlang va ishonchli ehsonlar qiling.',
  openGraph: {
    title: 'Xayriya va Ehson Kampaniyasi — PayGo',
    description: 'PayGo universal to‘lov va ehson tizimi orqali xayriya loyihalarini qo‘llab-quvvatlang va ishonchli ehsonlar qiling.',
    images: ['/placeholder-logo.png'],
  },
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <FundraiserPage fundraiserId={id} />
}
