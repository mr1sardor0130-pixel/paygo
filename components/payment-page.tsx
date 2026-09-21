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
  Palette,
  Crown,
  Share2,
  Shield,
  Star,
  Flame,
} from 'lucide-react'
import Link from 'next/link'
import { HumoLogo, UzcardLogo, PayGoLogo, PaymeLogo, ClickLogo, UzumBankLogo } from '@/components/brand-logos'
import { PAYMENT_THEMES, PaymentTheme, getPaymentTheme } from '@/lib/payment-themes'

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
  merchantUser?: {
    telegramId?: string
    name?: string
    tier?: string
    image?: string
  } | null
  shop: {
    id: string
    name: string
    cardNumber: string
    cardLast4: string
    cardBank: string
    accountOwner: string
    logoUrl?: string | null
    tier?: string
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
  const [extending, setExtending] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [overrideTheme, setOverrideTheme] = useState<string | null>(null)
  const [appRedirectToast, setAppRedirectToast] = useState<string | null>(null)

  // Load theme from query parameter if provided (for owner preview/testing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const qTheme = urlParams.get('theme')
      if (qTheme && PAYMENT_THEMES[qTheme]) {
        setOverrideTheme(qTheme)
      }
    }
  }, [])

  const currentThemeId = overrideTheme || data?.shop?.themeId || 'cyber_blue'
  const currentTheme = getPaymentTheme(currentThemeId)

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
  const initialRedirectDelay = 3

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
  }, [data?.status, data?.returnUrl])

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
  const shopId = data?.shop?.id || paymentId.slice(0, 8)
  const isShopPremium = data?.shop?.tier === 'premium' || data?.merchantUser?.tier === 'premium'
  const amountNumber = data?.amount ?? 99000
  const isPaid = data?.status === 'paid'
  const isExpired = data?.status === 'expired' || seconds <= 0

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  const themesList = Object.values(PAYMENT_THEMES)
  const filteredThemes = themesList.filter((t) => {
    if (themeFilter === 'free') return t.tier === 'free'
    if (themeFilter === 'premium') return t.tier === 'premium'
    return true
  })

  return (
    <main className={`min-h-screen ${currentTheme.bgGradient} px-3.5 sm:px-6 py-6 ${currentTheme.isDark ? 'text-white' : 'text-slate-900'} antialiased ${currentTheme.fontClass} selection:bg-blue-600 selection:text-white transition-colors duration-500`}>
      <div className="mx-auto max-w-xl space-y-4 sm:space-y-5">

        {/* 1. BRAND HEADER & USER/MERCHANT PROFILE */}
        <header className={`flex items-center justify-between gap-3 ${currentTheme.headerBg} backdrop-blur-xl px-4 py-3 rounded-2xl border ${currentTheme.headerBorder} shadow-xl`}>
          {/* Left: PayGo Secure Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <PayGoLogo className="h-9 w-auto" url={data?.siteLogo || undefined} showText={true} />
          </div>

          {/* Right: User / Shop Profile Badge + Secure Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="hidden xs:inline">Xavfsiz to‘lov</span>
            </div>

            {/* Shop & User Profile Badge */}
            <div className={`flex items-center gap-2 rounded-xl ${currentTheme.isDark ? 'bg-black/30' : 'bg-slate-100'} border ${currentTheme.headerBorder} px-2.5 py-1.5`}>
              {data?.shop?.logoUrl ? (
                <img
                  src={data.shop.logoUrl}
                  alt={shopName}
                  className="size-7 rounded-lg object-cover border border-white/20 shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className={`size-7 rounded-lg ${currentTheme.accentColor} flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0`}>
                  {shopName.charAt(0) || 'M'}
                </div>
              )}
              <div className="text-right hidden sm:block max-w-[120px]">
                <div className="flex items-center justify-end gap-1">
                  <span className={`text-xs font-bold truncate ${currentTheme.isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {shopName}
                  </span>
                  {isShopPremium ? (
                    <Crown size={12} className="text-amber-400 shrink-0" />
                  ) : (
                    <BadgeCheck size={13} className="text-sky-400 fill-sky-400/20 shrink-0" />
                  )}
                </div>
                <p className="text-[9.5px] font-mono text-slate-400 truncate">
                  ID: {shopId.slice(0, 8)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(!showGuide)}
              title="Qo‘llanma va xabarlar"
              className={`relative rounded-xl p-2 ${currentTheme.isDark ? 'bg-black/30' : 'bg-slate-100'} border ${currentTheme.headerBorder} text-slate-300 hover:text-white transition`}
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
          <div className={`rounded-3xl border border-emerald-500/30 ${currentTheme.isDark ? 'bg-[#091824]/95' : 'bg-white'} backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden`}>
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 size={38} className="animate-in zoom-in-75 duration-300" />
            </div>
            <h1 className={`text-2xl font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>
              To‘lov muvaffaqiyatli qabul qilindi!
            </h1>
            <p className="mt-1.5 text-xs text-slate-400">
              HUMO / UZCARD to‘lovi avtomatik tarzda tasdiqlandi va merchantga yetkazildi.
            </p>

            {/* Receipt Summary Card */}
            <div className={`mt-6 rounded-2xl ${currentTheme.isDark ? 'bg-[#06101c]' : 'bg-slate-50'} p-5 text-left border border-emerald-900/40 relative overflow-hidden`}>
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
                  <b className={`text-sm font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'} font-mono`}>
                    {formatAmount(amountNumber)} UZS
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>Karta:</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {formattedCard}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Karta egasi:</span>
                  <span className="font-medium text-slate-300">{cardOwner}</span>
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
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                >
                  <Printer size={14} /> Chop etish
                </button>
                {data?.returnUrl ? (
                  <a
                    href={data.returnUrl}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                  >
                    <ArrowLeft size={14} /> Do‘konga qaytish
                  </a>
                ) : (
                  <Link
                    href="/"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
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
          <div className={`rounded-3xl border border-red-900/40 ${currentTheme.isDark ? 'bg-[#0a1220]/90' : 'bg-white'} backdrop-blur-xl p-6 sm:p-8 shadow-2xl text-center`}>
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-red-950/80 border border-red-500/40 text-red-400 shadow-xl shadow-red-950/40">
              <AlertCircle size={36} />
            </div>
            <h1 className={`text-2xl font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
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
          /* STATUS 3: PENDING PAYMENT */
          /* ========================================================================= */
          <div className="space-y-4">

            {/* 3. ASOSIY BALANS / TO'LOV SUMMASI CARD */}
            <div className={`rounded-3xl border ${currentTheme.amountCardBorder} ${currentTheme.amountCardBg} backdrop-blur-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Amount & Security */}
                <div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                    <span>Asosiy to‘lov</span>
                    <button
                      onClick={() => setShowAmount(!showAmount)}
                      className={`hover:${currentTheme.accentText} transition`}
                      title={showAmount ? 'Summani yashirish' : 'Summani ko‘rsatish'}
                    >
                      {showAmount ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
                    <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${currentTheme.isDark ? 'text-white' : 'text-slate-900'} font-mono`}>
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

                  <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full ${currentTheme.isDark ? 'bg-black/40' : 'bg-slate-100'} border ${currentTheme.headerBorder} px-3 py-1 text-[11px] font-medium text-slate-300`}>
                    <ShieldCheck size={13} className={currentTheme.accentText} />
                    <span className={currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'}>Hisobingiz xavfsiz</span>
                    <Check size={12} className={currentTheme.accentText} />
                  </div>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                    className={`flex items-center justify-center gap-2 rounded-2xl ${currentTheme.actionBtnBg} px-5 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-98`}
                  >
                    <Plus size={15} />
                    <span>Tez to‘lov</span>
                  </button>

                  <button
                    onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                    className={`flex items-center justify-center gap-2 rounded-2xl ${currentTheme.quickBtnBg} ${currentTheme.quickBtnHover} border ${currentTheme.quickBtnBorder} px-5 py-2.5 text-xs font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-700'} transition active:scale-98`}
                  >
                    <ArrowUpRight size={14} className={currentTheme.accentText} />
                    <span>Pul o‘tkazish</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. REALISTIC METALLIC DEBIT CARD + SIDE ACTION PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Metallic Card Mockup */}
              <div className={`md:col-span-8 rounded-3xl ${currentTheme.cardGradient} border ${currentTheme.cardBorder} p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[215px]`}>
                {/* Subtle card sheen reflections */}
                <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${currentTheme.cardSheen} pointer-events-none`} />

                {/* Card Top: Brand & Network Logos (Pristine High-Definition Badges) */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-md bg-white/15 backdrop-blur-xs flex items-center justify-center">
                      <span className="font-black text-xs text-white">P</span>
                    </div>
                    <span className="font-mono text-xs font-extrabold tracking-widest text-white uppercase">
                      PAYGO CARD
                    </span>
                  </div>

                  {/* Pristine Humo & Uzcard Vector Badges */}
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xs rounded-xl p-1 border border-white/15">
                    <UzcardLogo className="h-5 w-auto" />
                    <div className="w-px h-3 bg-white/25" />
                    <HumoLogo className="h-5 w-auto" />
                  </div>
                </div>

                {/* EMV Gold Circuit Chip */}
                <div className="my-4 relative z-10 flex items-center justify-between">
                  <div className={`w-10 h-7 rounded-lg bg-gradient-to-tr ${currentTheme.cardChipBg} shadow-md flex items-center justify-center relative overflow-hidden`}>
                    <div className="w-full h-[1px] bg-amber-700/50 absolute top-2.5"></div>
                    <div className="w-full h-[1px] bg-amber-700/50 absolute bottom-2.5"></div>
                    <div className="h-full w-[1px] bg-amber-700/50 absolute left-3"></div>
                    <div className="h-full w-[1px] bg-amber-700/50 absolute right-3"></div>
                    <Radio size={12} className="text-amber-900/70" />
                  </div>

                  <span className="text-[9.5px] font-mono uppercase tracking-widest text-white/90 font-bold bg-black/40 px-2.5 py-0.5 rounded-full border border-white/20">
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
                <div className="mt-4 flex items-center justify-between relative z-10 pt-2 border-t border-white/15 text-xs text-white">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-white/80" />
                    <span className="font-bold tracking-wider uppercase">{cardOwner}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[8.5px] uppercase tracking-wider text-white/70 font-semibold leading-none">VALID THRU</p>
                    <p className="font-mono font-bold text-[11px] mt-0.5">12/28</p>
                  </div>
                </div>
              </div>

              {/* Side Quick Actions */}
              <div className="md:col-span-4 flex flex-col justify-between gap-2.5">
                {/* Copy Card Button */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(cardNumber.replace(/\s/g, ''), 'card')}
                  className={`flex-1 flex flex-col items-center justify-center p-4 rounded-3xl ${currentTheme.amountCardBg} border ${currentTheme.amountCardBorder} hover:border-blue-500/60 transition text-center shadow-xl group active:scale-98`}
                >
                  <div className={`size-10 rounded-2xl ${currentTheme.isDark ? 'bg-black/40' : 'bg-slate-100'} border ${currentTheme.headerBorder} grid place-items-center ${currentTheme.accentText} group-hover:scale-105 transition mb-2`}>
                    {copiedCard ? <Check size={20} className="text-emerald-400" /> : <QrCode size={20} />}
                  </div>
                  <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>
                    {copiedCard ? 'Nusxalandi! ✅' : 'Karta raqamini nusxalash'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">1 marta bosish bilan</p>
                </button>

                {/* Card Network Switcher / Info */}
                <div className={`p-4 rounded-3xl ${currentTheme.amountCardBg} border ${currentTheme.amountCardBorder} flex items-center justify-between shadow-xl`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`size-9 rounded-xl ${currentTheme.isDark ? 'bg-black/40' : 'bg-slate-100'} border ${currentTheme.headerBorder} grid place-items-center ${currentTheme.accentText}`}>
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>{data?.shop?.cardBank || 'HUMOCARD'}</p>
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
                className={`flex flex-col items-center justify-center p-3 rounded-2xl ${currentTheme.quickBtnBg} border ${currentTheme.quickBtnBorder} ${currentTheme.quickBtnHover} transition active:scale-95`}
              >
                <div className={`size-8 rounded-xl bg-blue-600/20 ${currentTheme.accentText} grid place-items-center mb-1.5`}>
                  <Zap size={16} />
                </div>
                <span className={`text-[11px] font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>To‘lov</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl ${currentTheme.quickBtnBg} border ${currentTheme.quickBtnBorder} ${currentTheme.quickBtnHover} transition active:scale-95`}
              >
                <div className={`size-8 rounded-xl bg-blue-600/20 ${currentTheme.accentText} grid place-items-center mb-1.5`}>
                  <ArrowRight size={16} />
                </div>
                <span className={`text-[11px] font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>O‘tkazma</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl ${currentTheme.quickBtnBg} border ${currentTheme.quickBtnBorder} ${currentTheme.quickBtnHover} transition active:scale-95`}
              >
                <div className={`size-8 rounded-xl bg-blue-600/20 ${currentTheme.accentText} grid place-items-center mb-1.5`}>
                  <Smartphone size={16} />
                </div>
                <span className={`text-[11px] font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>Mobil aloqa</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Click', 'https://my.click.uz')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl ${currentTheme.quickBtnBg} border ${currentTheme.quickBtnBorder} ${currentTheme.quickBtnHover} transition active:scale-95`}
              >
                <div className={`size-8 rounded-xl bg-blue-600/20 ${currentTheme.accentText} grid place-items-center mb-1.5`}>
                  <Globe size={16} />
                </div>
                <span className={`text-[11px] font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>Internet</span>
              </button>

              <button
                onClick={() => handleOpenPaymentApp('Uzum Bank', 'https://uzumbank.uz')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl ${currentTheme.quickBtnBg} border ${currentTheme.quickBtnBorder} ${currentTheme.quickBtnHover} transition active:scale-95`}
              >
                <div className={`size-8 rounded-xl bg-blue-600/20 ${currentTheme.accentText} grid place-items-center mb-1.5`}>
                  <Home size={16} />
                </div>
                <span className={`text-[11px] font-bold ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>Kommunal</span>
              </button>

            </div>

            {/* 6. TO'LOV XIZMATLARI (ORIGINAL VIVID BRAND LOGOS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Layers size={16} className={currentTheme.accentText} />
                  <h3 className={`text-xs font-bold ${currentTheme.isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    To‘lov xizmatlari (Ilovalar)
                  </h3>
                </div>
                <button
                  onClick={() => setShowGuide(true)}
                  className={`text-[11px] font-bold ${currentTheme.accentText} flex items-center gap-1`}
                >
                  <span>Qo‘llanma</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Payme Card */}
                <button
                  type="button"
                  onClick={() => handleOpenPaymentApp('Payme', 'https://payme.uz')}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl ${currentTheme.appCardBg} border ${currentTheme.appCardBorder} hover:border-sky-400/60 transition text-left group shadow-lg min-h-[110px] active:scale-98`}
                >
                  <div className="flex items-center justify-between w-full">
                    <PaymeLogo className="h-6.5 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>Payme</p>
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
                  className={`flex flex-col justify-between p-3.5 rounded-2xl ${currentTheme.appCardBg} border ${currentTheme.appCardBorder} hover:border-sky-400/60 transition text-left group shadow-lg min-h-[110px] active:scale-98`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ClickLogo className="h-6.5 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>Click</p>
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
                  className={`flex flex-col justify-between p-3.5 rounded-2xl ${currentTheme.appCardBg} border ${currentTheme.appCardBorder} hover:border-sky-400/60 transition text-left group shadow-lg min-h-[110px] active:scale-98`}
                >
                  <div className="flex items-center justify-between w-full">
                    <UzumBankLogo className="h-6.5 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>Uzum Bank</p>
                      <p className="text-[10px] text-slate-400">Bank xizmatlari</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>

                {/* Bank ilovasi / HUMO & UZCARD */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(cardNumber.replace(/\s/g, ''), 'card')}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl ${currentTheme.appCardBg} border ${currentTheme.appCardBorder} hover:border-sky-400/60 transition text-left group shadow-lg min-h-[110px] active:scale-98`}
                >
                  <div className="flex items-center gap-1.5">
                    <HumoLogo className="h-5 w-auto" />
                    <UzcardLogo className="h-5 w-auto" />
                  </div>
                  <div className="mt-3 flex items-end justify-between w-full">
                    <div>
                      <p className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>Barcha banklar</p>
                      <p className="text-[10px] text-slate-400">P2P o‘tkazma</p>
                    </div>
                    <div className="size-6 rounded-full bg-blue-600 group-hover:bg-sky-500 text-white grid place-items-center transition">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 8. TIMER & REAL-TIME STATUS CHECK BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Timer Pill */}
              <div className={`sm:col-span-5 flex items-center justify-between rounded-2xl ${currentTheme.amountCardBg} border ${currentTheme.amountCardBorder} px-4 py-3 shadow-lg`}>
                <div className={`flex items-center gap-2 text-xs ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'} font-medium`}>
                  <Clock3 size={15} className={currentTheme.accentText} />
                  <span>To‘lov uchun vaqt:</span>
                </div>
                <span className={`font-mono text-sm font-extrabold ${currentTheme.accentText} tracking-wider`}>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </div>

              {/* Instant Verification Button */}
              <button
                onClick={fetchPayment}
                className={`sm:col-span-7 flex items-center justify-center gap-2 rounded-2xl ${currentTheme.actionBtnBg} py-3 px-4 text-xs font-bold text-white shadow-xl transition active:scale-98`}
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
            <div className={`rounded-3xl border ${currentTheme.amountCardBorder} ${currentTheme.amountCardBg} p-4 sm:p-5 shadow-xl`}>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`size-8 rounded-xl ${currentTheme.isDark ? 'bg-black/40' : 'bg-slate-100'} border ${currentTheme.headerBorder} grid place-items-center ${currentTheme.accentText}`}>
                    <FileText size={16} />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>To‘lov bo‘yicha qo‘llanma:</h4>
                    <p className="text-[10px] text-slate-400">3 qadamda xavfsiz to‘lov</p>
                  </div>
                </div>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${showGuide ? 'rotate-90' : ''}`} />
              </button>

              {(showGuide || true) && (
                <div className={`mt-3.5 pt-3.5 border-t ${currentTheme.headerBorder} space-y-2 text-xs ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed`}>
                  <p className="flex items-start gap-2">
                    <span className={`font-bold ${currentTheme.accentText} font-mono`}>1.</span>
                    <span><b>Payme, Click, Uzum Bank</b> tugmasini bosing yoki bank ilovangizni oching.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className={`font-bold ${currentTheme.accentText} font-mono`}>2.</span>
                    <span>Yuqoridagi <b className={`${currentTheme.isDark ? 'text-white' : 'text-slate-900'} font-mono`}>{formattedCard}</b> kartasiga aynan <b className={`${currentTheme.accentText} font-mono`}>{formatAmount(amountNumber)} UZS</b> o‘tkazing.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className={`font-bold ${currentTheme.accentText} font-mono`}>3.</span>
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
                <p>• 10 xil qulay va jozibali dizayn mavzulari</p>
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
