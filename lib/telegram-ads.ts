'use client'

/**
 * Telegram Mini App Monetag / Adsgram Integration Utility for Zone ID 11886893
 * Supports:
 * 1. Rewarded Interstitial: show_11886893()
 * 2. Rewarded Popup: show_11886893('pop')
 * 3. In-App Interstitial: show_11886893({ type: 'inApp', ... })
 */

declare global {
  interface Window {
    show_11886893?: (options?: any) => Promise<any>
    AdexiumWidget?: any
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<{ done: boolean; description?: string }>
      }
    }
    showTgAd?: (format: 'rewarded' | 'interstitial' | 'popup') => Promise<boolean>
    Telegram?: any
  }
}

export type AdFormat = 'rewarded_interstitial' | 'rewarded_popup' | 'in_app_interstitial'

export interface ShowAdOptions {
  format: AdFormat
  onReward?: () => void
  onError?: (error: string) => void
  onClose?: () => void
}

/**
 * Executes Rewarded Interstitial format: show_11886893()
 */
export async function showRewardedInterstitial(onReward?: () => void, onError?: (err: string) => void) {
  if (typeof window !== 'undefined' && typeof window.show_11886893 === 'function') {
    try {
      await window.show_11886893()
      if (onReward) onReward()
      return true
    } catch (e: any) {
      if (onError) onError(e?.message || 'Reklama ko‘rishda xatolik')
      return false
    }
  } else {
    // Fallback direct link launch if script loading or local environment
    if (typeof window !== 'undefined') {
      window.open('https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c', '_blank')
      if (onReward) onReward()
    }
    return true
  }
}

/**
 * Executes Rewarded Popup format: show_11886893('pop')
 */
export async function showRewardedPopup(onReward?: () => void, onError?: (err: string) => void) {
  if (typeof window !== 'undefined' && typeof window.show_11886893 === 'function') {
    try {
      await window.show_11886893('pop')
      if (onReward) onReward()
      return true
    } catch (e: any) {
      if (onError) onError(e?.message || 'Popup reklama xatosi')
      return false
    }
  } else {
    if (typeof window !== 'undefined') {
      window.open('https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c', '_blank')
      if (onReward) onReward()
    }
    return true
  }
}

/**
 * Executes In-App Interstitial format:
 * show_11886893({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } })
 */
export async function showInAppInterstitial(options?: {
  frequency?: number
  capping?: number
  interval?: number
  timeout?: number
  everyPage?: boolean
}) {
  const inAppSettings = {
    frequency: options?.frequency ?? 2,
    capping: options?.capping ?? 0.1,
    interval: options?.interval ?? 30,
    timeout: options?.timeout ?? 5,
    everyPage: options?.everyPage ?? false,
  }

  if (typeof window !== 'undefined' && typeof window.show_11886893 === 'function') {
    try {
      await window.show_11886893({
        type: 'inApp',
        inAppSettings,
      })
      return true
    } catch (e) {
      console.warn('InApp Interstitial error:', e)
      return false
    }
  } else {
    if (typeof window !== 'undefined') {
      window.open('https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c', '_blank')
    }
    return true
  }
}

/**
 * Unified Ad Trigger Router
 */
export async function triggerTelegramMiniAppAd(options: ShowAdOptions): Promise<boolean> {
  const { format, onReward, onError } = options

  if (format === 'rewarded_interstitial') {
    return showRewardedInterstitial(onReward, onError)
  } else if (format === 'rewarded_popup') {
    return showRewardedPopup(onReward, onError)
  } else {
    return showInAppInterstitial()
  }
}
