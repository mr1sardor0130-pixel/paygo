'use client'

import React, { useState, useEffect } from 'react'
import {
  Crown,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  Copy,
  CreditCard,
  QrCode,
  ShieldCheck,
  Store,
  RefreshCw,
  Send,
  Check,
  ArrowRight,
  HelpCircle,
  Users,
  FileCode,
  Home,
} from 'lucide-react'
import Link from 'next/link'

interface TariffItem {
  id: string
  name: string
  description?: string
  price: number
  period: string
  cardNumber?: string
  cardOwner?: string
  cardBank?: string
  features?: string[] | string
  active?: boolean
}

const DEFAULT_TARIFFS: TariffItem[] = [
  {
    id: 'tariff-daily',
    name: 'Kunlik Sinov',
    description: '1 kunlik sinov, avto-to‘lov va monitoring',
    features: [
      '⚡️ @humocardbot orqali 1 soniyada avto-to‘lov',
      '🏪 3 tagacha do‘kon ochish',
      '🔗 Har bir do‘kon uchun alohida Webhook & Kanal',
      '👥 1 ta VIP Guruh (Pullik yozish / kirish)',
      '🎁 1 ta Donate / Ehson yig‘ish kampaniyasi',
      '0% komissiya, mablag‘ to‘g‘ridan-to‘g‘ri kartangizga',
      '📄 PDF cheklar generatsiyasi',
    ],
    price: 5000,
    period: 'kun',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
  {
    id: 'tariff-weekly',
    name: 'Haftalik Standart',
    description: '7 kunlik biznes va faol savdo imkoniyati',
    features: [
      '⚡️ 1 soniyada avto-to‘lov tasdiqlash (@humocardbot)',
      '🏪 10 tagacha mustaqil do‘konlar',
      '🔗 Har bir do‘kon uchun maxsus Webhook & Kanal',
      '👥 5 tagacha VIP Guruh / Kanal (Pullik yozish)',
      '🎁 Cheksiz Donate & Xayriya yig‘ish havolalari',
      '0% komissiya va 24/7 avtomatik monitoring',
      '📄 QR-kodli rasmiy PDF kvitansiyalar',
      '🛠 Dasturchilar uchun REST API & SDK',
    ],
    price: 25000,
    period: 'hafta',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
  {
    id: 'tariff-monthly',
    name: 'Oylik VIP (Cheksiz)',
    description: '30 kunlik to‘liq cheksiz imkoniyatlar to‘plami',
    features: [
      '⚡️ Avtomatlashtirilgan 24/7 Avto-to‘lov (0 kutish)',
      '🏪 CHEKSIZ do‘konlar yaratish va ulash',
      '🔗 Har bir do‘konga individual Webhook & Kanal',
      '👥 CHEKSIZ VIP Guruhlar va Pullik yozish monetizatsiyasi',
      '🎁 CHEKSIZ Donate / Ehson yig‘ish kampaniyalari',
      '💳 Har bir do‘konga alohida HUMO/UZCARD karta ulash',
      '0% komissiya — 100% to‘g‘ridan-to‘g‘ri kartangizga',
      '📄 Brendlangan PDF cheklar va to‘lov tahlillari',
      '🚀 Yuqori ustuvorlikdagi 24/7 VIP texnik qo‘llab-quvvatlash',
    ],
    price: 79000,
    period: 'oy',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  },
]

export function TariffsView() {
  const [tariffs, setTariffs] = useState<TariffItem[]>(DEFAULT_TARIFFS)
  const [loading, setLoading] = useState<boolean>(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Payment Modal state
  const [payModal, setPayModal] = useState<TariffItem | null>(null)
  const [countdown, setCountdown] = useState<number>(300)
  const [checkingPayment, setCheckingPayment] = useState<boolean>(false)
  const [telegramIdInput, setTelegramIdInput] = useState<string>('')

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Load User if logged in
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('paybot_user')
      if (savedUser) {
        const parsed = JSON.parse(savedUser)
        setCurrentUser(parsed)
        if (parsed.telegramId) {
          setTelegramIdInput(parsed.telegramId)
        }
      }
    } catch {}
  }, [])

  // Load Tariffs from API
  const loadTariffs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tariffs?_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok && Array.isArray(data.tariffs) && data.tariffs.length > 0) {
        setTariffs(data.tariffs)
      }
    } catch {
      // Fallback already in state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTariffs()
  }, [])

  // Countdown timer for payment modal
  useEffect(() => {
    let timer: any = null
    if (payModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [payModal, countdown])

  const openPaymentModal = (tariff: TariffItem) => {
    setPayModal(tariff)
    setCountdown(300)
  }

  const checkPaymentStatus = async () => {
    setCheckingPayment(true)
    try {
      const tgId = telegramIdInput.trim() || currentUser?.telegramId || '8021115446'
      const res = await fetch(`/api/tariffs?checkPayment=true&telegramId=${encodeURIComponent(tgId)}`)
      const data = await res.json()

      if (data.isPremium) {
        showToast('🎉 Tabriklaymiz! To‘lov muvaffaqiyatli qabul qilindi va Premium faollashdi!')
        setPayModal(null)
        if (currentUser) {
          const updated = { ...currentUser, tier: 'premium', premiumEndsAt: data.premiumEndsAt }
          setCurrentUser(updated)
          localStorage.setItem('paybot_user', JSON.stringify(updated))
        }
      } else {
        showToast('To‘lov hali hisobga o‘tmagan. Iltimos, o‘tkazmani tekshirib qayta bosing.', 'error')
      }
    } catch {
      showToast('Tekshirishda xatolik yuz berdi', 'error')
    } finally {
      setCheckingPayment(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl px-5 py-3.5 text-xs font-bold shadow-2xl transition animate-in fade-in slide-in-from-top-4 ${
            toastMsg.type === 'error'
              ? 'bg-rose-600 text-white border border-rose-400/40'
              : 'bg-emerald-600 text-white border border-emerald-400/40'
          }`}
        >
          {toastMsg.type === 'error' ? '⚠️' : '✅'} <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0d172e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Crown size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">PayGo</span>
                <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                  Premium
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Tariflar & To‘lov Tizimi</p>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 transition"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Bosh sahifa</span>
            </Link>

            <Link
              href="/panel"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition"
            >
              <Store size={14} />
              <span>Shaxsiy Panel (/panel)</span>
            </Link>

            {currentUser?.isAdmin && (
              <Link
                href="/admin/tariffs"
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition"
              >
                <Crown size={14} />
                <span className="hidden sm:inline">Admin Boshqaruv</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900 to-[#101b35] p-6 sm:p-10 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-3.5 py-1 text-xs font-bold text-amber-300">
                <Sparkles size={14} />
                <span>0% KOMISSIYA — 100% SHAXSIY KARTANGIZGA</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                💎 PayGo Premium & Tariflar
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed">
                Avtomatlashtirilgan 1 soniyalik to‘lovlar (<span className="text-emerald-400 font-bold">@humocardbot</span>), VIP Guruhlar (Pullik yozish va obuna), Donate ehson kampaniyalari va cheksiz do‘konlar tizimi!
              </p>

              {/* Expiry Banner if Active */}
              {currentUser?.premiumEndsAt && (() => {
                try {
                  const d = new Date(currentUser.premiumEndsAt)
                  if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                    return (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 mt-2">
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span>Sizning Premium obunangiz faol: <b>{d.toLocaleDateString('uz-UZ')}</b> gacha</span>
                      </div>
                    )
                  }
                } catch {}
                return null
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadTariffs}
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-amber-400' : ''} />
                <span>Tariflarni yangilash</span>
              </button>

              <a
                href="https://t.me/Pay_Gouzbot"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-2xl bg-[#1769e0] hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition"
              >
                <Send size={14} />
                <span>@Pay_Gouzbot orqali kirish</span>
              </a>
            </div>
          </div>
        </div>

        {/* Tarif Kartalari Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <CreditCard size={20} className="text-amber-400" />
              <span>Mavjud Tarif Rejalari</span>
            </h2>
            <span className="text-xs text-slate-400">Tezkor avto-faollashtirish</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.map((t) => {
              const isPopular = t.id?.includes('monthly') || t.name?.toLowerCase().includes('vip') || Number(t.price || 0) >= 50000

              let featuresList: string[] = []
              try {
                if (Array.isArray(t.features)) {
                  featuresList = t.features.map((f: any) => String(f))
                } else if (typeof t.features === 'string') {
                  const trimmed = t.features.trim()
                  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    const parsed = JSON.parse(trimmed)
                    if (Array.isArray(parsed)) {
                      featuresList = parsed.map((f: any) => String(f))
                    }
                  }
                  if (!featuresList.length) {
                    featuresList = trimmed
                      .split('\n')
                      .map((s: string) => s.trim().replace(/^[✓•\-\*]\s*/, ''))
                      .filter(Boolean)
                  }
                }
              } catch {
                featuresList = []
              }

              if (!featuresList.length) {
                featuresList = [
                  '⚡️ 1 soniyada avto-to‘lov (@humocardbot)',
                  '🏪 Do‘kon ochish va Webhook ulash',
                  '👥 VIP Guruhlar & Pullik yozish',
                  '0% komissiya — to‘g‘ridan-to‘g‘ri kartangizga',
                ]
              }

              const cardNumStr = String(t.cardNumber || '9860350123453587')
              const formattedCard = cardNumStr.replace(/(\d{4})(?=\d)/g, '$1 ')

              return (
                <div
                  key={t.id || String(Math.random())}
                  className={`relative flex flex-col justify-between rounded-3xl bg-[#141f38] p-6 sm:p-7 border transition-all ${
                    isPopular
                      ? 'border-amber-500 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-1 text-[10px] font-extrabold text-slate-950 uppercase tracking-wider shadow-md">
                      🔥 Eng Ommabop & Tavsiya
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-white">{t.name}</h3>
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-0.5 text-[11px] font-bold text-slate-300">
                        1 {t.period || 'oy'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-4 min-h-[32px] leading-relaxed">
                      {t.description || 'To‘liq monitoring va avtomatlashtirilgan to‘lov'}
                    </p>

                    {/* Price */}
                    <div className="mb-6 rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                          {Number(t.price || 0).toLocaleString('uz-UZ')}
                        </span>
                        <span className="text-xs font-bold text-slate-400">UZS</span>
                        <span className="text-xs text-slate-500">/ {t.period || 'oy'}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2.5 mb-6 text-xs text-slate-300">
                      {featuresList.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 leading-snug">
                          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Card Info */}
                    <div className="rounded-2xl bg-slate-900/60 p-3.5 border border-slate-800 text-xs space-y-1 mb-6">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span>To‘lov kartasi ({t.cardBank || 'HUMOCARD'}):</span>
                        <span className="text-emerald-400 font-bold">0% komissiya</span>
                      </div>
                      <p className="font-mono font-bold text-slate-200 flex items-center justify-between pt-0.5">
                        <span>{formattedCard}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cardNumStr.replace(/\s+/g, ''))
                            showToast('Karta raqami nusxalandi!')
                          }}
                          title="Nusxa olish"
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <Copy size={13} />
                        </button>
                      </p>
                      <p className="text-slate-400 text-[11px]">{t.cardOwner || 'Hisob egasi'}</p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => openPaymentModal(t)}
                    className={`w-full rounded-2xl py-3.5 text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg cursor-pointer active:scale-[0.99] ${
                      isPopular
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                    }`}
                  >
                    <Zap size={15} />
                    <span>Ushbu Tarifni Faollashtirish</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="rounded-3xl border border-slate-800 bg-[#121c33] p-6 space-y-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap size={20} />
            </div>
            <h4 className="text-base font-bold text-white">⚡️ 1 Soniyada Avto-Tasdiq</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              @humocardbot va Humo to‘lov monitoringi orqali har bir to‘lov 1 soniyada avtomatik tasdiqlanadi va chek generatsiya qilinadi.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#121c33] p-6 space-y-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-base font-bold text-white">💳 0% Komissiya — Shaxsiy Karta</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pullar hech qanday vositachilarsiz va ushlab qolishlarsiz to‘g‘ridan-to‘g‘ri sizning shaxsiy HUMO/UZCARD kartangizga tushadi.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#121c33] p-6 space-y-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Users size={20} />
            </div>
            <h4 className="text-base font-bold text-white">👥 VIP Guruhlar & Donate</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Guruhlarda pullik yozish huquqi, obunalar va maxsus xayriya yig‘ish (Donate) sahifalarini bir zumda ishga tushiring.
            </p>
          </div>
        </div>
      </main>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#14203b] p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{payModal.name} Tarif To‘lovi</h3>
                  <p className="text-xs text-slate-400">1 soniyalik avtomatlashtirilgan qabul</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="grid size-8 place-items-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Countdown Banner */}
            <div className="flex items-center justify-between rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Clock size={16} className="text-amber-400 animate-pulse" />
                <span>Hisob faol bo‘lish vaqti:</span>
              </div>
              <div className="font-mono text-base font-extrabold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-xl">
                {Math.floor(countdown / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(countdown % 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Card & Amount Box */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>To‘lov summasi:</span>
                <span className="text-lg font-mono font-extrabold text-amber-400">
                  {Number(payModal.price || 0).toLocaleString('uz-UZ')} UZS
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-800/80 p-3.5 border border-slate-700">
                <div>
                  <p className="font-mono text-base font-bold text-white tracking-wider">
                    {String(payModal.cardNumber || '9860350123453587').replace(/(\d{4})(?=\d)/g, '$1 ')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {payModal.cardOwner || 'AZizbek I'} • {payModal.cardBank || 'HUMOCARD'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(String(payModal.cardNumber || '9860350123453587').replace(/\s+/g, ''))
                    showToast('Karta raqami nusxalandi!')
                  }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1 shadow-sm transition"
                >
                  <Copy size={12} /> Nusxa
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Telegram ID raqamingiz (avto-faollashishi uchun):
                </label>
                <input
                  type="text"
                  value={telegramIdInput}
                  onChange={(e) => setTelegramIdInput(e.target.value)}
                  placeholder="Masalan: 8021115446"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Steps Guide */}
            <div className="rounded-2xl bg-slate-900/60 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-white">To‘lov yo‘riqnomasi:</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Kartaga aynan ko‘rsatilgan summani o‘tkazing.</li>
                <li>To‘lov amalga oshirilgach, pastdagi tugmani bosing.</li>
                <li>Tizim (@humocardbot) orqali avtomatik tasdiqlanib, hisobingiz darhol Premium qilinadi.</li>
              </ol>
            </div>

            {/* Check Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={checkPaymentStatus}
                disabled={checkingPayment}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold py-3.5 text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <RefreshCw size={15} className={checkingPayment ? 'animate-spin' : ''} />
                <span>{checkingPayment ? 'To‘lov tekshirilmoqda...' : 'To‘lov Qildim (Tekshirish & Faollashtirish)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white transition"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
