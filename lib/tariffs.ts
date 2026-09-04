import { db } from '@/lib/db'
import { systemTariffs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export interface TariffItem {
  id: string
  name: string
  description?: string
  features: string[] | string
  price: number
  period: string
  cardNumber?: string
  cardOwner?: string
  cardBank?: string
  active?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export const DEFAULT_TARIFFS: TariffItem[] = [
  {
    id: 'tariff-daily',
    name: 'Kunlik Sinov',
    description: '1 kunlik sinov, avto-to‘lov va monitoring',
    features: [
      '⚡️ @humocardbot orqali 1 soniyada avto-to‘lov',
      '🏪 3 tagacha do‘kon ochish',
      '🔗 Har bir do‘kon uchun alohida Webhook & Kanal',
      '👥 1 ta VIP Guruh (Pullik yozish / kirish)',
      '🎁 1 ta Donate / Ehson yig‘ish kampaniyasi',
      '0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga',
      '📄 PDF cheklar generatsiyasi',
    ],
    price: 5000,
    period: 'kun',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
  {
    id: 'tariff-weekly',
    name: 'Haftalik Standart',
    description: '7 kunlik biznes va faol savdo imkoniyati',
    features: [
      '⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)',
      '🏪 10 tagacha mustaqil do‘konlar',
      '🔗 Har bir do‘kon uchun maxsus Webhook & Kanal',
      '👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)',
      '🎁 Cheksiz Donate & Xayriya yig‘ish havolalari',
      '0% komissiya va 24/7 avtomatik monitoring',
      '📄 QR-kodli rasmiy PDF kvitansiyalar',
      '🛠 Dasturchilar uchun REST API & SDK',
    ],
    price: 25000,
    period: 'hafta',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
  {
    id: 'tariff-monthly',
    name: 'Oylik VIP (Cheksiz)',
    description: '30 kunlik to‘liq cheksiz imkoniyatlar to‘plami',
    features: [
      '⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)',
      '🏪 CHEKSIZ do‘konlar yaratish va ulash',
      '🔗 Har bir do‘konga individual Webhook & Kanal',
      '👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi',
      '🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari',
      '💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash',
      '0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga',
      '📄 Brendlangan PDF cheklar va to‘lov tahlillari',
      '🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash',
    ],
    price: 79000,
    period: 'oy',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
]

export async function getSystemTariffs(): Promise<TariffItem[]> {
  try {
    const list = await db.select().from(systemTariffs).orderBy(systemTariffs.price)
    if (list && list.length > 0) {
      const activeList = list.filter((t) => t.active !== false)
      if (activeList.length > 0) {
        return activeList.map((t) => ({
          ...t,
          features: typeof t.features === 'string' ? safeParseFeatures(t.features) : (t.features || []),
        }))
      }
    }

    // Seed defaults into database
    for (const dt of DEFAULT_TARIFFS) {
      await db
        .insert(systemTariffs)
        .values({
          ...dt,
          features: JSON.stringify(dt.features),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemTariffs.id,
          set: {
            active: true,
          },
        })
    }

    const refreshed = await db.select().from(systemTariffs).orderBy(systemTariffs.price)
    if (refreshed && refreshed.length > 0) {
      return refreshed.filter((t) => t.active !== false).map((t) => ({
        ...t,
        features: typeof t.features === 'string' ? safeParseFeatures(t.features) : (t.features || []),
      }))
    }
  } catch (err) {
    console.warn('getSystemTariffs error:', err)
  }

  return DEFAULT_TARIFFS
}

export async function getTariffById(id: string): Promise<TariffItem | null> {
  try {
    const list = await db.select().from(systemTariffs).where(eq(systemTariffs.id, id)).limit(1)
    if (list && list[0]) {
      const t = list[0]
      return {
        ...t,
        features: typeof t.features === 'string' ? safeParseFeatures(t.features) : (t.features || []),
      }
    }
  } catch (err) {
    console.warn('getTariffById db error:', err)
  }

  const fallback = DEFAULT_TARIFFS.find(
    (t) => t.id === id || (id.includes('daily') && t.id.includes('daily')) || (id.includes('weekly') && t.id.includes('weekly')) || (id.includes('monthly') && t.id.includes('monthly'))
  )
  return fallback || DEFAULT_TARIFFS[0]
}

function safeParseFeatures(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}
