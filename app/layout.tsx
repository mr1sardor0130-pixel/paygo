import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { AdBanner } from '@/components/ad-banner'

export const metadata: Metadata = {
  title: 'PayGo V0 — HUMO To‘lov Avtomatlashtirish Tizimi & Telegram Bot CRM',
  description: 'Next-Gen HUMO va UZCARD to‘lovlarini avtomatik tekshirish, Telegram userbot monitoringi, instant webhook va do‘konlar CRM platformasi.',
  keywords: [
    'PayGo',
    'PayGo V0',
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
        <meta name="e883203ca759061446a63b06aea59b25fae43647" content="e883203ca759061446a63b06aea59b25fae43647" />
        <meta name="e883203ca759061446a6" content="e883203ca759061446a6" />
        <Script src="https://telegram.org/js/telegram-web-app.js?56" strategy="beforeInteractive" />
        <script type="text/javascript" src="https://sorrowfulpsychology.com/bt3.VF0/Pf3PpXv/b/mVVWJ_ZdDo0B3ZN/DUYGztNsDTQSxeLKTec/0vNJj-MI0RNIDoUJ" async></script>
        <Script id="hilltop-prizefamily-ad" strategy="afterInteractive">
          {`
            (function(sgxn){
            var d = document,
                s = d.createElement('script'),
                l = d.currentScript || d.scripts[d.scripts.length - 1];
            s.settings = sgxn || {};
            s.src = "//prizefamily.com/biXPV/s.dvGZlH0qYzWxc_/jeamZ9VuYZdU/lokUP/TVcj0rNAj/MA0JOIDRk/tFNPzaQL2DMpz/QF5OMKwO";
            s.async = true;
            s.referrerPolicy = 'no-referrer-when-downgrade';
            if (l && l.parentNode) {
              l.parentNode.insertBefore(s, l);
            } else if (d.head) {
              d.head.appendChild(s);
            }
            })({});
          `}
        </Script>
        <Script id="hilltop-prizefamily-ad-2" strategy="afterInteractive">
          {`
            (function(jnkg){
            var d = document,
                s = d.createElement('script'),
                l = d.currentScript || d.scripts[d.scripts.length - 1];
            s.settings = jnkg || {};
            s.src = "//prizefamily.com/b/X/V.sKdIGulf0SYvWdcq/NeemF9juWZZUaluk/PJTDcz0VNTjyYq0fN/DpU/t/N/zPQo2ZNLjqQX0JOlQE";
            s.async = true;
            s.referrerPolicy = 'no-referrer-when-downgrade';
            if (l && l.parentNode) {
              l.parentNode.insertBefore(s, l);
            } else if (d.head) {
              d.head.appendChild(s);
            }
            })({});
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            {children}
          </main>
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
