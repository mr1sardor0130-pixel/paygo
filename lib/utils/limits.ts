import { db } from '@/lib/db'
import { userProfiles, systemRoles, shops, payments } from '@/lib/db/schema'
import { eq, and, or, isNull, count } from 'drizzle-orm'

export async function checkShopLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const admin = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, userId)).limit(1)
  if (admin.length > 0) return { allowed: true }

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userId)).limit(1)
  const isPremium = profile.length > 0 && profile[0].tier === 'premium' && 
    (!profile[0].premiumEndsAt || profile[0].premiumEndsAt > new Date())

  if (isPremium) return { allowed: true }

  const shopCountRes = await db.select({ count: count() }).from(shops).where(eq(shops.userId, userId))
  if (shopCountRes[0].count >= 1) {
    return { allowed: false, reason: 'Bepul tarifda faqat 1 ta do‘kon ochish mumkin. Cheksiz do‘konlar va alohida kartalar uchun Premium tarifga o‘ting.' }
  }

  return { allowed: true }
}

export async function checkTransactionLimits(userId: string, isTest: boolean = false): Promise<{ allowed: boolean; reason?: string }> {
  const admin = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, userId)).limit(1)
  if (admin.length > 0) return { allowed: true }

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userId)).limit(1)
  const isPremium = profile.length > 0 && profile[0].tier === 'premium' && 
    (!profile[0].premiumEndsAt || profile[0].premiumEndsAt > new Date())

  if (isPremium) return { allowed: true }

  if (isTest) {
    // Free mode: test payments limit is 50
    const testCountRes = await db.select({ count: count() })
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.isTest, true)))

    const testCount = testCountRes[0]?.count || 0
    if (testCount >= 50) {
      return { 
        allowed: false, 
        reason: 'Bepul rejimda test to‘lovlar limiti (50 ta) to‘lgan (50/50 ishlatildi). Cheksiz test va to‘liq imkoniyatlar uchun Premium tarifga o‘ting.' 
      }
    }
  } else {
    // Free mode: real payments limit is 30
    const realCountRes = await db.select({ count: count() })
      .from(payments)
      .where(and(eq(payments.userId, userId), or(eq(payments.isTest, false), isNull(payments.isTest))))

    const realCount = realCountRes[0]?.count || 0
    if (realCount >= 30) {
      return { 
        allowed: false, 
        reason: 'Bepul rejimda haqiqiy to‘lovlar limiti (30 ta) to‘lgan (30/30 qabul qilindi). Cheksiz to‘lovlar uchun Premium tarifga o‘ting.' 
      }
    }
  }

  return { allowed: true }
}

export async function getUserLimitsStatus(userId: string) {
  const admin = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, userId)).limit(1)
  const isAdmin = admin.length > 0

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userId)).limit(1)
  const isPremium = isAdmin || (profile.length > 0 && profile[0].tier === 'premium' && 
    (!profile[0].premiumEndsAt || profile[0].premiumEndsAt > new Date()))

  const testCountRes = await db.select({ count: count() })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.isTest, true)))

  const realCountRes = await db.select({ count: count() })
    .from(payments)
    .where(and(eq(payments.userId, userId), or(eq(payments.isTest, false), isNull(payments.isTest))))

  const shopCountRes = await db.select({ count: count() }).from(shops).where(eq(shops.userId, userId))

  return {
    isAdmin,
    isPremium,
    testUsed: testCountRes[0]?.count || 0,
    testMax: 50,
    realUsed: realCountRes[0]?.count || 0,
    realMax: 30,
    shopsCount: shopCountRes[0]?.count || 0,
    shopsMax: isPremium ? 9999 : 1,
  }
}

