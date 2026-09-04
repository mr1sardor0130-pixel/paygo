'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  KeyRound,
  Phone,
  MessageSquare,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react'

type Step = 'api_id' | 'api_hash' | 'phone' | 'code' | '2fa' | 'connected'

export default function TelegramConnectPage() {
  const [step, setStep] = useState<Step>('api_id')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('+998')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Step 1: Submit API ID
  const handleApiId = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const num = Number(apiId.trim())
    if (!num || isNaN(num) || num <= 0) {
      setError('Iltimos, haqiqiy raqamli API ID kiriting (masalan: 12345678)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_api_id', apiId: num }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Xatolik yuz berdi')
      setStep('api_hash')
    } catch (err: any) {
      setError(err?.message || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Submit API Hash
  const handleApiHash = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const hash = apiHash.trim()
    if (!hash || hash.length < 8) {
      setError('Iltimos, my.telegram.org dagi 32 xonali API Hash ni kiriting')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_api_hash', apiHash: hash }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Xatolik yuz berdi')
      setStep('phone')
    } catch (err: any) {
      setError(err?.message || 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Submit Phone & Send Code
  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleanPhone = phone.trim()
    if (!cleanPhone || cleanPhone.length < 9) {
      setError('Telefon raqamini to‘liq xalqaro formatda kiriting (masalan: +998901234567)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'send_code', phone: cleanPhone }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Kod yuborishda xatolik yuz berdi')
      setStep('code')
    } catch (err: any) {
      setError(err?.message || 'Kod yuborishda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Verify Telegram Code (supports "2.1.2.3.4" or "2 1 2 3 4")
  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleanCode = code.trim()
    if (!cleanCode) {
      setError('Tasdiqlash kodini kiriting')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify_code', code: cleanCode }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Kodni tekshirishda xatolik')

      if (data.needsPassword || data.step === 'awaiting_2fa') {
        setStep('2fa')
      } else if (data.step === 'connected') {
        setStep('connected')
        setSuccessMsg(data.message || 'Telegram Userbot muvaffaqiyatli ulandi!')
      }
    } catch (err: any) {
      setError(err?.message || 'Kodni tekshirishda xatolik')
    } finally {
      setLoading(false)
    }
  }

  // Step 5: Submit 2FA Password
  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const pwd = password.trim()
    if (!pwd) {
      setError('2FA parolingizni kiriting')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'submit_2fa', password: pwd }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '2FA paroli xato')

      setStep('connected')
      setSuccessMsg(data.message || 'Telegram Userbot 2FA orqali muvaffaqiyatli ulandi!')
    } catch (err: any) {
      setError(err?.message || '2FA paroli xato')
    } finally {
      setLoading(false)
    }
  }

  const resetAll = () => {
    setStep('api_id')
    setApiId('')
    setApiHash('')
    setPhone('+998')
    setCode('')
    setPassword('')
    setError(null)
    setSuccessMsg(null)
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-12 text-[#152238]">
      <div className="mx-auto max-w-lg">
        {/* Top brand */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#1769e0] font-mono text-sm font-bold text-white shadow-sm">
              P
            </span>
            <span className="font-bold tracking-tight text-[#152238]">PayGo Humo</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf2ff] px-3 py-1 font-mono text-[11px] font-semibold text-[#1769e0]">
            <ShieldCheck size={14} /> Userbot Wizard
          </span>
        </div>

        {/* Wizard Card */}
        <div className="rounded-2xl border border-[#e3e8f0] bg-white p-7 shadow-xl shadow-slate-200/50">
          {/* Steps Indicator */}
          <div className="mb-6 flex items-center justify-between border-b border-[#f1f5f9] pb-4">
            <div className="flex items-center gap-2">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                step === 'connected' ? 'bg-[#1ea672] text-white' : 'bg-[#1769e0] text-white'
              }`}>
                {step === 'api_id' && '1'}
                {step === 'api_hash' && '2'}
                {step === 'phone' && '3'}
                {step === 'code' && '4'}
                {step === '2fa' && '5'}
                {step === 'connected' && '✓'}
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#718096]">
                  {step === 'api_id' && '1 / 4-qadam'}
                  {step === 'api_hash' && '2 / 4-qadam'}
                  {step === 'phone' && '3 / 4-qadam'}
                  {step === 'code' && '4 / 4-qadam'}
                  {step === '2fa' && '5-qadam (2FA)'}
                  {step === 'connected' && 'Tayyor!'}
                </p>
                <h1 className="text-sm font-bold text-[#152238]">
                  {step === 'api_id' && 'Telegram API ID kiritish'}
                  {step === 'api_hash' && 'Telegram API Hash kiritish'}
                  {step === 'phone' && 'Telefon raqamni kiritish'}
                  {step === 'code' && 'Tasdiqlash kodini kiritish'}
                  {step === '2fa' && '2FA Cloud Password kiritish'}
                  {step === 'connected' && 'Userbot muvaffaqiyatli ulandi!'}
                </h1>
              </div>
            </div>

            {step !== 'api_id' && step !== 'connected' && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1 text-xs text-[#718096] hover:text-[#152238]"
              >
                <RefreshCcw size={12} /> Qaytadan
              </button>
            )}
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-xs text-[#991b1b]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: API ID */}
          {step === 'api_id' && (
            <form onSubmit={handleApiId} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Telegram API ID
                </label>
                <div className="relative mt-1.5">
                  <KeyRound size={16} className="absolute left-3 top-3 text-[#94a3b8]" />
                  <input
                    type="text"
                    required
                    value={apiId}
                    onChange={(e) => setApiId(e.target.value)}
                    placeholder="Masalan: 12345678"
                    className="w-full rounded-xl border border-[#dfe7f2] py-2.5 pl-10 pr-3 text-xs font-mono outline-none focus:border-[#1769e0] focus:ring-1 focus:ring-[#1769e0]"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#718096]">
                  API ID va API Hash olish uchun{' '}
                  <a
                    href="https://my.telegram.org"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-[#1769e0] hover:underline"
                  >
                    my.telegram.org <ExternalLink size={10} />
                  </a>{' '}
                  saytiga kiring.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !apiId.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
              >
                {loading ? 'Yuklanmoqda...' : 'Keyingi qadam'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* Step 2: API Hash */}
          {step === 'api_hash' && (
            <form onSubmit={handleApiHash} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Telegram API Hash
                </label>
                <div className="relative mt-1.5">
                  <KeyRound size={16} className="absolute left-3 top-3 text-[#94a3b8]" />
                  <input
                    type="text"
                    required
                    value={apiHash}
                    onChange={(e) => setApiHash(e.target.value)}
                    placeholder="Masalan: 0123456789abcdef0123456789abcdef"
                    className="w-full rounded-xl border border-[#dfe7f2] py-2.5 pl-10 pr-3 text-xs font-mono outline-none focus:border-[#1769e0] focus:ring-1 focus:ring-[#1769e0]"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#718096]">
                  API Hash — bu 32 xonali maxfiy kalit.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !apiHash.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
              >
                {loading ? 'Yuklanmoqda...' : 'Keyingi qadam (Telefon kiritish)'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* Step 3: Phone number */}
          {step === 'phone' && (
            <form onSubmit={handlePhone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Telegram telefon raqamingiz
                </label>
                <div className="relative mt-1.5">
                  <Phone size={16} className="absolute left-3 top-3 text-[#94a3b8]" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998901234567"
                    className="w-full rounded-xl border border-[#dfe7f2] py-2.5 pl-10 pr-3 text-xs font-mono outline-none focus:border-[#1769e0] focus:ring-1 focus:ring-[#1769e0]"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#718096]">
                  Telegram sizning rasmiy hisobingizga tasdiqlash kodini yuboradi.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
              >
                {loading ? 'Kod yuborilmoqda...' : 'Kodni olish'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* Step 4: Code with dots/spaces */}
          {step === 'code' && (
            <form onSubmit={handleCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  Telegram tasdiqlash kodi
                </label>
                <div className="relative mt-1.5">
                  <MessageSquare size={16} className="absolute left-3 top-3 text-[#94a3b8]" />
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Masalan: 2.1.2.3.4 yoki 2 1 2 3 4"
                    className="w-full rounded-xl border border-[#dfe7f2] py-2.5 pl-10 pr-3 text-xs font-mono outline-none focus:border-[#1769e0] focus:ring-1 focus:ring-[#1769e0]"
                  />
                </div>
                <div className="mt-2.5 rounded-xl bg-[#eff6ff] p-3 text-[11px] leading-5 text-[#1e40af] border border-[#bfdbfe]">
                  💡 <b>Eslatma:</b> Telegram xavfsizlik filtri kodni chatda bloklamasligi uchun kodni <b>nuqtalar</b> yoki <b>bo‘shliq</b> bilan yozishingiz mumkin (masalan: <code>2.1.2.3.4</code> yoki <code>2 1 2 3 4</code>).
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
              >
                {loading ? 'Tasdiqlanmoqda...' : 'Tasdiqlash va ulash'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* Step 5: 2FA Password */}
          {step === '2fa' && (
            <form onSubmit={handle2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#152238]">
                  2FA (Ikki bosqichli Cloud Password)
                </label>
                <div className="relative mt-1.5">
                  <Lock size={16} className="absolute left-3 top-3 text-[#94a3b8]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Telegram 2FA parolingiz"
                    className="w-full rounded-xl border border-[#dfe7f2] py-2.5 pl-10 pr-3 text-xs outline-none focus:border-[#1769e0] focus:ring-1 focus:ring-[#1769e0]"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#718096]">
                  Hisobingizda 2FA yoqilganligi sababli parolingizni kiriting.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
              >
                {loading ? 'Tekshirilmoqda...' : '2FA orqali yakunlash'} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* Step 6: Connected Success */}
          {step === 'connected' && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#eaf8f1] text-[#1ea672]">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#152238]">
                  Userbot muvaffaqiyatli ulandi!
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#475569]">
                  {successMsg || 'Telegram hisobingiz, @CardXabarBot (UZCARD & HUMO) hamda @humocardbot monitoringi faollashtirildi.'}
                </p>
              </div>

              <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-left text-xs text-[#166534]">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles size={16} /> Real-vaqt monitoringi faol:
                </div>
                <ul className="mt-2 list-disc list-inside space-y-1 text-[11px]">
                  <li><b>@CardXabarBot</b> (UZCARD va HUMO) hamda <b>@humocardbot</b> dagi barcha kirim xabarlari avtomatik ushlanadi.</li>
                  <li>Mijozlar to‘lov sahifasida to‘lov qilganda holat 1 soniyada avto-tasdiqlanadi.</li>
                </ul>
              </div>

              <div className="pt-2 flex gap-3">
                <Link
                  href="/"
                  className="flex-1 rounded-xl bg-[#1769e0] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition text-center"
                >
                  Boshqaruv paneliga o‘tish
                </Link>
                <button
                  onClick={resetAll}
                  className="rounded-xl border border-[#dfe7f2] px-4 py-3 text-xs font-semibold text-[#152238] hover:bg-[#f8fafc]"
                >
                  Qayta sozlash
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

