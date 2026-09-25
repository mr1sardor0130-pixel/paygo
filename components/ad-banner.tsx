'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface AdBannerProps {
  /** Auto refresh interval in seconds (default: 18) */
  refreshInterval?: number
  /** Custom wrapper styling */
  className?: string
  /** Optional variant (kept for backwards compatibility) */
  variant?: string
  /** Optional label (kept for backwards compatibility) */
  label?: string
  /** Optional context (kept for backwards compatibility) */
  pageContext?: string
}

export function AdBanner({
  refreshInterval = 18,
  className = '',
}: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [refreshKey, setRefreshKey] = useState<number>(0)

  // Silent background auto-refresh
  const reloadAd = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      reloadAd()
    }, refreshInterval * 1000)

    return () => clearInterval(timer)
  }, [reloadAd, refreshInterval])

  // Inject HighRevenueFormat Iframe Script on key update
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous ad content
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
  }, [refreshKey])

  return (
    <div className={`w-full flex justify-center items-center my-3 ${className}`}>
      <div className="bg-white rounded-xl p-2 border border-slate-200/90 shadow-xs flex justify-center items-center min-h-[68px] min-w-[300px] sm:min-w-[484px] overflow-hidden">
        <div 
          ref={containerRef} 
          className="ad-unit-container flex justify-center items-center overflow-hidden min-w-[300px] sm:min-w-[468px] min-h-[60px]"
        />
      </div>
    </div>
  )
}

/**
 * Standard Native Ad Bar fallback component
 */
export function NativeAdBar({ className = '' }: { className?: string }) {
  return <AdBanner className={className} />
}
