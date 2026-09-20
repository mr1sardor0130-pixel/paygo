import { NextResponse } from 'next/server'
import { db, ensureDbSchema } from '@/lib/db'
import { systemSettings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureDbSchema()
  try {
    const keys = [
      'site_logo',
      'paygo_official_logo',
      'logo_humo',
      'logo_uzcard',
      'logo_payme',
      'logo_click',
      'logo_uzum',
    ]

    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, keys))

    const map: Record<string, string> = {}
    rows.forEach((r) => {
      if (r.value) map[r.key] = r.value
    })

    return NextResponse.json({
      ok: true,
      logos: {
        paygo: map['paygo_official_logo'] || map['site_logo'] || '',
        humo: map['logo_humo'] || '',
        uzcard: map['logo_uzcard'] || '',
        payme: map['logo_payme'] || '',
        click: map['logo_click'] || '',
        uzum: map['logo_uzum'] || '',
      },
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message,
      logos: {
        paygo: '',
        humo: '',
        uzcard: '',
        payme: '',
        click: '',
        uzum: '',
      },
    })
  }
}
