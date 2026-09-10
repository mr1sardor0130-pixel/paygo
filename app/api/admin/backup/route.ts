import { NextRequest, NextResponse } from 'next/server'
import { exportNeonDatabaseFull, sendBackupToTelegram, generateDatabaseSqlDump } from '@/lib/db/backup'
import { isAdminTelegramId } from '@/lib/db/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'zip').toLowerCase()
    const sendTg = searchParams.get('send_tg') === 'true'
    const customChatId = searchParams.get('chat_id')
    const customConn = searchParams.get('conn') || undefined

    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    const adminChatId = customChatId || process.env.TELEGRAM_ADMIN_CHAT_ID || '8021115446'

    if (sendTg) {
      if (!botToken) {
        return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 400 })
      }
      const tgRes = await sendBackupToTelegram(botToken, adminChatId, {
        connectionString: customConn,
        format: format === 'sql' ? 'sql' : format === 'both' ? 'both' : 'zip',
      })
      return NextResponse.json(tgRes)
    }

    if (format === 'json') {
      const dump = await generateDatabaseSqlDump({ connectionString: customConn })
      return NextResponse.json({
        ok: true,
        stats: dump.stats,
      })
    }

    const backup = await exportNeonDatabaseFull({ connectionString: customConn })

    if (format === 'sql') {
      return new Response(backup.sql, {
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="${backup.sqlFilename}"`,
        },
      })
    }

    // Default: ZIP download
    return new Response(backup.zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${backup.zipFilename}"`,
        'Content-Length': String(backup.zipBuffer.length),
      },
    })
  } catch (err: any) {
    console.error('Backup API error:', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Backup failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { connectionString, format = 'zip', sendTelegram = false, chatId } = body

    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    const adminChatId = chatId || process.env.TELEGRAM_ADMIN_CHAT_ID || '8021115446'

    if (sendTelegram) {
      if (!botToken) {
        return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 400 })
      }
      const tgRes = await sendBackupToTelegram(botToken, adminChatId, {
        connectionString,
        format: format === 'sql' ? 'sql' : format === 'both' ? 'both' : 'zip',
      })
      return NextResponse.json(tgRes)
    }

    const backup = await exportNeonDatabaseFull({ connectionString })

    return NextResponse.json({
      ok: true,
      stats: backup.stats,
      sqlFilename: backup.sqlFilename,
      zipFilename: backup.zipFilename,
      downloadUrlZip: `/api/admin/backup?format=zip${connectionString ? `&conn=${encodeURIComponent(connectionString)}` : ''}`,
      downloadUrlSql: `/api/admin/backup?format=sql${connectionString ? `&conn=${encodeURIComponent(connectionString)}` : ''}`,
    })
  } catch (err: any) {
    console.error('Backup POST error:', err)
    return NextResponse.json({ ok: false, error: err?.message || 'Backup failed' }, { status: 500 })
  }
}
