'use client'

import { useState } from 'react'
import { Sparkles, Gift, Play, Monitor, Tv, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react'
import { triggerTelegramMiniAppAd, AdFormat } from '@/lib/telegram-ads'

export function TelegramMiniAppAdsWidget() {
  const [loadingFormat, setLoadingFormat] = useState<AdFormat | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [rewardCount, setRewardCount] = useState(0)

  const handleShowAd = async (format: AdFormat, formatName: string) => {
    setLoadingFormat(format)
    setStatusMsg(null)

    const success = await triggerTelegramMiniAppAd({
      format,
      onReward: () => {
        setRewardCount((prev) => prev + 1)
        setStatusMsg({
          text: `🎉 Tabriklaymiz! "${formatName}" reklamasi ko'rindi va bonus berildi!`,
          type: 'success',
        })
      },
      onError: (err) => {
        setStatusMsg({
          text: `⚠️ Reklama yuklashda xatolik: ${err}`,
          type: 'error',
        })
      },
    })

    if (!success && !statusMsg) {
      setStatusMsg({
        text: ` Reklama yangi oynada ochildi. Statistika to'planmoqda...`,
        type: 'success',
      })
    }

    setLoadingFormat(null)
  }

  return (
    <div className="w-full my-6 max-w-4xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs text-slate-800">
      
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-blue-600 text-white grid place-items-center shadow-xs">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>Telegram Mini App Reklama Formatlari</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                Monetag / Adsgram
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Ilovangizga o‘rnatilgan 3 xil monatizatsiya formati
            </p>
          </div>
        </div>

        {/* Reward counter badge */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-bold self-start sm:self-auto">
          <Gift className="w-4 h-4 text-amber-600" />
          <span>Olingan mukofotlar: <b className="text-amber-700 font-mono text-sm">{rewardCount}</b></span>
        </div>
      </div>

      {/* Format Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
        
        {/* 1. Mukofotlangan Interstitsial */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col justify-between hover:border-blue-300 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" /> Rewarded Interstitial
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Aktiv
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">
              Mukofotlangan Interstitsial
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              Foydalanuvchi to'liq ekranda reklamani tomosha qilib, evaziga bonus/balans oladi.
            </p>
          </div>

          <button
            onClick={() => handleShowAd('rewarded_interstitial', 'Mukofotlangan Interstitsial')}
            disabled={loadingFormat === 'rewarded_interstitial'}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 text-xs transition shadow-xs active:scale-98 disabled:opacity-60"
          >
            {loadingFormat === 'rewarded_interstitial' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            <span>Interstitsialni Chiqarish</span>
          </button>
        </div>

        {/* 2. Mukofotlangan Qalqib Chiquvchi Oyna */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col justify-between hover:border-indigo-300 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5" /> Rewarded Popup
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Aktiv
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">
              Mukofotlangan Qalqib Chiquvchi Oyna
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              Qalqib chiquvchi ixcham modal ko'rinishidagi mukofotli reklama oynasi.
            </p>
          </div>

          <button
            onClick={() => handleShowAd('rewarded_popup', 'Mukofotlangan Qalqib Chiquvchi Oyna')}
            disabled={loadingFormat === 'rewarded_popup'}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 text-xs transition shadow-xs active:scale-98 disabled:opacity-60"
          >
            {loadingFormat === 'rewarded_popup' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Popup Reklamani Ochiq Ko‘rish</span>
          </button>
        </div>

        {/* 3. Ilova Ichidagi Interstitsial */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col justify-between hover:border-purple-300 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> In-App Interstitial
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Aktiv
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">
              Ilova Ichidagi Interstitsial
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              Sahifalar almashayotganda yoki to'lov tasdiqlanganda chiquvchi standart reklama.
            </p>
          </div>

          <button
            onClick={() => handleShowAd('in_app_interstitial', 'Ilova Ichidagi Interstitsial')}
            disabled={loadingFormat === 'in_app_interstitial'}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 text-xs transition shadow-xs active:scale-98 disabled:opacity-60"
          >
            {loadingFormat === 'in_app_interstitial' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>In-App Ads Faollashtirish</span>
          </button>
        </div>

      </div>

      {/* Notification Toast */}
      {statusMsg && (
        <div className={`mt-3.5 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

    </div>
  )
}
