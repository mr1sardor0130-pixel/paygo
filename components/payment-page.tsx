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
} from 'lucide-react'

type PaymentData = {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired'
  expiresAt: string
  matchedAt?: string
  shop: {
    id: string
    name: string
    cardNumber: string
    cardLast4: string
    cardBank: string
    accountOwner: string
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
  const [seconds, setSeconds] = useState(600)
  const [copiedCard, setCopiedCard] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)

  // Fetch payment data
  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/pay/${paymentId}`)
      if (res.ok) {
        const json: PaymentData = await res.json()
        setData(json)
        if (json.expiresAt) {
          const diff = Math.max(
            0,
            Math.floor((new Date(json.expiresAt).getTime() - Date.now()) / 1000)
          )
          setSeconds(diff)
        }
      }
    } catch (err) {
      console.warn('Payment fetch error:', err)
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

  const cardNumber = data?.shop?.cardNumber || '9860350123453587'
  const formattedCard = formatCardNumber(cardNumber)
  const cardOwner = data?.shop?.accountOwner || 'HUMO hisob egasi'
  const shopName = data?.shop?.name || 'HUMO to‘lov xizmati'
  const amountNumber = data?.amount || 10000
  const isPaid = data?.status === 'paid'
  const isExpired = data?.status === 'expired' || seconds <= 0

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#152238] antialiased">
      <div className="mx-auto max-w-lg">
        {/* Brand Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#1769e0] text-base font-bold text-white shadow-md shadow-blue-500/20">
              P
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold tracking-[.18em] text-[#1769e0]">
                PAYGO • HUMO
              </p>
              <p className="text-xs font-medium text-[#718096]">{shopName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#16865b] shadow-sm border border-[#e3e8f0]">
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
              <div className="mt-6 rounded-2xl bg-[#f8fafc] p-4 text-left border border-[#e2e8f0] space-y-2">
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
                Ajratilgan 10 daqiqalik to‘lov vaqti yakunlandi.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1769e0] px-5 py-3 text-sm font-semibold text-white"
              >
                <RefreshCw size={16} /> Qayta tekshirish
              </button>
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

              {/* SPECIAL FULL CARD CONTAINER (High visual clarity) */}
              <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#10223d] via-[#162a4a] to-[#0d1b32] p-6 text-white shadow-xl shadow-blue-950/15">
                <div className="flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-[#60a5fa]" />
                    <span className="font-mono text-xs uppercase tracking-widest text-[#93c5fd]">
                      HUMO CARD
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#94a3b8]">
                    O‘zbekiston
                  </span>
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
                    <span>HUMOCARD</span>
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

              {/* Countdown timer */}
              <div className="mt-6 flex items-center justify-between rounded-xl bg-[#f8fafc] p-4 border border-[#e2e8f0]">
                <div className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                  <Clock3 size={17} className="text-[#2563eb]" /> To‘lov uchun
                  ajratilgan vaqt:
                </div>
                <span className="font-mono text-sm font-bold text-[#2563eb]">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              </div>

              {/* Instructions */}
              <div className="mt-5 space-y-2 rounded-xl bg-[#f0f7ff] p-4 text-xs leading-5 text-[#1e40af]">
                <p className="font-bold">To‘lov bo‘yicha qo‘llanma:</p>
                <p>
                  1. <b>Payme, Click</b> yoki <b>bank ilovangizni</b> oching.
                </p>
                <p>
                  2. Yuqoridagi <b>{formattedCard}</b> kartasiga aynan{' '}
                  <b>{formatAmount(amountNumber)} UZS</b> pul yuboring.
                </p>
                <p>
                  3. Userbot <b>@humocardbot</b> xabarini o‘qishi bilanoq ushbu
                  sahifa avtomatik ravishda tasdiqlanadi.
                </p>
              </div>
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

