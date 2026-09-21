import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'PayGo Secure — HUMO To‘lov Avtomatlashtirish Tizimi & Telegram Bot CRM',
  description: 'HUMO va UZCARD to‘lovlarini avtomatik tekshirish, Telegram userbot monitoringi, instant webhook va do‘konlar CRM platformasi.',
  keywords: [
    'PayGo',
    'PayGo uz',
    'PayGo Secure',
    'HUMO tolov',
    'HUMO webhook',
    'Telegram userbot',
    'HUMO bot',
    'Uzcard bot',
    'PayGo CRM',
    'To‘lov tizimi',
  ],
  authors: [{ name: 'PayGo Secure Team', url: 'https://paygo.uz' }],
  creator: 'PayGo Secure Platform',
  publisher: 'PayGo Inc.',
  generator: 'PayGo Secure Platform',
  applicationName: 'PayGo Secure',
  metadataBase: new URL(process.env.APP_URL || 'https://paygo.uz'),
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: 'https://paygo.uz',
    siteName: 'PayGo Secure',
    title: 'PayGo Secure — HUMO To‘lov Avtomatlashtirish Tizimi & Telegram Bot CRM',
    description: 'HUMO va UZCARD to‘lovlarini avtomatik tekshirish, Telegram userbot monitoringi, instant webhook va do‘konlar CRM platformasi.',
    images: [
      {
        url: '/paygo-og-banner.svg',
        width: 1200,
        height: 630,
        alt: 'PayGo Secure Platform Banner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayGo Secure — HUMO To‘lov Avtomatlashtirish Tizimi',
    description: 'HUMO va UZCARD to‘lovlarini avtomatik tekshirish, Telegram userbot monitoringi va instant webhook platformasi.',
    images: ['/paygo-og-banner.svg'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0066ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'PayGo Secure',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'All',
    description: 'HUMO va UZCARD to‘lovlarini avtomatik tekshirish, Telegram userbot monitoringi, instant webhook va do‘konlar CRM platformasi.',
    url: 'https://paygo.uz',
    logo: 'https://paygo.uz/icon.svg',
    image: 'https://paygo.uz/paygo-og-banner.svg',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'UZS',
    },
  }

  return (
    <html lang="uz" className="bg-background">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
