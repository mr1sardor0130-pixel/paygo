'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, ExternalLink, Sparkles, Zap, ShieldCheck, Flame, ArrowUpRight } from 'lucide-react'

export interface AdBannerProps {
  /**
   * Ad presentation type:
   * - 'banner': 468x60 iFrame ad unit
   * - 'native': Text/Link high-revenue bannerless native ad (2-chi turdagi bannersiz reklama)
   * - 'combined': Both banner and native direct ad shown together
   * - 'auto': Responsive auto-selection
   */
  variant?: 'banner' | 'native' | 'combined' | 'auto'
  /** Auto refresh interval in seconds (default: 18) */
  refreshInterval?: number
  /** Label tag text */
  label?: string
  /** Custom wrapper styling */
  className?: string
  /** Context tag for tracking/placement */
  pageContext?: string
}

// Sponsored Native Bannersiz (Text/Link Direct) Ad Suggestions
const NATIVE_SPONSORS = [
  {
    badge: '🔥 Top Taklif',
    title: 'HUMO & UZCARD Kartalaringizni Telegram Botga Ulang!',
    description: '1 soniyada avto-tekshiruv, instant webhook xabarnomalari va 0% komissiya bilan ishlashni boshlang.',
    cta: 'Hoziroq Sinash',
    url: 'https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c',
    tag: 'Tavsiya etilgan',
  },
  {
    badge: '⚡ Homiy E’loni',
    title: 'Telegram Do’koningiz Uchun VIP Avto-To’lov Plagin',
    description: 'Mijozlaringiz xarid qilishi bilan to’lov holati darhol yangilanadi va chek yuboriladi.',
    cta: 'Batafsil Ko‘rish',
    url: 'https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c',
    tag: 'Hamkorlik',
  },
  {
    badge: '💎 Maxsus Taklif',
    title: 'PayGo V0 API — Ishonchli Webhook & Bot CRM Platformasi',
    description: 'Biznesingiz to’lovlarini avtomatlashtiring, kunlik monitoring va xavfsiz hisobotlarni oling.',
    cta: 'Ulanish',
    url: 'https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c',
    tag: 'Homiylik',
  },
  {
    badge: '🚀 Tezkor Xizmat',
    title: 'Karta Raqamlari va Monitoring Tizimida Maxsus Chegirmalar',
    description: 'Tariflarni faollashtiring hamda botingizda bir vaqtning o’zida 10+ kartani birga boshqaring.',
    cta: 'Tariflarni Ko‘rish',
    url: 'https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c',
    tag: 'Aksiya',
  },
]

export function AdBanner({
  variant = 'combined',
  refreshInterval = 18,
  label = 'Reklama & Homiylik',
  className = '',
  pageContext = 'general',
}: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [countdown, setCountdown] = useState<number>(refreshInterval)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [currentSponsorIdx, setCurrentSponsorIdx] = useState<number>(0)

  // Manual & Auto Refresh Ad Banner Logic
  const reloadAd = useCallback(() => {
    setIsRefreshing(true)
    setRefreshKey((prev) => prev + 1)
    setCountdown(refreshInterval)
    // Rotate native sponsor offer
    setCurrentSponsorIdx((prev) => (prev + 1) % NATIVE_SPONSORS.length)
    
    setTimeout(() => {
      setIsRefreshing(false)
    }, 600)
  }, [refreshInterval])

  // Timer Countdown for Frequent Auto-Refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          reloadAd()
          return refreshInterval
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [reloadAd, refreshInterval])

  // Inject HighRevenueFormat Iframe Script on key update
  useEffect(() => {
    if (variant === 'native') return // Skip iframe injection for pure native variant

    const container = containerRef.current
    if (!container) return

    // Clear previous children
    container.innerHTML = ''

    try {
      // 1. Script configuration object
      const scriptConfig = document.createElement('script')
      scriptConfig.type = 'text/javascript'
      scriptConfig.innerHTML = `
        atOptions = {
          'key' : '56b3fbce57a92c544a70c5b0a2dc9e6c',
          'format' : 'iframe',
          'height' : 60,
          'width' : 468,
          'params' : {}
        };
      `
      container.appendChild(scriptConfig)

      // 2. High Revenue Invoke Script
      const scriptInvoke = document.createElement('script')
      scriptInvoke.type = 'text/javascript'
      scriptInvoke.src = `https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c/invoke.js?v=${refreshKey}`
      scriptInvoke.async = true
      container.appendChild(scriptInvoke)
    } catch (err) {
      console.warn('AdBanner injection error:', err)
    }
  }, [refreshKey, variant])

  const sponsor = NATIVE_SPONSORS[currentSponsorIdx]

  return (
    <div className={`w-full my-4 px-2 sm:px-4 ${className}`}>
      <div className="max-w-4xl mx-auto bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-3 border border-indigo-500/20 shadow-lg shadow-indigo-950/20 text-white relative overflow-hidden backdrop-blur-md">
        
        {/* Background glow effects */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Bar with Auto-refresh timer & indicator */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-400/30 text-[11px]">
              <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
              {label}
            </span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              • Avto-yangilanish: <span className="text-emerald-400 font-mono font-semibold">{countdown}s</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reloadAd}
              disabled={isRefreshing}
              title="Reklamani yangilash"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white transition-all text-[11px] border border-slate-700"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden xs:inline">Yangilash</span>
            </button>
          </div>
        </div>

        {/* Ad Contents Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-1">

          {/* 1. Standard 468x60 Iframe Ad Container (For 'banner', 'combined', 'auto') */}
          {(variant === 'banner' || variant === 'combined' || variant === 'auto') && (
            <div className="flex flex-col items-center justify-center w-full md:w-auto min-h-[64px] bg-slate-950/60 rounded-xl p-1.5 border border-slate-800 shadow-inner overflow-hidden">
              <div 
                ref={containerRef} 
                className="ad-unit-container flex justify-center items-center overflow-hidden min-w-[300px] sm:min-w-[468px] min-h-[60px]"
              />
            </div>
          )}

          {/* 2. Type 2 Native Bannerless Ad Unit ("2-chi turdagi bannersiz reklama") */}
          {(variant === 'native' || variant === 'combined' || variant === 'auto') && (
            <a
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex-1 w-full bg-gradient-to-br from-indigo-900/40 via-slate-900/80 to-slate-950 p-3 rounded-xl border border-indigo-500/30 hover:border-indigo-400/60 transition-all hover:shadow-md hover:shadow-indigo-500/10 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    {sponsor.badge}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300">
                    {sponsor.tag}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>

              <h4 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-blue-300 transition-colors line-clamp-1">
                {sponsor.title}
              </h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                {sponsor.description}
              </p>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-indigo-300 font-medium">
                <span className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Homiylik havolasi
                </span>
                <span className="group-hover:underline flex items-center gap-1 text-blue-400">
                  {sponsor.cta} <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            </a>
          )}

        </div>

        {/* Bottom subtle progress line for refresh countdown */}
        <div className="w-full h-0.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / refreshInterval) * 100}%` }}
          />
        </div>

      </div>
    </div>
  )
}

/**
 * Compact Native Ad Bar specifically tailored for Payment Pages and Sidebars
 */
export function NativeAdBar({ className = '' }: { className?: string }) {
  return (
    <AdBanner 
      variant="native" 
      refreshInterval={15} 
      label="Tavsiya etilgan taklif"
      className={className}
      pageContext="native_bar"
    />
  )
}
