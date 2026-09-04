'use client'

import React, { useState, useEffect } from 'react'
import {
  Crown,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Save,
  Store,
  Layers,
  Home,
  Zap,
  ArrowRight,
  Sparkles,
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

export function AdminTariffsView() {
  const [tariffs, setTariffs] = useState<TariffItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [token, setToken] = useState<string>('')
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Local card/price editable state per tariff id
  const [editedFields, setEditedFields] = useState<{
    [id: string]: {
      price: number
      cardNumber: string
      cardOwner: string
      cardBank: string
    }
  }>({})

  // Modals
  const [editingFullTariff, setEditingFullTariff] = useState<any | null>(null)
  const [bulkCardModal, setBulkCardModal] = useState<boolean>(false)
  const [bulkCardForm, setBulkCardForm] = useState({
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
  })
  const [savingBulk, setSavingBulk] = useState<boolean>(false)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Load User & Auth
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('paybot_token') || ''
      const savedUser = localStorage.getItem('paybot_user')
      setToken(savedToken)
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser))
      }
    } catch {}
  }, [])

  // Load Tariffs
  const loadTariffs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tariffs?_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok && Array.isArray(data.tariffs)) {
        setTariffs(data.tariffs)
        // initialize editedFields
        const initialMap: any = {}
        data.tariffs.forEach((t: TariffItem) => {
          initialMap[t.id] = {
            price: t.price || 0,
            cardNumber: t.cardNumber || '9860350123453587',
            cardOwner: t.cardOwner || 'AZizbek I',
            cardBank: t.cardBank || 'HUMOCARD',
          }
        })
        setEditedFields(initialMap)
      }
    } catch {
      showToast('Tariflarni yuklashda xatolik', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTariffs()
  }, [])

  // Quick Save specific Tariff (Price, Card, Owner, Bank)
  const handleQuickSave = async (tariff: TariffItem) => {
    const fields = editedFields[tariff.id] || {
      price: tariff.price,
      cardNumber: tariff.cardNumber || '9860350123453587',
      cardOwner: tariff.cardOwner || 'AZizbek I',
      cardBank: tariff.cardBank || 'HUMOCARD',
    }

    if (!fields.cardNumber || fields.cardNumber.replace(/\s+/g, '').length < 16) {
      showToast('Karta raqami 16 xonali bo‘lishi shart', 'error')
      return
    }

    setSavingId(tariff.id)
    try {
      let featuresVal = tariff.features
      if (Array.isArray(featuresVal)) {
        featuresVal = JSON.stringify(featuresVal)
      }

      const res = await fetch('/api/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '8021115446',
        },
        body: JSON.stringify({
          action: 'upsert_tariff',
          tariff: {
            ...tariff,
            price: Number(fields.price) || 0,
            cardNumber: fields.cardNumber.replace(/\s+/g, ''),
            cardOwner: fields.cardOwner || 'AZizbek I',
            cardBank: fields.cardBank || 'HUMOCARD',
            features: featuresVal,
          },
        }),
      })

      const data = await res.json()
      if (data.ok) {
        showToast(`✅ «${tariff.name}» narxi va karta ma’lumotlari saqlandi!`)
        loadTariffs()
      } else {
        showToast(data.error || 'Saqlashda xatolik', 'error')
      }
    } catch {
      showToast('Server bilan ulanishda xatolik', 'error')
    } finally {
      setSavingId(null)
    }
  }

  // Save Full Tariff
  const handleSaveFullTariff = async () => {
    if (!editingFullTariff || !editingFullTariff.name) {
      showToast('Tarif nomini kiriting', 'error')
      return
    }

    setLoading(true)
    try {
      let featuresArr: string[] = []
      if (typeof editingFullTariff.featuresText === 'string') {
        featuresArr = editingFullTariff.featuresText
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)
      } else if (Array.isArray(editingFullTariff.features)) {
        featuresArr = editingFullTariff.features
      }

      const res = await fetch('/api/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '8021115446',
        },
        body: JSON.stringify({
          action: 'upsert_tariff',
          tariff: {
            ...editingFullTariff,
            price: Number(editingFullTariff.price) || 0,
            features: JSON.stringify(featuresArr),
          },
        }),
      })

      const data = await res.json()
      if (data.ok) {
        showToast('✅ Tarif to‘liq saqlandi!')
        setEditingFullTariff(null)
        loadTariffs()
      } else {
        showToast(data.error || 'Saqlashda xatolik', 'error')
      }
    } catch {
      showToast('Xatolik yuz berdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Delete Tariff
  const handleDeleteTariff = async (tariffId: string) => {
    if (!confirm('Ushbu tarifni o‘chirishni xohlaysizmi?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '8021115446',
        },
        body: JSON.stringify({
          action: 'delete_tariff',
          tariffId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('Tarif o‘chirildi')
        loadTariffs()
      } else {
        showToast(data.error || 'O‘chirishda xatolik', 'error')
      }
    } catch {
      showToast('Xatolik', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Bulk Card Save
  const handleBulkCardSave = async () => {
    if (!bulkCardForm.cardNumber || bulkCardForm.cardNumber.replace(/\s+/g, '').length < 16) {
      showToast('16 xonali karta raqamini kiriting', 'error')
      return
    }

    setSavingBulk(true)
    try {
      const res = await fetch('/api/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '8021115446',
        },
        body: JSON.stringify({
          action: 'bulk_update_card',
          cardNumber: bulkCardForm.cardNumber.replace(/\s+/g, ''),
          cardOwner: bulkCardForm.cardOwner,
          cardBank: bulkCardForm.cardBank,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('✅ Barcha tariflarning karta raqamlari bittada yangilandi!')
        setBulkCardModal(false)
        loadTariffs()
      } else {
        showToast(data.error || 'Xatolik', 'error')
      }
    } catch {
      showToast('Ulanishda xatolik', 'error')
    } finally {
      setSavingBulk(false)
    }
  }

  // Reset to Full Defaults
  const handleResetDefaults = async () => {
    if (!confirm('Mukammal standart tariflarni (Kunlik, Haftalik, Oylik VIP) qayta tiklashni xohlaysizmi?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/tariffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '8021115446',
        },
        body: JSON.stringify({ action: 'reset_default_tariffs' }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('✅ Standart mukammal tariflar to‘liq tiklandi!')
        loadTariffs()
      } else {
        showToast(data.error || 'Xatolik', 'error')
      }
    } catch {
      showToast('Xatolik yuz berdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
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

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0d172e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Crown size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">PayGo Admin</span>
                <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                  CRM
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Tariflar & To‘lov Kartalarini Boshqarish</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Admin CRM (/admin)</span>
            </Link>

            <Link
              href="/panel"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition"
            >
              <Store size={14} />
              <span className="hidden sm:inline">Shaxsiy Panel (/panel)</span>
            </Link>

            <Link
              href="/tariffs"
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition"
            >
              <CreditCard size={14} />
              <span>Saytdagi Ko‘rinish (/tariffs)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Info & Bulk Actions Banner */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#121c33] via-[#101b35] to-[#14203b] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-0.5 text-xs font-bold text-amber-300">
                <Sparkles size={13} />
                <span>TEZKOR BOSHQARUV PANELI</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Tariflar, Karta Raqamlari va Narxlarni Sozlash
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Tariflarning barcha imkoniyatlari tayyor holatda tuzilgan. Siz faqat o‘zingizning <b>Karta raqamingiz</b>, <b>Karta egasi</b> va kerakli <b>Tarif narxini (Summa)</b> to‘g‘ridan-to‘g‘ri quyidagi kartalarda o‘zgartirib saqlashingiz mumkin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition"
              >
                <RotateCcw size={14} />
                <span>Standartlarni Tiklash</span>
              </button>

              <button
                type="button"
                onClick={() => setBulkCardModal(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition cursor-pointer"
              >
                <CreditCard size={14} />
                <span>Barcha Kartalarni Bitta O‘zgartirish</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setEditingFullTariff({
                    id: `tariff-${Date.now()}`,
                    name: 'Yangi Maxsus Tarif',
                    description: 'Yangi tarif tavsifi',
                    price: 45000,
                    period: 'oy',
                    cardNumber: '9860350123453587',
                    cardOwner: 'AZizbek I',
                    cardBank: 'HUMOCARD',
                    active: true,
                    featuresText: `⚡️ @humocardbot orqali 1 soniyada avto-to‘lov\n🏪 5 tagacha do‘kon ochish\n🔗 Alohida Webhook & Kanal\n👥 VIP Guruhlar & Pullik yozish\n0% komissiya, to‘g‘ridan-to‘g‘ri kartangizga`,
                  })
                }
                className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Yangi Tarif Qo‘shish</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tariffs List with Direct Quick-Edit Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard size={20} className="text-amber-400" />
              <span>Mavjud Tariflar ({tariffs.length} ta)</span>
            </h2>
            <span className="text-xs text-slate-400">Har bir kartadagi narx va kartani tahrirlab saqlang</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.map((t) => {
              const currentFields = editedFields[t.id] || {
                price: t.price || 0,
                cardNumber: t.cardNumber || '9860350123453587',
                cardOwner: t.cardOwner || 'AZizbek I',
                cardBank: t.cardBank || 'HUMOCARD',
              }

              let featuresList: string[] = []
              try {
                if (Array.isArray(t.features)) {
                  featuresList = t.features.map((f) => String(f))
                } else if (typeof t.features === 'string') {
                  const trimmed = t.features.trim()
                  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    const p = JSON.parse(trimmed)
                    if (Array.isArray(p)) featuresList = p.map((f) => String(f))
                  }
                  if (!featuresList.length) {
                    featuresList = trimmed.split('\n').map((s) => s.trim()).filter(Boolean)
                  }
                }
              } catch {
                featuresList = []
              }

              const isSaving = savingId === t.id

              return (
                <div
                  key={t.id}
                  className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#141f38] p-6 space-y-5 hover:border-slate-700 transition shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                          <span>{t.name}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t.description || '1 soniyalik to‘lov'}</p>
                      </div>
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-bold text-amber-300">
                        1 {t.period || 'oy'}
                      </span>
                    </div>

                    {/* Quick Edit 1: NARXI (SUMMA) */}
                    <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800 space-y-1.5">
                      <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        💰 Tarif Narxi (UZS):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={currentFields.price}
                          onChange={(e) =>
                            setEditedFields({
                              ...editedFields,
                              [t.id]: {
                                ...currentFields,
                                price: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-base font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                        />
                        <span className="text-xs font-bold text-slate-400">UZS</span>
                      </div>
                    </div>

                    {/* Quick Edit 2: KARTA RAQAMI & EGASI */}
                    <div className="rounded-2xl bg-slate-900/70 p-3.5 border border-slate-800 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-300">💳 Qabul Qiluvchi Karta:</label>
                          <span className="text-[10px] text-emerald-400 font-bold">16 xonali</span>
                        </div>
                        <input
                          type="text"
                          value={currentFields.cardNumber}
                          onChange={(e) =>
                            setEditedFields({
                              ...editedFields,
                              [t.id]: {
                                ...currentFields,
                                cardNumber: e.target.value.replace(/\s+/g, ''),
                              },
                            })
                          }
                          placeholder="9860350123453587"
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-blue-400 tracking-wider"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Karta Egasi (Ism):</label>
                          <input
                            type="text"
                            value={currentFields.cardOwner}
                            onChange={(e) =>
                              setEditedFields({
                                ...editedFields,
                                [t.id]: {
                                ...currentFields,
                                cardOwner: e.target.value,
                              },
                            })
                          }
                            placeholder="AZizbek I"
                            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Karta Turi:</label>
                          <select
                            value={currentFields.cardBank}
                            onChange={(e) =>
                              setEditedFields({
                                ...editedFields,
                                [t.id]: {
                                  ...currentFields,
                                  cardBank: e.target.value,
                                },
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-400"
                          >
                            <option value="HUMOCARD">HUMOCARD</option>
                            <option value="UZCARD">UZCARD</option>
                            <option value="HUMO">HUMO</option>
                            <option value="VISA">VISA</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Features Preview (Ready built) */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Tayyor Imkoniyatlar:</span>
                        <span className="text-[10px] text-slate-500 font-normal">{featuresList.length} ta punkt</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300 max-h-36 overflow-y-auto pr-1">
                        {featuresList.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleQuickSave(t)}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-[0.99]"
                    >
                      <Save size={14} className={isSaving ? 'animate-spin' : ''} />
                      <span>{isSaving ? 'Saqlanmoqda...' : '💾 O‘zgarishlarni Saqlash'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingFullTariff({
                            ...t,
                            featuresText: Array.isArray(t.features)
                              ? t.features.join('\n')
                              : typeof t.features === 'string'
                              ? t.features
                              : featuresList.join('\n'),
                          })
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-300 transition"
                      >
                        <Edit2 size={12} />
                        <span>Matnlarni tahrirlash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTariff(t.id)}
                        title="O‘chirish"
                        className="grid size-8 place-items-center rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Bulk Card Modal */}
      {bulkCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#14203b] p-6 sm:p-8 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard size={18} className="text-blue-400" />
                <span>Barcha Tariflarga Karta O‘rnatish</span>
              </h3>
              <button
                type="button"
                onClick={() => setBulkCardModal(false)}
                className="grid size-8 place-items-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Kiritilgan karta raqami va egasi barcha mavjud tariflarga bir vaqtda tatbiq etiladi.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">16 xonali karta raqami:</label>
                <input
                  type="text"
                  value={bulkCardForm.cardNumber}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardNumber: e.target.value.replace(/\s+/g, '') })}
                  placeholder="9860350123453587"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-mono font-bold text-white outline-none focus:border-blue-400 tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta egasi (Ism):</label>
                <input
                  type="text"
                  value={bulkCardForm.cardOwner}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardOwner: e.target.value })}
                  placeholder="AZizbek I"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta turi:</label>
                <select
                  value={bulkCardForm.cardBank}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardBank: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                >
                  <option value="HUMOCARD">HUMOCARD</option>
                  <option value="UZCARD">UZCARD</option>
                  <option value="HUMO">HUMO</option>
                  <option value="VISA">VISA</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBulkCardModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleBulkCardSave}
                disabled={savingBulk}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition"
              >
                <Save size={13} />
                <span>{savingBulk ? 'Saqlanmoqda...' : 'Barchasiga Saqlash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Modal */}
      {editingFullTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-[#14203b] p-6 sm:p-8 shadow-2xl text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-amber-400" />
                <span>Tarif Tafsilotlari & Imkoniyatlari</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingFullTariff(null)}
                className="grid size-8 place-items-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tarif nomi:</label>
                <input
                  type="text"
                  value={editingFullTariff.name || ''}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Narxi (UZS):</label>
                <input
                  type="number"
                  value={editingFullTariff.price || 0}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Davr birligi:</label>
                <input
                  type="text"
                  value={editingFullTariff.period || 'oy'}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, period: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">To‘lov karta raqami:</label>
                <input
                  type="text"
                  value={editingFullTariff.cardNumber || ''}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, cardNumber: e.target.value.replace(/\s+/g, '') })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta egasi:</label>
                <input
                  type="text"
                  value={editingFullTariff.cardOwner || ''}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, cardOwner: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta turi (HUMOCARD / UZCARD):</label>
                <input
                  type="text"
                  value={editingFullTariff.cardBank || 'HUMOCARD'}
                  onChange={(e) => setEditingFullTariff({ ...editingFullTariff, cardBank: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Qisqa tavsif:</label>
              <input
                type="text"
                value={editingFullTariff.description || ''}
                onChange={(e) => setEditingFullTariff({ ...editingFullTariff, description: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Imkoniyatlar ro‘yxati (Har bir qatorda bitta):
              </label>
              <textarea
                rows={6}
                value={editingFullTariff.featuresText || ''}
                onChange={(e) => setEditingFullTariff({ ...editingFullTariff, featuresText: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs text-white outline-none focus:border-amber-400 leading-relaxed font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingFullTariff(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSaveFullTariff}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 transition"
              >
                <Save size={14} />
                <span>Saqlash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
