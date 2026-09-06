'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Check, ShieldCheck } from 'lucide-react'

/* ==========================================================================
   OFFICIAL & CUSTOM BRAND LOGO COMPONENTS (HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * HUMO Logo (Reads custom uploaded logo or default official PNG)
 */
export function HumoLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = customUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Humo_logo.png/1200px-Humo_logo.png"

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt="HUMO"
        className={`${className} object-contain inline-block`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
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
 * UZCARD Logo (Reads custom uploaded logo or default official PNG)
 */
export function UzcardLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = customUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Uzcard_logo.png/1200px-Uzcard_logo.png"

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt="UZCARD"
        className={`${className} object-contain inline-block`}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <svg viewBox="0 0 110 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="110" height="32" rx="6" fill="#003366" />
      <text x="10" y="21" fill="#FFFFFF" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="13" letterSpacing="1.2">UZCARD</text>
      <g transform="translate(80, 6)">
        <rect width="20" height="20" rx="4" fill="#00A3E0" />
        <rect y="4" width="20" height="4.5" fill="#001F3F" />
        <circle cx="14" cy="14" r="2.5" fill="#FFFFFF" />
      </g>
    </svg>
  )
}

/**
 * PayGo Official Logo
 */
export function PayGoLogo({ className = "h-6" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#1769e0] to-[#124ba8] shadow-md ${className}`}>
      <svg width="100%" height="100%" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z" fill="white" />
        <path d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z" fill="white" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
    </div>
  )
}

/**
 * Payme Logo (Reads custom uploaded logo or fallback)
 */
export function PaymeLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const logoUrl = customUrl || "https://upload.wikimedia.org/wikipedia/commons/2/23/Paymeuz_logo.png";

  return (
    <div className="flex items-center">
      <img
        src={logoUrl}
        alt="Payme"
        className={`${className} object-contain inline-block brightness-110 contrast-125`}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}

/**
 * Click Logo (Reads custom uploaded logo or fallback)
 */
export function ClickLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const logoUrl = customUrl || "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Click_Uzbekistan_logo.png/640px-Click_Uzbekistan_logo.png";

  return (
    <div className="flex items-center px-1.5 py-1 bg-white/10 rounded-lg">
      <img
        src={logoUrl}
        alt="Click"
        className={`${className} object-contain inline-block brightness-125`}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}

/**
 * Uzum Bank Logo (Reads custom uploaded logo or fallback)
 */
export function UzumBankLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const logoUrl = customUrl || "https://upload.wikimedia.org/wikipedia/commons/1/1d/Uzum_logo.png";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoUrl}
        alt="Uzum"
        className="h-[120%] w-auto object-contain brightness-110"
        referrerPolicy="no-referrer"
      />
      <span className="text-white font-black text-xl tracking-tighter uppercase italic italic-accent">bank</span>
    </div>
  )
}

/* ==========================================================================
   ACCEPTED PAYMENT BRANDS BAR
   ========================================================================== */

export function AcceptedBrandsBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-slate-900/80 border border-slate-800 ${className}`}>
      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
        <ShieldCheck size={14} className="text-emerald-400" /> Qabul qilinadigan kartalar:
      </span>
      <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
        <HumoLogo className="h-5 w-auto" />
        <div className="w-px h-4 bg-slate-700"></div>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* PAYME BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Payme', 'https://payme.uz')}
          className="group relative flex h-14 items-center justify-between px-4 rounded-2xl bg-[#19D3C5] hover:brightness-105 active:scale-[0.98] transition-all shadow-sm border border-white/10 cursor-pointer"
        >
          <PaymeLogo className="h-8" />
          <ExternalLink size={16} className="text-[#002B28] opacity-40 group-hover:opacity-100 transition" />
        </button>

        {/* CLICK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Click', 'https://my.click.uz')}
          className="group relative flex h-14 items-center justify-between px-4 rounded-2xl bg-[#008BE3] hover:brightness-105 active:scale-[0.98] transition-all shadow-sm border border-white/10 cursor-pointer"
        >
          <ClickLogo className="h-8" />
          <ExternalLink size={16} className="text-white opacity-40 group-hover:opacity-100 transition" />
        </button>

        {/* UZUM BANK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Uzum Bank', 'https://uzumbank.uz')}
          className="group relative flex h-14 items-center justify-between px-4 rounded-2xl bg-[#7000FF] hover:brightness-105 active:scale-[0.98] transition-all shadow-sm border border-white/10 cursor-pointer"
        >
          <UzumBankLogo className="h-10" />
          <ExternalLink size={16} className="text-white opacity-40 group-hover:opacity-100 transition" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-normal">
        💡 Tugmani bosishingiz bilan karta raqami nusxalanadi va to‘lov ilovasi ochiladi.
      </p>
    </div>
  )
}

