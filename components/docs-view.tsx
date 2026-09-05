'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileCode,
  Globe,
  Key,
  Layers,
  Lock,
  Radio,
  Send,
  Terminal,
  Zap,
} from 'lucide-react'

export function DocsView() {
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'webhook' | 'api' | 'code'>('overview')

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const webhookSample = `{
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
  "signature": "sha256_hash_hex"
}`

  const createPayCurl = `curl -X POST https://paygo.uz/api/pay/create \\
  -H "Content-Type: application/json" \\
  -H "x-telegram-user-id: 8925536385" \\
  -d '{
    "amount": 50000,
    "currency": "UZS",
    "orderId": "INV-1029"
  }'`

  const nodeJsSnippet = `const express = require('express');
const app = express();

app.post('/webhook/paygo', express.json(), (req, res) => {
  const signature = req.headers['x-paygo-signature'];
  const data = req.body;

  if (data.event === 'payment.paid') {
    const { id, amount, orderId } = data.payment;
    console.log(\`✅ To'lov qabul qilindi: \${id} - \${amount} UZS (Buyurtma: \${orderId})\`);
    
    // Foydalanuvchi hisobiga pul qo'shish yoki buyurtmani yetkazish
  }

  res.status(200).json({ ok: true });
});

app.listen(3000, () => console.log('PayGo Webhook server listening on :3000'));`

  const pythonSnippet = `from fastapi import FastAPI, Request
app = FastAPI()

@app.post("/webhook/paygo")
async def handle_paygo(request: Request):
    payload = await request.json()
    if payload.get("event") == "payment.paid":
        payment = payload.get("payment", {})
        print(f"✅ To'lov: {payment.get('id')} - {payment.get('amount')} UZS")
        # Buyurtmani tasdiqlash kodi
    return {"ok": True}`

  const phpSnippet = `<?php
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

if ($data && isset($data['event']) && $data['event'] === 'payment.paid') {
    $payment = $data['payment'];
    $amount = $payment['amount'];
    $paymentId = $payment['id'];
    
    // Bazada hisobni to'ldirish
    error_log("PayGo to'lov tasdiqlandi: $paymentId ($amount UZS)");
}

http_response_code(200);
echo json_encode(['ok' => true]);
?>`

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/panel"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>CRM Panel</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                P
              </div>
              <span className="font-bold text-base tracking-tight text-white">PayGo API Docs</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v2.1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/paybot-api.docx"
              download="paybot-api.docx"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOCX Yuklab olish</span>
            </a>
            <a
              href="/api/docs/webhook-schema.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-sm transition"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON Schema</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 border border-slate-800">
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              PayGo Webhook & REST API Hujjatlari
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              HUMO kartalari orqali avtomatlashtirilgan to‘lovlarni qabul qilish, to‘lov havolalarini yaratish va
              real vaqt rejimida Webhook xabarnomalarini qabul qilish bo‘yicha to‘liq integratsiya qo‘llanmasi.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Base URL: https://paygo.uz</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>HMAC SHA-256 Imzo</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>Telegram Bot: @Pay_Gouzbot</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Umumiy tushuncha
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'webhook'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Webhook JSON Schema
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'api'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            REST Endpoints
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'code'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Kod Namunalari
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-3">Tizim qanday ishlaydi?</h2>
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">To‘lov havolasi yaratish</h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Saytingiz yoki botingiz mijozga 5 daqiqalik unikal to‘lov havolasi taqdim etadi. Havolada
                        karta raqami va aniq summa ko‘rsatiladi.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">HUMO Monitoring (@humocardbot)</h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Mijoz o‘z ilovasi (Payme, Click va h.k.) orqali kartaga pul o‘tkazganda @humocardbot dan kelgan
                        xabarnoma avtomatik tarzda tutib olinadi.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Webhook va Telegram Kanal yetkazish</h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        To‘lov tasdiqlangach, soniyalar ichida serveringizga to‘liq JSON Webhook jo‘natiladi va
                        Telegram kanalingizga chek joylanadi.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-3">Xavfsizlik va HMAC Imzo</h2>
                <p className="text-xs text-slate-300 mb-3">
                  Har bir Webhook so‘rovi <code className="text-blue-400 bg-slate-800 px-1 py-0.5 rounded">X-PayGo-Signature</code> sarlavhasi
                  bilan yuboriladi. Bu so‘rov haqiqatan ham PayGo serveridan kelganligini kafolatlaydi.
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
                  X-PayGo-Signature: sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />
                  Hujjatlarni yuklab olish
                </h3>
                <div className="space-y-2">
                  <a
                    href="/paybot-api.docx"
                    download="paybot-api.docx"
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition group"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-200">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span>paybot-api.docx</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
                  </a>
                  <a
                    href="/api/docs/webhook-schema.json"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition group"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-200">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span>webhook-schema.json</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-2">Bot orqali boshqaruv</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Barcha do‘kon, karta va webhooklarni Telegram bot orqali ham boshqarishingiz mumkin.
                </p>
                <a
                  href="https://t.me/Pay_Gouzbot"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>@Pay_Gouzbot ni ochish</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Webhook Schema */}
        {activeTab === 'webhook' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Webhook JSON Formati</h2>
                  <p className="text-xs text-slate-400">
                    To‘lov tasdiqlanganda savdogar serveriga yuboriladigan to‘liq JSON ma’lumot.
                  </p>
                </div>
                <button
                  onClick={() => copyText(webhookSample, 'webhook')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                >
                  {copied === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'webhook' ? 'Nusxalandi' : 'Nusxa olish'}</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto">
                <code>{webhookSample}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: REST Endpoints */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded">
                    POST
                  </span>
                  <span className="text-sm font-mono font-bold text-white">/api/pay/create</span>
                </div>
                <button
                  onClick={() => copyText(createPayCurl, 'curl')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  {copied === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>cURL</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Yangi to‘lov havolasini yaratish. Xaridor uchun to‘lov sahifasi 5 daqiqa davomida faol bo‘ladi.
              </p>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                <code>{createPayCurl}</code>
              </pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-400 rounded">
                  GET
                </span>
                <span className="text-sm font-mono font-bold text-white">/api/pay/status?id=pay_xxx</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                To‘lov holatini tekshirish (<code className="text-slate-300">pending</code>, <code className="text-emerald-400">paid</code>, <code className="text-red-400">expired</code>).
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Code Samples */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  Node.js / Express
                </h3>
                <button
                  onClick={() => copyText(nodeJsSnippet, 'node')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  {copied === 'node' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Nusxa olish</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                <code>{nodeJsSnippet}</code>
              </pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  Python (FastAPI)
                </h3>
                <button
                  onClick={() => copyText(pythonSnippet, 'python')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  {copied === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Nusxa olish</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-blue-300 overflow-x-auto">
                <code>{pythonSnippet}</code>
              </pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-400" />
                  PHP
                </h3>
                <button
                  onClick={() => copyText(phpSnippet, 'php')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
                >
                  {copied === 'php' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Nusxa olish</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-purple-300 overflow-x-auto">
                <code>{phpSnippet}</code>
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
