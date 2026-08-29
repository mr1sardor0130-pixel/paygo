'use client'

import { useState } from 'react'
import { Activity, ArrowUpRight, Bot, Check, ChevronRight, Copy, Link2, Plus, Settings2, Store, Webhook } from 'lucide-react'

const plans = [
  { name: 'Kunlik', price: '1 000', unit: 'kun', note: 'Narx o‘zgarmaydi' },
  { name: 'Haftalik', price: '6 500', unit: 'hafta', note: '3 hafta — 19 500 UZS' },
  { name: 'Oylik', price: '27 858', unit: 'oy', note: '3 oy — 83 574 UZS' },
]

export function PaybotDashboard() {
  const [activePlan, setActivePlan] = useState('Haftalik')
  const [copied, setCopied] = useState(false)
  const copyApi = () => { setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#152238]">
      <header className="border-b border-[#e3e8f0] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#1769e0] text-white"><Activity size={21} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#1769e0]">PAY BOT</p><p className="text-xs text-[#718096]">Payment infrastructure</p></div></div>
          <div className="flex items-center gap-5 text-sm"><span className="hidden text-[#718096] md:inline">API holati <b className="ml-1 text-[#1ea672]">Online</b></span><div className="size-9 rounded-full bg-[#dceaff] text-center pt-2 text-xs font-bold text-[#1769e0]">AD</div></div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 font-mono text-xs uppercase tracking-[.18em] text-[#1769e0]">Boshqaruv paneli</p><h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">To‘lovlarni bir joydan boshqaring</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#718096]">HUMO bildirishnomalarini avtomatik tekshiring, webhook va Telegram kanalingizga real vaqtda xabar yuboring.</p></div><button className="flex items-center justify-center gap-2 rounded-lg bg-[#1769e0] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200"><Plus size={17} /> Yangi do‘kon</button></div>
        <section className="grid gap-4 md:grid-cols-3"><Stat label="Bugungi tushum" value="1 248 500 UZS" trend="+18.4%" /><Stat label="Kutilayotgan to‘lovlar" value="12" trend="5 daqiqa" /><Stat label="Muvaffaqiyat darajasi" value="98.7%" trend="Oxirgi 30 kun" /></section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <section className="rounded-xl border border-[#e3e8f0] bg-white p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Do‘konlar</h2><p className="mt-1 text-xs text-[#718096]">1 / 1 bepul do‘kon ishlatilmoqda</p></div><button className="text-xs font-semibold text-[#1769e0]">Barchasi <ArrowUpRight className="ml-1 inline" size={14} /></button></div><div className="rounded-lg border border-[#dfe7f2] p-4"><div className="flex items-start justify-between"><div className="flex gap-3"><div className="grid size-10 place-items-center rounded-lg bg-[#eaf2ff] text-[#1769e0]"><Store size={19} /></div><div><h3 className="text-sm font-semibold">Asosiy do‘kon</h3><p className="mt-1 font-mono text-[11px] text-[#8995a7]">shop_paybot_01</p></div></div><span className="rounded-full bg-[#e8f8f0] px-2 py-1 text-[10px] font-bold text-[#16865b]">FAOL</span></div><div className="mt-5 grid gap-4 border-t border-[#edf0f5] pt-4 sm:grid-cols-3"><Info label="Karta" value="HUMO •••• 3587" /><Info label="Webhook" value="Ulangan" green /><Info label="Userbot" value="Ulangan" green /></div></div><div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f7f9fc] p-3 text-xs text-[#718096]"><Bot size={16} className="text-[#1769e0]" /> Yangi do‘kon ochish uchun Premium tarifga o‘ting <ChevronRight size={15} className="ml-auto" /></div></section>
          <section className="rounded-xl border border-[#e3e8f0] bg-[#14243c] p-6 text-white"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#8eaddb]">API kalit</p><h2 className="mt-2 font-semibold">Production access</h2></div><Settings2 size={18} className="text-[#9db5d7]" /></div><div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-xs text-[#c4d2e8]">pb_live_••••••••••••9f42</div><button onClick={copyApi} className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#8eaddb]">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Nusxalandi' : 'Kalitni nusxalash'}</button><div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4"><span className="text-xs text-[#9db5d7]">Endpoint</span><span className="font-mono text-[11px] text-[#c4d2e8]">api.paybot.uz/v1</span></div></section>
        </div>
        <section className="mt-6 rounded-xl border border-[#e3e8f0] bg-white p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Premium tariflar</h2><p className="mt-1 text-xs text-[#718096]">1x dan 10x gacha oldindan to‘lang — qo‘shimcha chegirma avtomatik qo‘llanadi.</p></div><span className="rounded-full bg-[#fff4df] px-3 py-1 text-[10px] font-bold text-[#ae7212]">PRO</span></div><div className="grid gap-3 md:grid-cols-3">{plans.map((plan) => <button key={plan.name} onClick={() => setActivePlan(plan.name)} className={`rounded-lg border p-4 text-left transition ${activePlan === plan.name ? 'border-[#1769e0] bg-[#f2f7ff] ring-1 ring-[#1769e0]' : 'border-[#e3e8f0] hover:border-[#9bbce9]'}`}><div className="flex justify-between"><span className="text-sm font-semibold">{plan.name}</span>{activePlan === plan.name && <Check size={16} className="text-[#1769e0]" />}</div><p className="mt-3 text-xl font-bold">{plan.price} <span className="text-xs font-normal text-[#718096]">UZS / {plan.unit}</span></p><p className="mt-2 text-[11px] text-[#718096]">{plan.note}</p><div className="mt-4 flex gap-1">{[1,2,3,4,5].map((n) => <span key={n} className="grid size-6 place-items-center rounded bg-[#e9f0fb] font-mono text-[10px] text-[#1769e0]">{n}x</span>)}</div></button>)}</div></section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <WebhookCard />
          <UserbotCard />
        </section>
      </main>
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
                  className="flex-1 rounded-xl bg-[#1769e0] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1258be] transition disabled:opacity-50"
                >
                  {loading ? 'Ulanmoqda...' : '⚡️ Webhookni yangilash'}
                </button>
                <button
                  onClick={() => checkOrSet('check')}
                  disabled={loading}
                  className="rounded-xl border border-[#dfe7f2] px-4 py-2.5 text-xs font-semibold text-[#152238] hover:bg-[#f8fafc]"
                >
                  Tekshirish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({label,value,trend}:{label:string,value:string,trend:string}){return <div className="rounded-xl border border-[#e3e8f0] bg-white p-5"><p className="text-xs text-[#718096]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-[11px] font-semibold text-[#1ea672]">{trend}</p></div>}
function Info({label,value,green}:{label:string,value:string,green?:boolean}){return <div><p className="text-[10px] uppercase tracking-wider text-[#8995a7]">{label}</p><p className={`mt-1 text-xs font-semibold ${green ? 'text-[#16865b]' : ''}`}>{value}</p></div>}
function UserbotCard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<string>('idle')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const startFlow = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', userId: 'dashboard-user' }),
      })
      const data = await res.json()
      if (data.ok) {
        setStep(data.step)
      } else {
        setError(data.error || 'Boshlashda xatolik')
      }
    } catch (err: any) {
      setError(err?.message || 'Server xatosi')
    } finally {
      setLoading(false)
    }
  }

  const submitStep = async () => {
    setError('')
    setLoading(true)
    try {
      const payload: any = { action: 'step', userId: 'dashboard-user' }
      if (step === 'awaiting_api_id') payload.apiId = Number(apiId)
      if (step === 'awaiting_api_hash') payload.apiHash = apiHash
      if (step === 'awaiting_phone') payload.phone = phone
      if (step === 'awaiting_code') payload.code = code
      if (step === 'awaiting_2fa') payload.password = password

      const res = await fetch('/api/telegram/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setStep(data.step)
        if (data.step === 'connected') {
          setSuccess('Telegram Userbot muvaffaqiyatli ulandi! @humocardbot xabarnomalari kuzatilmoqda.')
        }
      } else {
        setError(data.error || 'Amal bajarilmadi')
      }
    } catch (err: any) {
      setError(err?.message || 'Server xatosi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-[#e3e8f0] bg-white p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ff] text-[#1769e0]">
          <Link2 size={19} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Userbot ulash</h3>
          <p className="mt-1 text-xs leading-5 text-[#718096]">
            @humocardbot to‘lov xabarlarini real vaqtda kuzatish tizimi.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(true)
            if (step === 'idle') startFlow()
          }}
          className="ml-auto hidden shrink-0 text-xs font-semibold text-[#1769e0] sm:block hover:underline"
        >
          Ulash <ArrowUpRight className="ml-1 inline" size={14} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14243c]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#e2e8f0]">
            <div className="flex items-start justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#1769e0]">
                  Telegram Userbot Wizard
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#152238]">
                  {step === 'connected'
                    ? '🎉 Ulanish yakunlandi'
                    : 'Userbotni tizimga ulash'}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-xs text-[#718096] hover:bg-[#f1f5f9]"
              >
                ✕ Yopish
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-[#fef2f2] p-3 text-xs text-[#991b1b] border border-[#fecaca]">
                ⚠️ {error}
              </div>
            )}

            {step === 'connected' ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[#eaf8f1] text-[#16865b]">
                  <Check size={28} />
                </div>
                <h3 className="text-base font-bold text-[#152238]">
                  Userbot faollashtirildi!
                </h3>
                <p className="mt-2 text-xs text-[#718096]">
                  {success ||
                    '@humocardbot monitoringi yoqildi. Endi to‘lovlar avtomatik qabul qilinadi.'}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-5 w-full rounded-xl bg-[#1769e0] py-2.5 text-xs font-semibold text-white"
                >
                  Tayyor
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Step indicator */}
                <div className="flex items-center justify-between text-[11px] font-medium text-[#718096]">
                  <span>
                    Bosqich:{' '}
                    <b className="text-[#1769e0]">
                      {step === 'awaiting_api_id'
                        ? '1/4 (API ID)'
                        : step === 'awaiting_api_hash'
                        ? '2/4 (API Hash)'
                        : step === 'awaiting_phone'
                        ? '3/4 (Telefon)'
                        : step === 'awaiting_code'
                        ? '4/4 (Telegram Kod)'
                        : step === 'awaiting_2fa'
                        ? '2FA (Cloud Password)'
                        : 'Boshlanmoqda...'}
                    </b>
                  </span>
                </div>

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
function SetupCard({icon,title,description,action}:{icon:React.ReactNode,title:string,description:string,action:string}){return <div className="flex items-center gap-4 rounded-xl border border-[#e3e8f0] bg-white p-5"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ff] text-[#1769e0]">{icon}</div><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#718096]">{description}</p></div><button className="ml-auto hidden shrink-0 text-xs font-semibold text-[#1769e0] sm:block">{action} <ArrowUpRight className="ml-1 inline" size={14} /></button></div>}
