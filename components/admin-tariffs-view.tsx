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
  ShieldAlert,
  Save,
  Store,
  Layers,
  Home,
  Send,
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
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [token, setToken] = useState<string>('')
  const [authLoading, setAuthLoading] = useState<boolean>(true)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modals
  const [editingTariff, setEditingTariff] = useState<any | null>(null)
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
    setAuthLoading(false)
  }, [])

  // Load Tariffs
  const loadTariffs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tariffs')
      const data = await res.json()
      if (data.ok && Array.isArray(data.tariffs)) {
        setTariffs(data.tariffs)
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

  // Save / Update Tariff
  const handleSaveTariff = async () => {
    if (!editingTariff || !editingTariff.name) {
      showToast('Tarif nomini kiriting', 'error')
      return
    }

    setLoading(true)
    try {
      let featuresArr: string[] = []
      if (typeof editingTariff.featuresText === 'string') {
        featuresArr = editingTariff.featuresText
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)
      } else if (Array.isArray(editingTariff.features)) {
        featuresArr = editingTariff.features
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
            ...editingTariff,
            price: Number(editingTariff.price) || 0,
            features: JSON.stringify(featuresArr),
          },
        }),
      })

      const data = await res.json()
      if (data.ok) {
        showToast('✅ Tarif muvaffaqiyatli saqlandi!')
        setEditingTariff(null)
        loadTariffs()
      } else {
        showToast(data.error || 'Saqlashda xatolik', 'error')
      }
    } catch {
      showToast('Server bilan ulanishda xatolik', 'error')
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
        showToast('Tarif muvaffaqiyatli o‘chirildi')
        loadTariffs()
      } else {
        showToast(data.error || 'O‘chirishda xatolik', 'error')
      }
    } catch {
      showToast('Xatolik yuz berdi', 'error')
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
        showToast('✅ Barcha tariflar uchun to‘lov kartasi yangilandi!')
        setBulkCardModal(false)
        loadTariffs()
      } else {
        showToast(data.error || 'Xatolik yuz berdi', 'error')
      }
    } catch {
      showToast('Ulanishda xatolik', 'error')
    } finally {
      setSavingBulk(false)
    }
  }

  // Reset to Defaults
  const handleResetDefaults = async () => {
    if (!confirm('Birlamchi tariflarni qayta tiklashni xohlaysizmi?')) return
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
        showToast('✅ Birlamchi tariflar tiklandi!')
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
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans">
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

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0d172e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20">
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
              href="/tariffs"
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition"
            >
              <CreditCard size={14} />
              <span>Saytdagi Ko‘rinish (/tariffs)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-[#121c33] p-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard size={22} className="text-amber-400" />
              <span>Tariflar va To‘lov Kartalari Boshqaruvi</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Foydalanuvchilar Premium obuna sotib olishi uchun tarif narxlari, kartalari va imkoniyatlarini sozlang
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition"
            >
              <RotateCcw size={13} />
              <span>Standartlarni Tiklash</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkCardModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition"
            >
              <CreditCard size={13} />
              <span>Barcha Kartalarni O‘zgartirish</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setEditingTariff({
                  id: `tariff-${Date.now()}`,
                  name: 'Yangi Maxsus Tarif',
                  description: 'Tarif tavsifi',
                  price: 30000,
                  period: 'oy',
                  cardNumber: '9860350123453587',
                  cardOwner: 'AZizbek I',
                  cardBank: 'HUMOCARD',
                  active: true,
                  featuresText: `⚡️ @humocardbot orqali 1 soniyada avto-to‘lov\n🏪 5 tagacha do‘kon ochish\n👥 VIP Guruhlar & Pullik yozish\n0% komissiya, to‘g‘ridan-to‘g‘ri kartangizga`,
                })
              }
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition"
            >
              <Plus size={14} />
              <span>Yangi Tarif Qo‘shish</span>
            </button>
          </div>
        </div>

        {/* Tariffs List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tariffs.map((t) => {
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

            const cardNum = String(t.cardNumber || '9860350123453587')

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-[#141f38] p-6 space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{t.name}</h3>
                      <p className="text-[11px] font-mono text-slate-500">ID: {t.id}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                      1 {t.period || 'oy'}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800">
                    <span className="text-xl font-extrabold text-amber-400">
                      {Number(t.price || 0).toLocaleString('uz-UZ')} UZS
                    </span>
                    <span className="text-xs text-slate-400"> / {t.period || 'oy'}</span>
                  </div>

                  <p className="text-xs text-slate-400">{t.description || 'Tavsif mavjud emas'}</p>

                  <div className="rounded-2xl bg-slate-900/60 p-3 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Karta ({t.cardBank || 'HUMO'}):</span>
                      <span className="text-emerald-400 font-bold">Faol</span>
                    </div>
                    <p className="font-mono font-bold text-white tracking-wider">
                      {cardNum.replace(/(\d{4})(?=\d)/g, '$1 ')}
                    </p>
                    <p className="text-[11px] text-slate-400">{t.cardOwner || 'Hisob egasi'}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Imkoniyatlar:</p>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {featuresList.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTariff({
                        ...t,
                        featuresText: Array.isArray(t.features)
                          ? t.features.join('\n')
                          : typeof t.features === 'string'
                          ? t.features
                          : featuresList.join('\n'),
                      })
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-200 transition"
                  >
                    <Edit2 size={13} />
                    <span>Tahrirlash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTariff(t.id)}
                    className="grid size-9 place-items-center rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Edit / Add Modal */}
      {editingTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-[#14203b] p-6 sm:p-8 shadow-2xl text-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-amber-400" />
                <span>Tarifni Sozlash</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTariff(null)}
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
                  value={editingTariff.name || ''}
                  onChange={(e) => setEditingTariff({ ...editingTariff, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Narxi (UZS):</label>
                <input
                  type="number"
                  value={editingTariff.price || 0}
                  onChange={(e) => setEditingTariff({ ...editingTariff, price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Davr birligi (kun/hafta/oy/yil):</label>
                <input
                  type="text"
                  value={editingTariff.period || 'oy'}
                  onChange={(e) => setEditingTariff({ ...editingTariff, period: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">To‘lov karta raqami:</label>
                <input
                  type="text"
                  value={editingTariff.cardNumber || ''}
                  onChange={(e) => setEditingTariff({ ...editingTariff, cardNumber: e.target.value.replace(/\s+/g, '') })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta egasi:</label>
                <input
                  type="text"
                  value={editingTariff.cardOwner || ''}
                  onChange={(e) => setEditingTariff({ ...editingTariff, cardOwner: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta banki/turi (HUMOCARD / UZCARD):</label>
                <input
                  type="text"
                  value={editingTariff.cardBank || 'HUMOCARD'}
                  onChange={(e) => setEditingTariff({ ...editingTariff, cardBank: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tarif qisqa tavsifi:</label>
              <input
                type="text"
                value={editingTariff.description || ''}
                onChange={(e) => setEditingTariff({ ...editingTariff, description: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Imkoniyatlar ro‘yxati (Har bir qatorda bitta punkt):
              </label>
              <textarea
                rows={5}
                value={editingTariff.featuresText || ''}
                onChange={(e) => setEditingTariff({ ...editingTariff, featuresText: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs text-white outline-none focus:border-amber-400 leading-relaxed font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTariff(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSaveTariff}
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

      {/* Bulk Card Modal */}
      {bulkCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#14203b] p-6 shadow-2xl text-slate-100 space-y-4">
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

            <p className="text-xs text-slate-400">
              Ushbu o‘zgarish barcha faol tariflarning qabul qilish karta raqamini bir vaqtda yangilaydi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Yangi 16 xonali karta:</label>
                <input
                  type="text"
                  value={bulkCardForm.cardNumber}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardNumber: e.target.value.replace(/\s+/g, '') })}
                  placeholder="9860350123453587"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-white outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta egasi:</label>
                <input
                  type="text"
                  value={bulkCardForm.cardOwner}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardOwner: e.target.value })}
                  placeholder="AZizbek I"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Karta turi/Banki:</label>
                <input
                  type="text"
                  value={bulkCardForm.cardBank}
                  onChange={(e) => setBulkCardForm({ ...bulkCardForm, cardBank: e.target.value })}
                  placeholder="HUMOCARD"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBulkCardModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleBulkCardSave}
                disabled={savingBulk}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition"
              >
                <Save size={13} />
                <span>{savingBulk ? 'Saqlanmoqda...' : 'Barchasiga Saqlash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
