'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Check, ShieldCheck } from 'lucide-react'

/* ==========================================================================
   OFFICIAL & CUSTOM BRAND LOGO COMPONENTS (HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * HUMO Logo (Reads custom uploaded logo or default vector SVG)
 */
export function HumoLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(customUrl || null)

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_humo_logo') : null
    if (saved) setLogoUrl(saved)
  }, [customUrl])

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt="HUMO"
        className={`${className} object-contain inline-block`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <svg viewBox="0 0 100 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="32" rx="6" fill="#023b20" />
      <path d="M14 8V24M14 16H22M22 8V24" stroke="#00E676" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M28 8V17C28 20.5 30.5 23 33.5 23C36.5 23 39 20.5 39 17V8" stroke="#00E676" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M45 24V8L52 17L59 8V24" stroke="#00E676" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="72" cy="16" r="7.5" stroke="#FF6D00" strokeWidth="3.2" />
    </svg>
  )
}

/**
 * UZCARD Logo (Reads custom uploaded logo or default vector SVG)
 */
export function UzcardLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const url = customUrl || 'https://i.ibb.co/0VJX9CBH/Uzcard-Logo-white-text-643x700.png'
  return (
    <img
      src={url}
      alt="UZCARD"
      className={`${className} object-contain inline-block`}
      referrerPolicy="no-referrer"
    />
  )
}

/**
 * PayGo Official Logo
 */
export function PayGoLogo({ className = "h-6", url }: { className?: string; url?: string }) {
  const logoUrl = url || 'https://i.ibb.co/sd8RnH9N/Pix-WYE0d-PXzy-DGc8-OLd6-I6-NXw5y-Og3y6.webp'
  return (
    <img
      src={logoUrl}
      alt="PayGo"
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  )
}

/**
 * Payme Logo (Reads custom uploaded logo or fallback)
 */
export function PaymeLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const url = customUrl || 'https://i.ibb.co/s9QfXv64/payme-uz-logo.jpg'
  return (
    <img
      src={url}
      alt="Payme"
      className={`${className} object-contain inline-block`}
      referrerPolicy="no-referrer"
    />
  )
}

/**
 * Click Logo (Reads custom uploaded logo or fallback)
 */
export function ClickLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const url = customUrl || 'https://i.ibb.co/50BC2y7/click-white-1.jpg'
  return (
    <img
      src={url}
      alt="Click"
      className={`${className} object-contain inline-block`}
      referrerPolicy="no-referrer"
    />
  )
}

/**
 * Uzum Bank Logo (Reads custom uploaded logo or fallback)
 */
export function UzumBankLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const url = customUrl || 'https://i.ibb.co/WvtSkNq2/ex3h2e6g2nohuqmg5429lihq1q7mdduy.png'
  return (
    <img
      src={url}
      alt="Uzum Bank"
      className={`${className} object-contain inline-block`}
      referrerPolicy="no-referrer"
    />
  )
}

/* ==========================================================================
   ACCEPTED PAYMENT BRANDS BAR
   ========================================================================== */

export function AcceptedBrandsBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white border border-slate-200 shadow-sm ${className}`}>
      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
        <ShieldCheck size={14} className="text-emerald-500" /> Qabul qilinadigan kartalar:
      </span>
      <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
        <HumoLogo className="h-5 w-auto" />
        <div className="w-px h-4 bg-slate-200"></div>
        <UzcardLogo className="h-5 w-auto" />
      </div>
    </div>
  )
}

/* ==========================================================================
   PAYMENT APP BUTTONS (CLICK, PAYME, UZUM BANK)
   ========================================================================== */

interface PaymentAppButtonsProps {
  cardNumber: string
  amount?: number
  className?: string
}

export function PaymentAppButtons({ cardNumber, amount, className = "" }: PaymentAppButtonsProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const cleanCard = cardNumber.replace(/\D/g, '')

  const handleOpenApp = (appName: string, url: string) => {
    // 1. Copy card number automatically
    if (cleanCard && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cleanCard)
    }

    // 2. Show user feedback toast
    const msg = `Karta (${cleanCard}) nusxalandi! ${appName} ga o‘tilmoqda...`
    setToastMessage(msg)

    // 3. Open mobile payment app / website synchronously without delay to bypass popup blockers
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      window.location.href = url
    }

    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <Zap size={14} className="text-yellow-500 fill-yellow-500" />
          <span>To‘lov ilovalari orqali tezkor o‘tish</span>
        </span>
        <span className="text-[11px] text-emerald-600 font-bold">Bosing va o‘ting →</span>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span>{toastMessage}</span>
          <Check size={14} className="text-emerald-500 shrink-0" />
        </div>
      )}

      {/* App Launch Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* PAYME BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Payme', 'https://payme.uz')}
          className="group relative flex h-16 items-center justify-between px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm border border-slate-200 cursor-pointer"
        >
          <PaymeLogo className="h-10" />
          <ExternalLink size={16} className="text-slate-400 group-hover:text-slate-600 transition" />
        </button>

        {/* CLICK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Click', 'https://my.click.uz')}
          className="group relative flex h-16 items-center justify-center px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm border border-slate-200 cursor-pointer"
        >
          <ClickLogo className="h-10" />
        </button>

        {/* UZUM BANK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Uzum Bank', 'https://uzumbank.uz')}
          className="group relative flex h-16 items-center justify-center px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm border border-slate-200 cursor-pointer"
        >
          <UzumBankLogo className="h-12" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-normal font-medium">
        💡 Tugmani bosishingiz bilan karta raqami nusxalanadi va to‘lov ilovasi ochiladi.
      </p>
    </div>
  )
}

