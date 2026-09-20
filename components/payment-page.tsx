'use client'

import { useEffect, useState } from 'react'
import {
  Clock3,
  Copy,
  Check,
  ShieldCheck,
  CreditCard,
  Building2,
  User,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  FileText,
  Printer,
  Download,
  Eye,
  EyeOff,
  Bell,
  QrCode,
  Wallet,
  ChevronRight,
  Zap,
  ArrowRight,
  Smartphone,
  Globe,
  Home,
  MoreHorizontal,
  ArrowUpRight,
  Plus,
  BadgeCheck,
  Radio,
  Layers,
} from 'lucide-react'
import Link from 'next/link'
import { HumoLogo, UzcardLogo, PayGoLogo, PaymeLogo, ClickLogo, UzumBankLogo } from '@/components/brand-logos'

type PaymentData = {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired'
  isTest?: boolean
  expiresAt: string
  matchedAt?: string
  siteLogo?: string | null
  returnUrl?: string | null
  shop: {
    id: string
    name: string
    cardNumber: string
    cardLast4: string
    cardBank: string
    accountOwner: string
    logoUrl?: string | null
  }
}

function formatCardNumber(card: string): string {
  const clean = card.replace(/\D/g, '')
  if (!clean) return '9860 1666 5523 8557'
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount)
}

export function PaymentPage({ paymentId }: { paymentId: string }) {
  const [data, setData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(300)
  const [copiedCard, setCopiedCard] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [showAmount, setShowAmount] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [simulationResult, setSimulationResult] = useState<string | null>(null)
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [siteLogoError, setSiteLogoError] = useState(false)
  const [extending, setExtending] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [appRedirectToast, setAppRedirectToast] = useState<string | null>(null)

  const handleExtendTime = async () => {
    setExtending(true)
    try {
      const res = await fetch(`/api/pay/${paymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend' }),
      })
      if (res.ok) {
        await fetchPayment()
      }
    } catch (err) {
      console.warn('Extend error:', err)
    } finally {
      setExtending(false)
    }
  }

  // Auto-redirect to returnUrl on successful payment
  const hasAdBanner = true
  const initialRedirectDelay = hasAdBanner ? 3 : 1

  useEffect(() => {
    if (data?.status === 'paid' && data?.returnUrl) {
      setRedirectCountdown(initialRedirectDelay)
      const interval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev === null) return initialRedirectDelay
          if (prev <= 1) {
            window.location.href = data.returnUrl!
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [data?.status, data?.returnUrl, initialRedirectDelay])

  // Fetch payment data
  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/pay/${paymentId}`)
      if (res.ok) {
        const json: PaymentData = await res.json()
        setData(json)
        setFetchError(null)
        if (json.expiresAt) {
          const diff = Math.max(
            0,
            Math.floor((new Date(json.expiresAt).getTime() - Date.now()) / 1000)
          )
          setSeconds(diff)
        }
      } else {
        const errJson = await res.json().catch(() => ({}))
        if (!data) {
          setFetchError(errJson.error === 'payment_not_found' ? 'To‘lov topilmadi' : (errJson.error || 'Yuklab bo‘lmadi'))
        }
      }
    } catch (err) {
      console.warn('Payment fetch error:', err)
      if (!data) {
        setFetchError('Server bilan aloqa uzildi')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayment()
    const interval = setInterval(fetchPayment, 2500)
    return () => clearInterval(interval)
  }, [paymentId])

  // Timer countdown
  useEffect(() => {
    if (data?.status !== 'pending' || seconds <= 0) return
    const timer = setInterval(() => {
      setSeconds((val) => {
        if (val <= 1) {
          fetchPayment()
          return 0
        }
        return val - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [seconds, data?.status])

  const copyToClipboard = (text: string, type: 'card' | 'amount') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
    if (type === 'card') {
      setCopiedCard(true)
      setTimeout(() => setCopiedCard(false), 2000)
    } else {
      setCopiedAmount(true)
      setTimeout(() => setCopiedAmount(false), 2000)
    }
  }

  const handleOpenPaymentApp = (appName: string, url: string) => {
    const rawCard = (data?.shop?.cardNumber || '9860166655238557').replace(/\D/g, '')
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(rawCard)
    }
    setAppRedirectToast(`Karta (${rawCard}) nusxalandi! ${appName} ga o‘tilmoqda...`)
    setTimeout(() => {
      setAppRedirectToast(null)
    }, 4000)

    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      window.location.href = url
    }
  }

  // Simulate instant payment for testing
  const handleSimulatePayment = async () => {
    setSimulating(true)
    setSimulationResult(null)
    try {
      const res = await fetch(`/api/pay/${paymentId}`, {
        method: 'POST',
      })
      const json = await res.json()
      if (res.ok) {
        setSimulationResult('To‘lov tasdiqlandi! Webhook va Kanalga JSON yuborildi.')
        fetchPayment()
      } else {
        setSimulationResult(json.error || 'Xatolik yuz berdi')
      }
    } catch {
      setSimulationResult('Server bilan aloqa xatosi')
    } finally {
      setSimulating(false)
    }
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[#040812] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c1f44] via-[#060e1d] to-[#040711] flex flex-col items-center justify-center px-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 border-3 border-[#0066ff] border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-500/20" />
          <p className="text-xs font-semibold text-slate-400 font-mono tracking-wider">PAYGO SECURE REKVIZITLARI YUKLANMOQDA...</p>
        </div>
      </main>
    )
  }

  if (fetchError && !data) {
    return (
      <main className="min-h-screen bg-[#040812] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c1f44] via-[#060e1d] to-[#040711] flex flex-col items-center justify-center px-4 text-white">
        <div className="max-w-md w-full bg-[#0a1428] rounded-3xl p-8 border border-red-900/40 shadow-2xl text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-red-950/80 border border-red-500/40 text-red-400">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">To‘lov topilmadi</h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Ushbu to‘lov identifikatori ({paymentId}) bazada mavjud emas yoki muddati tugab arxivlangan.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setLoading(true)
                fetchPayment()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-5 py-3 text-xs font-bold text-white hover:bg-blue-600 transition shadow-lg shadow-blue-600/30"
            >
              <RefreshCw size={14} /> Qayta tekshirish
            </button>
            <Link
              href="/panel"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <ArrowLeft size={14} /> Veb-panelga qaytish
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const cardNumber = data?.shop?.cardNumber || '9860166655238557'
  const formattedCard = formatCardNumber(cardNumber)
  const cardOwner = data?.shop?.accountOwner || 'SARDOR T'
  const shopName = data?.shop?.name || 'HUMO To‘lov Xizmati'
  const amountNumber = data?.amount ?? 99000
  const isPaid = data?.status === 'paid'
  const isExpired = data?.status === 'expired' || seconds <= 0

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <main className="min-h-screen bg-[#040812] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c1f44] via-[#060e1d] to-[#040711] px-3.5 sm:px-6 py-6 text-white antialiased font-sans selection:bg-blue-600 selection:text-white">
      <div className="mx-auto max-w-xl space-y-4 sm:space-y-5">

        {/* 1. BRAND HEADER (TOP BAR) */}
        <header className="flex items-center justify-between gap-3 bg-[#0a1428]/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-blue-900/40 shadow-xl shadow-blue-950/20">
          {/* Left: PayGo Secure Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 p-0.5 shadow-lg shadow-blue-500/25 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" fill="none" className="size-6">
                <path d="M7 6C7 4.89543 7.89543 4 9 4H18C22.4183 4 26 7.58172 26 12C26 16.4183 22.4183 20 18 20H13V26C13 27.1046 12.1046 28 11 28H9C7.89543 28 7 27.1046 7 26V6Z" fill="white" />
                <path d="M13 10H18C19.1046 10 20 10.8954 20 12C20 13.1046 19.1046 14 18 14H13V10Z" fill="#1e3a8a" />
                <path d="M19 16L25 24H20L18 27L21 21H16L19 16Z" fill="#38bdf8" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-black tracking-widest text-sky-400 uppercase">
                  PAYGO <span className="text-white">SECURE</span>
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 truncate">
                Xavfsiz to‘lovlar, siz bilan
              </p>
            </div>
          </div>

          {/* Right: User / Shop Profile Badge */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-[#0e1c38]/90 border border-blue-800/40 px-2.5 py-1.5 shadow-inner">
              <div className="size-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                {shopName.charAt(0) || 'Y'}
              </div>
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-100 max-w-[90px] truncate">{shopName}</span>
                  <BadgeCheck size={13} className="text-sky-400 fill-sky-400/20" />
                </div>
                <p className="text-[9.5px] font-mono text-slate-400">ID: {paymentId.slice(0, 8)}</p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(!showGuide)}
              title="Qo‘llanma va xabarlar"
              className="relative rounded-xl p-2 bg-[#0e1c38] border border-blue-900/50 text-slate-300 hover:text-white hover:bg-blue-900/40 transition"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-400 animate-ping" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-400" />
            </button>
          </div>
        </header>

        {/* 2. APP REDIRECT TOAST NOTIFICATION */}
        {appRedirectToast && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-[#0a2e1d] border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xl shadow-emerald-950/40 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2">
              <Check size={15} className="text-emerald-400" />
              <span>{appRedirectToast}</span>
            </div>
            <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold">Avto-nusxa</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATUS 1: SUCCESS / PAID STATE */}
        {/* ========================================================================= */}
        {isPaid ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-[#091824]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 size={38} className="animate-in zoom-in-75 duration-300" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              To‘lov muvaffaqiyatli qabul qilindi!
            </h1>
            <p className="mt-1.5 text-xs text-slate-300">
              HUMO / UZCARD to‘lovi avtomatik tarzda tasdiqlandi va merchantga yuborildi.
            </p>

            {/* Receipt Summary Card */}
            <div className="mt-6 rounded-2xl bg-[#06101c] p-5 text-left border border-emerald-900/40 relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-90 pointer-events-none transform rotate-[-6deg]">
                <div className="size-20 rounded-full border-2 border-dashed border-emerald-500/80 flex flex-col items-center justify-center p-1 text-center bg-emerald-950/40">
                  <span className="text-[7px] font-black text-emerald-400 tracking-wider">PAYGO</span>
                  <span className="text-[9px] font-extrabold text-emerald-300 uppercase">MUHR</span>
                  <span className="text-[6.5px] font-bold text-emerald-400">TASDIQLANDI</span>
                </div>
              </div>

              <div className="space-y-2.5 pr-16 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>To‘lov summasi:</span>
                  <b className="text-sm font-bold text-white font-mono">
                    {formatAmount(amountNumber)} UZS
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>Karta:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formattedCard}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Karta egasi:</span>
                  <span className="font-medium text-slate-200">{cardOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span>Holati:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Check size={13} /> Muvaffaqiyatli
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>To‘lov ID:</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {paymentId}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: PDF Chek & Navigation */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={`/pay/${paymentId}/receipt`}
                target="_blank"
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 py-3.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-sky-400 transition active:scale-98"
              >
                <FileText size={16} />
                <span>📥 Rasmiy Chekni Yuklab Olish (PDF)</span>
              </Link>

              <div className="flex gap-2.5">
                <button
                  onClick={() => window.open(`/pay/${paymentId}/receipt`, '_blank')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                >
                  <Printer size={14} /> Chop etish
                </button>
                {data?.returnUrl ? (
                  <a
                    href={data.returnUrl}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                  >
                    <ArrowLeft size={14} /> Do‘konga qaytish
                  </a>
                ) : (
                  <Link
                    href="/"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                  >
                    <ArrowLeft size={14} /> Bosh sahifa
                  </Link>
                )}
              </div>

              {redirectCountdown !== null && (
                <p className="text-[11px] text-sky-400 font-medium text-center mt-2 animate-pulse">
                  ⏱ {redirectCountdown} soniyadan so‘ng avtomatik tarzda do‘konga qaytasiz...
                </p>
              )}
            </div>
          </div>
        ) : isExpired ? (
          /* ========================================================================= */
          /* STATUS 2: EXPIRED STATE */
          /* ========================================================================= */
          <div className="rounded-3xl border border-red-900/40 bg-[#0a1220]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-red-950/80 border border-red-500/40 text-red-400 shadow-xl shadow-red-950/40">
              <AlertCircle size={36} />
            </div>
            <h1 className="text-2xl font-bold text-white">
              To‘lov muddati tugadi
            </h1>
            <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              To‘lov havolasining xavfsizlik vaqti yakunlangan. Quyidagi tugma orqali to‘lov vaqtini uzaytirib, jarayonni xavfsiz davom ettirishingiz mumkin.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={handleExtendTime}
                disabled={extending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 transition disabled:opacity-50"
              >
                <RefreshCw size={15} className={extending ? 'animate-spin' : ''} />
                {extending ? 'Vaqt uzaytirilmoqda...' : 'To‘lov vaqtini 1 soatga uzaytirish'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                <RefreshCw size={14} /> Qayta tekshirish
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition py-1"
              >
                <ArrowLeft size={14} /> Bosh sahifaga qaytish
              </Link>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STATUS 3: PENDING PAYMENT (MATCHING USER MOCKUP PERFECTLY) */
          /* ========================================================================= */
          <div className="space-y-4">

            {/* 3. ASOSIY BALANS / TO'LOV SUMMASI CARD */}
            <div className="rounded-3xl border border-blue-900/40 bg-[#091428]/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Amount & Security */}
                <div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                    <span>Asosiy to‘lov</span>
                    <button
                      onClick={() => setShowAmount(!showAmount)}
                      className="text-slate-400 hover:text-sky-400 transition"
                      title={showAmount ? 'Summani yashirish' : 'Summani ko‘rsatish'}
                    >
                      {showAmount ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
                      {showAmount ? formatAmount(amountNumber) : '••••••'}{' '}
                      <span className="text-lg font-bold text-slate-400">UZS</span>
                    </h1>
                    <button
                      onClick={() => copyToClipboard(String(amountNumber), 'amount')}
                      title="Summani nusxalash"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-950 hover:text-sky-400 transition"
                    >
                      {copiedAmount ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-950/80 border border-blue-800/50 px-3 py-1 text-[11px] font-medium text-slate-300">
                    <ShieldCheck size={13} className="text-sky-400" />
                    <span>Hisobingiz xavfsiz</span>
                    <Check size={12} className="text-sky-400" />
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#0066ff] hover:bg-[#0052cc] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition active:scale-98"
                  >
                    <Plus size={15} />
                    <span>Tez to‘lov</span>
                  </button>

                  <button
                    onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#0e1c38] hover:bg-[#13274e] border border-blue-900/60 px-5 py-2.5 text-xs font-bold text-slate-200 transition active:scale-98"
                  >
                    <ArrowUpRight size={14} className="text-sky-400" />
                    <span>Pul o‘tkazish</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. REALISTIC METALLIC DEBIT CARD + SIDE ACTION PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Metallic Card Mockup */}
              <div className="md:col-span-8 rounded-3xl bg-gradient-to-br from-[#0c2452] via-[#103478] to-[#091a3b] border border-blue-500/40 p-5 sm:p-6 shadow-2xl shadow-blue-950/50 relative overflow-hidden flex flex-col justify-between min-h-[210px]">
                {/* Subtle card sheen reflections */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-400/15 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -right-10 -bottom-10 size-48 rounded-full bg-blue-600/10 blur-2xl pointer-events-none" />

                {/* Card Top: Brand & Network Logos */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-white/10 backdrop-blur-xs flex items-center justify-center">
                      <span className="font-black text-xs text-sky-300">P</span>
                    </div>
                    <span className="font-mono text-xs font-extrabold tracking-widest text-white uppercase">
                      PAYGO CARD
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-black/30 backdrop-blur-xs rounded-xl px-2.5 py-1 border border-white/10">
                    <UzcardLogo className="h-4.5 w-auto" />
                    <div className="w-px h-3 bg-white/20" />
                    <HumoLogo className="h-4.5 w-auto" />
                  </div>
                </div>

                {/* EMV Gold Circuit Chip */}
                <div className="my-4 relative z-10 flex items-center justify-between">
                  <div className="w-10 h-7 rounded-lg bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-300/80 shadow-md flex items-center justify-center relative overflow-hidden">
                    <div className="w-full h-[1px] bg-amber-700/50 absolute top-2.5"></div>
                    <div className="w-full h-[1px] bg-amber-700/50 absolute bottom-2.5"></div>
                    <div className="h-full w-[1px] bg-amber-700/50 absolute left-3"></div>
                    <div className="h-full w-[1px] bg-amber-700/50 absolute right-3"></div>
                    <Radio size={12} className="text-amber-900/60" />
                  </div>

                  <span className="text-[10px] font-mono uppercase tracking-widest text-sky-200/80 font-bold bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-sky-400/20">
                    ONLINE REKVIZIT
                  </span>
                </div>

                {/* Full 16-Digit Card Number */}
                <div className="relative z-10">
                  <p className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-white select-all drop-shadow-md">
                    {formattedCard}
                  </p>
                </div>

                {/* Card Holder & Expiry */}
                <div className="mt-4 flex items-center justify-between relative z-10 pt-2 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-sky-300" />
                    <span className="font-bold tracking-wider text-slate-100 uppercase">{cardOwner}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[8.5px] uppercase tracking-wider text-sky-200/70 font-semibold leading-none">VALID THRU</p>
                    <p className="font-mono font-bold text-slate-100 text-[11px] mt-0.5">12/28</p>
                  </div>
                </div>
              </div>

              {/* Side Quick Actions */}
              <div className="md:col-span-4 flex flex-col justify-between gap-2.5">
                {/* Copy Card Button */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(cardNumber.replace(/\s/g, ''), 'card')}
                  className="flex-1 flex flex-col items-center justify-center p-4 rounded-3xl bg-[#091428]/90 border border-blue-900/50 hover:border-blue-500/60 hover:bg-[#0d1d3a] transition text-center shadow-xl group active:scale-98"
                >
                  <div className="size-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 grid place-items-center text-sky-400 group-hover:scale-105 transition mb-2">
                    {copiedCard ? <Check size={20} className="text-emerald-400" /> : <QrCode size={20} />}
                  </div>
                  <p className="text-xs font-bold text-white">
                    {copiedCard ? 'Nusxalandi! ✅' : 'Karta raqamini nusxalash'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">1 marta bosish bilan</p>
                </button>

                {/* Card Network Switcher / Info */}
                <div className="p-4 rounded-3xl bg-[#091428]/90 border border-blue-900/50 flex items-center justify-between shadow-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-blue-950/80 border border-blue-800/60 grid place-items-center text-sky-400">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{data?.shop?.cardBank || 'HUMOCARD'}</p>
                      <p className="text-[10px] text-emerald-400 font-semibold">Faol qabul qiluvchi</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
              </div>
            </div>

            {/* 5. QUICK 6-CATEGORY ACTION ROW */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <Zap size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">To‘lov</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <ArrowRight size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">O‘tkazma</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <Smartphone size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">Mobil aloqa</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <Globe size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">Internet</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Uzum Bank', 'https://uzumbank.uz')}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <Home size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">Kommunal</span>
              </button>

              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#091428]/80 border border-blue-900/40 hover:border-blue-500/50 hover:bg-[#0e1d38] transition active:scale-95"
              >
                <div className="size-8 rounded-xl bg-blue-600/20 text-sky-400 grid place-items-center mb-1.5">
                  <MoreHorizontal size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-200">Boshqalar</span>
              </button>
            </div>

            {/* 6. TO'LOV XIZMATLARI (DIRECT FINTECH APPS GRID) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-sky-400" />
                  <h3 className="text-xs font-bold text-slate-100">To‘lov xizmatlari</h3>
                </div>
                <button
                  onClick={() => setShowGuide(true)}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <span>Barchasi</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Payme Card */}
                <button
                  type="button"
                  onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                  className="flex flex-col justify-between p-3.5 rounded-2xl bg-[#091428]/90 border border-blue-900/40 hover:border-sky-400/50 hover:bg-[#0e1d38] transition text-left group shadow-lg min-h-[105px] active:scale-98"
                >
                  <div className="flex items-center justify-between w-full">
                    <PaymeLogo className="h-6 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className="text-xs font-bold text-white">Payme</p>
                      <p className="text-[10px] text-slate-400">Tez va qulay</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>

                {/* Click Card */}
                <button
                  type="button"
                  onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                  className="flex flex-col justify-between p-3.5 rounded-2xl bg-[#091428]/90 border border-blue-900/40 hover:border-sky-400/50 hover:bg-[#0e1d38] transition text-left group shadow-lg min-h-[105px] active:scale-98"
                >
                  <div className="flex items-center justify-between w-full">
                    <ClickLogo className="h-6 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className="text-xs font-bold text-white">Click</p>
                      <p className="text-[10px] text-slate-400">Oson to‘lovlar</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>

                {/* Uzum Bank Card */}
                <button
                  type="button"
                  onClick={() => handleOpenPaymentApp('Uzum Bank', 'https://uzumbank.uz')}
                  className="flex flex-col justify-between p-3.5 rounded-2xl bg-[#091428]/90 border border-blue-900/40 hover:border-sky-400/50 hover:bg-[#0e1d38] transition text-left group shadow-lg min-h-[105px] active:scale-98"
                >
                  <div className="flex items-center justify-between w-full">
                    <UzumBankLogo className="h-6 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className="text-xs font-bold text-white">Uzum Bank</p>
                      <p className="text-[10px] text-slate-400">Bank xizmatlari</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>

                {/* Anorbank / Beeline / Boshqa */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(cardNumber.replace(/\s/g, ''), 'card')}
                  className="flex flex-col justify-between p-3.5 rounded-2xl bg-[#091428]/90 border border-blue-900/40 hover:border-sky-400/50 hover:bg-[#0e1d38] transition text-left group shadow-lg min-h-[105px] active:scale-98"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="size-7 rounded-xl bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold text-xs">
                      B
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className="text-xs font-bold text-white">Bank ilovasi</p>
                      <p className="text-[10px] text-slate-400">Karta o‘tkazmasi</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 7. PROMO FEATURE BANNER (PAYGO CARD) */}
            <div className="rounded-3xl border border-blue-800/40 bg-gradient-to-r from-[#0b1938] via-[#0f2552] to-[#0a162e] p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 p-0.5 shadow-lg shadow-blue-500/20 shrink-0 flex items-center justify-center">
                  <div className="size-full rounded-[14px] bg-[#091428] flex items-center justify-center text-sky-400">
                    <Wallet size={22} />
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 rounded-md bg-blue-950/80 border border-blue-700/40 px-2 py-0.5 text-[9.5px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                    YANGILIK
                  </div>
                  <h4 className="text-xs font-bold text-white">PayGo Card — endi yanada qulay!</h4>
                  <p className="text-[10.5px] text-slate-400">Kartangiz orqali tez va xavfsiz to‘lov qiling.</p>
                </div>
              </div>

              <button
                onClick={() => setShowPromoModal(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition shrink-0 shadow-md shadow-blue-600/30"
              >
                <span>Batafsil</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* 8. TIMER & REAL-TIME STATUS CHECK BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Timer Pill */}
              <div className="sm:col-span-5 flex items-center justify-between rounded-2xl bg-[#091428]/90 border border-blue-900/40 px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Clock3 size={15} className="text-sky-400" />
                  <span>To‘lov uchun vaqt:</span>
                </div>
                <span className="font-mono text-sm font-extrabold text-sky-400 tracking-wider">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </div>

              {/* Instant Verification Button */}
              <button
                onClick={fetchPayment}
                className="sm:col-span-7 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0052cc] hover:from-blue-500 hover:to-blue-600 py-3 px-4 text-xs font-bold text-white shadow-xl shadow-blue-600/25 transition active:scale-98"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                <span>To‘lov qilinganini tekshirish</span>
              </button>
            </div>

            {/* 9. TEST PAYMENT SIMULATION (ONLY IN TEST MODE) */}
            {data?.isTest && (
              <div className="rounded-3xl border border-dashed border-sky-400/40 bg-blue-950/40 p-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-sky-400" />
                  <span className="text-xs font-bold text-sky-300">
                    Test To‘lov Rejimi (Simulyatsiya):
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                  Ushbu to‘lov test rejimida yaratilgan. Haqiqiy pul o‘tkazmasdan to‘lovni sinab ko‘rish va Webhook / Telegram Kanalga JSON yuborilishini tekshirish uchun bosing:
                </p>
                <button
                  onClick={handleSimulatePayment}
                  disabled={simulating}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-500 hover:to-sky-400 transition disabled:opacity-50"
                >
                  {simulating ? 'Tasdiqlanmoqda...' : '⚡️ Test To‘lovni Tasdiqlash (Simulyatsiya)'}
                </button>
                {simulationResult && (
                  <p className="mt-2 text-center text-xs font-medium text-emerald-400">
                    {simulationResult}
                  </p>
                )}
              </div>
            )}

            {/* 10. INSTRUCTION ACCORDION CARD */}
            <div className="rounded-3xl border border-blue-900/40 bg-[#091428]/90 p-4 sm:p-5 shadow-xl">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-blue-950/90 border border-blue-800/60 grid place-items-center text-sky-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">To‘lov bo‘yicha qo‘llanma:</h4>
                    <p className="text-[10px] text-slate-400">3 qadamda xavfsiz to‘lov</p>
                  </div>
                </div>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${showGuide ? 'rotate-90' : ''}`} />
              </button>

              {(showGuide || true) && (
                <div className="mt-3.5 pt-3.5 border-t border-blue-900/40 space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-sky-400 font-mono">1.</span>
                    <span><b>Payme, Click, Uzum Bank</b> tugmasini bosing yoki bank ilovangizni oching.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-sky-400 font-mono">2.</span>
                    <span>Yuqoridagi <b className="text-white font-mono">{formattedCard}</b> kartasiga aynan <b className="text-sky-300 font-mono">{formatAmount(amountNumber)} UZS</b> o‘tkazing.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-sky-400 font-mono">3.</span>
                    <span>Userbot <b>@humocardbot</b> xabarini o‘qishi bilanoq ushbu sahifa 1-3 soniyada avtomatik tasdiqlanadi.</span>
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 11. FOOTER BRANDING */}
        <footer className="pt-2 pb-4 text-center">
          <p className="font-mono text-[11px] text-slate-500">
            To‘lov ID: {paymentId} • PayGo Secure Infrastructure v2.4
          </p>
        </footer>

      </div>

      {/* PROMO / INFO MODAL */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowPromoModal(false)} className="fixed inset-0 bg-black/80 backdrop-blur-xs" />
          <div className="relative w-full max-w-md rounded-3xl bg-[#0a1428] border border-blue-800/50 p-6 shadow-2xl z-50 text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/50 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-blue-600 text-white grid place-items-center">
                  <Wallet size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">PayGo Secure To‘lov Tizimi</h3>
              </div>
              <button onClick={() => setShowPromoModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>PayGo to‘lov tizimi orqali har bir to‘lov bank xabarnomalari (HUMO/UZCARD) orqali avtomatlashtirilgan tarzda o‘qiladi.</p>
              <div className="p-3 rounded-2xl bg-[#060e1d] border border-blue-900/50 space-y-1.5">
                <p className="text-sky-400 font-bold">Qulayliklar:</p>
                <p>• 100% avtomatik tekshiruv (1-3 soniyada)</p>
                <p>• Barcha bank kartalari qo‘llab-quvvatlanadi</p>
                <p>• Rasmiy PDF chek yaratish va chop etish</p>
              </div>
            </div>
            <button
              onClick={() => setShowPromoModal(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
            >
              Tushundim
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
