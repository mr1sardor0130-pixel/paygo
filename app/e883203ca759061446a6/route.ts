import { NextResponse } from 'next/server'

export async function GET() {
  return new NextResponse('e883203ca759061446a6', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
