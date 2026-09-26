import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('e883203ca759061446a63b06aea59b25fae43647', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
