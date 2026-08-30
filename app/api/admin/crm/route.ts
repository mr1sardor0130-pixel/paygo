import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db, ensureDbSchema } from '@/lib/db'
import { shops, payments, systemRoles, systemTariffs, userbotConnections, userProfiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { isAdminTelegramId } from '@/lib/admin'

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

    // 2. ADD ADMIN ROLE
    if (action === 'add_admin') {
      const { telegramId, role } = body
      if (!telegramId || !String(telegramId).trim()) {
        return NextResponse.json({ error: 'Telegram ID kiritilmadi' }, { status: 400 })
      }
      const newId = randomUUID()
      await db
        .insert(systemRoles)
        .values({
          id: newId,
          telegramId: String(telegramId).trim(),
          role: role || 'admin',
          addedBy: auth.telegramId,
        })
        .onConflictDoUpdate({
          target: systemRoles.telegramId,
          set: { role: role || 'admin' },
        })

      return NextResponse.json({ ok: true, message: `Foydalanuvchi ${telegramId} admin etib tayinlandi!` })
    }

    // 3. REMOVE ADMIN ROLE
    if (action === 'remove_admin') {
      const { telegramId } = body
      if (String(telegramId) === '8021115446') {
        return NextResponse.json({ error: 'Asosiy superadminni o‘chirib bo‘lmaydi' }, { status: 400 })
      }
      await db.delete(systemRoles).where(eq(systemRoles.telegramId, String(telegramId)))
      return NextResponse.json({ ok: true, message: `Admin ${telegramId} o‘chirildi` })
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

    return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Xatolik' }, { status: 500 })
  }
}
