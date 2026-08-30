import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const docContent = `
================================================================================
                    PAYGO PAYMENT GATEWAY & WEBHOOK API DOCS
                  HUMO Avtomatlashtirilgan To'lov Tizimi
================================================================================

1. KIRISH VA UMUMIY MA'LUMOT
--------------------------------------------------------------------------------
PayGo - HUMO to'lov tizimi xabarnomalarini (@humocardbot) Telegram Userbot orqali
avtomatik tarzda tutib olib, to'lovlarni real vaqtda tasdiqlovchi va savdogar
serveriga Webhook (JSON) hamda Telegram kanaliga chek yuboruvchi to'lov integratsiyasi.

Baza URL: https://paygo-pearl.vercel.app
Bot Username: @Pay_Gouzbot

2. AUTENTIFIKATSIYA VA XAVFSIZLIK
--------------------------------------------------------------------------------
Barcha API so'rovlari va Webhook xabarnomalari quyidagi sarlavhalar (headers)
orqali himoyalanadi:

  - X-PayGo-Signature: sha256={HMAC_SHA256_HEX}
  - Content-Type: application/json

Imzoni tekshirish algoritmi (HMAC SHA-256):
Savdogar o'ziga berilgan Shop API Secret kaliti orqali kelgan JSON payload xom baytlarini
HMAC SHA-256 bilan heshlaydi va X-PayGo-Signature sarlavhasi bilan solishtiradi.

3. WEBHOOK EVENT TURLARI VA FORMATI
--------------------------------------------------------------------------------
To'lov muvaffaqiyatli amalga oshirilganda (HUMO kartaga pul tushganda), savdogar
sozlangan Webhook URL manziliga quyidagi formatda POST so'rovi jo'natiladi:

Webhook JSON Schema:
{
  "event": "payment.paid",
  "eventId": "evt_98f4e21a4bc3",
  "createdAt": "2026-08-30T11:05:00.000Z",
  "shop": {
    "id": "shop_3829104",
    "name": "Mening Do'konim",
    "cardNumber": "9860350123453587",
    "cardLast4": "3587",
    "cardOwner": "AZIZBEK KARIMOV"
  },
  "payment": {
    "id": "pay_hpqh98gxsc",
    "amount": 50000,
    "currency": "UZS",
    "status": "paid",
    "cardLast4": "3587",
    "matchedAt": "2026-08-30T11:05:00.000Z",
    "orderId": "order_12345"
  },
  "signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

Serveringiz javobi:
Muvaffaqiyatli qabul qilinganda HTTP 200 OK va JSON {"ok": true} qaytarishi shart.

4. REST API ENDPOINTS
--------------------------------------------------------------------------------
A) To'lov yaratish (Create Payment Link):
   POST /api/pay/create
   Headers:
     Content-Type: application/json
     x-telegram-user-id: {telegram_id}
   Body:
     {
       "amount": 50000,
       "currency": "UZS",
       "orderId": "INV-1092"
     }
   Response:
     {
       "ok": true,
       "payment": {
         "id": "pay_hpqh98gxsc",
         "amount": 50000,
         "currency": "UZS",
         "status": "pending",
         "payUrl": "https://paygo-pearl.vercel.app/pay/pay_hpqh98gxsc",
         "expiresAt": "2026-08-30T11:10:00.000Z"
       }
     }

B) To'lov holatini tekshirish (Check Payment Status):
   GET /api/pay/status?id=pay_hpqh98gxsc
   Response:
     {
       "ok": true,
       "payment": {
         "id": "pay_hpqh98gxsc",
         "status": "paid",
         "amount": 50000,
         "currency": "UZS",
         "cardLast4": "3587"
       }
     }

5. KOD NAMUNALARI
--------------------------------------------------------------------------------
Node.js / Express Webhook Handler:
\`\`\`javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  const signature = req.headers['x-paygo-signature'];
  const event = req.body;

  if (event.event === 'payment.paid') {
    const { amount, id, orderId } = event.payment;
    console.log(\`To'lov tasdiqlandi: \${id}, Summa: \${amount} UZS, Buyurtma: \${orderId}\`);
    // Buyurtmani faollashtirish kodi
  }

  res.status(200).json({ ok: true });
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
\`\`\`

Python (FastAPI / Flask):
\`\`\`python
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def paygo_webhook():
    data = request.get_json()
    if data.get('event') == 'payment.paid':
        payment = data.get('payment', {})
        print(f"To'lov qabul qilindi: {payment.get('id')} - {payment.get('amount')} UZS")
    return jsonify({"ok": True}), 200

if __name__ == '__main__':
    app.run(port=3000)
\`\`\`

PHP:
\`\`\`php
<?php
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

if ($data && isset($data['event']) && $data['event'] === 'payment.paid') {
    $payment = $data['payment'];
    $amount = $payment['amount'];
    $paymentId = $payment['id'];
    // Bazada buyurtmani tasdiqlash
    file_put_contents('payments.log', "To'lov qabul qilindi: $paymentId, Summa: $amount\n", FILE_APPEND);
}

http_response_code(200);
echo json_encode(['ok' => true]);
?>
\`\`\`
================================================================================
Hujjat versiyasi: 2.1.0 | Qo'llab-quvvatlash: @Pay_Gouzbot | https://paygo-pearl.vercel.app
================================================================================
`

  return new NextResponse(docContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': 'attachment; filename="paybot-api.docx"',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
