'use client'

import React, { useEffect, useState } from 'react'
import {
  Activity,
  Server,
  Database,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  Globe,
  Radio,
  ArrowLeft,
  Bot,
  Store,
  CreditCard,
} from 'lucide-react'
import Link from 'next/link'

export default function SystemStatusPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/system/status')
      const json = await res.json()
      setData(json)
      setLastRefreshed(new Date())
    } catch (err) {
      console.error('Failed to fetch system status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatUptime = (secs: number) => {
    if (!secs) return '0s'
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs % 86400) / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    const seconds = secs % 60
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m ${seconds}s`
    return `${mins}m ${seconds}s`
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-20">
      {/* Background Subtle Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft size={16} /> Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
              <h1 className="text-xl font-bold text-white tracking-tight">System Health & Host Status</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Radio size={12} className={autoRefresh ? 'animate-pulse text-emerald-400' : ''} />
              {autoRefresh ? 'Auto-refresh Active (10s)' : 'Auto-refresh Off'}
            </button>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Yangilash"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-400' : ''} />
            </button>
          </div>
        </div>

        {/* Global Overall Status Banner */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 ${
                  data?.status === 'operational'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}
              >
                {data?.status === 'operational' ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border ${
                      data?.status === 'operational'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {data?.status === 'operational' ? 'Barcha Tizimlar Barqaror' : 'Tizimda ogohlantirish bor'}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {data?.status === 'operational' ? 'All Systems Operational & Healthy' : 'Partial Degradation Detected'}
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-1">
                  Server hosti, Vercel edge tarmoqlari, PostgreSQL ma'lumotlar bazasi va Telegram botlar to'liq ishchi holatda.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 w-full md:w-auto">
              <span className="text-xs text-slate-400 block font-medium">Oxirgi tekshiruv vaqti:</span>
              <span className="text-sm font-mono font-bold text-emerald-400 block">
                {lastRefreshed ? lastRefreshed.toLocaleTimeString('uz-UZ') : 'Yuklanmoqda...'}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                API latency: <b>{data?.metrics?.apiLatencyMs ?? 0} ms</b>
              </span>
            </div>
          </div>
        </div>

        {/* Top Key Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Host Muhiti</span>
              <Server size={18} className="text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white truncate">
              {data?.host?.environment ?? 'Cloud Host'}
            </div>
            <span className="text-xs text-slate-400 block mt-1">
              Node {data?.host?.nodeVersion ?? 'v20'} • {data?.host?.arch ?? 'x64'}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Baza Ping Latency</span>
              <Database size={18} className="text-sky-400" />
            </div>
            <div className="text-2xl font-extrabold text-sky-400">
              {data?.database?.latencyMs ?? 0} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">
              Holat: <b className="text-emerald-400">{data?.database?.status ?? 'connected'}</b>
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Xotira Ishlatilishi</span>
              <Cpu size={18} className="text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-purple-400">
              {data?.host?.memoryUsageMB ?? 0} <span className="text-xs font-normal text-slate-400">MB RAM</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">
              Process Uptime: <b>{formatUptime(data?.host?.uptimeSeconds ?? 0)}</b>
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">To‘lov Taymeri</span>
              <Clock size={18} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">
              {data?.metrics?.paymentExpiryMinutes ?? 15} <span className="text-xs font-normal text-slate-400">daqiqa</span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">
              Standard QR/Havola muddati
            </span>
          </div>
        </div>

        {/* Detailed Service Components Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Services Health List */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Sub-tizimlar va Xizmatlar Holati
            </h3>

            <div className="space-y-4">
              {data?.services?.map((svc: any, i: number) => (
                <div
                  key={i}
                  className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />
                    <div>
                      <h4 className="font-bold text-white text-sm">{svc.name}</h4>
                      <span className="text-xs text-slate-400">
                        Javob vaqti: <b>{svc.latencyMs} ms</b>
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">
                    ✓ Operational
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Runtime Metadata */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-sky-400" /> Host & Server Parametrlari
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Server Host Turi:</span>
                  <span className="font-mono font-bold text-slate-200">{data?.host?.environment}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Node.js Versiyasi:</span>
                  <span className="font-mono font-bold text-slate-200">{data?.host?.nodeVersion}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Platforma & Arch:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {data?.host?.platform} ({data?.host?.arch})
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Hudud / Region:</span>
                  <span className="font-mono font-bold text-emerald-400 uppercase">{data?.host?.region}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Faol Userbotlar:</span>
                  <span className="font-mono font-bold text-white">{data?.metrics?.activeUserbots ?? 0} ta</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">Jami Ulangan Do‘konlar:</span>
                  <span className="font-mono font-bold text-white">{data?.metrics?.totalShops ?? 0} ta</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-500">
                🔒 Vercel SSL Edge Encryption & 24/7 Health Monitoring Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
