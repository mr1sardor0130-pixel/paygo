import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { paidAccessRooms, paidAccessMembers, authSessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

async function resolveUser(request: Request) {
  await ensureDbSchema()
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  const telegramHeader = request.headers.get('x-telegram-user-id') || ''

  if (token) {
    const rows = await db.select().from(authSessions).where(eq(authSessions.token, token)).limit(1)
    if (rows.length && rows[0] && rows[0].userId !== 'pending') {
      return { userId: rows[0].userId, telegramId: rows[0].telegramId || rows[0].userId }
    }
  }

  if (telegramHeader) {
    return { userId: telegramHeader, telegramId: telegramHeader }
  }

  return null
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

    const activeRooms = rooms.filter((r) => r.active)
    const activeMembers = members.filter((m) => m.status === 'active' && new Date(m.expiresAt) > new Date())
    const totalVolume = members.reduce((sum, m) => sum + (m.amountPaid || 0), 0)

    return NextResponse.json({
      ok: true,
      rooms,
      members,
      stats: {
        totalRooms: rooms.length,
        activeRooms: activeRooms.length,
        totalMembers: members.length,
        activeMembers: activeMembers.length,
        totalVolume,
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
  if (!isAdmin) {
    return NextResponse.json({ error: 'Faqat administratorlar uchun' }, { status: 403 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {}

  const { action } = body

  try {
    // 1. Create Room
    if (action === 'create_room') {
      const { title, chatId, type, mode, hourlyPrice, dailyPrice, weeklyPrice, monthlyPrice, welcomeMessage } = body
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
        title: title.trim(),
        chatId: cleanChatId,
        type: type || 'group',
        mode: mode || 'write_permission',
        hourlyPrice: Number(hourlyPrice) || 5000,
        dailyPrice: Number(dailyPrice) || 15000,
        weeklyPrice: Number(weeklyPrice) || 50000,
        monthlyPrice: Number(monthlyPrice) || 120000,
        welcomeMessage: welcomeMessage || null,
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
      const { id, title, chatId, type, mode, hourlyPrice, dailyPrice, weeklyPrice, monthlyPrice, active, welcomeMessage } = body
      if (!id) return NextResponse.json({ error: 'ID topilmadi' }, { status: 400 })

      const updates: any = { updatedAt: new Date() }
      if (title !== undefined) updates.title = title.trim()
      if (chatId !== undefined) updates.chatId = String(chatId).trim()
      if (type !== undefined) updates.type = type
      if (mode !== undefined) updates.mode = mode
      if (hourlyPrice !== undefined) updates.hourlyPrice = Number(hourlyPrice)
      if (dailyPrice !== undefined) updates.dailyPrice = Number(dailyPrice)
      if (weeklyPrice !== undefined) updates.weeklyPrice = Number(weeklyPrice)
      if (monthlyPrice !== undefined) updates.monthlyPrice = Number(monthlyPrice)
      if (active !== undefined) updates.active = Boolean(active)
      if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage

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

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Xatolik yuz berdi' }, { status: 500 })
  }
}
