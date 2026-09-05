import { DocsView } from '@/components/docs-view'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tizim Hujjatlari va REST API Integratsiyasi — PayGo Developers',
  description: 'Dasturchilar uchun universal webhook ulanishi, HMAC SHA-256 xavfsiz imzosi va to‘lovlarni integratsiya qilish bo‘yicha to‘liq REST API yo‘riqnomasi.',
  openGraph: {
    title: 'Tizim Hujjatlari va REST API Integratsiyasi — PayGo Developers',
    description: 'Dasturchilar uchun universal webhook ulanishi, HMAC SHA-256 xavfsiz imzosi va to‘lovlarni integratsiya qilish bo‘yicha to‘liq REST API yo‘riqnomasi.',
  },
}

export default function DocsPage() {
  return <DocsView />
}
