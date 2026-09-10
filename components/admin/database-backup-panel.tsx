'use client'

import { useState, useEffect } from 'react'
import {
  Database,
  Download,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Archive,
  Server,
  Zap,
  ShieldCheck,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react'

interface BackupStats {
  tablesCount: number
  recordsCount: number
  sizeBytes: number
  zipSizeBytes?: number
  timestamp: string
  source: 'neon_postgres' | 'local_storage'
  durationMs: number
  tables: Record<string, number>
}

export function DatabaseBackupPanel({ adminTelegramId }: { adminTelegramId?: string }) {
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [downloadingSql, setDownloadingSql] = useState(false)
  const [sendingTelegram, setSendingTelegram] = useState(false)
  const [customConn, setCustomConn] = useState('')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [copied, setCopied] = useState(false)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchStats = async () => {
    setLoading(true)
    try {
      const url = customConn
        ? `/api/admin/backup?format=json&conn=${encodeURIComponent(customConn)}`
        : '/api/admin/backup?format=json'
      const res = await fetch(url)
      const data = await res.json()
      if (data.ok && data.stats) {
        setStats(data.stats)
      } else {
        showToast(data.error || 'Statistikani olib bo‘lmadi', 'error')
      }
    } catch {
      showToast('Baza bilan bog‘lanib bo‘lmadi', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleDownloadZip = async () => {
    setDownloadingZip(true)
    try {
      const url = customConn
        ? `/api/admin/backup?format=zip&conn=${encodeURIComponent(customConn)}`
        : '/api/admin/backup?format=zip'
      
      const res = await fetch(url)
      if (!res.ok) throw new Error('ZIP yuklab olishda xatolik')

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `paygo_neon_backup_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      showToast('📦 ZIP backup muvaffaqiyatli yuklab olindi!')
    } catch (err: any) {
      showToast(err?.message || 'Yuklab olishda xatolik', 'error')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleDownloadSql = async () => {
    setDownloadingSql(true)
    try {
      const url = customConn
        ? `/api/admin/backup?format=sql&conn=${encodeURIComponent(customConn)}`
        : '/api/admin/backup?format=sql'

      const res = await fetch(url)
      if (!res.ok) throw new Error('SQL yuklab olishda xatolik')

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `paygo_neon_backup_${new Date().toISOString().slice(0, 10)}.sql`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      showToast('📄 SQL backup muvaffaqiyatli yuklab olindi!')
    } catch (err: any) {
      showToast(err?.message || 'Yuklab olishda xatolik', 'error')
    } finally {
      setDownloadingSql(false)
    }
  }

  const handleSendTelegram = async (format: 'zip' | 'sql' | 'both' = 'both') => {
    setSendingTelegram(true)
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: customConn || undefined,
          sendTelegram: true,
          format,
          chatId: adminTelegramId || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        showToast('✈️ Backup fayllari Telegram botingizga yuborildi!')
      } else {
        showToast(data.description || data.error || 'Telegramga yuborishda xatolik', 'error')
      }
    } catch {
      showToast('Telegram bilan bog‘lanib bo‘lmadi', 'error')
    } finally {
      setSendingTelegram(false)
    }
  }

  const copySqlRestoreCmd = () => {
    const cmd = `psql "${customConn || 'YOUR_NEON_DATABASE_URL'}" < paygo_neon_backup.sql`
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Terminal buyrug‘i nusxalandi!')
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-[#16865b] text-white' : 'bg-[#dc2626] text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Hero Banner */}
      <div className="rounded-3xl border border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] via-white to-[#f0fdf4] p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#1769e0]/10 px-3 py-1 text-xs font-bold text-[#1769e0]">
              <Database size={14} /> Neon PostgreSQL & DB Backup Engine
            </div>
            <h2 className="text-xl lg:text-2xl font-black tracking-tight text-[#152238]">
              Baza SQL & ZIP Backup Eksport Tizimi
            </h2>
            <p className="text-xs lg:text-sm text-[#64748b] max-w-2xl leading-relaxed">
              Neon PostgreSQL bazasidagi barcha jadvallar, DDL tuzilmalar va ma’lumotlarni 100% sifatli SQL skript yoki siqilgan ZIP arxiv ko‘rinishida yuklab oling hamda Telegram orqali qabul qiling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-xs font-bold text-[#334155] shadow-xs hover:bg-[#f8fafc] active:scale-95 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="flex items-center gap-2 rounded-xl bg-[#16865b] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#136f4c] active:scale-95 transition disabled:opacity-50"
            >
              <Archive size={15} /> {downloadingZip ? 'Siqilmoqda...' : '📦 ZIP Yuklab Olish (.zip)'}
            </button>

            <button
              onClick={handleDownloadSql}
              disabled={downloadingSql}
              className="flex items-center gap-2 rounded-xl bg-[#1769e0] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1254b7] active:scale-95 transition disabled:opacity-50"
            >
              <FileCode size={15} /> {downloadingSql ? 'Yuklanmoqda...' : '📄 SQL Yuklab Olish (.sql)'}
            </button>

            <button
              onClick={() => handleSendTelegram('both')}
              disabled={sendingTelegram}
              className="flex items-center gap-2 rounded-xl bg-[#0284c7] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0369a1] active:scale-95 transition disabled:opacity-50"
            >
              <Send size={15} /> {sendingTelegram ? 'Yuborilmoqda...' : '✈️ Telegramga Tashlash'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#64748b] mb-2">
            <span className="text-xs font-semibold">Baza Manbasi</span>
            <Server size={18} className="text-[#1769e0]" />
          </div>
          <div className="text-base font-bold text-[#152238] flex items-center gap-2">
            {stats?.source === 'neon_postgres' ? (
              <>
                <span className="size-2 rounded-full bg-[#16865b] animate-ping" />
                <span className="text-[#16865b]">Neon Cloud Postgres</span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="text-amber-600">Persistent Safe DB</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            {stats?.source === 'neon_postgres' ? 'To‘g‘ridan-to‘g‘ri Neon ulanish' : 'Xavfsiz doimiy xotira holati'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#64748b] mb-2">
            <span className="text-xs font-semibold">Jami Jadvallar</span>
            <Layers size={18} className="text-[#0284c7]" />
          </div>
          <div className="text-2xl font-black text-[#152238]">
            {stats?.tablesCount ?? 0} <span className="text-xs font-normal text-[#64748b]">ta jadval</span>
          </div>
          <p className="mt-1 text-[11px] text-[#94a3b8]">Barcha asosiy sxemalar bilan</p>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#64748b] mb-2">
            <span className="text-xs font-semibold">Jami Yozuvlar (Rows)</span>
            <HardDrive size={18} className="text-[#16865b]" />
          </div>
          <div className="text-2xl font-black text-[#16865b]">
            {stats?.recordsCount ? stats.recordsCount.toLocaleString('uz-UZ') : '0'}{' '}
            <span className="text-xs font-normal text-[#64748b]">ta qator</span>
          </div>
          <p className="mt-1 text-[11px] text-[#94a3b8]">Barcha do‘kon, to‘lov va foydalanuvchilar</p>
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#64748b] mb-2">
            <span className="text-xs font-semibold">SQL Hajmi</span>
            <Archive size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-[#152238]">
            {stats?.sizeBytes ? (stats.sizeBytes / 1024).toFixed(1) : '0'}{' '}
            <span className="text-xs font-normal text-[#64748b]">KB</span>
          </div>
          <p className="mt-1 text-[11px] text-[#94a3b8]">ZIP orqali ~85% gacha siqiladi</p>
        </div>
      </div>

      {/* Telegram Quality & Integrity Explanation Box */}
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#16865b] text-white">
            <ShieldCheck size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#166534]">
              Telegram orqali yuborilganda sifat va ma’lumotlar buziladimi?
            </h3>
            <p className="text-xs text-[#15803d] leading-relaxed">
              <b>Aslo yo‘q!</b> Telegram Bot API’ning <code>sendDocument</code> protokoli fayllarni (ayniqsa <code>.zip</code> va <code>.sql</code>) rasm yoki videolar kabi kompressiya qilmaydi (sifatini tushirmaydi). U faylni baytma-bayt (binary stream) va UTF-8 kodirovkasida 100% asl holatida uzatadi. ZIP arxiv esa barcha SQL fayllarni yaxlit saqlaydi va tez yuklanishini ta’minlaydi.
            </p>
          </div>
        </div>
      </div>

      {/* Custom Neon Connection String Input */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
              <Zap size={16} className="text-amber-500" /> Maxsus Neon Connection String orqali Eksport
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Istalgan tashqi Neon PostgreSQL bazangiz URL manzilini kiritib, to‘g‘ridan-to‘g‘ri backup olishingiz mumkin:
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="postgresql://neondb_owner:password@ep-cool-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"
            value={customConn}
            onChange={(e) => setCustomConn(e.target.value)}
            className="flex-1 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-4 py-2.5 font-mono text-xs text-[#152238] focus:border-[#1769e0] focus:bg-white focus:outline-none"
          />
          <button
            onClick={fetchStats}
            disabled={loading}
            className="rounded-xl bg-[#1769e0] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1254b7] active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Tekshirilmoqda...' : 'Ulanish & O‘qish'}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3 border border-[#e2e8f0]">
          <div className="text-[11px] font-mono text-[#475569] truncate max-w-xl">
            <code>psql &quot;{customConn || 'YOUR_NEON_DATABASE_URL'}&quot; &lt; paygo_neon_backup.sql</code>
          </div>
          <button
            onClick={copySqlRestoreCmd}
            className="flex items-center gap-1 text-xs font-bold text-[#1769e0] hover:underline shrink-0 ml-3"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Nusxalandi' : 'Qayta tiklash kodi'}
          </button>
        </div>
      </div>

      {/* Table by Table Breakdown */}
      {stats?.tables && (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <Layers size={16} className="text-[#1769e0]" /> Jadvallar va Yozuvlar Ro‘yxati
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Har bir jadvalning eksport qilinayotgan ma’lumotlar soni:
              </p>
            </div>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 font-mono text-xs font-bold text-[#475569]">
              {Object.keys(stats.tables).length} ta jadval
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(stats.tables).map(([tableName, count]) => (
              <div
                key={tableName}
                className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 hover:bg-[#f1f5f9] transition"
              >
                <span className="font-mono text-xs font-semibold text-[#1e293b] truncate">
                  {tableName}
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${
                    count > 0 ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#f1f5f9] text-[#94a3b8]'
                  }`}
                >
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
