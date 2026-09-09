'use client'

import React, { useState, useEffect } from 'react'
import { ExternalLink, Check, ShieldCheck, Zap } from 'lucide-react'

/* ==========================================================================
   OFFICIAL & CUSTOM BRAND LOGO COMPONENTS (HUMO, UZCARD, PAYME, CLICK, UZUM BANK)
   ========================================================================== */

/**
 * HUMO Logo (Official Clean Emblem & Transparent Vector Badge)
 */
export function HumoLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(
    customUrl || 'https://i.ibb.co/6R2K3xXy/humo-logo-svg.png'
  )

  useEffect(() => {
    if (customUrl) {
      setLogoUrl(customUrl)
      return
    }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('paygo_humo_logo') : null
    if (saved) {
      setLogoUrl(saved)
    } else {
      setLogoUrl('https://i.ibb.co/6R2K3xXy/humo-logo-svg.png')
    }
  }, [customUrl])

  return (
    <div className={`relative inline-flex items-center justify-center bg-white rounded-md px-1.5 py-0.5 shadow-xs overflow-hidden shrink-0 ${className}`}>
      {/* Authentic Official HUMO SVG Vector */}
      <svg viewBox="0 0 100 30" className="h-full w-auto max-h-full object-contain" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="30" rx="4" fill="#FFFFFF" />
        {/* Humo Bird Wings Icon */}
        <path d="M14 6C12 9 9.5 12.5 7 16C10.5 15.3 14.5 14.7 18.5 14.5C16.8 11.8 15.3 9 14 6Z" fill="#FF9E1B" />
        <path d="M19.5 14.5C15.5 14.7 11.5 15.3 8 16C11 20 15.5 23 20.5 23C24.5 23 28 21 30.5 18C26.8 17.2 23 16 19.5 14.5Z" fill="#00A3A6" />
        <path d="M22 6.5C19.5 9.5 17 12.8 14.5 16.2C18.2 15.6 22.2 15 26.2 14.8C24.5 12 23.2 9.2 22 6.5Z" fill="#FFB74D" />
        {/* Crisp Professional Letterforms */}
        <path d="M38 9V21M38 15H44M44 9V21" stroke="#00796B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M50 9V16.5C50 19 51.8 21 54 21C56.2 21 58 19 58 16.5V9" stroke="#00796B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M64 21V9L69.5 16.5L75 9V21" stroke="#00796B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="86" cy="15" r="5.5" stroke="#FF9E1B" strokeWidth="2.5" />
      </svg>

      {/* Official Humo Raster Image Overlay */}
      {logoUrl && !imgError && (
        <img
          src={logoUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain p-0.5 bg-white transition-opacity duration-150 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  )
}

/**
 * UZCARD Logo (Official Clean Emblem & Transparent Vector Badge)
 */
export function UzcardLogo({ className = "h-6", customUrl }: { className?: string; customUrl?: string }) {
  const url = customUrl || 'https://i.ibb.co/0VJX9CBH/Uzcard-Logo-white-text-643x700.png'
  return (
    <div className={`relative inline-flex items-center justify-center bg-white rounded-md px-1.5 py-0.5 shadow-xs overflow-hidden shrink-0 ${className}`}>
      <img
        src={url}
        alt=""
        className="h-full w-auto max-h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
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
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-transparent hover:bg-slate-50/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer"
        >
          <PaymeLogo className="h-8 max-h-8 max-w-[110px] object-contain" />
        </button>

        {/* CLICK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Click', 'https://my.click.uz')}
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-transparent hover:bg-slate-50/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer"
        >
          <ClickLogo className="h-8 max-h-8 max-w-[110px] object-contain" />
        </button>

        {/* UZUM BANK BUTTON */}
        <button
          type="button"
          onClick={() => handleOpenApp('Uzum Bank', 'https://uzumbank.uz')}
          className="group relative flex h-14 items-center justify-center px-4 rounded-xl bg-transparent hover:bg-slate-50/80 active:scale-[0.98] transition-all border border-slate-200 hover:border-slate-300 cursor-pointer"
        >
          <UzumBankLogo className="h-8 max-h-8 max-w-[110px] object-contain" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center leading-normal font-medium">
        💡 Tugmani bosishingiz bilan karta raqami nusxalanadi va to‘lov ilovasi ochiladi.
      </p>
    </div>
  )
}

