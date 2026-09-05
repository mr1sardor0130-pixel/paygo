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
} from 'lucide-react'
import Link from 'next/link'
import { HumoLogo, UzcardLogo, PaymentAppButtons, AcceptedBrandsBar } from '@/components/brand-logos'

type PaymentData = {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired'
  isTest?: boolean
  expiresAt: string
  matchedAt?: string
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
  if (!clean) return '9860 3501 2345 3587'
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
  const [simulating, setSimulating] = useState(false)
  const [simulationResult, setSimulationResult] = useState<string | null>(null)
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const [logoError, setLogoError] = useState(false)

  // Auto-redirect to returnUrl on successful payment
  // If there is an ad/promo banner, wait 3 seconds; if no ad banner, fast 1-second redirect
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
      <main className="min-h-screen bg-[#f5f7fb] flex flex-col items-center justify-center px-4 text-[#152238]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-3 border-[#1769e0] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#64748b]">To‘lov rekvizitlari yuklanmoqda...</p>
        </div>
      </main>
    )
  }

  if (fetchError && !data) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] flex flex-col items-center justify-center px-4 text-[#152238]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#e2e8f0] shadow-sm text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[#fee2e2] text-[#dc2626]">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#152238]">To‘lov topilmadi</h2>
          <p className="mt-2 text-xs text-[#64748b]">
            Ushbu to‘lov identifikatori ({paymentId}) bazada mavjud emas yoki muddati tugab o‘chirilgan.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                setLoading(true)
                fetchPayment()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-5 py-3 text-xs font-bold text-white hover:bg-[#1254b7] transition"
            >
              <RefreshCw size={14} /> Qayta tekshirish
            </button>
            <Link
              href="/panel"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc] transition"
            >
              <ArrowLeft size={14} /> Veb-panelga qaytish
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const cardNumber = data?.shop?.cardNumber || '9860350123453587'
  const formattedCard = formatCardNumber(cardNumber)
  const cardOwner = data?.shop?.accountOwner || 'HUMO hisob egasi'
  const shopName = data?.shop?.name || 'HUMO to‘lov xizmati'
  const amountNumber = data?.amount ?? 1000
  const isPaid = data?.status === 'paid'
  const isExpired = data?.status === 'expired' || seconds <= 0

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#152238] antialiased">
      <div className="mx-auto max-w-lg">
        {/* Brand Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {data?.shop?.logoUrl && !logoError ? (
              <img
                src={data.shop.logoUrl}
                alt={shopName}
                onError={() => setLogoError(true)}
                className="size-12 rounded-2xl object-cover border border-[#cbd5e1] shadow-sm bg-white shrink-0"
              />
            ) : (
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#1769e0] to-[#124ba8] text-lg font-black text-white shadow-md shadow-blue-500/20 shrink-0">
                {shopName ? shopName.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-extrabold tracking-[.18em] text-[#1769e0] uppercase">
                PAYGO • HUMO
              </p>
              <p className="text-sm font-extrabold text-[#152238] truncate" title={shopName}>
                {shopName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#16865b] shadow-sm border border-[#e2e8f0] shrink-0">
            <ShieldCheck size={15} className="text-[#1ea672]" /> Himoyalangan to‘lov
          </div>
        </header>

        {/* Main Card */}
        <div className="overflow-hidden rounded-3xl border border-[#e3e8f0] bg-white p-6 md:p-8 shadow-sm">
          {/* Status: PAID */}
          {isPaid ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[#eaf8f1] text-[#16865b]">
                <CheckCircle2 size={36} />
              </div>
              <h1 className="text-2xl font-bold text-[#152238]">
                To‘lov muvaffaqiyatli qabul qilindi!
              </h1>
              <p className="mt-2 text-sm text-[#718096]">
                HUMO xabarnomasi orqali to‘lov avtomatik tasdiqlandi.
              </p>

              {/* Receipt info card */}
              <div className="mt-6 rounded-2xl bg-[#f8fafc] p-5 text-left border border-[#e2e8f0] relative overflow-hidden">
                {/* Embedded Mini Stamp */}
                <div className="absolute right-3 top-3 opacity-80 pointer-events-none transform rotate-[-8deg]">
                  <div className="size-20 rounded-full border-2 border-dashed border-blue-600 flex flex-col items-center justify-center p-1 text-center bg-blue-50/50">
                    <span className="text-[7px] font-black text-blue-700 tracking-wider">PAYGO</span>
                    <span className="text-[9px] font-extrabold text-blue-800 uppercase">MUHR</span>
                    <span className="text-[6.5px] font-bold text-blue-600">TASDIQLANDI</span>
                  </div>
                </div>

                <div className="space-y-2 pr-16">
                  <div className="flex justify-between text-xs text-[#718096]">
                    <span>To‘lov summasi:</span>
                    <b className="text-sm font-bold text-[#152238]">
                      {formatAmount(amountNumber)} UZS
                    </b>
                  </div>
                  <div className="flex justify-between text-xs text-[#718096]">
                    <span>Karta:</span>
                    <span className="font-mono font-semibold text-[#152238]">
                      {formattedCard}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-[#718096]">
                    <span>Karta egasi:</span>
                    <span className="font-medium text-[#152238]">{cardOwner}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#718096]">
                    <span>Holati:</span>
                    <span className="font-bold text-[#16865b]">Muvaffaqiyatli ✅</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#718096]">
                    <span>To‘lov ID:</span>
                    <span className="font-mono text-[11px] text-[#8995a7]">
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                >
                  <FileText size={16} />
                  <span>📥 Rasmiy Chekni Yuklab Olish (PDF)</span>
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(`/pay/${paymentId}/receipt`, '_blank')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Printer size={14} /> Chop etish
                  </button>
                  {data?.returnUrl ? (
                    <a
                      href={data.returnUrl}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <ArrowLeft size={14} /> Do‘konga qaytish
                    </a>
                  ) : (
                    <Link
                      href="/"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <ArrowLeft size={14} /> Do‘konga qaytish
                    </Link>
                  )}
                </div>

                {redirectCountdown !== null && (
                  <p className="text-[11px] text-[#718096] font-medium text-center mt-2 animate-pulse">
                    ⏱ {redirectCountdown} soniyadan so‘ng avtomatik tarzda do‘konga qaytasiz...
                  </p>
                )}
              </div>
            </div>
          ) : isExpired ? (
            /* Status: EXPIRED */
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[#fee2e2] text-[#dc2626]">
                <AlertCircle size={36} />
              </div>
              <h1 className="text-2xl font-bold text-[#152238]">
                To‘lov muddati tugadi
              </h1>
              <p className="mt-2 text-sm text-[#718096]">
                Ajratilgan 5 daqiqalik to‘lov vaqti yakunlandi.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769e0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1254b7] transition"
                >
                  <RefreshCw size={16} /> Qayta tekshirish
                </button>
                <Link
                  href="/panel"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc] transition"
                >
                  <ArrowLeft size={14} /> Panelga qaytish
                </Link>
              </div>
            </div>
          ) : (
            /* Status: PENDING */
            <div>
              {/* Header Amount and Status */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#718096]">
                    To‘lov summasi
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#152238]">
                      {formatAmount(amountNumber)}{' '}
                      <span className="text-lg font-semibold text-[#718096]">
                        UZS
                      </span>
                    </h1>
                    <button
                      onClick={() =>
                        copyToClipboard(String(amountNumber), 'amount')
                      }
                      title="Summani nusxalash"
                      className="rounded-lg p-1.5 text-[#718096] hover:bg-[#f1f5f9] hover:text-[#1769e0] transition"
                    >
                      {copiedAmount ? (
                        <Check size={16} className="text-[#16865b]" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#fff4df] px-3.5 py-1.5 text-xs font-bold text-[#ae7212]">
                  <span className="size-2 rounded-full bg-[#ae7212] animate-ping" />
                  Kutilmoqda
                </div>
              </div>

              {/* SPECIAL FULL CARD CONTAINER */}
              <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#10223d] via-[#162a4a] to-[#0d1b32] p-6 text-white shadow-xl shadow-blue-950/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-[#60a5fa]" />
                    <span className="font-mono text-xs uppercase tracking-widest text-[#93c5fd]">
                      HUMO / UZCARD
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HumoLogo className="h-5 w-auto" />
                    <UzcardLogo className="h-5 w-auto" />
                  </div>
                </div>

                {/* FULL 16-DIGIT CARD NUMBER DISPLAY */}
                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-wider text-[#93c5fd]">
                    Pul o‘tkaziladigan to‘liq karta raqami:
                  </p>
                  <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tracking-wider text-white select-all">
                    {formattedCard}
                  </p>
                </div>

                {/* Card Owner & Bank */}
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#93c5fd]" />
                    <span className="text-xs font-medium text-[#e2e8f0]">
                      {cardOwner}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#93c5fd]">
                    <Building2 size={13} />
                    <span>{data?.shop?.cardBank || 'HUMOCARD'}</span>
                  </div>
                </div>

                {/* Primary Copy Action Button */}
                <button
                  onClick={() =>
                    copyToClipboard(cardNumber.replace(/\s/g, ''), 'card')
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] py-3 text-xs font-bold text-white shadow-md hover:from-[#1d4ed8] hover:to-[#1e40af] transition active:scale-[0.99]"
                >
                  {copiedCard ? (
                    <>
                      <Check size={16} className="text-white" /> Karta raqami
                      nusxalandi!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> To‘liq karta raqamini nusxalash
                    </>
                  )}
                </button>
              </div>

              {/* Instant App Launch Buttons (Payme, Click, Uzum Bank) */}
              <PaymentAppButtons cardNumber={cardNumber} amount={amountNumber} className="mt-6 p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-sm" />

              {/* Countdown timer (5 minutes limit) */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f8fafc] p-4 border border-[#e2e8f0]">
                <div className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                  <Clock3 size={17} className="text-[#2563eb]" /> To‘lov uchun
                  ajratilgan vaqt:
                </div>
                <span className="font-mono text-sm font-bold text-[#2563eb]">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </div>

              {/* Manual Check Button */}
              <button
                onClick={fetchPayment}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1769e0] bg-white py-3 text-xs font-bold text-[#1769e0] hover:bg-[#f0f7ff] transition active:scale-[0.99]"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                To‘lov qilinganini tekshirish
              </button>

              {/* Test Mode Simulation Button (ONLY visible if payment is a Test payment) */}
              {data?.isTest && (
                <div className="mt-4 rounded-2xl border border-dashed border-[#2563eb]/40 bg-[#f0f7ff] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#2563eb]" />
                      <span className="text-xs font-bold text-[#1e40af]">
                        Test To‘lov Rejimi (Simulyatsiya):
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[#3b82f6]">
                    Ushbu to‘lov test rejimida yaratilgan. Haqiqiy pul o‘tkazmasdan to‘lovni sinab ko‘rish va Webhook / Telegram Kanalga JSON yuborilishini tekshirish uchun bosing:
                  </p>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={simulating}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1d4ed8] transition disabled:opacity-50 active:scale-[0.99]"
                  >
                    {simulating ? 'Tasdiqlanmoqda...' : '⚡️ Test To‘lovni Tasdiqlash (Simulyatsiya)'}
                  </button>
                  {simulationResult && (
                    <p className="mt-2 text-center text-xs font-medium text-[#16865b]">
                      {simulationResult}
                    </p>
                  )}
                </div>
              )}

              {/* Instructions */}
              <div className="mt-5 space-y-2 rounded-xl bg-[#f8fafc] p-4 text-xs leading-5 text-[#64748b] border border-[#e2e8f0]">
                <p className="font-bold text-[#152238]">To‘lov bo‘yicha qo‘llanma:</p>
                <p>
                  1. <b>Payme, Click, Uzum Bank</b> tugmasini bosing yoki bank ilovangizni oching.
                </p>
                <p>
                  2. Yuqoridagi <b>{formattedCard}</b> kartasiga aynan{' '}
                  <b>{formatAmount(amountNumber)} UZS</b> pul o‘tkazing.
                </p>
                <p>
                  3. Userbot <b>@humocardbot</b> xabarini o‘qishi bilanoq ushbu
                  sahifa avtomatik ravishda tasdiqlanadi.
                </p>
              </div>

              <AcceptedBrandsBar className="mt-4" />
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="mt-4 text-center font-mono text-[11px] text-[#94a3b8]">
          To‘lov ID: {paymentId} • PayGo Secure Infrastructure
        </p>
      </div>
    </main>
  )
}
