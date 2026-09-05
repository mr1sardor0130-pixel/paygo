import { NextRequest, NextResponse } from 'next/server'

// In-memory IP rate limiter map (Sliding Window / Token Bucket)
interface RateLimitRecord {
  count: number
  resetAt: number
}

const ipMap = new Map<string, RateLimitRecord>()

// Helper for opportunistic cleanup to avoid top-level timers in Edge runtime
function cleanupStaleEntries(now: number) {
  if (ipMap.size > 500) {
    for (const [ip, record] of ipMap.entries()) {
      if (now > record.resetAt) {
        ipMap.delete(ip)
      }
    }
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignore static assets and Next.js internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Get real client IP address from proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1'

  const now = Date.now()
  cleanupStaleEntries(now)
  const windowMs = 10000 // 10 seconds window
  let maxRequests = 100   // 100 requests per 10s default limit (~10 req/sec)

  // Stricter limits for heavy endpoints (payment creation, login polling, admin CRM)
  if (pathname.startsWith('/api/pay/create') || pathname.startsWith('/api/auth/')) {
    maxRequests = 30 // ~3 req/sec
  } else if (pathname.startsWith('/api/admin/')) {
    maxRequests = 40 // ~4 req/sec
  }

  const record = ipMap.get(clientIp)

  if (!record || now > record.resetAt) {
    // Start new window for IP
    ipMap.set(clientIp, {
      count: 1,
      resetAt: now + windowMs,
    })
  } else {
    record.count += 1
    if (record.count > maxRequests) {
      // Return HTTP 429 Too Many Requests immediately without hitting database
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error: 'too_many_requests',
          message: 'Juda ko‘p so‘rov yuborildi. Iltimos, birozdan so‘ng qayta urinib ko‘ring (DDoS protection).',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '10',
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
  }

  // Pass-through with security headers
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
