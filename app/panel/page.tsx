import { redirect } from 'next/navigation'
import { getAdminIdentity, isAdminTelegramId } from '@/lib/admin'

export default async function AdminPanelPage() {
  const telegramId = await getAdminIdentity()
  if (!(await isAdminTelegramId(telegramId))) redirect('/')
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[.18em] text-primary">Pay bot / Admin</p>
        <h1 className="mt-3 text-3xl font-semibold">Admin panel</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['Faol do‘konlar', 'Bugungi to‘lovlar', 'Webhook yetkazilishi'].map((label, index) => <section className="rounded-xl border bg-card p-5" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{index === 0 ? '24' : index === 1 ? '1 248' : '99.2%'}</p></section>)}
        </div>
        <section className="mt-6 rounded-xl border bg-card p-6"><h2 className="font-semibold">Tizim holati</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Userbot ulanishlari, payment archive va webhook delivery loglarini shu yerdan nazorat qiling.</p></section>
      </div>
    </main>
  )
}
