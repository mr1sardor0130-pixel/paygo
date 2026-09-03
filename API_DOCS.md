# 🚀 PayGo Merchant REST API & Webhook Hujjatlari (API Docs)

Ushbu hujjat tashqi backend serverlar, do‘kon saytlari, mobil ilovalar va Telegram botlarni **PayGo** to‘lov tizimiga ulash bo‘yicha to‘liq texnik qo‘llanma hisoblanadi.

---

## 1. Asosiy Server URL
- **Production API:** `https://paygo-pearl.vercel.app`
- **Format:** `application/json`
- **Shifrlash:** HTTPS / TLS 1.3

---

## 2. To‘lov Havolasini Yaratish (Create Payment)

Tashqi saytingiz yoki backend serveringizdan xaridor uchun to‘lov havolasini yaratish uchun ushbu endpointga `POST` so‘rov yuborasiz.

### Endpoint:
```http
POST /api/pay/create
Content-Type: application/json
```

### So‘rov Headers (Ixtiyoriy):
| Header | Turi | Tavsif |
| :--- | :--- | :--- |
| `Content-Type` | `string` | `application/json` (Majburiy) |
| `X-API-Key` | `string` | Do‘koningiz API kaliti (ixtiyoriy) |
| `X-Shop-Slug` | `string` | Do‘kon slug identifikatori (ixtiyoriy) |

### So‘rov Tanasi (Request Body JSON):
```json
{
  "amount": 45000,
  "shopId": "shop_demo_12345",
  "shopSlug": "shop-3587",
  "orderId": "ORD-991823",
  "description": "Krossovka Nike Air (O‘lcham: 42)",
  "callbackUrl": "https://myshop.uz/api/webhooks/paygo",
  "returnUrl": "https://myshop.uz/checkout/success"
}
```

### Parametrlar Tavsifi:
- `amount` *(integer, majburiy)*: To‘lov summasi (so‘mda, minimal 1,000 UZS).
- `shopId` yoki `shopSlug` *(string, ixtiyoriy)*: Do‘koningiz ID yoki slugi. Agar ko‘rsatilmasa, tizimning asosiy tasdiqlangan do‘koni tanlanadi.
- `orderId` *(string, ixtiyoriy)*: Sizning tizimingizdagi buyurtma raqami.
- `description` *(string, ixtiyoriy)*: To‘lov izohi yoki tovar nomi.
- `callbackUrl` *(string, ixtiyoriy)*: To‘lov tasdiqlanganda webhook yuboriladigan manzil.

### Muvaffaqiyatli Javob (Response 200 OK):
```json
{
  "ok": true,
  "id": "pay_a83f81014a9b",
  "amount": 45000,
  "currency": "UZS",
  "status": "pending",
  "orderId": "ORD-991823",
  "description": "Krossovka Nike Air (O‘lcham: 42)",
  "expiresAt": "2026-09-03T17:15:00.000Z",
  "payUrl": "https://paygo-pearl.vercel.app/pay/pay_a83f81014a9b",
  "paymentUrl": "https://paygo-pearl.vercel.app/pay/pay_a83f81014a9b",
  "shop": {
    "id": "shop_demo_12345",
    "slug": "shop-3587",
    "name": "Nike Official Store",
    "cardNumber": "9860350123453587",
    "cardOwner": "Azizbek I",
    "cardBank": "HUMOCARD"
  }
}
```

> 💡 **Eslatma:** Foydalanuvchini olingan `payUrl` manziliga yo‘naltirasiz (Redirect qilasiz).

---

## 3. To‘lov Holatini Tekshirish (Get Payment Status)

Har qanday vaqtda to‘lov holatini tekshirishingiz mumkin.

### Endpoint:
```http
GET /api/pay/{payment_id}
```

### Javob (Response 200 OK):
```json
{
  "id": "pay_a83f81014a9b",
  "amount": 45000,
  "currency": "UZS",
  "status": "paid",
  "expiresAt": "2026-09-03T17:15:00.000Z",
  "matchedAt": "2026-09-03T17:11:24.000Z",
  "shop": {
    "id": "shop_demo_12345",
    "name": "Nike Official Store",
    "cardNumber": "9860350123453587",
    "cardLast4": "3587",
    "cardBank": "HUMOCARD",
    "accountOwner": "Azizbek I"
  }
}
```

### Holatlar (Statuses):
- `pending`: To‘lov kutilmoqda (5 daqiqa vaqt ajratilgan).
- `paid`: To‘lov muvaffaqiyatli amalga oshirildi va tasdiqlandi.
- `expired`: Belgilangan 5 daqiqa tugagan, to‘lov bekor qilingan.

---

## 4. Webhook Bildirishnomasi (Real-time Callback)

Xaridor pul o‘tkazgan zahoti va tizim (HUMO Userbot / SMS) orqali tasdiqlangach, siz ko‘rsatgan `callbackUrl` manziliga avtomatik `POST` so‘rov yuboriladi.

### Webhook So‘rov Tanasi (Webhook Payload):
```json
{
  "event": "payment.paid",
  "eventId": "evt_7f18b3294c9812",
  "createdAt": "2026-09-03T17:11:24.000Z",
  "shop": {
    "id": "shop_demo_12345",
    "name": "Nike Official Store",
    "cardNumber": "9860350123453587",
    "cardOwner": "Azizbek I"
  },
  "payment": {
    "id": "pay_a83f81014a9b",
    "amount": 45000,
    "currency": "UZS",
    "status": "paid",
    "cardLast4": "3587",
    "matchedAt": "2026-09-03T17:11:24.000Z"
  },
  "signature": "a64f89d31c0e782b54e7f9..."
}
```

### Xavfsizlik va Imzoni Tekshirish (HMAC-SHA256):
Har bir webhook bilan birga `signature` (yoki Headerda `X-PayGo-Signature`) yuboriladi. Uni tekshirish:
```javascript
const crypto = require('crypto');

function verifyWebhook(body, secret, signature) {
  const payloadStr = JSON.stringify({ id: body.payment.id, amount: body.payment.amount });
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return expectedSignature === signature;
}
```

---

## 5. Dasturlash Tillarida Integratsiya Misollari

### Node.js / JavaScript (Fetch):
```javascript
async function createPayGoInvoice(amount, orderId) {
  const response = await fetch('https://paygo-pearl.vercel.app/api/pay/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount,
      orderId: orderId,
      description: `Buyurtma #${orderId}`
    })
  });
  
  const data = await response.json();
  if (data.ok) {
    console.log('To‘lov havolasi:', data.payUrl);
    return data.payUrl;
  } else {
    console.error('Xatolik:', data.error);
  }
}
```

### Python (Requests):
```python
import requests

def create_payment(amount, order_id):
    url = "https://paygo-pearl.vercel.app/api/pay/create"
    payload = {
        "amount": amount,
        "orderId": order_id,
        "description": f"Buyurtma #{order_id}"
    }
    response = requests.post(url, json=payload)
    res_data = response.json()
    if res_data.get("ok"):
        return res_data.get("payUrl")
    raise Exception(res_data.get("error", "Payment error"))
```

### PHP (cURL):
```php
<?php
$data = [
    'amount' => 50000,
    'orderId' => 'ORD-1234',
    'description' => 'Tovarlar uchun to‘lov'
];

$ch = curl_init('https://paygo-pearl.vercel.app/api/pay/create');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
if ($result['ok']) {
    header('Location: ' . $result['payUrl']);
    exit;
}
?>
```

### cURL:
```bash
curl -X POST https://paygo-pearl.vercel.app/api/pay/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000,
    "orderId": "TEST-001",
    "description": "Test to‘lov"
  }'
```

---

## 6. Kiberxavfsizlik va Ishonchlilik Protokollari
1. **Idempotency & Double-Spending Protection:** Har bir to‘lov ID takrorlanmas noyob bo‘lib, bir marta `paid` holatiga o‘tgandan so‘ng qayta o‘zgarmaydi.
2. **Serverless Socket Resilience:** Telegram yoki tashqi tarmoqdagi uzilishlarda to‘lov oqimi to‘xtab qolmaydi, barcha tashqi so‘rovlar 4 soniyalik `AbortSignal` bilan himoyalangan.
3. **Parametrlangan Ma’lumotlar:** SQL Injection va NoSQL hujumlaridan himoyalangan.
4. **Tarif va Ehson Cheklovlari:** Free va Premium tariflari avtomatik tekshirilib, suiiste’molliklarning oldi olinadi.
