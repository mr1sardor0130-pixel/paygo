import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, payments, systemRoles, systemTariffs, userbotConnections, userProfiles } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'
import { sendTelegramMessage } from '@/lib/telegram-notifier'

export const dynamic = 'force-dynamic'

// Helper to authenticate admin
async function checkAuth(request: Request) {
  const telegramId = request.headers.get('x-telegram-user-id') || new URL(request.url).searchParams.get('adminId')
  const ok = await isAdminTelegramId(telegramId)
  return { ok, telegramId: String(telegramId || '') }
}

// GET: Fetch all shops, payments, tariffs, roles and statistics
export async function GET(request: Request) {
  const auth = await checkAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Ruxsat berilmadi (Faqat adminlar uchun)' }, { status: 403 })
  }

  await ensureDbSchema()

  try {
    const allUsers = await db.select().from(userProfiles)
    const allShops = await db.select().from(shops).orderBy(desc(shops.createdAt))
    const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100)
    const allTariffs = await db.select().from(systemTariffs).orderBy(desc(systemTariffs.createdAt))
    const allRoles = await db.select().from(systemRoles).orderBy(desc(systemRoles.createdAt))
    const allConnections = await db.select().from(userbotConnections).orderBy(desc(userbotConnections.createdAt))

    const paidPayments = allPayments.filter((p) => p.status === 'paid')
    const totalVolume = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

    return NextResponse.json({
      ok: true,
      stats: {
        totalUsers: allUsers.length,
        totalShops: allShops.length,
        approvedShops: allShops.filter((s) => s.approved).length,
        pendingShops: allShops.filter((s) => !s.approved).length,
        totalPayments: allPayments.length,
        paidPayments: paidPayments.length,
        totalVolume,
        activeUserbots: allConnections.filter((c) => c.status === 'active').length,
        totalAdmins: allRoles.length,
      },
      shops: allShops,
      payments: allPayments,
      tariffs: allTariffs,
      roles: allRoles,
      userbots: allConnections,
      users: allUsers,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Xatolik yuz berdi' }, { status: 500 })
  }
}

// POST: Manage actions (approve/reject shop, add/delete admin role, update/add tariff)
export async function POST(request: Request) {
  const auth = await checkAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Ruxsat berilmadi' }, { status: 403 })
  }

  await ensureDbSchema()
  const body = await request.json()
  const { action } = body

  try {
    // 1. APPROVE / REJECT SHOP
    if (action === 'approve_shop') {
      const { shopId, approved } = body
      await db.update(shops).set({ approved: Boolean(approved) }).where(eq(shops.id, shopId))
      return NextResponse.json({ ok: true, message: `Do‘kon holati ${approved ? 'Tasdiqlandi' : 'Kutilmoqda holatiga o‘tkazildi'}` })
    }

    // 1.5 UPDATE FULL SHOP DETAILS (Admin Edit Shop)
    if (action === 'update_shop') {
      const { shopId, name, description, cardNumber, accountOwner, cardBank, webhookUrl, telegramChannelId, logoUrl, approved, tier } = body
      if (!shopId) {
        return NextResponse.json({ error: 'Do‘kon ID kiritilmadi' }, { status: 400 })
      }

      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (cardNumber !== undefined) {
        updateData.cardNumber = cardNumber
        updateData.cardLast4 = cardNumber.replace(/\D/g, '').slice(-4) || '3587'
      }
      if (accountOwner !== undefined) updateData.accountOwner = accountOwner
      if (cardBank !== undefined) updateData.cardBank = cardBank
      if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
      if (telegramChannelId !== undefined) updateData.telegramChannelId = telegramChannelId
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl
      if (approved !== undefined) updateData.approved = Boolean(approved)
      if (tier !== undefined) updateData.tier = tier

      await db.update(shops).set(updateData).where(eq(shops.id, shopId))
      return NextResponse.json({ ok: true, message: 'Do‘kon ma’lumotlari muvaffaqiyatli saqlandi!' })
    }

    // 2. ADD ADMIN ROLE
    if (action === 'add_admin') {
      const { telegramId, role } = body
      if (!telegramId || !String(telegramId).trim()) {
        return NextResponse.json({ error: 'Telegram ID kiritilmadi' }, { status: 400 })
      }
      const newId = randomUUID()
      const addedByWho = auth.telegramId || 'superadmin'
      await db
        .insert(systemRoles)
        .values({
          id: newId,
          telegramId: String(telegramId).trim(),
          role: role || 'admin',
          addedBy: addedByWho,
        })
        .onConflictDoUpdate({
          target: systemRoles.telegramId,
          set: { role: role || 'admin', addedBy: addedByWho },
        })

      return NextResponse.json({ ok: true, message: `Foydalanuvchi ${telegramId} admin etib tayinlandi (${addedByWho} tomonidan)` })
    }

    // 3. REMOVE / DELETE ADMIN ROLE
    if (action === 'remove_admin' || action === 'delete_admin') {
      const { telegramId, roleId } = body
      if (roleId) {
        const found = await db.select().from(systemRoles).where(eq(systemRoles.id, roleId)).limit(1)
        if (found[0]?.telegramId === '8021115446') {
          return NextResponse.json({ error: 'Asosiy superadminni o‘chirib bo‘lmaydi' }, { status: 400 })
        }
        await db.delete(systemRoles).where(eq(systemRoles.id, roleId))
        return NextResponse.json({ ok: true, message: 'Admin role muvaffaqiyatli o‘chirildi' })
      }

      const targetTgId = String(telegramId || '').trim()
      if (!targetTgId) {
        return NextResponse.json({ error: 'Telegram ID kiritilmadi' }, { status: 400 })
      }

      if (targetTgId === '8021115446') {
        return NextResponse.json({ error: 'Asosiy superadminni o‘chirib bo‘lmaydi' }, { status: 400 })
      }

      await db.delete(systemRoles).where(eq(systemRoles.telegramId, targetTgId))
      return NextResponse.json({ ok: true, message: `Admin ${targetTgId} muvaffaqiyatli o‘chirildi` })
    }

    // 3.5 CLEANUP BOGUS AUTO-GRANT ADMINS
    if (action === 'clean_auto_admins') {
      await db.execute(
        sql`DELETE FROM "system_roles" WHERE "telegramId" != '8021115446' AND ("addedBy" IN ('auto-grant', 'auto-maintenance', 'self') OR "addedBy" IS NULL)`
      )
      return NextResponse.json({ ok: true, message: 'Barcha nohaq berilgan avto-adminlar tozalandi!' })
    }

    // 4. CREATE / UPDATE TARIFF
    if (action === 'save_tariff') {
      const { id, name, description, price, period, cardNumber, cardOwner, cardBank, active } = body
      if (!name || !price) {
        return NextResponse.json({ error: 'Tarif nomi va narxi majburiy' }, { status: 400 })
      }

      if (id) {
        // Update existing tariff
        await db
          .update(systemTariffs)
          .set({
            name,
            description,
            price: Number(price),
            period: period || 'month',
            cardNumber: cardNumber || '9860350123453587',
            cardOwner: cardOwner || 'AZizbek I',
            cardBank: cardBank || 'HUMOCARD',
            active: active !== undefined ? Boolean(active) : true,
            updatedAt: new Date(),
          })
          .where(eq(systemTariffs.id, id))
        return NextResponse.json({ ok: true, message: 'Tarif muvaffaqiyatli tahrirlandi' })
      } else {
        // Create new tariff
        const tariffId = `tariff-${randomUUID().slice(0, 8)}`
        await db.insert(systemTariffs).values({
          id: tariffId,
          name,
          description,
          price: Number(price),
          period: period || 'month',
          cardNumber: cardNumber || '9860350123453587',
          cardOwner: cardOwner || 'AZizbek I',
          cardBank: cardBank || 'HUMOCARD',
          active: active !== undefined ? Boolean(active) : true,
        })
        return NextResponse.json({ ok: true, message: 'Yangi tarif yaratildi' })
      }
    }

    // 5. DELETE TARIFF
    if (action === 'delete_tariff') {
      const { tariffId } = body
      await db.delete(systemTariffs).where(eq(systemTariffs.id, tariffId))
      return NextResponse.json({ ok: true, message: 'Tarif o‘chirildi' })
    }

    // 6. GRANT / EXTEND PREMIUM FOR USER
    if (action === 'grant_premium') {
      const { telegramId, days } = body
      if (!telegramId) return NextResponse.json({ error: 'Telegram ID majburiy' }, { status: 400 })

      const daysToAdd = Number(days) || 7
      let baseDate = new Date()

      const existing = await db.select().from(userProfiles).where(eq(userProfiles.telegramId, String(telegramId))).limit(1)
      if (existing.length && existing[0]?.premiumEndsAt && new Date(existing[0].premiumEndsAt) > new Date()) {
        baseDate = new Date(existing[0].premiumEndsAt)
      }

      const premiumEndsAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

      await db
        .insert(userProfiles)
        .values({
          telegramId: String(telegramId),
          termsAccepted: true,
          tier: 'premium',
          premiumEndsAt,
          acceptedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userProfiles.telegramId,
          set: {
            tier: 'premium',
            premiumEndsAt,
          },
        })

      await db.update(shops).set({ tier: 'premium' }).where(eq(shops.userId, String(telegramId)))

      // Notify user via Telegram
      const formattedDate = premiumEndsAt.toLocaleString('uz-UZ')
      await sendTelegramMessage(
        String(telegramId),
        `🎉 <b>Tabriklaymiz! Admin tomonidan sizga Premium VIP taqdim etildi!</b>\n\n` +
        `💎 <b>Qo‘shilgan muddat:</b> +${daysToAdd} kun\n` +
        `⏳ <b>Yangi amal qilish muddati:</b> <code>${formattedDate}</code> gacha\n\n` +
        `🚀 Barcha imkoniyatlar faollashtirildi!`
      )

      return NextResponse.json({
        ok: true,
        message: `Foydalanuvchi ${telegramId} ga +${daysToAdd} kunlik Premium berildi (${formattedDate} gacha)`,
      })
    }

    // 7. REVOKE PREMIUM
    if (action === 'revoke_premium') {
      const { telegramId } = body
      if (!telegramId) return NextResponse.json({ error: 'Telegram ID majburiy' }, { status: 400 })

      await db
        .update(userProfiles)
        .set({ tier: 'free', premiumEndsAt: null })
        .where(eq(userProfiles.telegramId, String(telegramId)))

      await db.update(shops).set({ tier: 'free' }).where(eq(shops.userId, String(telegramId)))

      await sendTelegramMessage(
        String(telegramId),
        `⚠️ <b>Diqqat:</b> Sizning Premium VIP maqomingiz bekor qilindi.`
      )

      return NextResponse.json({ ok: true, message: `Foydalanuvchi ${telegramId} Premium maqomi bekor qilindi` })
    }

    // 8. BROADCAST MESSAGE TO USERS
    if (action === 'broadcast') {
      const { text, targetGroup, buttonText, buttonUrl } = body
      if (!text || !text.trim()) {
        return NextResponse.json({ error: 'E’lon matni bo‘sh bo‘lishi mumkin emas' }, { status: 400 })
      }

      const allUsers = await db.select().from(userProfiles)
      let targetUsers = allUsers

      if (targetGroup === 'premium') {
        targetUsers = allUsers.filter((u) => u.tier === 'premium' && u.premiumEndsAt && new Date(u.premiumEndsAt) > new Date())
      } else if (targetGroup === 'free') {
        targetUsers = allUsers.filter((u) => u.tier !== 'premium' || !u.premiumEndsAt || new Date(u.premiumEndsAt) <= new Date())
      }

      let successCount = 0
      let failCount = 0

      const replyMarkup = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined

      for (const u of targetUsers) {
        try {
          const res = await sendTelegramMessage(u.telegramId, text.trim(), replyMarkup)
          if (res && res.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      return NextResponse.json({
        ok: true,
        message: `E’lon yuborildi! Muvaffaqiyatli: ${successCount} ta, Xatolik: ${failCount} ta`,
        stats: { total: targetUsers.length, success: successCount, failed: failCount },
      })
    }

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Xatolik' }, { status: 500 })
  }
}
