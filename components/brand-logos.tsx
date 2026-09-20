'use client'

import React, { useState } from 'react'
import { Check, ShieldCheck, Zap } from 'lucide-react'

/* ==========================================================================
   OFFICIAL & 100% SELF-CONTAINED BRAND LOGO COMPONENTS
   (PAYGO, HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * PayGo Official Logo (Pristine High-Definition Vector SVG)
 */
export function PayGoLogo({ className = "h-8", url }: { className?: string; url?: string }) {
  const [imgError, setImgError] = useState(false)

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt="PayGo"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}>
      {/* PayGo Emblem Icon */}
      <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto aspect-square drop-shadow-xs">
        <defs>
          <linearGradient id="paygo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1769e0" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id="paygo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <rect width="44" height="44" rx="12" fill="url(#paygo-grad)" />
        {/* Stylized P/G Speed Wave */}
        <path
          d="M13 14C13 12.3431 14.3431 11 16 11H25.5C29.0899 11 32 13.9101 32 17.5C32 21.0899 29.0899 24 25.5 24H18.5V32C18.5 32.5523 18.0523 33 17.5 33H14C13.4477 33 13 32.5523 13 32V14Z"
          fill="white"
        />
        <path
          d="M19 16.5H25C26.3807 16.5 27.5 17.6193 27.5 19C27.5 20.3807 26.3807 21.5 25 21.5H19V16.5Z"
          fill="#1d4ed8"
        />
        {/* Fast Lightning Arrow */}
        <path
          d="M26 23L33 30H27L25 33L28 27H23L26 23Z"
          fill="url(#paygo-accent)"
        />
      </svg>
    </div>
  )
}

/**
 * HUMO Official Logo (Pristine High-Definition Vector SVG Badge)
 */
export function HumoLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  if (customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt="HUMO"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-white rounded-md px-1.5 py-0.5 border border-slate-200/80 shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 76 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
        {/* Official HUMO Bird Emblem */}
        <g transform="translate(1, 1)">
          <path d="M12.5 3.5C10.5 6.5 8 10 5.5 13.5C9 12.8 13 12.2 17 12C15.3 9.3 13.8 6.5 12.5 3.5Z" fill="#FF9E1B" />
          <path d="M18 12C14 12.2 10 12.8 6.5 13.5C9.5 17.5 14 20.5 19 20.5C23 20.5 26.5 18.5 29 15.5C25.3 14.7 21.5 13.5 18 12Z" fill="#00A3A6" />
          <path d="M20.5 4C18 7 15.5 10.3 13 13.7C16.7 13.1 20.7 12.5 24.7 12.3C23 9.5 21.7 6.7 20.5 4Z" fill="#FFB74D" />
        </g>
        {/* Bold Clean HUMO Text */}
        <text x="34" y="17" fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="900" fill="#00A3A6" letterSpacing="0.5">
          HUMO
        </text>
      </svg>
    </div>
  )
}

/**
 * UZCARD Official Logo (Pristine High-Definition Vector SVG Badge)
 */
export function UzcardLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  if (customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt="UZCARD"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#0d2346] rounded-md px-1.5 py-0.5 border border-[#163566] shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 82 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
        {/* UZCARD Stylized 'U' Shield */}
        <g transform="translate(2, 2)">
          <rect width="20" height="20" rx="4" fill="#0072CE" />
          <path
            d="M5.5 6V11.5C5.5 14 7.5 16 10 16C12.5 16 14.5 14 14.5 11.5V6H12V11.5C12 12.6 11.1 13.5 10 13.5C8.9 13.5 8 12.6 8 11.5V6H5.5Z"
            fill="white"
          />
        </g>
        {/* Crisp UZCARD Lettering */}
        <text x="27" y="17" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="900" fill="#FFFFFF" letterSpacing="0.8">
          UZCARD
        </text>
      </svg>
    </div>
  )
}

/**
 * Payme Official Logo (Vector SVG)
 */
export function PaymeLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  if (customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt="Payme"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#00cccc] rounded-xl px-3 py-1.5 shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
        <g transform="translate(2, 2)">
          {/* Payme White Card Emblem */}
          <rect width="24" height="24" rx="7" fill="white" />
          <path d="M7 8.5H17C17.8 8.5 18.5 9.2 18.5 10V16C18.5 16.8 17.8 17.5 17 17.5H7C6.2 17.5 5.5 16.8 5.5 16V10C5.5 9.2 6.2 8.5 7 8.5Z" fill="#00cccc" />
          <rect x="5.5" y="10.5" width="13" height="2" fill="white" />
          <circle cx="8.5" cy="14.5" r="1" fill="white" />
        </g>
        <text x="32" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="17" fontWeight="900" fill="white" letterSpacing="-0.3">
          payme
        </text>
      </svg>
    </div>
  )
}

/**
 * Click Official Logo (Vector SVG)
 */
export function ClickLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  if (customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt="Click"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-white rounded-xl px-3 py-1.5 border border-slate-200 shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
        {/* Click Dual-Blue Ring */}
        <g transform="translate(4, 2)">
          <circle cx="12" cy="12" r="10" stroke="#0073FF" strokeWidth="4" />
          <circle cx="12" cy="12" r="4.5" fill="#00C4FE" />
        </g>
        <text x="32" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="17" fontWeight="900" fill="#0073FF" letterSpacing="-0.4">
          click
        </text>
      </svg>
    </div>
  )
}

/**
 * Uzum Bank Official Logo (Vector SVG)
 */
export function UzumBankLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)

  if (customUrl && !imgError) {
    return (
      <img
        src={customUrl}
        alt="Uzum Bank"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#7000FF] rounded-xl px-3 py-1.5 shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 120 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
        {/* Uzum Emblem */}
        <g transform="translate(4, 3)">
          <circle cx="11" cy="11" r="10" stroke="white" strokeWidth="3" />
          <path d="M11 4V12" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </g>
        <text x="30" y="19" fontFamily="system-ui, -apple-system, sans-serif" fontSize="15" fontWeight="800" fill="white" letterSpacing="-0.2">
          uzum bank
        </text>
      </svg>
    </div>
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
      <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
        <HumoLogo className="h-6 w-auto" />
        <div className="w-px h-4 bg-slate-200"></div>
        <UzcardLogo className="h-6 w-auto" />
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
    } catch {
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
          <Zap size={14} className="text-amber-500 fill-amber-500" />
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
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
        >
          <PaymeLogo className="h-8 max-h-8 max-w-[120px]" />
        </button>

        {/* CLICK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Click', 'https://my.click.uz')}
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
        >
          <ClickLogo className="h-8 max-h-8 max-w-[120px]" />
        </button>

        {/* UZUM BANK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Uzum Bank', 'https://uzumbank.uz')}
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs"
        >
          <UzumBankLogo className="h-8 max-h-8 max-w-[120px]" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-normal font-medium">
        💡 Tugmani bosishingiz bilan karta raqami nusxalanadi va to‘lov ilovasi ochiladi.
      </p>
    </div>
  )
}


