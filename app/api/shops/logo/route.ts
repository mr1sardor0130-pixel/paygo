import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MAX_BYTES = 2 * 1024 * 1024
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const shopId = z.string().min(1).max(120).safeParse(formData.get('shopId'))
    if (!(file instanceof File) || !shopId.success) {
      return NextResponse.json({ error: 'file va shopId kerak' }, { status: 400 })
    }
    if (!allowedTypes.has(file.type) || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Faqat PNG, JPG yoki WebP, maksimal 2 MB' }, { status: 400 })
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80)
    const blob = await put(`shops/${shopId.data}/${Date.now()}-${safeName}`, file, { access: 'private', addRandomSuffix: true })
    return NextResponse.json({ pathname: blob.pathname, contentType: file.type })
  } catch {
    return NextResponse.json({ error: 'Logo yuklashda xatolik' }, { status: 500 })
  }
}
