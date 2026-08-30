import { generateReceiptPdfBuffer } from './pdf-receipt'

export async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    })
    return await res.json()
  } catch (e) {
    console.error('sendTelegramMessage error:', e)
    return { ok: false }
  }
}

export async function sendTelegramDocument(
  chatId: string | number,
  buffer: Buffer,
  fileName: string,
  caption?: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false }
  try {
    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    const blob = new Blob([buffer], { type: 'application/pdf' })
    formData.append('document', blob, fileName)
    if (caption) {
      formData.append('caption', caption)
      formData.append('parse_mode', 'HTML')
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    })
    return await res.json()
  } catch (e) {
    console.error('sendTelegramDocument error:', e)
    return { ok: false }
  }
}
