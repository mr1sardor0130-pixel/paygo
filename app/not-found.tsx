import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-6xl font-bold text-slate-900 mb-2">404</h1>
      <p className="text-lg text-slate-600 mb-6">Sahifa topilmadi yoki to‘lov havolasi eskirgan.</p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition"
      >
        Bosh sahifaga qaytish
      </Link>
    </div>
  )
}
