import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { writeFile } from 'node:fs/promises'

const doc = new Document({ sections: [{ children: [
  new Paragraph({ text: 'Pay bot API hujjati', heading: HeadingLevel.TITLE }),
  new Paragraph('Versiya: 1.0 | JSON API | UZS payment gateway'),
  new Paragraph({ text: '1. Payment yaratish', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('POST /api/v1/payments'),
  new Paragraph('Header: x-api-key: YOUR_SHOP_API_KEY'),
  new Paragraph('Body: { "amount": 10000, "multiplier": 1, "customerRef": "order-123" }'),
  new Paragraph('Javob: { "id": "pay_...", "amount": 10000, "currency": "UZS", "status": "pending", "expiresAt": "...", "paymentUrl": "/pay/pay_...", "cardLast4": "3587" }'),
  new Paragraph({ text: '2. Payment statusi', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('GET /api/v1/payments/{id}'),
  new Paragraph('Header: x-api-key: YOUR_SHOP_API_KEY'),
  new Paragraph('Statuslar: pending, paid, expired, rejected, archived.'),
  new Paragraph({ text: '3. Webhook event', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('To‘lov tasdiqlanganda webhook URL ga POST yuboriladi. Headerlar: x-paybot-event, x-paybot-event-id, x-paybot-signature.'),
  new Paragraph('Body: { "eventId": "evt_...", "type": "payment.paid", "createdAt": "...", "payment": { "id": "pay_...", "amount": 10000, "currency": "UZS", "status": "paid" } }'),
  new Paragraph({ text: '4. Xavfsizlik', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('Webhook signature HMAC-SHA256 orqali tekshiriladi. Event ID bo‘yicha idempotency qo‘llang. Bir payment faqat bir marta paid bo‘ladi.'),
  new Paragraph({ text: '5. Eslatma', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('Telegram userbot session stringni server loglari yoki client kodiga chiqarmang. Humo bildirishnomasi matching signalidir; productionda manual review va limitlar qo‘shish tavsiya etiladi.'),
] }] })
const buffer = await Packer.toBuffer(doc)
await writeFile('public/paybot-api.docx', buffer)
console.log('Created public/paybot-api.docx')
