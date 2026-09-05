import { NextRequest, NextResponse } from 'next/server'
import { uploadToImgBB } from '@/lib/imgbb'

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let imageInput: string | Buffer | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') || formData.get('image')
      if (file && typeof file !== 'string') {
        const bytes = await file.arrayBuffer()
        imageInput = Buffer.from(bytes)
      } else if (typeof file === 'string') {
        imageInput = file
      }
    } else {
      const body = await request.json()
      imageInput = body.image || body.file || body.dataUrl
    }

    if (!imageInput) {
      return NextResponse.json({ error: 'no_image_provided' }, { status: 400 })
    }

    // Attempt ImgBB upload
    const imgbbUrl = await uploadToImgBB(imageInput)
    if (imgbbUrl) {
      return NextResponse.json({ ok: true, url: imgbbUrl, provider: 'imgbb' })
    }

    // Fallback if ImgBB not configured
    if (typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
      return NextResponse.json({ ok: true, url: imageInput, provider: 'data_url' })
    }

    if (Buffer.isBuffer(imageInput)) {
      const base64 = imageInput.toString('base64')
      const dataUrl = `data:image/jpeg;base64,${base64}`
      return NextResponse.json({ ok: true, url: dataUrl, provider: 'data_url' })
    }

    return NextResponse.json({ error: 'upload_failed', message: 'ImgBB API kaliti sozlanmagan yoki yuklashda xatolik yuz berdi.' }, { status: 500 })
  } catch (error: any) {
    return NextResponse.json({ error: 'server_error', message: error?.message }, { status: 500 })
  }
}
