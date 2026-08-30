'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Plus,
  Settings2,
  Store,
  Webhook,
  ShieldCheck,
  UserCheck,
  CreditCard,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  DollarSign,
  TrendingUp,
  Key,
  Lock,
} from 'lucide-react'

export function PaybotDashboard() {
  const [adminId, setAdminId] = useState<string>('8021115446')
  const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'tariffs' | 'admins' | 'payments'>('overview')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [crmData, setCrmData] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Tariff form modal
  const [tariffModalOpen, setTariffModalOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState<any>(null)
  const [tariffForm, setTariffForm] = useState({
    name: '',
    description: '',
    price: '',
    period: 'month',
    cardNumber: '9860350123453587',
    cardOwner: 'AZizbek I',
    cardBank: 'HUMOCARD',
    active: true,
  })

  // Admin add modal
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [newAdminTelegramId, setNewAdminTelegramId] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('admin')

  // Load CRM Data
  const loadCrm = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/admin/crm?adminId=${adminId}`, {
        headers: { 'x-telegram-user-id': adminId },
      })
      const data = await res.json()
      if (data.ok) {
        setCrmData(data)
      } else {
        setErrorMsg(data.error || 'CRM ma’lumotlarini yuklashda xatolik')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Server bilan aloqa uzildi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCrm()
  }, [adminId])

  // Approve / Reject Shop
  const handleApproveShop = async (shopId: string, approved: boolean) => {
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-user-id': adminId },
        body: JSON.stringify({ action: 'approve_shop', shopId, approved }),
      })
      const data = await res.json()
      if (data.ok) {
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(null), 3000)
        loadCrm()
      } else {
        alert(data.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Save Tariff
  const handleSaveTariff = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-user-id': adminId },
        body: JSON.stringify({
          action: 'save_tariff',
          id: editingTariff?.id,
          ...tariffForm,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTariffModalOpen(false)
        setEditingTariff(null)
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(null), 3000)
        loadCrm()
      } else {
        alert(data.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Delete Tariff
  const handleDeleteTariff = async (tariffId: string) => {
    if (!confirm('Ushbu tarifni o‘chirishni xohlaysizmi?')) return
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-user-id': adminId },
        body: JSON.stringify({ action: 'delete_tariff', tariffId }),
      })
      const data = await res.json()
      if (data.ok) {
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(null), 3000)
        loadCrm()
      } else {
        alert(data.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Add Admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-user-id': adminId },
        body: JSON.stringify({
          action: 'add_admin',
          telegramId: newAdminTelegramId,
          role: newAdminRole,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setAdminModalOpen(false)
        setNewAdminTelegramId('')
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(null), 3000)
        loadCrm()
      } else {
        alert(data.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Remove Admin
  const handleRemoveAdmin = async (tId: string) => {
    if (!confirm(`${tId} raqamli adminni o‘chirishni xohlaysizmi?`)) return
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-user-id': adminId },
        body: JSON.stringify({ action: 'remove_admin', telegramId: tId }),
      })
      const data = await res.json()
      if (data.ok) {
        setActionSuccess(data.message)
        setTimeout(() => setActionSuccess(null), 3000)
        loadCrm()
      } else {
        alert(data.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  const copyApi = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const stats = crmData?.stats || {
    totalShops: 0,
    approvedShops: 0,
    pendingShops: 0,
    totalPayments: 0,
    paidPayments: 0,
    totalVolume: 0,
    activeUserbots: 0,
    totalAdmins: 1,
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#152238]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#e3e8f0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#1769e0] text-white shadow-sm shadow-blue-300">
              <Activity size={21} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#1769e0]">
                  PAYGO CRM & ADMIN
                </p>
                <span className="rounded bg-[#eaf2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1769e0]">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-[#718096]">Avtomatlashtirilgan to‘lov boshqaruvi</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1.5 text-xs">
              <ShieldCheck size={15} className="text-[#16865b]" />
              <span className="text-[#64748b]">Admin ID:</span>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-24 font-mono font-bold text-[#152238] bg-transparent outline-none"
                title="Admin Telegram ID sini o‘zgartirish"
              />
            </div>
            <button
              onClick={loadCrm}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-[#dfe7f2] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f8fafc]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <div className="size-9 rounded-full bg-[#dceaff] text-center pt-2 text-xs font-bold text-[#1769e0]">
              ADMIN
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-[1400px] gap-2 px-6 lg:px-10 overflow-x-auto border-t border-[#f1f5f9]">
          {[
            { id: 'overview', label: '📊 Asosiy Ko‘rsatkichlar' },
            { id: 'shops', label: `🏪 Do‘konlar (${stats.totalShops})` },
            { id: 'tariffs', label: `💳 Maxsus Tariflar (${crmData?.tariffs?.length || 3})` },
            { id: 'admins', label: `🛡 Adminlar & Rollar (${stats.totalAdmins})` },
            { id: 'payments', label: `💰 To‘lovlar (${stats.totalPayments})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 py-3 px-3 text-xs font-semibold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#1769e0] text-[#1769e0]'
                  : 'border-transparent text-[#718096] hover:text-[#152238]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main container */}
      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        {actionSuccess && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-[#eaf8f1] border border-[#bbf7d0] p-4 text-xs font-semibold text-[#16865b]">
            <Check size={16} />
            {actionSuccess}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 rounded-xl bg-[#fef2f2] border border-[#fecaca] p-4 text-xs text-[#991b1b]">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="mb-1 font-mono text-xs uppercase tracking-[.18em] text-[#1769e0]">
                  CRM Boshqaruv
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Admin & To‘lov Boshqaruvi</h1>
                <p className="mt-1 max-w-xl text-sm text-[#718096]">
                  Do‘konlarni tasdiqlash, pullik tariflar narxi va karta rekvizitlarini boshqarish, admin qo‘shish va tushumlarni monitoring qilish.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingTariff(null)
                    setTariffForm({
                      name: '',
                      description: '',
                      price: '',
                      period: 'month',
                      cardNumber: '9860350123453587',
                      cardOwner: 'AZizbek I',
                      cardBank: 'HUMOCARD',
                      active: true,
                    })
                    setTariffModalOpen(true)
                  }}
                  className="flex items-center gap-2 rounded-lg bg-[#1769e0] px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#1258be]"
                >
                  <Plus size={15} /> Yangi Tarif
                </button>
                <button
                  onClick={() => setAdminModalOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-[#dfe7f2] bg-white px-4 py-2.5 text-xs font-semibold text-[#152238] hover:bg-[#f8fafc]"
                >
                  <UserCheck size={15} /> Admin Tayinlash
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<DollarSign size={20} className="text-[#16865b]" />}
                label="Jami tushum (Hajm)"
                value={`${(stats.totalVolume || 0).toLocaleString()} UZS`}
                sub={`${stats.paidPayments} ta to‘lov amalga oshirildi`}
              />
              <StatCard
                icon={<Store size={20} className="text-[#1769e0]" />}
                label="Do‘konlar soni"
                value={`${stats.totalShops} ta`}
                sub={`✅ ${stats.approvedShops} faol / ⏳ ${stats.pendingShops} tasdiq kutilmoqda`}
              />
              <StatCard
                icon={<Bot size={20} className="text-[#8e24aa]" />}
                label="Faol Userbotlar"
                value={`${stats.activeUserbots} ta`}
                sub="Humocardbot monitoringi faol"
              />
              <StatCard
                icon={<ShieldCheck size={20} className="text-[#e65100]" />}
                label="Tizim Adminlari"
                value={`${stats.totalAdmins} ta`}
                sub="To‘liq boshqaruv huquqiga ega"
              />
            </div>

            {/* Quick Cards Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-xl border border-[#e3e8f0] bg-white p-6 lg:col-span-2">
                <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
                  <div>
                    <h2 className="font-semibold text-sm">Oxirgi Yaratilgan Do‘konlar</h2>
                    <p className="text-xs text-[#718096]">Admin tasdiqlashi talab etiladigan do‘konlar</p>
                  </div>
                  <button onClick={() => setActiveTab('shops')} className="text-xs font-semibold text-[#1769e0] hover:underline">
                    Barchasi ({crmData?.shops?.length || 0}) →
                  </button>
                </div>
                <div className="mt-4 divide-y divide-[#f1f5f9]">
                  {(crmData?.shops || []).slice(0, 4).map((shop: any) => (
                    <div key={shop.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#152238]">{shop.name}</span>
                          <span className="text-[11px] font-mono text-[#64748b]">({shop.cardLast4 ? `•••• ${shop.cardLast4}` : 'Karta yo‘q'})</span>
                          {shop.approved ? (
                            <span className="rounded bg-[#eaf8f1] px-2 py-0.5 text-[10px] font-bold text-[#16865b]">
                              Tasdiqlangan
                            </span>
                          ) : (
                            <span className="rounded bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#d97706]">
                              Kutilmoqda
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-[#718096]">
                          Egasi: <b>{shop.accountOwner || 'Noma’lum'}</b> | User ID: <code>{shop.userId}</code>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {shop.approved ? (
                          <button
                            onClick={() => handleApproveShop(shop.id, false)}
                            className="rounded-lg border border-[#fecaca] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#dc2626] hover:bg-[#fef2f2]"
                          >
                            To‘xtatish
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproveShop(shop.id, true)}
                            className="rounded-lg bg-[#16865b] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#126e49]"
                          >
                            ✅ Tasdiqlash
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* API and Webhook Card */}
              <section className="rounded-xl border border-[#e3e8f0] bg-[#14243c] p-6 text-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#8eaddb]">Admin API & Webhook</p>
                    <Settings2 size={18} className="text-[#9db5d7]" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold">Tizim Integratsiyasi</h3>
                  <p className="mt-1 text-xs text-[#9db5d7] leading-relaxed">
                    Userbot to‘lovlarni Humocardbotdan ushlab, Telegram webhook orqali uzatmoqda.
                  </p>
                  <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3 font-mono text-xs text-[#c4d2e8]">
                    pb_master_••••••••••••8021
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[#9db5d7]">Bot Webhook</span>
                  <span className="text-[#4ade80] font-semibold">🟢 Faol</span>
                </div>
              </section>
            </div>

            {/* Webhook & Userbot Config Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <WebhookCard />
              <UserbotCard />
            </div>
          </div>
        )}

        {/* TAB 2: SHOPS MANAGEMENT */}
        {activeTab === 'shops' && (
          <div className="rounded-xl border border-[#e3e8f0] bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-5">
              <div>
                <h2 className="text-lg font-semibold">Barcha Do‘konlar va Kartalar</h2>
                <p className="text-xs text-[#718096]">Foydalanuvchilar ochgan do‘konlarni tekshiring va tasdiqlang</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] font-semibold">
                    <th className="p-3">Do‘kon Nomi</th>
                    <th className="p-3">Karta Raqami</th>
                    <th className="p-3">Karta Egasi</th>
                    <th className="p-3">Telegram ID</th>
                    <th className="p-3">Userbot</th>
                    <th className="p-3">Holat</th>
                    <th className="p-3 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(crmData?.shops || []).map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-semibold text-[#152238]">{s.name}</td>
                      <td className="p-3 font-mono font-medium">{s.cardNumber || s.cardLast4 || 'Mavjud emas'}</td>
                      <td className="p-3">{s.accountOwner || '—'}</td>
                      <td className="p-3 font-mono text-[#64748b]">{s.userId}</td>
                      <td className="p-3">
                        {s.userbotSession ? (
                          <span className="text-[#16865b] font-semibold">🟢 Ulangan</span>
                        ) : (
                          <span className="text-[#94a3b8]">🔴 Ulanmagan</span>
                        )}
                      </td>
                      <td className="p-3">
                        {s.approved ? (
                          <span className="rounded bg-[#eaf8f1] px-2 py-0.5 text-[10px] font-bold text-[#16865b]">
                            ✅ Faol
                          </span>
                        ) : (
                          <span className="rounded bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#d97706]">
                            ⏳ Kutilmoqda
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {s.approved ? (
                          <button
                            onClick={() => handleApproveShop(s.id, false)}
                            className="rounded-lg border border-[#fecaca] px-2.5 py-1 text-[11px] font-semibold text-[#dc2626] hover:bg-[#fef2f2]"
                          >
                            To‘xtatish
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproveShop(s.id, true)}
                            className="rounded-lg bg-[#16865b] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#126e49]"
                          >
                            ✅ Tasdiqlash
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: TARIFFS MANAGEMENT */}
        {activeTab === 'tariffs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Maxsus Pullik Tariflar</h2>
                <p className="text-xs text-[#718096]">
                  Tarif narxlari, muddati va tushum qabul qilinadigan karta raqami & egasi
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTariff(null)
                  setTariffForm({
                    name: '',
                    description: '',
                    price: '',
                    period: 'month',
                    cardNumber: '9860350123453587',
                    cardOwner: 'AZizbek I',
                    cardBank: 'HUMOCARD',
                    active: true,
                  })
                  setTariffModalOpen(true)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#1769e0] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1258be]"
              >
                <Plus size={15} /> Yangi Tarif Qo‘shish
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {(crmData?.tariffs || []).map((t: any) => (
                <div key={t.id} className="rounded-xl border border-[#dfe7f2] bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#152238]">{t.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.active ? 'bg-[#eaf8f1] text-[#16865b]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                        {t.active ? 'FAOL' : 'NOFAOL'}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[#1769e0]">
                      {Number(t.price).toLocaleString()} <span className="text-xs font-normal text-[#718096]">UZS / {t.period}</span>
                    </p>
                    <p className="mt-2 text-xs text-[#718096]">{t.description || 'Tarif tavsifi mavjud emas'}</p>

                    <div className="mt-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3 text-[11px] space-y-1">
                      <div className="text-[#64748b]">💳 Rekvizit karta:</div>
                      <div className="font-mono font-bold text-[#152238]">{t.cardNumber}</div>
                      <div className="text-[#64748b]">👤 Egasi: <b className="text-[#152238]">{t.cardOwner}</b></div>
                      <div className="text-[#64748b]">🏦 Tizim: <b>{t.cardBank || 'HUMOCARD'}</b></div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 pt-3 border-t border-[#f1f5f9]">
                    <button
                      onClick={() => {
                        setEditingTariff(t)
                        setTariffForm({
                          name: t.name,
                          description: t.description || '',
                          price: String(t.price),
                          period: t.period || 'month',
                          cardNumber: t.cardNumber || '9860350123453587',
                          cardOwner: t.cardOwner || 'AZizbek I',
                          cardBank: t.cardBank || 'HUMOCARD',
                          active: t.active,
                        })
                        setTariffModalOpen(true)
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#dfe7f2] bg-white py-2 text-xs font-semibold text-[#1769e0] hover:bg-[#f0f7ff]"
                    >
                      <Edit3 size={13} /> Tahrirlash
                    </button>
                    <button
                      onClick={() => handleDeleteTariff(t.id)}
                      className="rounded-lg border border-[#fecaca] p-2 text-[#dc2626] hover:bg-[#fef2f2]"
                      title="O‘chirish"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ADMINS & ROLES */}
        {activeTab === 'admins' && (
          <div className="rounded-xl border border-[#e3e8f0] bg-white p-6">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h2 className="text-lg font-semibold">Tizim Adminlari va Huquqlar</h2>
                <p className="text-xs text-[#718096]">
                  Bot va sayt panelini boshqarish huquqiga ega Telegram ID lari
                </p>
              </div>
              <button
                onClick={() => setAdminModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#1769e0] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1258be]"
              >
                <Plus size={15} /> Yangi Admin Qo‘shish
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] font-semibold">
                    <th className="p-3">Telegram ID</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Qo‘shgan admin</th>
                    <th className="p-3">Sana</th>
                    <th className="p-3 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(crmData?.roles || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-mono font-bold text-[#152238]">
                        {r.telegramId}
                        {r.telegramId === '8021115446' && (
                          <span className="ml-2 rounded bg-[#eaf2ff] px-2 py-0.5 text-[10px] text-[#1769e0]">
                            Bosh Superadmin
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-[#f0f7ff] px-2 py-0.5 text-[10px] font-bold text-[#1769e0] uppercase">
                          {r.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#64748b]">{r.addedBy || 'Tizim'}</td>
                      <td className="p-3 text-[#64748b]">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        {r.telegramId !== '8021115446' && (
                          <button
                            onClick={() => handleRemoveAdmin(r.telegramId)}
                            className="rounded-lg border border-[#fecaca] px-2.5 py-1 text-[11px] font-semibold text-[#dc2626] hover:bg-[#fef2f2]"
                          >
                            O‘chirish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: PAYMENTS LOGS */}
        {activeTab === 'payments' && (
          <div className="rounded-xl border border-[#e3e8f0] bg-white p-6">
            <div className="border-b border-[#f1f5f9] pb-4">
              <h2 className="text-lg font-semibold">Tushumlar va To‘lovlar Jurnali</h2>
              <p className="text-xs text-[#718096]">Barcha real vaqtda ushlangan HUMO to‘lovlari</p>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] font-semibold">
                    <th className="p-3">Payment ID</th>
                    <th className="p-3">Summa</th>
                    <th className="p-3">Foydalanuvchi</th>
                    <th className="p-3">Holat</th>
                    <th className="p-3">Sana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(crmData?.payments || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-mono text-[#64748b]">{p.id.slice(0, 12)}...</td>
                      <td className="p-3 font-bold text-[#152238]">
                        {(p.amount || 0).toLocaleString()} {p.currency}
                      </td>
                      <td className="p-3 font-mono text-[#64748b]">{p.userId}</td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            p.status === 'paid'
                              ? 'bg-[#eaf8f1] text-[#16865b]'
                              : p.status === 'pending'
                              ? 'bg-[#fef3c7] text-[#d97706]'
                              : 'bg-[#f1f5f9] text-[#64748b]'
                          }`}
                        >
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-[#64748b]">{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* TARIFF EDIT / CREATE MODAL */}
      {tariffModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14243c]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#e2e8f0]">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <h3 className="text-base font-bold text-[#152238]">
                {editingTariff ? 'Tarifni Tahrirlash' : 'Yangi Tarif Yaratish'}
              </h3>
              <button onClick={() => setTariffModalOpen(false)} className="text-xs text-[#718096]">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTariff} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold">Tarif Nomi</label>
                <input
                  type="text"
                  required
                  value={tariffForm.name}
                  onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })}
                  placeholder="Masalan: Oylik VIP"
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 font-medium outline-none focus:border-[#1769e0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold">Narxi (UZS)</label>
                  <input
                    type="number"
                    required
                    value={tariffForm.price}
                    onChange={(e) => setTariffForm({ ...tariffForm, price: e.target.value })}
                    placeholder="27858"
                    className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 font-mono outline-none focus:border-[#1769e0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Muddati</label>
                  <select
                    value={tariffForm.period}
                    onChange={(e) => setTariffForm({ ...tariffForm, period: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 outline-none focus:border-[#1769e0]"
                  >
                    <option value="day">Kunlik (day)</option>
                    <option value="week">Haftalik (week)</option>
                    <option value="month">Oylik (month)</option>
                    <option value="year">Yillik (year)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold">To‘lov Qabul Qiluvchi Karta Raqami</label>
                <input
                  type="text"
                  required
                  value={tariffForm.cardNumber}
                  onChange={(e) => setTariffForm({ ...tariffForm, cardNumber: e.target.value })}
                  placeholder="9860 3501 2345 3587"
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 font-mono outline-none focus:border-[#1769e0]"
                />
              </div>

              <div>
                <label className="block font-semibold">Karta Egasi (Ism Sharifi)</label>
                <input
                  type="text"
                  required
                  value={tariffForm.cardOwner}
                  onChange={(e) => setTariffForm({ ...tariffForm, cardOwner: e.target.value })}
                  placeholder="AZizbek I"
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 outline-none focus:border-[#1769e0]"
                />
              </div>

              <div>
                <label className="block font-semibold">Tarif Tavsifi</label>
                <textarea
                  rows={2}
                  value={tariffForm.description}
                  onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })}
                  placeholder="Ushbu tarif haqida qisqacha ma’lumot..."
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 outline-none focus:border-[#1769e0]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTariffModalOpen(false)}
                  className="rounded-xl border border-[#dfe7f2] px-4 py-2.5 font-semibold text-[#64748b]"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1769e0] px-5 py-2.5 font-semibold text-white hover:bg-[#1258be]"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN ADD MODAL */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14243c]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#e2e8f0]">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <h3 className="text-base font-bold text-[#152238]">Yangi Admin Qo‘shish</h3>
              <button onClick={() => setAdminModalOpen(false)} className="text-xs text-[#718096]">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold">Telegram ID Raqami</label>
                <input
                  type="text"
                  required
                  value={newAdminTelegramId}
                  onChange={(e) => setNewAdminTelegramId(e.target.value)}
                  placeholder="Masalan: 123456789"
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 font-mono outline-none focus:border-[#1769e0]"
                />
              </div>

              <div>
                <label className="block font-semibold">Rol darajasi</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dfe7f2] p-2.5 outline-none focus:border-[#1769e0]"
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="rounded-xl border border-[#dfe7f2] px-4 py-2.5 font-semibold text-[#64748b]"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1769e0] px-5 py-2.5 font-semibold text-white hover:bg-[#1258be]"
                >
                  Admin Qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-[#e3e8f0] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#718096] font-medium">{label}</span>
        <div className="rounded-lg bg-[#f8fafc] p-2">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#152238] tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-[#64748b]">{sub}</p>
    </div>
  )
}

function WebhookCard() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [info, setInfo] = useState<any>(null)

  const checkOrSet = async (action: 'set' | 'check') => {
    setLoading(true)
    setStatusMsg(null)
    try {
      let url = '/api/telegram/activate'
      const params = new URLSearchParams()
      if (token.trim()) params.append('token', token.trim())
      if (action === 'set' && webhookUrl.trim()) params.append('url', webhookUrl.trim())
      if (params.toString()) url += `?${params.toString()}`

      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setStatusMsg({
          ok: true,
          text: data.message || 'Telegram webhook muvaffaqiyatli yangilandi!',
        })
        setInfo(data.currentWebhookInfo)
      } else {
        setStatusMsg({
          ok: false,
          text: data.error || data.message || 'Xatolik yuz berdi',
        })
      }
    } catch (err: any) {
      setStatusMsg({ ok: false, text: err?.message || 'Server xatosi' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-[#e3e8f0] bg-white p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ff] text-[#1769e0]">
          <Webhook size={19} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Telegram Webhook</h3>
          <p className="mt-1 text-xs leading-5 text-[#718096]">
            Telegram botingizni hozirgi server manziliga ulash va yangilash.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(true)
            if (typeof window !== 'undefined') {
              setWebhookUrl(`${window.location.origin}/api/telegram/webhook`)
            }
          }}
          className="ml-auto hidden shrink-0 text-xs font-semibold text-[#1769e0] sm:block hover:underline"
        >
          Sozlash <ArrowUpRight className="ml-1 inline" size={14} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14243c]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#e2e8f0]">
            <div className="flex items-start justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#1769e0]">
                  Telegram Bot Webhook
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#152238]">
                  Webhook URL manzilini ulash
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-xs text-[#718096] hover:bg-[#f1f5f9]"
              >
                ✕ Yopish
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-[#f0f7ff] p-3 text-xs leading-5 text-[#1e40af]">
                ℹ️ <b>Muhim:</b> Agar botingiz eski Vercel linkiga javob berayotgan bo‘lsa, ushbu tugma orqali Webhookni hozirgi yangi serverga yangilang!
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Telegram Bot Token (ixtiyoriy, agar .env da bo‘lmasa)
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="8123456789:AAH..."
                  className="mt-1.5 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-xs font-mono outline-none focus:border-[#1769e0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Webhook qabul qiluvchi URL
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://.../api/telegram/webhook"
                  className="mt-1.5 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-xs font-mono outline-none focus:border-[#1769e0]"
                />
              </div>

              {statusMsg && (
                <div
                  className={`rounded-xl p-3 text-xs border ${
                    statusMsg.ok
                      ? 'bg-[#eaf8f1] text-[#16865b] border-[#bbf7d0]'
                      : 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              {info && (
                <div className="rounded-xl bg-[#f8fafc] p-3 border border-[#e2e8f0] text-[11px] text-[#64748b] font-mono space-y-1">
                  <div>Hozirgi Webhook: <b>{info.url || 'O‘rnatilmagan'}</b></div>
                  {info.last_error_message && (
                    <div className="text-red-500">Oxirgi xatolik: {info.last_error_message}</div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => checkOrSet('set')}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-[#1769e0] py-2.5 text-xs font-bold text-white hover:bg-[#1258be] transition disabled:opacity-50"
                >
                  {loading ? 'Bajarilmoqda...' : 'Webhook O‘rnatish'}
                </button>
                <button
                  onClick={() => checkOrSet('check')}
                  disabled={loading}
                  className="rounded-xl border border-[#dfe7f2] bg-white px-4 py-2.5 text-xs font-semibold text-[#152238] hover:bg-[#f8fafc]"
                >
                  Holatni Tekshirish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UserbotCard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<string>('idle')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [connected, setConnected] = useState(false)

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/telegram/onboarding?action=status')
      const data = await res.json()
      if (data.active) {
        setConnected(true)
        setStep('active')
      }
    } catch {}
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const submitStep = async () => {
    setLoading(true)
    setStatusMsg(null)
    try {
      let url = '/api/telegram/onboarding'
      let body: any = {}

      if (step === 'idle' || step === 'awaiting_api_id') {
        body = { action: 'set_api_id', apiId }
      } else if (step === 'awaiting_api_hash') {
        body = { action: 'set_api_hash', apiHash }
      } else if (step === 'awaiting_phone') {
        body = { action: 'start_login', phone }
      } else if (step === 'awaiting_code') {
        body = { action: 'verify_code', code }
      } else if (step === 'awaiting_2fa') {
        body = { action: 'submit_2fa', password }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.ok) {
        setStep(data.step)
        if (data.step === 'active') {
          setConnected(true)
          setStatusMsg({
            ok: true,
            text: '🎉 Userbot muvaffaqiyatli ulandi! Humocardbot xabarnomalari real vaqtda ushlanmoqda.',
          })
        }
      } else {
        setStatusMsg({ ok: false, text: data.error || 'Xatolik yuz berdi' })
      }
    } catch (err: any) {
      setStatusMsg({ ok: false, text: err?.message || 'Server xatosi' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-[#e3e8f0] bg-white p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ff] text-[#1769e0]">
          <Bot size={19} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Telegram Userbot</h3>
            {connected && (
              <span className="rounded bg-[#eaf8f1] px-2 py-0.5 text-[10px] font-bold text-[#16865b]">
                Faol
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#718096]">
            @humocardbot dagi to‘lovlarni avtomatik ushlovchi userbot sessiyasi.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(true)
            if (step === 'idle' && !connected) setStep('awaiting_api_id')
          }}
          className="ml-auto hidden shrink-0 text-xs font-semibold text-[#1769e0] sm:block hover:underline"
        >
          {connected ? 'Holat' : 'Ulash'} <ArrowUpRight className="ml-1 inline" size={14} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14243c]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#e2e8f0]">
            <div className="flex items-start justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#1769e0]">
                  Userbot Konfiguratsiyasi
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#152238]">
                  Telegram Hisobni Ulash
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-xs text-[#718096] hover:bg-[#f1f5f9]"
              >
                ✕ Yopish
              </button>
            </div>

            {connected ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-[#eaf8f1] border border-[#bbf7d0] p-4 text-center">
                  <div className="text-2xl">🎉</div>
                  <h4 className="mt-2 font-bold text-sm text-[#16865b]">
                    Userbot Faol Ishlamoqda
                  </h4>
                  <p className="mt-1 text-xs text-[#16865b]">
                    @humocardbot bildirishnomalari real vaqtda ushlanib, to‘lovlar tasdiqlanmoqda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {statusMsg && (
                  <div
                    className={`rounded-xl p-3 text-xs border ${
                      statusMsg.ok
                        ? 'bg-[#eaf8f1] text-[#16865b] border-[#bbf7d0]'
                        : 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]'
                    }`}
                  >
                    {statusMsg.text}
                  </div>
                )}

                {step === 'awaiting_api_id' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#152238]">
                      Telegram API ID
                    </label>
                    <p className="mt-1 text-[11px] text-[#718096]">
                      my.telegram.org saytidan olingan raqamli API ID:
                    </p>
                    <input
                      type="number"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="12345678"
                      className="mt-2 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#1769e0]"
                    />
                  </div>
                )}

                {step === 'awaiting_api_hash' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#152238]">
                      Telegram API Hash
                    </label>
                    <p className="mt-1 text-[11px] text-[#718096]">
                      my.telegram.org saytidagi 32 ta belgili API Hash:
                    </p>
                    <input
                      type="text"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="0123456789abcdef0123456789abcdef"
                      className="mt-2 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#1769e0]"
                    />
                  </div>
                )}

                {step === 'awaiting_phone' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#152238]">
                      Telefon raqami
                    </label>
                    <p className="mt-1 text-[11px] text-[#718096]">
                      Telegram hisobingiz telefon raqami (+998...):
                    </p>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998901234567"
                      className="mt-2 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#1769e0]"
                    />
                  </div>
                )}

                {step === 'awaiting_code' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#152238]">
                      Telegram tasdiqlash kodi
                    </label>
                    <p className="mt-1 text-[11px] text-[#718096]">
                      Telegramdan kelgan kod. Nuqta bilan ajratib yuborishingiz mumkin (masalan: <b>2.1.2.3.4</b>):
                    </p>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="2.1.2.3.4 yoki 21234"
                      className="mt-2 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-sm font-mono outline-none focus:border-[#1769e0]"
                    />
                  </div>
                )}

                {step === 'awaiting_2fa' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#152238]">
                      2FA Paroli (Cloud Password)
                    </label>
                    <p className="mt-1 text-[11px] text-[#718096]">
                      Hisobingizda 2FA yoqilgan. Parolingizni kiriting:
                    </p>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-2 w-full rounded-xl border border-[#dfe7f2] px-3 py-2.5 text-sm outline-none focus:border-[#1769e0]"
                    />
                  </div>
                )}

                <button
                  onClick={submitStep}
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
                >
                  {loading ? 'Tekshirilmoqda...' : 'Davom etish →'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
