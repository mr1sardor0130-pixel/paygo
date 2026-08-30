import { db } from '@/lib/db'
import { userProfiles, systemRoles, shops, payments } from '@/lib/db/schema'
import { eq, and, gte, count } from 'drizzle-orm'

export async function checkShopLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const admin = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, userId)).limit(1)
  if (admin.length > 0) return { allowed: true }

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userId)).limit(1)
  const isPremium = profile.length > 0 && profile[0].tier === 'premium' && 
    (!profile[0].premiumEndsAt || profile[0].premiumEndsAt > new Date())

  if (isPremium) return { allowed: true }

  const shopCountRes = await db.select({ count: count() }).from(shops).where(eq(shops.userId, userId))
  if (shopCountRes[0].count >= 1) {
    return { allowed: false, reason: 'Bepul tarifda faqat 1 ta do‘kon ochish mumkin. Qo‘shimcha do‘konlar uchun Premium tarifga o‘ting.' }
  }

  return { allowed: true }
}

export async function checkTransactionLimits(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const admin = await db.select().from(systemRoles).where(eq(systemRoles.telegramId, userId)).limit(1)
  if (admin.length > 0) return { allowed: true }

  const profile = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, userId)).limit(1)
  const isPremium = profile.length > 0 && profile[0].tier === 'premium' && 
    (!profile[0].premiumEndsAt || profile[0].premiumEndsAt > new Date())

  if (isPremium) return { allowed: true }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const todayCountRes = await db.select({ count: count() })
    .from(payments)
    .where(and(eq(payments.userId, userId), gte(payments.createdAt, startOfDay)))
    
  const totalCountRes = await db.select({ count: count() })
    .from(payments)
    .where(eq(payments.userId, userId))

  const todayCount = todayCountRes[0].count
  const totalCount = totalCountRes[0].count

  if (totalCount >= 50) {
    return { allowed: false, reason: 'Umumiy bepul limit tugagan (Max 50 ta tranzaksiya). Tizimdan foydalanishda davom etish uchun Premium tarifga o‘ting.' }
  }
  
  if (todayCount >= 10) {
    return { allowed: false, reason: 'Kunlik bepul limit tugagan (Max 10 ta tranzaksiya/kun). Ertaga qayta urinib ko‘ring yoki Premium tarifga o‘ting.' }
  }

  return { allowed: true }
}
