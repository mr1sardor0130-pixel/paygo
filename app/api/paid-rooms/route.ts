import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { paidAccessRooms, paidAccessMembers, manualPaymentRequests } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'
import { resolveAuthUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

async function resolveUser(request: Request) {
  return await resolveAuthUser(request)
}

export async function GET(request: Request) {
  await ensureDbSchema()
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  try {
    const rooms = await db.select().from(paidAccessRooms).orderBy(desc(paidAccessRooms.createdAt))
    const members = await db.select().from(paidAccessMembers).orderBy(desc(paidAccessMembers.createdAt)).limit(150)
    const manualRequests = await db.select().from(manualPaymentRequests).orderBy(desc(manualPaymentRequests.createdAt)).limit(100)

    const activeRooms = rooms.filter((r) => r.active)
    const activeMembers = members.filter((m) => m.status === 'active' && new Date(m.expiresAt) > new Date())
    const totalVolume = members.reduce((sum, m) => sum + (m.amountPaid || 0), 0)

    return NextResponse.json({
      ok: true,
      rooms,
      members,
      manualRequests,
      stats: {
        totalRooms: rooms.length,
        activeRooms: activeRooms.length,
        totalMembers: members.length,
        activeMembers: activeMembers.length,
        totalVolume,
        pendingManualRequests: manualRequests.filter((r) => r.status === 'pending').length,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  await ensureDbSchema()
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Avtorizatsiyadan o‘tilmagan' }, { status: 401 })
  }

  const isAdmin = await isAdminTelegramId(user.telegramId || user.userId)

  let body: any = {}
  try {
    body = await request.json()
  } catch {}

  const { action } = body

  try {
    // 1. Create Room
    if (action === 'create_room') {
      const { title, chatId, shopId, type, mode, hourlyPrice, dailyPrice, weeklyPrice, monthlyPrice, welcomeMessage, paymentType, manualCardNumber, manualCardOwner, manualInstructions } = body
      if (!title || !chatId) {
        return NextResponse.json({ error: 'Guruh nomi va Chat ID kiritilishi shart' }, { status: 400 })
      }

      let cleanChatId = String(chatId).trim()
      if (!cleanChatId.startsWith('-100') && !cleanChatId.startsWith('@') && /^\d+$/.test(cleanChatId)) {
        cleanChatId = `-100${cleanChatId}`
      }

      const newId = `room_${randomUUID().replace(/-/g, '').slice(0, 10)}`
      await db.insert(paidAccessRooms).values({
        id: newId,
        shopId: shopId ? String(shopId).trim() : null,
        title: title.trim(),
        chatId: cleanChatId,
        type: type || 'group',
        mode: mode || 'write_permission',
        hourlyPrice: Number(hourlyPrice) || 5000,
        dailyPrice: Number(dailyPrice) || 15000,
        weeklyPrice: Number(weeklyPrice) || 50000,
        monthlyPrice: Number(monthlyPrice) || 120000,
        welcomeMessage: welcomeMessage || null,
        paymentType: paymentType || 'auto',
        manualCardNumber: manualCardNumber ? String(manualCardNumber).trim() : null,
        manualCardOwner: manualCardOwner ? String(manualCardOwner).trim() : null,
        manualInstructions: manualInstructions ? String(manualInstructions).trim() : null,
        ownerTelegramId: user.telegramId || user.userId,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const rooms = await db.select().from(paidAccessRooms).orderBy(desc(paidAccessRooms.createdAt))
      return NextResponse.json({ ok: true, message: 'VIP Guruh/Kanal muvaffaqiyatli ulandi!', rooms })
    }

    // 2. Update Room
    if (action === 'update_room') {
      const { id, title, chatId, shopId, type, mode, hourlyPrice, dailyPrice, weeklyPrice, monthlyPrice, active, welcomeMessage, paymentType, manualCardNumber, manualCardOwner, manualInstructions } = body
      if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })

      const updates: any = { updatedAt: new Date() }
      if (title !== undefined) updates.title = title.trim()
      if (chatId !== undefined) updates.chatId = String(chatId).trim()
      if (shopId !== undefined) updates.shopId = shopId ? String(shopId).trim() : null
      if (type !== undefined) updates.type = type
      if (mode !== undefined) updates.mode = mode
      if (hourlyPrice !== undefined) updates.hourlyPrice = Number(hourlyPrice)
      if (dailyPrice !== undefined) updates.dailyPrice = Number(dailyPrice)
      if (weeklyPrice !== undefined) updates.weeklyPrice = Number(weeklyPrice)
      if (monthlyPrice !== undefined) updates.monthlyPrice = Number(monthlyPrice)
      if (active !== undefined) updates.active = Boolean(active)
      if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage
      if (paymentType !== undefined) updates.paymentType = paymentType
      if (manualCardNumber !== undefined) updates.manualCardNumber = manualCardNumber ? String(manualCardNumber).trim() : null
      if (manualCardOwner !== undefined) updates.manualCardOwner = manualCardOwner ? String(manualCardOwner).trim() : null
      if (manualInstructions !== undefined) updates.manualInstructions = manualInstructions ? String(manualInstructions).trim() : null

      await db.update(paidAccessRooms).set(updates).where(eq(paidAccessRooms.id, id))
      const rooms = await db.select().from(paidAccessRooms).orderBy(desc(paidAccessRooms.createdAt))
      return NextResponse.json({ ok: true, message: 'Guruh sozlamalari yangilandi!', rooms })
    }

    // 3. Delete Room
    if (action === 'delete_room') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })

      await db.delete(paidAccessRooms).where(eq(paidAccessRooms.id, id))
      await db.delete(paidAccessMembers).where(eq(paidAccessMembers.roomId, id))

      const rooms = await db.select().from(paidAccessRooms).orderBy(desc(paidAccessRooms.createdAt))
      return NextResponse.json({ ok: true, message: 'VIP Guruh o‘chirildi', rooms })
    }

    // 4. Manually Add/Extend Member
    if (action === 'add_member') {
      const { roomId, userId: targetUserId, username, fullName, durationHours, plan, amountPaid } = body
      if (!roomId || !targetUserId) {
        return NextResponse.json({ error: 'Guruh va foydalanuvchi ID si zarur' }, { status: 400 })
      }

      const room = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, roomId)).limit(1)
      if (!room.length) {
        return NextResponse.json({ error: 'Guruh topilmadi' }, { status: 404 })
      }

      const hours = Number(durationHours) || (plan === 'hour' ? 1 : plan === 'day' ? 24 : plan === 'week' ? 168 : 720)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + hours * 3600 * 1000)

      const memberId = `pmem_${randomUUID().replace(/-/g, '').slice(0, 10)}`
      await db.insert(paidAccessMembers).values({
        id: memberId,
        roomId,
        userId: String(targetUserId).trim(),
        username: username || null,
        fullName: fullName || null,
        plan: plan || 'custom',
        amountPaid: Number(amountPaid) || 0,
        status: 'active',
        startsAt: now,
        expiresAt,
        createdAt: now,
      })

      // Try to unrestrict member in Telegram group if bot token exists
      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN
      if (token && room[0].type === 'group' && room[0].mode === 'write_permission') {
        try {
          await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: room[0].chatId,
              user_id: Number(targetUserId),
              permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
              },
            }),
          })
        } catch (tgErr) {
          console.warn('Telegram unrestrict error:', tgErr)
        }
      }

      const members = await db.select().from(paidAccessMembers).orderBy(desc(paidAccessMembers.createdAt)).limit(150)
      return NextResponse.json({ ok: true, message: 'Foydalanuvchiga ruxsat berildi!', members })
    }

    // 5. Revoke Member
    if (action === 'revoke_member') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'A’zo ID topilmadi' }, { status: 400 })

      const mem = await db.select().from(paidAccessMembers).where(eq(paidAccessMembers.id, id)).limit(1)
      if (mem.length) {
        await db.update(paidAccessMembers).set({ status: 'revoked' }).where(eq(paidAccessMembers.id, id))

        // Mute in telegram if group
        const room = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, mem[0].roomId)).limit(1)
        const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN
        if (token && room.length && room[0].mode === 'write_permission') {
          try {
            await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: room[0].chatId,
                user_id: Number(mem[0].userId),
                permissions: {
                  can_send_messages: false,
                },
              }),
            })
          } catch {}
        }
      }

      const members = await db.select().from(paidAccessMembers).orderBy(desc(paidAccessMembers.createdAt)).limit(150)
      return NextResponse.json({ ok: true, message: 'Foydalanuvchi ruxsati bekor qilindi', members })
    }

    // 6. Approve Manual Payment Request from Web Dashboard
    if (action === 'approve_manual_request') {
      const { requestId } = body
      if (!requestId) return NextResponse.json({ error: 'So‘rov ID topilmadi' }, { status: 400 })

      const reqRows = await db.select().from(manualPaymentRequests).where(eq(manualPaymentRequests.id, requestId)).limit(1)
      if (!reqRows.length) {
        return NextResponse.json({ error: 'So‘rov topilmadi' }, { status: 404 })
      }
      const mreq = reqRows[0]
      const roomRows = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, mreq.roomId)).limit(1)
      const room = roomRows.length ? roomRows[0] : null

      const isOwnerOrAdmin = isAdmin || (room && room.ownerTelegramId === (user.telegramId || user.userId))
      if (!isOwnerOrAdmin) {
        return NextResponse.json({ error: 'Ruxsat berilmadi' }, { status: 403 })
      }

      await db.update(manualPaymentRequests).set({ status: 'approved', updatedAt: new Date() }).where(eq(manualPaymentRequests.id, requestId))

      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN

      let expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      if (mreq.period === 'hour') expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      else if (mreq.period === 'day') expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      else if (mreq.period === 'week') expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const existingMem = await db
        .select()
        .from(paidAccessMembers)
        .where(and(eq(paidAccessMembers.roomId, mreq.roomId), eq(paidAccessMembers.userId, mreq.userId)))
        .limit(1)

      if (existingMem.length > 0) {
        await db
          .update(paidAccessMembers)
          .set({
            status: 'active',
            period: mreq.period,
            expiresAt,
            amountPaid: String((Number(existingMem[0].amountPaid) || 0) + (mreq.amount || 0)),
            username: mreq.username || existingMem[0].username,
            fullName: mreq.fullName || existingMem[0].fullName,
            updatedAt: new Date(),
          })
          .where(eq(paidAccessMembers.id, existingMem[0].id))
      } else {
        await db.insert(paidAccessMembers).values({
          id: `pmem_${randomUUID().replace(/-/g, '').slice(0, 10)}`,
          roomId: mreq.roomId,
          userId: mreq.userId,
          username: mreq.username || null,
          fullName: mreq.fullName || null,
          status: 'active',
          period: mreq.period,
          amountPaid: String(mreq.amount || 0),
          expiresAt,
        })
      }

      let inviteLink = ''
      if (token && room) {
        if (room.mode === 'write_permission') {
          try {
            await fetch(`https://api.telegram.org/bot${token}/restrictChatMember`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: room.chatId,
                user_id: Number(mreq.userId),
                permissions: {
                  can_send_messages: true,
                  can_send_media_messages: true,
                  can_send_other_messages: true,
                  can_add_web_page_previews: true,
                },
              }),
            })
          } catch {}
        } else if (room.mode === 'invite_only') {
          try {
            const linkRes = await fetch(`https://api.telegram.org/bot${token}/createChatInviteLink`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: room.chatId,
                member_limit: 1,
                name: `VIP-${mreq.userId}`,
              }),
            })
            const linkData = await linkRes.json()
            if (linkData.ok && linkData.result?.invite_link) {
              inviteLink = linkData.result.invite_link
            }
          } catch {}
        }

        // Notify user via Telegram
        const periodName = mreq.period === 'hour' ? '1 Soat' : mreq.period === 'day' ? '1 Kun' : mreq.period === 'week' ? '1 Hafta' : '1 Oy'
        const userMsg =
          `🎉 <b>Sizning VIP to‘lovingiz tasdiqlandi!</b>\n\n` +
          `• Guruh: <b>${room.title}</b>\n` +
          `• Tarif: <b>${periodName}</b>\n` +
          `• Amal qilish muddati: <b>${expiresAt.toLocaleString('uz-UZ')}</b>\n\n` +
          (room.mode === 'write_permission'
            ? `✅ Guruhda yozish va media yuborish huquqingiz ochildi!`
            : `🔗 <b>VIP Guruhga Kirish Havolasi:</b>\n${inviteLink || 'Taklif havolasi yaratilmadi'}`)

        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: mreq.userId,
              text: userMsg,
              parse_mode: 'HTML',
            }),
          })
        } catch {}
      }

      const manualRequests = await db.select().from(manualPaymentRequests).orderBy(desc(manualPaymentRequests.createdAt)).limit(100)
      const members = await db.select().from(paidAccessMembers).orderBy(desc(paidAccessMembers.createdAt)).limit(150)
      return NextResponse.json({ ok: true, message: 'To‘lov tasdiqlandi va mijozga ruxsat ochildi!', manualRequests, members })
    }

    // 7. Reject Manual Payment Request from Web Dashboard
    if (action === 'reject_manual_request') {
      const { requestId } = body
      if (!requestId) return NextResponse.json({ error: 'So‘rov ID topilmadi' }, { status: 400 })

      const reqRows = await db.select().from(manualPaymentRequests).where(eq(manualPaymentRequests.id, requestId)).limit(1)
      if (!reqRows.length) {
        return NextResponse.json({ error: 'So‘rov topilmadi' }, { status: 404 })
      }
      const mreq = reqRows[0]
      const roomRows = await db.select().from(paidAccessRooms).where(eq(paidAccessRooms.id, mreq.roomId)).limit(1)
      const room = roomRows.length ? roomRows[0] : null

      const isOwnerOrAdmin = isAdmin || (room && room.ownerTelegramId === (user.telegramId || user.userId))
      if (!isOwnerOrAdmin) {
        return NextResponse.json({ error: 'Ruxsat berilmadi' }, { status: 403 })
      }

      await db.update(manualPaymentRequests).set({ status: 'rejected', updatedAt: new Date() }).where(eq(manualPaymentRequests.id, requestId))

      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.HUMO_BOT_TOKEN
      if (token && room) {
        const periodName = mreq.period === 'hour' ? '1 Soat' : mreq.period === 'day' ? '1 Kun' : mreq.period === 'week' ? '1 Hafta' : '1 Oy'
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: mreq.userId,
              text: `❌ <b>Siz yuborgan to‘lov cheki rad etildi.</b>\n\n• Guruh: <b>${room.title}</b>\n• Tarif: <b>${periodName}</b>\n\n<i>Qayta to‘lov qilish uchun botga kiring yoki admin bilan bog‘laning.</i>`,
              parse_mode: 'HTML',
            }),
          })
        } catch {}
      }

      const manualRequests = await db.select().from(manualPaymentRequests).orderBy(desc(manualPaymentRequests.createdAt)).limit(100)
      return NextResponse.json({ ok: true, message: 'To‘lov cheki rad etildi', manualRequests })
    }

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Xatolik yuz berdi' }, { status: 500 })
  }
}
