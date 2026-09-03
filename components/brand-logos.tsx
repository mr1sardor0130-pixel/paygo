'use client'

import React, { useState } from 'react'
import { ExternalLink, Check, Copy, ShieldCheck } from 'lucide-react'

/* ==========================================================================
   OFFICIAL BRAND LOGO SVGs (HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * Official HUMO Logo SVG
 */
export function HumoLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Pill */}
      <rect width="120" height="32" rx="6" fill="#022B18" />
      {/* Green Curved H & M symbol */}
      <path d="M12 8V24M12 16H22M22 8V24" stroke="#00C853" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29 8V18C29 21.3 31.7 24 35 24C38.3 24 41 21.3 41 18V8" stroke="#00C853" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M48 24V8L56 18L64 8V24" stroke="#00C853" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Orange Circle O */}
      <circle cx="78" cy="16" r="8" stroke="#FF6D00" strokeWidth="3.5" />
      {/* HUMO Text */}
      <text x="91" y="21" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="13" letterSpacing="0.5">HUMO</text>
    </svg>
  )
}

/**
 * Official UZCARD Logo SVG
 */
export function UzcardLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="130" height="32" rx="6" fill="#003D75" />
      <text x="12" y="21" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="15" letterSpacing="1">UZCARD</text>
      {/* Cyan card graphic emblem */}
      <g transform="translate(98, 7)">
        <rect width="20" height="18" rx="3" fill="#00A3E0" />
        <rect y="4" width="20" height="4" fill="#002A54" />
        <circle cx="15" cy="14" r="2" fill="#FFFFFF" />
      </g>
    </svg>
  )
}

/**
 * Official Payme Logo SVG
 */
export function PaymeLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="110" height="32" rx="7" fill="#19D3C5" />
      <text x="55" y="21" textAnchor="middle" fill="#002B28" fontFamily="sans-serif" fontWeight="900" fontSize="16" letterSpacing="-0.5">payme</text>
    </svg>
  )
}

/**
 * Official Click Logo SVG
 */
export function ClickLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="110" height="32" rx="7" fill="#008BE3" />
      <text x="50" y="21" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="17" letterSpacing="-0.5">click</text>
      <circle cx="86" cy="11" r="3" fill="#00FFCC" />
    </svg>
  )
}

/**
 * Official Uzum Bank Logo SVG
 */
export function UzumBankLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="120" height="32" rx="7" fill="#7000FF" />
      <text x="12" y="21" fill="#FFC700" fontFamily="sans-serif" fontWeight="900" fontSize="15" letterSpacing="-0.3">uzum</text>
      <text x="58" y="21" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="800" fontSize="13">bank</text>
    </svg>
  )
}

/* ==========================================================================
   ACCEPTED PAYMENT BRANDS BAR
   ========================================================================== */

export function AcceptedBrandsBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 ${className}`}>
      <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
        <ShieldCheck size={14} className="text-emerald-400" /> Rasmiy qabul qilinadigan kartalar:
      </span>
      <div className="flex items-center gap-2">
        <HumoLogo className="h-6 w-auto shadow-sm" />
        <UzcardLogo className="h-6 w-auto shadow-sm" />
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
    if (cleanCard) {
      navigator.clipboard.writeText(cleanCard)
    }

    // 2. Show user feedback toast
    const msg = `Karta (${cleanCard}) nusxalandi! ${appName} ga o‘tilmoqda...`
    setToastMessage(msg)

    // 3. Open mobile payment app / website
    setTimeout(() => {
      window.open(url, '_blank')
    }, 400)

    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <span>⚡️ To‘lov ilovalari orqali tezkor o‘tish</span>
        </span>
        <span className="text-[11px] text-emerald-400 font-medium">Bosing va o‘ting →</span>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <span>{toastMessage}</span>
          <Check size={14} className="text-emerald-400 shrink-0" />
        </div>
      )}

      {/* App Launch Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* PAYME BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Payme', 'https://payme.uz')}
          className="group relative flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#19D3C5] hover:bg-[#16c4b7] text-[#002B28] font-black text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <PaymeLogo className="h-5 w-auto" />
            <span className="font-extrabold text-[12px]">Payme</span>
          </div>
          <ExternalLink size={14} className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
        </button>

        {/* CLICK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Click', 'https://my.click.uz')}
          className="group relative flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#008BE3] hover:bg-[#007ccb] text-white font-black text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ClickLogo className="h-5 w-auto" />
            <span className="font-extrabold text-[12px]">Click</span>
          </div>
          <ExternalLink size={14} className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
        </button>

        {/* UZUM BANK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Uzum Bank', 'https://uzumbank.uz')}
          className="group relative flex items-center justify-between px-3.5 py-3 rounded-2xl bg-[#7000FF] hover:bg-[#6200e0] text-white font-black text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <UzumBankLogo className="h-5 w-auto" />
            <span className="font-extrabold text-[12px]">Uzum Bank</span>
          </div>
          <ExternalLink size={14} className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-normal">
        💡 Tugmani bosishingiz bilan karta raqami nusxalanadi va to‘lov ilovasi ochiladi.
      </p>
    </div>
  )
}
