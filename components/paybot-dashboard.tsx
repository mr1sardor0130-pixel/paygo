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
  Send,
  ExternalLink,
  LogOut,
  Sparkles,
  ArrowLeft,
  FileCode,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

type TabType = 'overview' | 'shop_settings' | 'test_payment' | 'webhook_docs' | 'shops' | 'tariffs' | 'admins' | 'payments'

export function PaybotDashboard() {
  // Auth state
  const [token, setToken] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginPendingToken, setLoginPendingToken] = useState<string | null>(null)
  const [loginBotLink, setLoginBotLink] = useState<string | null>(null)
  const [directTelegramIdInput, setDirectTelegramIdInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  // App tabs & UI state
  const [activeTab, setActiveTab] = useState<TabType>('shop_settings')
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Merchant Shop Settings
  const [shopForm, setShopForm] = useState({
    name: '',
    description: '',
    cardNumber: '9860350123453587',
    accountOwner: 'AZIZBEK KARIMOV',
    cardBank: 'HUMOCARD',
    logoUrl: '',
    webhookUrl: '',
    telegramChannelId: '',
  })
  const [shopData, setShopData] = useState<any>(null)
  const [savingShop, setSavingShop] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [testingChannel, setTestingChannel] = useState(false)

  // Test Payment Creator state
  const [testAmount, setTestAmount] = useState('15000')
  const [createdPayment, setCreatedPayment] = useState<any>(null)
  const [creatingPayment, setCreatingPayment] = useState(false)

  // Admin CRM Data
  const [crmData, setCrmData] = useState<any>(null)
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
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [newAdminTelegramId, setNewAdminTelegramId] = useState('')

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // 1. Initialize Auth on Mount
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true)
      let storedToken = ''
      let queryToken = ''
      let queryUserId = ''

      if (typeof window !== 'undefined') {
        const tg = (window as any).Telegram?.WebApp
        if (tg) {
          try {
            tg.ready?.()
            tg.expand?.()
            const tgUser = tg.initDataUnsafe?.user
            if (tgUser?.id) {
              queryUserId = String(tgUser.id)
            }
          } catch (tgErr) {
            console.warn('Telegram WebApp init warning:', tgErr)
          }
        }

        storedToken = localStorage.getItem('paygo_token') || ''
        const urlParams = new URLSearchParams(window.location.search)
        queryToken = urlParams.get('auth_token') || urlParams.get('token') || ''
        if (!queryUserId) {
          queryUserId = urlParams.get('userId') || urlParams.get('tgWebAppStartParam') || ''
        }

        if (queryToken) {
          storedToken = queryToken
          localStorage.setItem('paygo_token', queryToken)
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }

      if (storedToken || queryUserId) {
        setToken(storedToken)
        await verifyUser(storedToken, queryUserId)
      } else {
        await requestPendingLoginToken()
      }
      setAuthLoading(false)
    }

    initAuth()
  }, [])

  // 2. Request Pending Login Token for Telegram Gateway
  const requestPendingLoginToken = async () => {
    try {
      const res = await fetch('/api/auth/telegram-token', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setLoginPendingToken(data.token)
        setLoginBotLink(data.botLink)
      }
    } catch (e) {
      console.warn('Auth token req error:', e)
    }
  }

  // 3. Poll Telegram Login Token
  useEffect(() => {
    if (!loginPendingToken || currentUser) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/telegram-poll?token=${loginPendingToken}`)
        const data = await res.json()
        if (data.ok && data.status === 'authenticated') {
          setToken(data.token)
          localStorage.setItem('paygo_token', data.token)
          await verifyUser(data.token, data.userId)
        }
      } catch {}
    }, 2000)

    return () => clearInterval(interval)
  }, [loginPendingToken, currentUser])

  // 4. Verify User Session
  const verifyUser = async (authToken: string, fallbackUserId?: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-telegram-user-id': fallbackUserId || '',
        },
      })
      const data = await res.json()
      if (data.ok) {
        setCurrentUser(data)
        if (data.shop) {
          setShopData(data.shop)
          setShopForm({
            name: data.shop.name || '',
            description: data.shop.description || '',
            cardNumber: data.shop.cardNumber || '9860350123453587',
            accountOwner: data.shop.accountOwner || 'Hisob egasi',
            cardBank: data.shop.cardBank || 'HUMOCARD',
            logoUrl: data.shop.logoUrl || '',
            webhookUrl: data.shop.webhookUrl || '',
            telegramChannelId: data.shop.telegramChannelId || '',
          })
        }
        // If admin, load CRM
        if (data.isAdmin) {
          loadCrm(data.telegramId || data.userId)
        }
      } else {
        localStorage.removeItem('paygo_token')
        setToken('')
        setCurrentUser(null)
        requestPendingLoginToken()
      }
    } catch {
      setCurrentUser(null)
    }
  }

  // Direct login by Telegram ID
  const handleDirectTelegramLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!directTelegramIdInput.trim()) return
    setAuthLoading(true)
    setAuthError(null)
    try {
      await verifyUser(token, directTelegramIdInput.trim())
    } catch {
      setAuthError('Foydalanuvchi ma’lumotlarini yuklab bo‘lmadi')
    } finally {
      setAuthLoading(false)
    }
  }

  // Load CRM Data (for Admins)
  const loadCrm = async (adminId?: string) => {
    setLoading(true)
    try {
      const currentAdminId = adminId || currentUser?.telegramId || '8021115446'
      const res = await fetch(`/api/admin/crm?adminId=${currentAdminId}`, {
        headers: { 'x-telegram-user-id': currentAdminId },
      })
      const data = await res.json()
      if (data.ok) {
        setCrmData(data)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  // Save Shop Settings
  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingShop(true)
    const effectiveUserId = currentUser?.telegramId || currentUser?.userId || ''
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': effectiveUserId,
        },
        body: JSON.stringify({
          action: 'update_shop',
          userId: effectiveUserId,
          ...shopForm,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setShopData(data.shop)
        showToast('Do‘kon ma’lumotlari muvaffaqiyatli saqlandi!')
      } else {
        showToast(data.error || 'Saqlashda xatolik yuz berdi', 'error')
      }
    } catch {
      showToast('Server bilan aloqa uzildi', 'error')
    } finally {
      setSavingShop(false)
    }
  }

  // Test Webhook
  const handleTestWebhook = async () => {
    if (!shopForm.webhookUrl) {
      showToast('Avval Webhook URL manzilini kiriting', 'error')
      return
    }
    setTestingWebhook(true)
    const effectiveUserId = currentUser?.telegramId || currentUser?.userId || ''
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': effectiveUserId,
        },
        body: JSON.stringify({
          action: 'test_webhook',
          userId: effectiveUserId,
          webhookUrl: shopForm.webhookUrl,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast(`Webhook yetkazildi! HTTP ${data.status}`)
      } else {
        showToast(data.message || data.error || 'Webhook yetkazilmadi', 'error')
      }
    } catch {
      showToast('Server xatosi', 'error')
    } finally {
      setTestingWebhook(false)
    }
  }

  // Test Channel
  const handleTestChannel = async () => {
    if (!shopForm.telegramChannelId) {
      showToast('Avval Telegram kanal ID sini kiriting', 'error')
      return
    }
    setTestingChannel(true)
    const effectiveUserId = currentUser?.telegramId || currentUser?.userId || ''
    try {
      const res = await fetch('/api/shop/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': effectiveUserId,
        },
        body: JSON.stringify({
          action: 'test_channel',
          userId: effectiveUserId,
          telegramChannelId: shopForm.telegramChannelId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('Kanalga test xabar muvaffaqiyatli yuborildi!')
      } else {
        showToast(data.error || 'Kanalga yuborishda xatolik', 'error')
      }
    } catch {
      showToast('Server xatosi', 'error')
    } finally {
      setTestingChannel(false)
    }
  }

  // Create Test Payment (5-min countdown)
  const handleCreateTestPayment = async () => {
    setCreatingPayment(true)
    setCreatedPayment(null)
    try {
      const amt = Number(testAmount.replace(/\D/g, '')) || 15000
      const res = await fetch('/api/pay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-telegram-user-id': currentUser?.telegramId || '',
        },
        body: JSON.stringify({
          amount: amt,
          userId: currentUser?.telegramId,
        }),
      })

      const data = await res.json()
      if (res.ok && data.ok) {
        setCreatedPayment({
          id: data.id,
          amount: data.amount,
          payUrl: data.payUrl || `${window.location.origin}/pay/${data.id}`,
          expiresAt: data.expiresAt,
        })
        showToast('5 daqiqalik test to‘lov havolasi Neon bazaga yozildi!')
      } else {
        showToast(data.error || 'Test to‘lov yaratishda xatolik', 'error')
      }
    } catch {
      showToast('Server bilan aloqa uzildi', 'error')
    } finally {
      setCreatingPayment(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('paygo_token')
    setToken('')
    setCurrentUser(null)
    requestPendingLoginToken()
  }

  // -------------------------------------------------------------
  // AUTH GATEWAY SCREEN (Shown if not logged in)
  // -------------------------------------------------------------
  if (!authLoading && !currentUser) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-[#152238] flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-3xl p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#1769e0] text-lg font-bold text-white shadow-md shadow-blue-500/20">
              P
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#152238]">PayGo CRM Panel</h1>
              <p className="text-xs text-[#718096]">HUMO To‘lov tizimi boshqaruvi</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl bg-[#eff6ff] p-4 border border-[#bfdbfe]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1e40af]">
              <Lock size={15} /> Xavfsiz Telegram Autentifikatsiyasi
            </div>
            <p className="mt-1 text-[11px] text-[#3b82f6] leading-relaxed">
              Barcha do‘kon, karta, webhook va to‘lov ma’lumotlaringizni boshqarish uchun shaxsiy Telegram profilingiz orqali kiring.
            </p>
          </div>

          {/* Primary Login Button (1-Click Telegram Deep Link) */}
          <a
            href={loginBotLink || 'https://t.me/Pay_Gouzbot'}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1769e0] py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#1254b7] transition active:scale-[0.99]"
          >
            <Send size={16} /> ✈️ @Pay_Gouzbot orqali kirish (1-klikda)
          </a>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]"></div>
            </div>
            <span className="relative bg-white px-3 text-xs text-[#94a3b8]">yoki</span>
          </div>

          {/* Direct ID Form */}
          <form onSubmit={handleDirectTelegramLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Telegram ID raqamingiz:
              </label>
              <input
                type="text"
                value={directTelegramIdInput}
                onChange={(e) => setDirectTelegramIdInput(e.target.value)}
                placeholder="Masalan: 8021115446"
                className="w-full rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-sm outline-none focus:border-[#1769e0] focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl border border-[#cbd5e1] bg-white py-2.5 text-xs font-bold text-[#152238] hover:bg-[#f8fafc] transition"
            >
              ID orqali kirish
            </button>
          </form>

          {authError && (
            <p className="mt-4 text-center text-xs font-medium text-[#dc2626]">{authError}</p>
          )}

          {/* Footer note */}
          <div className="mt-6 flex flex-col items-center gap-1 text-[11px] text-[#94a3b8]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1769e0]">@Pay_Gouzbot</span>
              <span>•</span>
              <span className="font-mono text-[#64748b]">paygo-pearl.vercel.app</span>
            </div>
            <p>PayGo • HUMO To‘lov Avtomatlashtirish Platformasi</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#152238]">
      {/* Toast notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold shadow-lg transition-all ${
            toastMsg.type === 'success' ? 'bg-[#16865b] text-white' : 'bg-[#dc2626] text-white'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toastMsg.text}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e2e8f0] bg-white/90 backdrop-blur-md px-4 lg:px-8 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-[#1769e0] font-bold text-white shadow-sm">
                P
              </div>
              <div>
                <span className="font-mono text-xs font-bold tracking-wider text-[#1769e0]">
                  PAYGO • CRM
                </span>
                <p className="text-[11px] text-[#718096]">
                  {shopData?.name || 'HUMO To‘lov Boshqaruvi'}
                </p>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1 border-l border-[#e2e8f0] pl-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf8f1] px-2.5 py-0.5 text-[11px] font-semibold text-[#16865b]">
                <span className="size-1.5 rounded-full bg-[#16865b]" /> Userbot Faol
              </span>
              {currentUser?.isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-bold text-[#1769e0]">
                  👑 Admin
                </span>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc] transition"
            >
              <ArrowLeft size={14} /> Asosiy sahifa
            </Link>

            <div className="flex items-center gap-2 rounded-xl bg-[#f1f5f9] px-3 py-1.5 text-xs text-[#64748b]">
              <UserCheck size={14} className="text-[#1769e0]" />
              <span className="font-mono">{currentUser?.telegramId || currentUser?.userId || 'User'}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Chiqish"
              className="rounded-xl border border-[#e2e8f0] p-2 text-[#64748b] hover:bg-[#fee2e2] hover:text-[#dc2626] transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] pb-3">
          <button
            onClick={() => setActiveTab('shop_settings')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'shop_settings'
                ? 'bg-[#1769e0] text-white shadow-sm'
                : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <Settings2 size={15} /> ⚙️ Do‘kon Sozlamalari & Karta
          </button>

          <button
            onClick={() => setActiveTab('test_payment')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'test_payment'
                ? 'bg-[#1769e0] text-white shadow-sm'
                : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <Sparkles size={15} /> 🧪 Test To‘lov Yaratish (5 min)
          </button>

          <button
            onClick={() => setActiveTab('webhook_docs')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'webhook_docs'
                ? 'bg-[#1769e0] text-white shadow-sm'
                : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <FileCode size={15} /> 📚 Webhook Doksi (JSON)
          </button>

          {currentUser?.isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'overview'
                    ? 'bg-[#1769e0] text-white shadow-sm'
                    : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                <Activity size={15} /> 📊 Admin Statistika
              </button>

              <button
                onClick={() => setActiveTab('shops')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'shops'
                    ? 'bg-[#1769e0] text-white shadow-sm'
                    : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                <Store size={15} /> 🏪 Barcha Do‘konlar ({crmData?.shops?.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('tariffs')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'tariffs'
                    ? 'bg-[#1769e0] text-white shadow-sm'
                    : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                <CreditCard size={15} /> 💎 Tariflar Boshqaruvi
              </button>

              <button
                onClick={() => setActiveTab('admins')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'admins'
                    ? 'bg-[#1769e0] text-white shadow-sm'
                    : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                <UserCheck size={15} /> 👥 Adminlar
              </button>
            </>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB: SHOP SETTINGS (Full Card Number, Channel, Webhook, Logo) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'shop_settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6 border-b border-[#f1f5f9] pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#152238]">
                      Do‘kon va Karta Rekvizitlari
                    </h2>
                    <p className="text-xs text-[#718096]">
                      Xaridorlar to‘lov sahifasida ko‘radigan to‘liq karta va aloqa sozlamalari
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-mono text-[#64748b]">
                    ID: {shopData?.id || 'Yangi'}
                  </span>
                </div>

                <form onSubmit={handleSaveShop} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-[#475569] mb-1">
                        Do‘kon Nomi
                      </label>
                      <input
                        type="text"
                        value={shopForm.name}
                        onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                        placeholder="Masalan: Online Supermarket"
                        className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0] focus:ring-2 focus:ring-blue-50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#475569] mb-1">
                        Do‘kon Logotipi (URL)
                      </label>
                      <input
                        type="text"
                        value={shopForm.logoUrl}
                        onChange={(e) => setShopForm({ ...shopForm, logoUrl: e.target.value })}
                        placeholder="https://mysite.uz/logo.png"
                        className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0] focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#475569] mb-1">
                      Do‘kon Tavsifi
                    </label>
                    <input
                      type="text"
                      value={shopForm.description}
                      onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })}
                      placeholder="Online do‘konimiz orqali tezkor to‘lovlar"
                      className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0] focus:ring-2 focus:ring-blue-50"
                    />
                  </div>

                  {/* Karta qismi */}
                  <div className="rounded-2xl bg-[#f8fafc] p-5 border border-[#e2e8f0] space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1e40af]">
                      <CreditCard size={16} /> HUMO Karta Ma’lumotlari (To‘liq 16 xonali)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#64748b] mb-1">
                          16-xonali HUMO Karta Raqami:
                        </label>
                        <input
                          type="text"
                          value={shopForm.cardNumber}
                          onChange={(e) => setShopForm({ ...shopForm, cardNumber: e.target.value })}
                          placeholder="9860 3501 2345 3587"
                          className="w-full font-mono rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-sm font-bold text-[#152238] outline-none focus:border-[#1769e0]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#64748b] mb-1">
                          Karta / Hisob Egasi:
                        </label>
                        <input
                          type="text"
                          value={shopForm.accountOwner}
                          onChange={(e) => setShopForm({ ...shopForm, accountOwner: e.target.value })}
                          placeholder="AZIZBEK KARIMOV"
                          className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0]"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Webhook & Channel */}
                  <div className="space-y-4 pt-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#475569]">
                          🔗 Webhook URL (To‘lov xabarnomasi)
                        </label>
                        <button
                          type="button"
                          onClick={handleTestWebhook}
                          disabled={testingWebhook}
                          className="text-[11px] font-bold text-[#1769e0] hover:underline"
                        >
                          {testingWebhook ? 'Sinov yuborilmoqda...' : '⚡️ Test Webhook Yuborish'}
                        </button>
                      </div>
                      <input
                        type="url"
                        value={shopForm.webhookUrl}
                        onChange={(e) => setShopForm({ ...shopForm, webhookUrl: e.target.value })}
                        placeholder="https://mysite.uz/api/payment-webhook"
                        className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0]"
                      />
                      <p className="mt-1 text-[11px] text-[#94a3b8]">
                        To‘lov muvaffaqiyatli bo‘lganda ushbu manzilga <code>POST</code> JSON yuboriladi.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#475569]">
                          📣 Telegram Kanal ID / Username
                        </label>
                        <button
                          type="button"
                          onClick={handleTestChannel}
                          disabled={testingChannel}
                          className="text-[11px] font-bold text-[#1769e0] hover:underline"
                        >
                          {testingChannel ? 'Yuborilmoqda...' : '📣 Test Kanalga Yuborish'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={shopForm.telegramChannelId}
                        onChange={(e) => setShopForm({ ...shopForm, telegramChannelId: e.target.value })}
                        placeholder="@mening_kanalim yoki -1001234567890"
                        className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm outline-none focus:border-[#1769e0]"
                      />
                      <p className="mt-1 text-[11px] text-[#94a3b8]">
                        Botni kanalingizga admin qiling va kanal ID sini kiriting. Cheklar to‘g‘ridan-to‘g‘ri kanalga post bo‘ladi!
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingShop}
                      className="flex items-center gap-2 rounded-2xl bg-[#1769e0] px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-[#1254b7] transition disabled:opacity-50"
                    >
                      {savingShop ? 'Saqlanmoqda...' : '💾 Sozlamalarni Saqlash'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Col: Live Card & Status Preview */}
            <div className="space-y-6">
              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-4">
                  To‘lov Kartasi Jonli Ko‘rinishi
                </h3>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#10223d] via-[#162a4a] to-[#0d1b32] p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between opacity-80 mb-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-[#60a5fa]" />
                      <span className="font-mono text-[11px] tracking-widest text-[#93c5fd]">
                        HUMO CARD
                      </span>
                    </div>
                    <span className="text-[10px] text-[#94a3b8]">O‘zbekiston</span>
                  </div>

                  <p className="text-[10px] uppercase text-[#93c5fd]">HUMO Karta Raqami:</p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">
                    {shopForm.cardNumber || '9860 3501 2345 3587'}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                    <span className="text-[#e2e8f0]">{shopForm.accountOwner || 'Hisob egasi'}</span>
                    <span className="font-mono text-[11px] text-[#93c5fd]">HUMOCARD</span>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-xs text-[#64748b]">
                  <div className="flex justify-between border-b border-[#f1f5f9] pb-2">
                    <span>Do‘kon holati:</span>
                    <span className="font-bold text-[#16865b]">
                      {shopData?.approved ? '✅ Tasdiqlangan' : '⏳ Kutilmoqda'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f1f5f9] pb-2">
                    <span>Webhook holati:</span>
                    <span className="font-semibold text-[#152238]">
                      {shopForm.webhookUrl ? '🟢 Ulangan' : '🔴 O‘rnatilmagan'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#f1f5f9] pb-2">
                    <span>Kanal xabarnomasi:</span>
                    <span className="font-semibold text-[#152238]">
                      {shopForm.telegramChannelId ? '🟢 Faol' : '🔴 Ulanmagan'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: TEST PAYMENT CREATOR (5-Minute Payment Link) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'test_payment' && (
          <div className="max-w-2xl mx-auto bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#f1f5f9] pb-4">
              <div className="grid size-10 place-items-center rounded-2xl bg-[#eff6ff] text-[#1769e0]">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#152238]">
                  5 Daqiqalik Test To‘lov Yaratish
                </h2>
                <p className="text-xs text-[#718096]">
                  To‘lov sahifasi aynan 5 daqiqa davomida faol bo‘ladi va to‘lov tasdiqlangach Webhook hamda Telegram kanalga JSON chek tashlanadi.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  To‘lov summasini tanlang yoki kiriting (UZS):
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['1000', '5000', '15000', '50000', '100000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTestAmount(amt)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                        testAmount === amt
                          ? 'bg-[#1769e0] text-white'
                          : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                      }`}
                    >
                      {Number(amt).toLocaleString('uz-UZ')} UZS
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#cbd5e1] px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#1769e0]"
                  placeholder="15000"
                />
              </div>

              <button
                onClick={handleCreateTestPayment}
                disabled={creatingPayment}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1769e0] py-3.5 text-xs font-bold text-white shadow-md hover:bg-[#1254b7] transition disabled:opacity-50"
              >
                {creatingPayment ? 'Yaratilmoqda...' : '⚡️ 5 Daqiqalik Test Havola Yaratish'}
              </button>

              {createdPayment && (
                <div className="mt-6 rounded-2xl bg-[#f0f7ff] p-5 border border-[#bfdbfe] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1e40af]">
                      🎉 Test To‘lov Tayyor! (Muddati: 5 daqiqa)
                    </span>
                    <span className="font-mono text-xs text-[#1e40af]">
                      {Number(createdPayment.amount).toLocaleString()} UZS
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-white rounded-xl p-2.5 border border-[#cbd5e1]">
                    <input
                      type="text"
                      readOnly
                      value={createdPayment.payUrl}
                      className="w-full bg-transparent font-mono text-xs outline-none text-[#152238]"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdPayment.payUrl)
                        showToast('Havola nusxalandi!')
                      }}
                      className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={createdPayment.payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-2.5 text-xs font-bold text-white hover:bg-[#1d4ed8]"
                    >
                      <ExternalLink size={14} /> To‘lov Sahifasini Ochish
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: WEBHOOK & API DOCUMENTATION (JSON Schema & URLs) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'webhook_docs' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6 border-b border-[#f1f5f9] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#152238]">
                    PayGo Webhook & REST API Hujjati
                  </h2>
                  <p className="text-xs text-[#718096]">
                    To‘lovlar tasdiqlanganda serveringizga jo‘natiladigan to‘liq JSON formati
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/docs/webhook-schema.json"
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#1769e0] hover:bg-[#f1f5f9]"
                  >
                    📄 JSON Schema Fayli
                  </a>
                  <a
                    href="/paybot-api.docx"
                    className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#1769e0] hover:bg-[#f1f5f9]"
                  >
                    📥 DOCX Hujjat
                  </a>
                </div>
              </div>

              {/* JSON Code View */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569]">
                    Webhook POST Request Body Formati:
                  </span>
                  <button
                    onClick={() => {
                      const sample = JSON.stringify(
                        {
                          event: 'payment.paid',
                          eventId: 'evt_98f4e21a_0c9b',
                          createdAt: new Date().toISOString(),
                          shop: {
                            id: shopData?.id || 'shop_123',
                            name: shopData?.name || 'Do‘kon',
                            cardNumber: shopData?.cardNumber || '9860350123453587',
                            cardOwner: shopData?.accountOwner || 'AZIZBEK KARIMOV',
                          },
                          payment: {
                            id: 'pay_7fa83210',
                            amount: 50000,
                            currency: 'UZS',
                            status: 'paid',
                            cardLast4: '3587',
                          },
                          signature: 'sha256_hash...',
                        },
                        null,
                        2
                      )
                      navigator.clipboard.writeText(sample)
                      showToast('JSON nusxalandi!')
                    }}
                    className="flex items-center gap-1 text-xs text-[#1769e0] hover:underline"
                  >
                    <Copy size={13} /> Nusxalash
                  </button>
                </div>

                <pre className="rounded-2xl bg-[#0f172a] p-5 text-xs font-mono text-[#38bdf8] overflow-x-auto border border-[#1e293b]">
{`{
  "event": "payment.paid",
  "eventId": "evt_98f4e21a_0c9b",
  "createdAt": "2026-08-30T11:05:00.000Z",
  "shop": {
    "id": "${shopData?.id || 'shop_a1b2c3d4'}",
    "name": "${shopData?.name || 'Online Supermarket'}",
    "cardNumber": "${shopData?.cardNumber || '9860350123453587'}",
    "cardOwner": "${shopData?.accountOwner || 'AZIZBEK KARIMOV'}"
  },
  "payment": {
    "id": "pay_7fa83210b3",
    "amount": 50000,
    "currency": "UZS",
    "status": "paid",
    "cardLast4": "3587"
  },
  "signature": "sha256_hmac_signature"
}`}
                </pre>
              </div>

              {/* Security info */}
              <div className="mt-6 rounded-2xl bg-[#f8fafc] p-4 border border-[#e2e8f0] text-xs text-[#64748b] space-y-2">
                <p className="font-bold text-[#152238]">Xavfsizlik va HMAC Imzosi:</p>
                <p>
                  Har bir webhook <code>X-PayGo-Signature: sha256=...</code> headeri bilan jo‘natiladi. Serveringizda uni maxfiy kalit (secret) orqali tekshirib to‘lov sofligini tasdiqlashingiz mumkin.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ADMIN OVERVIEW & STATS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && currentUser?.isAdmin && crmData && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Jami Tushum Hajmi</span>
                  <div className="grid size-8 place-items-center rounded-xl bg-[#eaf8f1] text-[#16865b]">
                    <DollarSign size={16} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-[#152238]">
                  {(crmData?.stats?.totalVolume || 0).toLocaleString('uz-UZ')}{' '}
                  <span className="text-xs font-medium text-[#64748b]">UZS</span>
                </p>
                <p className="mt-1 text-[11px] text-[#16865b]">
                  {crmData?.stats?.paidPayments || 0} ta tasdiqlangan to‘lov
                </p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Jami Do‘konlar</span>
                  <div className="grid size-8 place-items-center rounded-xl bg-[#eff6ff] text-[#1769e0]">
                    <Store size={16} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-[#152238]">
                  {crmData?.stats?.totalShops || 0} ta
                </p>
                <p className="mt-1 text-[11px] text-[#718096]">
                  {crmData?.stats?.pendingShops || 0} ta kutilmoqda
                </p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Userbotlar Holati</span>
                  <div className="grid size-8 place-items-center rounded-xl bg-[#eff6ff] text-[#1769e0]">
                    <Bot size={16} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-[#152238]">
                  {crmData?.stats?.activeUserbots || 0} faol
                </p>
                <p className="mt-1 text-[11px] text-[#16865b]">@humocardbot monitoringda</p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Adminlar Soni</span>
                  <div className="grid size-8 place-items-center rounded-xl bg-[#f5f3ff] text-[#7c3aed]">
                    <UserCheck size={16} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-[#152238]">
                  {crmData?.stats?.totalAdmins || 0} ta
                </p>
                <p className="mt-1 text-[11px] text-[#718096]">Superadmin: 8021115446</p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ADMIN SHOPS LIST */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'shops' && currentUser?.isAdmin && crmData && (
          <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#152238] mb-6">
              Barcha Do‘konlar Boshqaruvi ({crmData?.shops?.length || 0} ta)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#64748b]">
                <thead className="bg-[#f8fafc] text-[#475569] font-bold border-b border-[#e2e8f0]">
                  <tr>
                    <th className="p-3">Do‘kon</th>
                    <th className="p-3">Karta (HUMO)</th>
                    <th className="p-3">Hisob Egasi</th>
                    <th className="p-3">Telegram User ID</th>
                    <th className="p-3">Holat</th>
                    <th className="p-3 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {crmData?.shops?.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#f8fafc]">
                      <td className="p-3 font-bold text-[#152238]">{s.name}</td>
                      <td className="p-3 font-mono text-[#1769e0]">{s.cardNumber || s.cardLast4}</td>
                      <td className="p-3">{s.accountOwner || '—'}</td>
                      <td className="p-3 font-mono">{s.userId}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            s.approved
                              ? 'bg-[#eaf8f1] text-[#16865b]'
                              : 'bg-[#fff4df] text-[#ae7212]'
                          }`}
                        >
                          {s.approved ? 'Tasdiqlangan' : 'Kutilmoqda'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={async () => {
                            const res = await fetch('/api/admin/crm', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'x-telegram-user-id': currentUser?.telegramId || '8021115446',
                              },
                              body: JSON.stringify({
                                action: 'approve_shop',
                                shopId: s.id,
                                approved: !s.approved,
                              }),
                            })
                            if (res.ok) {
                              showToast(s.approved ? 'Do‘kon to‘xtatildi' : 'Do‘kon tasdiqlandi!')
                              loadCrm()
                            }
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                            s.approved
                              ? 'bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca]'
                              : 'bg-[#16865b] text-white hover:bg-[#126b48]'
                          }`}
                        >
                          {s.approved ? 'To‘xtatish' : 'Tasdiqlash'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ADMIN TARIFFS LIST */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'tariffs' && currentUser?.isAdmin && crmData && (
          <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#152238] mb-6">
              💎 Pullik Tariflar va Rekvizitlar
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {crmData?.tariffs?.map((t: any) => (
                <div key={t.id} className="rounded-2xl border border-[#e2e8f0] p-5 bg-[#f8fafc]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-[#152238]">{t.name}</h3>
                    <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-bold text-[#1769e0]">
                      {Number(t.price).toLocaleString()} UZS / {t.period}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748b] mb-4">{t.description}</p>
                  <div className="rounded-xl bg-white p-3 border border-[#e2e8f0] space-y-1 text-xs">
                    <p className="text-[#94a3b8]">To‘lov kartasi:</p>
                    <p className="font-mono font-bold text-[#152238]">{t.cardNumber}</p>
                    <p className="text-[#64748b]">{t.cardOwner}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: ADMINS LIST */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'admins' && currentUser?.isAdmin && crmData && (
          <div className="max-w-2xl bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#152238] mb-4">
              👥 Tizim Boshqaruvchi Adminlari
            </h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newAdminTelegramId.trim()) return
                const res = await fetch('/api/admin/crm', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-telegram-user-id': currentUser?.telegramId || '8021115446',
                  },
                  body: JSON.stringify({
                    action: 'add_admin',
                    telegramId: newAdminTelegramId.trim(),
                  }),
                })
                if (res.ok) {
                  showToast('Yangi admin tayinlandi!')
                  setNewAdminTelegramId('')
                  loadCrm()
                }
              }}
              className="flex gap-2 mb-6"
            >
              <input
                type="text"
                value={newAdminTelegramId}
                onChange={(e) => setNewAdminTelegramId(e.target.value)}
                placeholder="Yangi admin Telegram ID (masalan: 12345678)"
                className="flex-1 rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-xs outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#1769e0] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1254b7]"
              >
                Qo‘shish
              </button>
            </form>

            <div className="divide-y divide-[#f1f5f9]">
              {crmData?.roles?.map((r: any) => (
                <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#152238]">{r.telegramId}</span>
                    <span className="ml-2 text-[11px] text-[#94a3b8]">({r.role})</span>
                  </div>
                  {r.telegramId !== '8021115446' && (
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/admin/crm', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-telegram-user-id': currentUser?.telegramId || '8021115446',
                          },
                          body: JSON.stringify({
                            action: 'delete_admin',
                            roleId: r.id,
                          }),
                        })
                        if (res.ok) {
                          showToast('Admin o‘chirildi')
                          loadCrm()
                        }
                      }}
                      className="text-[#dc2626] hover:underline"
                    >
                      O‘chirish
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
