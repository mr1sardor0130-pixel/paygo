'use client'

import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Heart, CreditCard, Copy, Check, Users, Target, Sparkles, ShieldCheck, ArrowRight, Clock, MessageSquare, ExternalLink, RefreshCw } from 'lucide-react'

interface FundraiserPageProps {
  fundraiserId: string
}

export function FundraiserPage({ fundraiserId }: FundraiserPageProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [donorName, setDonorName] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number>(25000)
  const [customAmount, setCustomAmount] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successDonation, setSuccessDonation] = useState<any>(null)

  const [copied, setCopied] = useState(false)

  const fetchFundraiser = async () => {
    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}`)
      const json = await res.json()
      if (json.ok) {
        setData(json)
      } else {
        setError(json.error || 'Loyiha topilmadi')
      }
    } catch (err) {
      setError('Serverga ulanishda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFundraiser()
    const interval = setInterval(fetchFundraiser, 5000) // Poll every 5s for live updates
    return () => clearInterval(interval)
  }, [fundraiserId])

  const handleCopyCard = (card: string) => {
    navigator.clipboard.writeText(card)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!donorName.trim()) {
      alert('Iltimos, ism va familiyangizni kiriting')
      return
    }

    const amountToPay = customAmount ? parseInt(customAmount, 10) : selectedAmount
    if (!amountToPay || amountToPay <= 0) {
      alert('Iltimos, to‘g‘ri to‘lov summasini tanlang yoki kiriting')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName,
          amount: amountToPay,
          comment,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSuccessDonation(json)
        fetchFundraiser()
      } else {
        alert(json.error || 'Xatolik yuz berdi')
      }
    } catch (err) {
      alert('Serverga ulanishda xatolik')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Loyiha ma’lumotlari yuklanmoqda...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">Loyiha Topilmadi</h1>
          <p className="text-slate-400 text-sm mb-6">{error || 'Ushbu xayriya yoki qo‘llab-quvvatlash sahifasi mavjud emas'}</p>
        </div>
      </div>
    )
  }

  const { fundraiser, shop, recentDonations } = data
  const goal = fundraiser.goalAmount || 0
  const collected = fundraiser.collectedAmount || 0
  const percent = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 100

  // Formatted card number e.g. 9860 3501 2345 3587
  const rawCard = shop.cardNumber || '9860350123453587'
  const formattedCard = rawCard.replace(/(\d{4})/g, '$1 ').trim()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-20">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 pt-10">
        {/* Top Header & Badge */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              PayGo
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <Heart className="w-3 h-3 fill-emerald-400" /> Qo‘llab-quvvatlash loyihasi
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Kafolatlangan xizmat</span>
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1 justify-end">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> PayGo Verification
            </span>
          </div>
        </div>

        {/* Main Campaign Card */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
                {fundraiser.title}
              </h1>
              {fundraiser.description && (
                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl">
                  {fundraiser.description}
                </p>
              )}
            </div>

            {/* Shop info badge */}
            <div className="shrink-0 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-lg text-emerald-400 border border-slate-700">
                {shop.name ? shop.name.charAt(0).toUpperCase() : '🏪'}
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Kollaboratsiya do‘koni:</span>
                <span className="text-sm font-bold text-white">{shop.name}</span>
                <span className="text-xs text-emerald-400 block font-medium">✅ Karta va Userbot ulangan</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Goal Stats */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Yig‘ilgan mablag‘</span>
                <div className="text-3xl font-extrabold text-emerald-400 tracking-tight flex items-baseline gap-2">
                  {collected.toLocaleString('uz-UZ')} <span className="text-lg text-slate-400 font-normal">UZS</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Maqsad</span>
                <div className="text-xl font-bold text-slate-200">
                  {goal > 0 ? `${goal.toLocaleString('uz-UZ')} UZS` : 'Cheksiz (Ochiq)'}
                </div>
              </div>
            </div>

            {/* Progress Bar Track */}
            {goal > 0 && (
              <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> <b>{fundraiser.donorCount || 0}</b> ta sahovatpesha qo‘llab-quvvatladi
              </span>
              {goal > 0 && (
                <span className="text-emerald-400 font-bold">
                  {percent}% bajarildi
                </span>
              )}
            </div>
          </div>

          {/* Donation Form or Success Receipt */}
          {!successDonation ? (
            <form onSubmit={handleDonate} className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" /> Loyihaga pul solish / Ehson qilish
              </h3>

              {/* Donor Name input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Ismingiz va Familiyangiz *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Sardor Rahimov"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>

              {/* Quick Preset Amounts */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  To‘lov summasini tanlang (UZS)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        setSelectedAmount(amt)
                        setCustomAmount('')
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all text-center ${
                        selectedAmount === amt && !customAmount
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {amt.toLocaleString('uz-UZ')} UZS
                    </button>
                  ))}
                </div>

                {/* Custom Amount input */}
                <input
                  type="number"
                  placeholder="Yoki ixtiyoriy summa kiriting..."
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>

              {/* Comment / Wish input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Izoh yoki Ezgu tilaklaringiz (Ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Omad tilayman, g‘oya zo‘r ekan!"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-base py-4 px-6 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> Yozib olinmoqda...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 fill-slate-950" /> Qo‘llab-quvvatlash va Karta raqamini olish
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Donation Confirmation & Card Details Screen */
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 animate-fadeIn">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">E’tiboringiz uchun rahmat, {successDonation.donation?.donorName}!</h3>
                    <p className="text-xs text-slate-400">Sizga vaqtinchalik unikal ID biriktirildi</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Sizning vaqtinchalik ID:</span>
                  <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    {successDonation.donorTempId}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Card copy box */}
                <div>
                  <p className="text-xs text-slate-400 mb-2">
                    Iltimos, quyidagi bank kartasiga <b>{(successDonation.donation?.amount || 0).toLocaleString('uz-UZ')} UZS</b> o‘tkazma qiling:
                  </p>

                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4 relative">
                    <span className="text-xs font-semibold uppercase text-emerald-400 block mb-1">
                      {shop.cardBank || 'HUMOCARD'}
                    </span>
                    <div className="text-xl font-mono font-bold tracking-wider text-white mb-2 flex items-center justify-between">
                      <span>{formattedCard}</span>
                      <button
                        onClick={() => handleCopyCard(rawCard)}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer"
                        title="Karta raqamini nusxalash"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span>Karta egasi: <b>{shop.accountOwner || 'Hisob egasi'}</b></span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    💡 <b>Maslahat:</b> To‘lov ilovasida (Click, Payme, Uzum) o‘tkazma izohiga <code>{successDonation.donorTempId}</code> kodini kiritishingiz mumkin.
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                  <div className="bg-white p-3 rounded-xl mb-3">
                    <QRCodeSVG value={`https://paygo.uz/pay/${rawCard}`} size={140} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">To‘lov ilovalari uchun QR Code</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                <button
                  onClick={() => setSuccessDonation(null)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  ← Yangi ehson kiritish
                </button>

                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Userbot to‘lovlarni 1 soniyada tekshiradi
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Donors List */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Oxirgi qo‘llab-quvvatlagan sahovatpeshalar
            </h3>
            <span className="text-xs text-slate-400">Jami: <b>{recentDonations.length}</b> ta</span>
          </div>

          {recentDonations.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl">
              <Heart className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">Hozircha birinchi bo‘lib siz loyihani qo‘llab-quvvatlang!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDonations.map((d: any) => (
                <div
                  key={d.id}
                  className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 flex items-start justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                      {d.donorName ? d.donorName.charAt(0).toUpperCase() : '👤'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{d.donorName}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {d.donorTempId}
                        </span>
                      </div>
                      {d.comment && (
                        <p className="text-slate-300 text-xs mt-1 italic flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-emerald-400 shrink-0" /> &quot;{d.comment}&quot;
                        </p>
                      )}
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {new Date(d.createdAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-emerald-400 block">
                      +{d.amount.toLocaleString('uz-UZ')} UZS
                    </span>
                    <span className="text-[10px] text-emerald-500/80 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-1">
                      ✅ Qabul qilindi
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
