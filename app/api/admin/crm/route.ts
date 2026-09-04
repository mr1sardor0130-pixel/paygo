import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, payments, systemRoles, systemTariffs, userbotConnections, userProfiles, systemSettings, mandatoryChannels } from '@/lib/db/schema'
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

// GET: Fetch all shops, payments, tariffs, roles, mandatory channels and statistics
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
    const allMandatoryChannels = await db.select().from(mandatoryChannels).orderBy(desc(mandatoryChannels.createdAt))
    const settingsRows = await db.select().from(systemSettings)

    const settingsMap: Record<string, string> = {}
    settingsRows.forEach((r) => {
      settingsMap[r.key] = r.value
    })

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
        mandatoryChannelsCount: allMandatoryChannels.length,
      },
      shops: allShops,
      payments: allPayments,
      tariffs: allTariffs,
      roles: allRoles,
      userbots: allConnections,
      users: allUsers,
      mandatoryChannels: allMandatoryChannels,
      officialSettings: {
        officialChannel: settingsMap['official_channel'] || '@Pay_Gouzbot',
        officialGroup: settingsMap['official_group'] || '',
        mandatorySubEnabled: settingsMap['mandatory_sub_enabled'] === 'true',
      },
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

    // 1.2 DELETE SHOP (Admin Delete Shop)
    if (action === 'delete_shop') {
      const { shopId } = body
      if (!shopId) {
        return NextResponse.json({ error: 'Do‘kon ID kiritilmadi' }, { status: 400 })
      }
      await db.delete(shops).where(eq(shops.id, shopId))
      return NextResponse.json({ ok: true, message: 'Do‘kon muvaffaqiyatli o‘chirildi!' })
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
      const t = body.tariff || body
      const { id, name, description, features, price, period, cardNumber, cardOwner, cardBank, active } = t
      if (!name || price === undefined || price === null || price === '') {
        return NextResponse.json({ error: 'Tarif nomi va narxi majburiy' }, { status: 400 })
      }

      const numPrice = Number(String(price).replace(/\s+/g, ''))
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: 'Tarif narxi musbat son bo‘lishi kerak' }, { status: 400 })
      }

      const cleanFeatures = typeof features === 'string' 
        ? features 
        : Array.isArray(features) 
          ? JSON.stringify(features) 
          : features || ''

      const tariffData = {
        name: String(name).trim(),
        description: description ? String(description).trim() : '',
        features: cleanFeatures,
        price: Math.round(numPrice),
        period: period || 'oy',
        cardNumber: cardNumber ? String(cardNumber).replace(/\s+/g, '') : '9860350123453587',
        cardOwner: cardOwner ? String(cardOwner).trim() : 'AZizbek I',
        cardBank: cardBank ? String(cardBank).trim() : 'HUMOCARD',
        active: active !== undefined ? Boolean(active) : true,
        updatedAt: new Date(),
      }

      if (id) {
        await db
          .insert(systemTariffs)
          .values({
            id: String(id),
            ...tariffData,
          })
          .onConflictDoUpdate({
            target: systemTariffs.id,
            set: tariffData,
          })
        return NextResponse.json({ ok: true, message: 'Tarif muvaffaqiyatli saqlandi!' })
      } else {
        const tariffId = `tariff-${randomUUID().slice(0, 8)}`
        await db.insert(systemTariffs).values({
          id: tariffId,
          ...tariffData,
        })
        return NextResponse.json({ ok: true, message: 'Yangi tarif muvaffaqiyatli yaratildi!' })
      }
    }

    // 4.1 DELETE TARIFF
    if (action === 'delete_tariff') {
      const id = body.id || body.tariffId
      if (!id) return NextResponse.json({ error: 'Tarif ID ko‘rsatilmadi' }, { status: 400 })
      await db.delete(systemTariffs).where(eq(systemTariffs.id, id))
      return NextResponse.json({ ok: true, message: 'Tarif o‘chirildi!' })
    }

    // 4.2 RESET DEFAULT TARIFFS
    if (action === 'reset_default_tariffs') {
      const defaults = [
        {
          id: 'tariff-daily',
          name: 'Kunlik Sinov',
          description: '1 kunlik sinov, avto-to‘lov va monitoring',
          features: JSON.stringify([
            '⚡️ @humocardbot orqali 1 soniyada avto-to‘lov',
            '🏪 3 tagacha do‘kon ochish',
            '🔗 Har bir do‘kon uchun alohida Webhook & Kanal',
            '👥 1 ta VIP Guruh (Pullik yozish / kirish)',
            '🎁 1 ta Donate / Ehson yig‘ish kampaniyasi',
            '🛡 0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga',
            '📄 PDF cheklar generatsiyasi',
          ]),
          price: 1000,
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
          features: JSON.stringify([
            '⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)',
            '🏪 10 tagacha mustaqil do‘konlar',
            '🔗 Har bir do‘kon uchun maxsus Webhook & Kanal',
            '👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)',
            '🎁 Cheksiz Donate & Xayriya yig‘ish havolalari',
            '🛡 0% komissiya va 24/7 avtomatik monitoring',
            '📄 QR-kodli rasmiy PDF kvitansiyalar',
            '🛠 Dasturchilar uchun REST API & SDK',
          ]),
          price: 6500,
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
          features: JSON.stringify([
            '⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)',
            '🏪 CHEKSIZ do‘konlar yaratish va ulash',
            '🔗 Har bir do‘konga individual Webhook & Kanal',
            '👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi',
            '🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari',
            '💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash',
            '🛡 0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga',
            '📄 Brendlangan PDF cheklar va to‘lov tahlillari',
            '🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash',
          ]),
          price: 27858,
          period: 'oy',
          cardNumber: '9860350123453587',
          cardOwner: 'AZizbek I',
          cardBank: 'HUMOCARD',
          active: true,
        },
      ]

      for (const d of defaults) {
        await db.insert(systemTariffs).values(d).onConflictDoUpdate({
          target: systemTariffs.id,
          set: d,
        })
      }

      return NextResponse.json({ ok: true, message: 'Tariflar birlamchi holatga keltirildi!' })
    }

    // 4.5 BULK UPDATE TARIFF CARDS
    if (action === 'bulk_update_tariff_card') {
      const { cardNumber, cardOwner, cardBank } = body
      if (!cardNumber) {
        return NextResponse.json({ error: 'Karta raqami kiritilmadi' }, { status: 400 })
      }

      const cleanCard = String(cardNumber).replace(/\s+/g, '')
      const updatePayload: any = {
        cardNumber: cleanCard,
        updatedAt: new Date(),
      }
      if (cardOwner) updatePayload.cardOwner = String(cardOwner).trim()
      if (cardBank) updatePayload.cardBank = String(cardBank).trim()

      await db.update(systemTariffs).set(updatePayload)
      return NextResponse.json({ ok: true, message: 'Barcha tariflar uchun to‘lov kartasi muvaffaqiyatli yangilandi!' })
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

    // 9. SAVE OFFICIAL CHANNELS & MANDATORY SUB SWITCH
    if (action === 'save_official_links') {
      const { officialChannel, officialGroup, mandatorySubEnabled } = body

      if (officialChannel !== undefined) {
        await db
          .insert(systemSettings)
          .values({ key: 'official_channel', value: String(officialChannel).trim() })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: String(officialChannel).trim(), updatedAt: new Date() },
          })
      }

      if (officialGroup !== undefined) {
        await db
          .insert(systemSettings)
          .values({ key: 'official_group', value: String(officialGroup).trim() })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: String(officialGroup).trim(), updatedAt: new Date() },
          })
      }

      if (mandatorySubEnabled !== undefined) {
        await db
          .insert(systemSettings)
          .values({ key: 'mandatory_sub_enabled', value: mandatorySubEnabled ? 'true' : 'false' })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: mandatorySubEnabled ? 'true' : 'false', updatedAt: new Date() },
          })
      }

      return NextResponse.json({
        ok: true,
        message: 'Rasmiy kanal, guruh va majburiy obuna sozlamalari muvaffaqiyatli saqlandi!',
      })
    }

    // 10. SAVE / ADD MANDATORY CHANNEL
    if (action === 'save_mandatory_channel') {
      const { id, name, channelId, inviteUrl, type, active } = body
      if (!name || !channelId || !inviteUrl) {
        return NextResponse.json({ error: 'Kanal nomi, ID si va taklif havolasi majburiy' }, { status: 400 })
      }

      const formattedChannelId = String(channelId).trim()
      const formattedInvite = String(inviteUrl).trim()
      const formattedName = String(name).trim()

      if (id) {
        await db
          .update(mandatoryChannels)
          .set({
            name: formattedName,
            channelId: formattedChannelId,
            inviteUrl: formattedInvite,
            type: type || 'channel',
            active: active !== undefined ? Boolean(active) : true,
          })
          .where(eq(mandatoryChannels.id, id))

        return NextResponse.json({ ok: true, message: 'Majburiy kanal/guruh muvaffaqiyatli tahrirlandi' })
      } else {
        const newId = `mchan_${randomUUID().slice(0, 8)}`
        await db.insert(mandatoryChannels).values({
          id: newId,
          name: formattedName,
          channelId: formattedChannelId,
          inviteUrl: formattedInvite,
          type: type || 'channel',
          active: active !== undefined ? Boolean(active) : true,
        })

        return NextResponse.json({ ok: true, message: 'Yangi majburiy kanal/guruh muvaffaqiyatli qo‘shildi' })
      }
    }

    // 11. DELETE MANDATORY CHANNEL
    if (action === 'delete_mandatory_channel') {
      const { channelId } = body
      if (!channelId) return NextResponse.json({ error: 'Kanal identifikatori kiritilmadi' }, { status: 400 })

      await db.delete(mandatoryChannels).where(eq(mandatoryChannels.id, channelId))
      return NextResponse.json({ ok: true, message: 'Majburiy kanal/guruh o‘chirildi' })
    }

    // 12. TOGGLE MANDATORY CHANNEL ACTIVE
    if (action === 'toggle_mandatory_channel') {
      const { channelId, active } = body
      if (!channelId) return NextResponse.json({ error: 'Kanal identifikatori kiritilmadi' }, { status: 400 })

      await db.update(mandatoryChannels).set({ active: Boolean(active) }).where(eq(mandatoryChannels.id, channelId))
      return NextResponse.json({ ok: true, message: `Kanal holati ${active ? 'faollashtirildi' : 'nofaol qilindi'}` })
    }

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Xatolik' }, { status: 500 })
  }
}
