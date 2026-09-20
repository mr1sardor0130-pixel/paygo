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
export function PayGoLogo({ 
  className = "h-8", 
  url, 
  showText = true 
}: { 
  className?: string
  url?: string
  showText?: boolean 
}) {
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
      <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto aspect-square drop-shadow-md">
        <defs>
          <linearGradient id="paygo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066ff" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="paygo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <rect width="44" height="44" rx="12" fill="url(#paygo-grad)" />
        {/* Stylized P / Fast Flash Wave */}
        <path
          d="M13 13C13 11.3431 14.3431 10 16 10H25.5C29.0899 10 32 12.9101 32 16.5C32 20.0899 29.0899 23 25.5 23H18.5V33C18.5 33.5523 18.0523 34 17.5 34H14C13.4477 34 13 33.5523 13 33V13Z"
          fill="white"
        />
        <path
          d="M19 15.5H25C26.3807 15.5 27.5 16.6193 27.5 18C27.5 19.3807 26.3807 20.5 25 20.5H19V15.5Z"
          fill="#1d4ed8"
        />
        {/* Fast Lightning Arrow */}
        <path
          d="M26 22L33 29H27L25 32L28 26H23L26 22Z"
          fill="url(#paygo-accent)"
        />
      </svg>

      {showText && (
        <div className="flex flex-col text-left leading-none">
          <span className="font-mono text-xs font-black tracking-widest text-sky-400 uppercase">
            PAYGO <span className="text-white">SECURE</span>
          </span>
          <span className="text-[9.5px] text-slate-400 font-medium tracking-tight">
            Xavfsiz to‘lovlar
          </span>
        </div>
      )}
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
    <div className={`inline-flex items-center justify-center bg-white rounded-lg px-2 py-1 border border-slate-200 shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 88 26" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
        {/* Official HUMO Bird Wings */}
        <g transform="translate(2, 2)">
          <path d="M13.5 3.5C11.5 6.8 8.8 10.5 6 14C9.8 13.3 14 12.7 18.5 12.5C16.6 9.7 15 6.7 13.5 3.5Z" fill="#FF9E1B" />
          <path d="M19.5 12.5C15 12.7 10.8 13.3 7 14C10.2 18.2 15 21.5 20.5 21.5C24.8 21.5 28.5 19.3 31.2 16C27.2 15.2 23.2 14 19.5 12.5Z" fill="#00A3A6" />
          <path d="M22 4C19.5 7.3 16.8 10.8 14 14.2C18 13.6 22.3 13 26.5 12.8C24.8 9.8 23.3 6.8 22 4Z" fill="#FFB74D" />
        </g>
        {/* Bold HUMO Lettering */}
        <text x="38" y="19" fontFamily="system-ui, -apple-system, sans-serif" fontSize="15" fontWeight="900" fill="#00A3A6" letterSpacing="0.8">
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
    <div className={`inline-flex items-center justify-center bg-[#0d2346] rounded-lg px-2 py-1 border border-[#1b3a6b] shadow-xs shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 94 26" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto">
        {/* UZCARD Stylized 'U' Shield */}
        <g transform="translate(3, 2.5)">
          <rect width="21" height="21" rx="5" fill="#0072CE" />
          <path
            d="M6 6V12C6 14.5 8 16.5 10.5 16.5C13 16.5 15 14.5 15 12V6H12.5V12C12.5 13.1 11.6 14 10.5 14C9.4 14 8.5 13.1 8.5 12V6H6Z"
            fill="white"
          />
        </g>
        {/* Crisp UZCARD Lettering */}
        <text x="31" y="19" fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="900" fill="#FFFFFF" letterSpacing="0.9">
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
    <div className={`inline-flex items-center justify-center bg-[#00cccc] rounded-xl px-3 py-1.5 shadow-sm shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 106 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
        <g transform="translate(2, 2)">
          {/* Payme White Card Emblem */}
          <rect width="24" height="24" rx="7" fill="white" />
          <path d="M6.5 8.5H17.5C18.3 8.5 19 9.2 19 10V16C19 16.8 18.3 17.5 17.5 17.5H6.5C5.7 17.5 5 16.8 5 16V10C5 9.2 5.7 8.5 6.5 8.5Z" fill="#00cccc" />
          <rect x="5" y="10.5" width="14" height="2" fill="white" />
          <circle cx="8" cy="14.5" r="1.2" fill="white" />
        </g>
        <text x="32" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="900" fill="white" letterSpacing="-0.3">
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
    <div className={`inline-flex items-center justify-center bg-white rounded-xl px-3 py-1.5 border border-slate-200 shadow-sm shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 106 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
        {/* Click Dual-Blue Ring */}
        <g transform="translate(4, 2)">
          <circle cx="12" cy="12" r="10" stroke="#0073FF" strokeWidth="4" />
          <circle cx="12" cy="12" r="4.5" fill="#00C4FE" />
        </g>
        <text x="32" y="20" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="900" fill="#0073FF" letterSpacing="-0.4">
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
    <div className={`inline-flex items-center justify-center bg-[#7000FF] rounded-xl px-3 py-1.5 shadow-sm shrink-0 select-none ${className}`}>
      <svg viewBox="0 0 130 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto max-h-7">
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
    <div className={`flex flex-wrap items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white border border-slate-200 shadow-xs ${className}`}>
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

/**
 * Quick Payment App Buttons row (Payme, Click, Uzum Bank)
 */
export function PaymentAppButtons({ 
  cardNumber, 
  amount, 
  className = "" 
}: { 
  cardNumber?: string
  amount?: number
  className?: string 
}) {
  const handleOpenApp = (url: string) => {
    if (cardNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cardNumber.replace(/\D/g, ''))
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => handleOpenApp('https://payme.uz')}
        className="flex items-center justify-center p-2 rounded-xl bg-[#00cccc]/10 border border-[#00cccc]/30 hover:bg-[#00cccc]/20 transition"
      >
        <PaymeLogo className="h-5 w-auto" />
      </button>
      <button
        type="button"
        onClick={() => handleOpenApp('https://my.click.uz')}
        className="flex items-center justify-center p-2 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
      >
        <ClickLogo className="h-5 w-auto" />
      </button>
      <button
        type="button"
        onClick={() => handleOpenApp('https://uzumbank.uz')}
        className="flex items-center justify-center p-2 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 transition"
      >
        <UzumBankLogo className="h-5 w-auto" />
      </button>
    </div>
  )
}

