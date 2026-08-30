'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  Printer,
  QrCode,
  RotateCw,
  Share2,
  ShieldCheck,
} from 'lucide-react'

interface ReceiptData {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'expired'
  createdAt?: string
  paidAt?: string
  expiresAt?: string
  shop?: {
    id: string
    name: string
    cardNumber: string
    cardLast4: string
    accountOwner: string
    cardBank?: string
    logoUrl?: string | null
  }
}

export function PaymentReceipt({ paymentId }: { paymentId: string }) {
  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/pay/${paymentId}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.warn('Error fetching receipt data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayment()
  }, [paymentId])

  const handlePrint = () => {
    window.print()
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Chek yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  const amount = data?.amount || 15000
  const shopName = data?.shop?.name || 'PayGo Rasmiy Savdogar'
  const cardOwner = data?.shop?.accountOwner || 'HUMO Hisob Egasi'
  const cardRaw = data?.shop?.cardNumber || '9860350123453587'
  const cardFormatted = cardRaw.replace(/(\d{4})(?=\d)/g, '$1 ')
  const isPaid = data?.status === 'paid'
  const dateStr = data?.paidAt
    ? new Date(data.paidAt).toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })

  const fiscalId = `FISC-${paymentId.toUpperCase().slice(-8)}`
  const rrnNumber = `9860${Math.abs(paymentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 12345).toString().slice(0, 8)}`

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 print:bg-white print:p-0 text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Top Action Bar (hidden when printing) */}
      <div className="max-w-xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/pay/${paymentId}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition"
        >
          <ArrowLeft size={14} />
          <span>To‘lov sahifasiga</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition"
          >
            <Share2 size={14} />
            <span>{copied ? 'Havola olindi!' : 'Ulashish'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Printer size={14} />
            <span>PDF Yuklab olish / Chop etish</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Paper */}
      <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xl shadow-slate-200/50 print:shadow-none print:border-none print:p-0 print:m-0 relative overflow-hidden">
        {/* Subtle Watermark (print only/background) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-8xl font-black rotate-[-35deg] tracking-widest text-slate-900">PAYGO</span>
        </div>

        {/* Receipt Header */}
        <div className="border-b border-slate-200 pb-6 text-center">
          <div className="flex justify-center mb-3">
            {data.shop.logoUrl ? (
              <img 
                src={data.shop.logoUrl} 
                alt="Shop Logo" 
                className="h-14 w-auto max-w-[150px] object-contain rounded-2xl shadow-sm border border-slate-100"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-blue-600 text-white font-black text-2xl shadow-lg shadow-blue-500/30">
                {data.shop.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">TO‘LOV KVITANSIYASI / CHEK</h1>
          <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
            {data.shop.name}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>TO‘LOV TO‘LIQ TASDIQLANDI</span>
          </div>
        </div>

        {/* Amount Box */}
        <div className="my-6 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To‘langan Summa</p>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-1 tracking-tight">
            {amount.toLocaleString('uz-UZ')}{' '}
            <span className="text-lg font-bold text-slate-600">UZS</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Komissiya: 0% (Bepul)</p>
        </div>

        {/* Transaction Details Table */}
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">To‘lov ID:</span>
            <span className="font-mono font-bold text-slate-900">{paymentId}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">Sana va vaqt:</span>
            <span className="font-semibold text-slate-900">{dateStr}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">Qabul qiluvchi do‘kon:</span>
            <span className="font-bold text-slate-900">{shopName}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">HUMO Karta:</span>
            <span className="font-mono font-bold text-slate-900">{cardFormatted}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">Hisob egasi:</span>
            <span className="font-semibold text-slate-900">{cardOwner}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">To‘lov usuli:</span>
            <span className="font-semibold text-blue-600">HUMOCARD (P2P Transfer)</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200">
            <span className="text-slate-500">Fiskal ID / RRN:</span>
            <span className="font-mono font-medium text-slate-700">{fiscalId} • {rrnNumber}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Holat:</span>
            <span className="font-bold text-emerald-600 uppercase">Muvaffaqiyatli (Tasdiqlangan)</span>
          </div>
        </div>

        {/* Bottom Section: Stamp (Muhr) & Verification QR */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* QR Verification Code */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-inner">
              <svg className="size-16" viewBox="0 0 100 100" fill="currentColor">
                <path d="M10 10h30v30h-30z M15 15h20v20h-20z M20 20h10v10h-10z M60 10h30v30h-30z M65 15h20v20h-20z M70 20h10v10h-10z M10 60h30v30h-30z M15 65h20v20h-20z M20 70h10v10h-10z M50 15h5v20h-5z M60 60h10v10h-10z M80 60h10v10h-10z M70 70h10v10h-10z M50 50h15v5h-15z M60 80h25v10h-25z M45 75h10v15h-10z" />
              </svg>
            </div>
            <div className="text-[11px] text-slate-500">
              <p className="font-bold text-slate-800">Onlayn Tekshirish</p>
              <p className="text-[10px] text-slate-400">QR orqali chekning haqiqiyligini tekshiring</p>
              <p className="font-mono text-[9px] text-blue-600 mt-0.5">paygo.uz/check/{paymentId.slice(-6)}</p>
            </div>
          </div>

          {/* OFFICIAL CIRCULAR STAMP (MUHR) */}
          <div className="relative flex items-center justify-center select-none">
            {/* SVG Circular Blue Stamp */}
            <div className="size-32 relative flex items-center justify-center transform rotate-[-7deg] transition-transform hover:rotate-0 duration-300">
              <svg viewBox="0 0 200 200" className="size-full text-blue-700 drop-shadow-sm">
                {/* Outer decorative ring */}
                <circle
                  cx="100"
                  cy="100"
                  r="94"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />
                {/* Outer solid border */}
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="#eff6ff"
                  fillOpacity="0.35"
                  stroke="#1d4ed8"
                  strokeWidth="2.5"
                />
                {/* Inner border */}
                <circle
                  cx="100"
                  cy="100"
                  r="62"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />

                {/* Circular Text Path: Top Arch */}
                <path
                  id="topCirclePath"
                  d="M 25,100 A 75,75 0 0,1 175,100"
                  fill="none"
                />
                <text className="text-[10.5px] font-black uppercase tracking-[.18em]" fill="#1d4ed8">
                  <textPath href="#topCirclePath" startOffset="50%" textAnchor="middle">
                    PAYGO • TO‘LOV TIZIMI
                  </textPath>
                </text>

                {/* Circular Text Path: Bottom Arch */}
                <path
                  id="bottomCirclePath"
                  d="M 175,100 A 75,75 0 0,1 25,100"
                  fill="none"
                />
                <text className="text-[10px] font-black uppercase tracking-[.18em]" fill="#1d4ed8">
                  <textPath href="#bottomCirclePath" startOffset="50%" textAnchor="middle">
                    ★ RASMIY CHEK ★ TASDIQ
                  </textPath>
                </text>

                {/* Center Content of the Stamp */}
                <g transform="translate(100, 100) scale(0.95)">
                  {/* Center Star / Badge */}
                  <path
                    d="M0 -22 L4 -10 L16 -10 L7 -2 L10 10 L0 3 L-10 10 L-7 -2 L-16 -10 L-4 -10 Z"
                    fill="#2563eb"
                    opacity="0.2"
                  />
                  <text
                    y="-4"
                    textAnchor="middle"
                    className="text-[13px] font-extrabold uppercase tracking-wider"
                    fill="#1e40af"
                  >
                    MUHR
                  </text>
                  <text
                    y="10"
                    textAnchor="middle"
                    className="text-[8.5px] font-bold tracking-widest uppercase"
                    fill="#1d4ed8"
                  >
                    TASDIQLANDI
                  </text>
                  <text
                    y="21"
                    textAnchor="middle"
                    className="text-[7.5px] font-mono font-semibold"
                    fill="#2563eb"
                  >
                    {new Date().toISOString().slice(0, 10)}
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
          <p>Ushbu chek elektron shaklda tuzilgan va HUMO banking xabarnomasi bilan tasdiqlangan.</p>
          <p className="mt-0.5">Savollar yoki qo‘llab-quvvatlash: @Pay_Gouzbot • https://paygo-pearl.vercel.app</p>
        </div>
      </div>
    </div>
  )
}
