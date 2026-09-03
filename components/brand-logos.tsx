'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Check, ShieldCheck } from 'lucide-react'

/* ==========================================================================
   OFFICIAL & CUSTOM BRAND LOGO COMPONENTS (HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * HUMO Logo (Reads custom uploaded logo from localStorage or uses default)
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

  if (imgError) {
    return (
      <svg viewBox="0 0 100 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="30" rx="5" fill="#022B18" />
        <path d="M12 7V23M12 15H20M20 7V23" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
        <path d="M26 7V16C26 19.5 28.5 22 31.5 22C34.5 22 37 19.5 37 16V7" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
        <path d="M43 23V7L50 16L57 7V23" stroke="#00C853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="70" cy="15" r="7" stroke="#FF6D00" strokeWidth="3" />
      </svg>
    )
  }

  return (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Humo_logo.png"
      alt="HUMO"
      className={`${className} object-contain inline-block`}
      onError={() => setImgError(true)}
    />
  )
}

/**
 * UZCARD Logo (Reads custom uploaded logo from localStorage or uses default)
 */
export function UzcardLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(customUrl || null)

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_uzcard_logo') : null
    if (saved) setLogoUrl(saved)
  }, [customUrl])

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt="UZCARD"
        className={`${className} object-contain inline-block`}
        onError={() => setImgError(true)}
      />
    )
  }

  if (imgError) {
    return (
      <svg viewBox="0 0 110 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="110" height="30" rx="5" fill="#003D75" />
        <text x="10" y="20" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="14" letterSpacing="1">UZCARD</text>
        <g transform="translate(82, 6)">
          <rect width="18" height="18" rx="3" fill="#00A3E0" />
          <rect y="4" width="18" height="4" fill="#002A54" />
          <circle cx="13" cy="13" r="2" fill="#FFFFFF" />
        </g>
      </svg>
    )
  }

  return (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/d/d4/UZCARD_logo.png"
      alt="UZCARD"
      className={`${className} object-contain inline-block`}
      onError={() => setImgError(true)}
    />
  )
}

/**
 * Payme Logo (Reads custom uploaded logo or fallback)
 */
export function PaymeLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(customUrl || null)

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_payme_logo') : null
    if (saved) setLogoUrl(saved)
  }, [customUrl])

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Payme"
        className={`${className} object-contain inline-block`}
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#19D3C5] px-2.5 py-1 rounded-lg font-black text-[#002B28] text-xs uppercase tracking-tight shadow-sm ${className}`}>
      payme
    </div>
  )
}

/**
 * Click Logo (Reads custom uploaded logo or fallback)
 */
export function ClickLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(customUrl || null)

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_click_logo') : null
    if (saved) setLogoUrl(saved)
  }, [customUrl])

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Click"
        className={`${className} object-contain inline-block`}
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#008BE3] px-2.5 py-1 rounded-lg font-black text-white text-xs tracking-tight shadow-sm ${className}`}>
      click <span className="w-1.5 h-1.5 bg-[#00FFCC] rounded-full ml-0.5 inline-block"></span>
    </div>
  )
}

/**
 * Uzum Bank Logo (Reads custom uploaded logo or fallback)
 */
export function UzumBankLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(customUrl || null)

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_uzum_logo') : null
    if (saved) setLogoUrl(saved)
  }, [customUrl])

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Uzum Bank"
        className={`${className} object-contain inline-block`}
      />
    )
  }

  return (
    <div className={`inline-flex items-center justify-center bg-[#7000FF] px-2.5 py-1 rounded-lg font-black text-xs shadow-sm ${className}`}>
      <span className="text-[#FFC700]">uzum</span>
      <span className="text-white ml-1 font-bold">bank</span>
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
            <PaymeLogo className="h-5" />
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
            <ClickLogo className="h-5" />
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
            <UzumBankLogo className="h-5" />
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

