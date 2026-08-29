import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const pathname = new URL(request.url).searchParams.get('pathname')
  if (!pathname || !pathname.startsWith('shops/')) return NextResponse.json({ error: 'Noto‘g‘ri pathname' }, { status: 400 })
  try {
    const result = await get(pathname, { access: 'private' })
    if (!result) return new NextResponse('Topilmadi', { status: 404 })
    return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType, 'Cache-Control': 'private, no-cache', ETag: result.blob.etag } })
  } catch {
    return NextResponse.json({ error: 'Logo topilmadi' }, { status: 404 })
  }
}
