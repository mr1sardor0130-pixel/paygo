import React from 'react';
import Link from 'next/link';
import { Shield, Scale, FileText, Lock, CheckCircle, Info } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Foydalanish Shartlari va Ommaviy Oferta — PayGo',
  description: 'PayGo platformasining rasmiy foydalanish shartlari, shaxsiy ma’lumotlar maxfiylik siyosati va SaaS litsenziya shartnomasi haqida batafsil ma’lumot.',
  openGraph: {
    title: 'Foydalanish Shartlari va Ommaviy Oferta — PayGo',
    description: 'PayGo platformasidan foydalanish shartlari, huquqiy asoslari va xavfsizlik kafolatlari.',
  },
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-neutral-900 uppercase">PayGo <span className="text-blue-600">Legal</span></span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-blue-600 transition-colors">Bosh sahifa</Link>
              <Link href="#offer" className="text-sm font-medium text-neutral-500 hover:text-blue-600 transition-colors">Ommaviy oferta</Link>
              <Link href="#privacy" className="text-sm font-medium text-neutral-500 hover:text-blue-600 transition-colors">Maxfiylik</Link>
              <Link href="#terms" className="text-sm font-medium text-neutral-500 hover:text-blue-600 transition-colors">Shartlar</Link>
            </nav>
            <Link href="/" className="bg-neutral-900 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-neutral-800 transition-all">
              Boshlash
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:py-20">
        {/* Intro Section */}
        <section className="mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-900 mb-6 leading-tight">
            Huquqiy asoslar va <span className="text-blue-600 underline decoration-blue-200 underline-offset-8">Shaffoflik</span>
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            PayGo platformasidan foydalanish shartlari va huquqiy asoslari bilan tanishib chiqing. Biz xavfsizlik va qonuniylikni birinchi o'ringa qo'yamiz.
          </p>
        </section>

        {/* Section: Public Offer */}
        <section id="offer" className="mb-20 scroll-mt-24">
          <div className="flex items-center gap-3 mb-8 border-b border-neutral-200 pb-4">
            <Scale className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold">1. Ommaviy oferta (Public Offer)</h2>
          </div>
          <div className="prose prose-neutral max-w-none space-y-6 text-neutral-700 leading-relaxed">
            <p className="font-semibold text-neutral-900 italic">
              Ushbu Ommaviy oferta (keyingi o'rinlarda — "Oferta") PayGo (keyingi o'rinlarda — "Platforma") tomonidan foydalanuvchilarga xizmat ko'rsatish shartlarini belgilaydi.
            </p>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">1.1. Xizmat mohiyati va SaaS modeli</h3>
              <p>
                Platforma foydalanuvchiga uning shaxsiy Telegram akkauntiga keladigan bildirishnomalarni (notifikatsiyalarni) avtomatlashtirilgan tarzda Webhook manzillariga yo'naltirish imkoniyatini taqdim etuvchi <b>SaaS (Software as a Service) infratuzilmasidir</b>. Platforma to'lov tashkiloti, bank yoki moliyaviy vositachi hisoblanmaydi va moliyaviy operatsiyalarni amalga oshirmaydi.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">1.2. To'lovlar mohiyati</h3>
              <p>
                Platformadagi Premium tariflar uchun to'lovlar tranzaksiyalar uchun komissiya hisoblanmaydi. Bu mablag'lar Platformaning <b>texnik infratuzilmasi, server resurslari va webhook uzatish xizmati</b> uchun olinadigan abonent to'lovidir.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">1.3. Aksept shartlari</h3>
              <p>
                Platformaning Telegram-boti yoki veb-sayti orqali ro'yxatdan o'tish va xizmatlardan foydalanishni boshlash ushbu Oferta shartlarini so'zsiz va to'liq qabul qilish (aksept) hisoblanadi.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-3">1.3. Moliyaviy cheklovlar</h3>
              <p>
                Platforma foydalanuvchi mablag'larini yig'ish, saqlash yoki tranzaksiyalarni boshqarish huquqiga ega emas. Barcha moliyaviy amallar banklar va rasmiy to'lov tizimlari orqali amalga oshiriladi. Platforma faqatgina axborot ko'prigi vazifasini bajaradi.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Privacy Policy */}
        <section id="privacy" className="mb-20 scroll-mt-24">
          <div className="flex items-center gap-3 mb-8 border-b border-neutral-200 pb-4">
            <Lock className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold">2. Maxfiylik siyosati</h2>
          </div>
          <div className="prose prose-neutral max-w-none space-y-6 text-neutral-700">
            <p>
              Biz sizning ma'lumotlaringiz xavfsizligini ta'minlash uchun O'zbekiston Respublikasining <b>"Shaxsiy ma'lumotlar to'g'risida"gi (ZRU-547)</b> qonuniga muvofiq ishlaymiz.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-5 bg-white border border-neutral-200 rounded-2xl shadow-sm">
                <CheckCircle className="w-6 h-6 text-green-500 mb-3" />
                <h4 className="font-bold mb-2">Ma'lumotlar shifrlanishi</h4>
                <p className="text-sm text-neutral-600">Siz taqdim etgan Telegram API ID, API Hash va sesiya ma'lumotlari serverlarimizda shifrlangan holda saqlanadi va uchinchi shaxslarga berilmaydi.</p>
              </div>
              <div className="p-5 bg-white border border-neutral-200 rounded-2xl shadow-sm">
                <CheckCircle className="w-6 h-6 text-green-500 mb-3" />
                <h4 className="font-bold mb-2">Faqat monitoring</h4>
                <p className="text-sm text-neutral-600">Bot faqatgina to'lov haqidagi xabarlarni filtrlash va ularni webhook orqali uzatish uchun ishlatiladi. Boshqa shaxsiy yozishmalar qayta ishlanmaydi.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Terms of Use */}
        <section id="terms" className="mb-20 scroll-mt-24">
          <div className="flex items-center gap-3 mb-8 border-b border-neutral-200 pb-4">
            <FileText className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold">3. Foydalanish shartlari</h2>
          </div>
          <div className="space-y-6 text-neutral-700 leading-relaxed">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">1</div>
              <div>
                <h4 className="font-bold text-neutral-900 mb-1">Qonuniy foydalanish</h4>
                <p>Platformadan faqat qonuniy maqsadlarda foydalanish shart. Firibgarlik, spam, litsenziyasiz qimor o'yinlari yoki noqonuniy moliyaviy oqimlar uchun botdan foydalanish qat'iyan taqiqlanadi.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">2</div>
              <div>
                <h4 className="font-bold text-neutral-900 mb-1">Mas'uliyat cheklanishi</h4>
                <p>Platforma ma'lumotlarning uzatilishidagi texnik uzilishlar yoki kechikishlar uchun javobgar emas. Foydalanuvchi o'z hisob raqami xavfsizligi va API kalitlari uchun to'liq mas'uldir.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">3</div>
              <div>
                <h4 className="font-bold text-neutral-900 mb-1">Xizmatni to'xtatish</h4>
                <p>Platforma ma'muriyati shubhali yoki noqonuniy harakatlar aniqlangan holda, foydalanuvchi hisobini ogohlantirishsiz bloklash huquqini o'zida saqlab qoladi.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Legal Grounds / Uzbekistan Laws */}
        <section className="bg-blue-600 rounded-3xl p-8 sm:p-12 text-white overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Info className="w-8 h-8 text-blue-200" />
              <h2 className="text-2xl sm:text-3xl font-bold">Qonuniy Asoslar (O'zR)</h2>
            </div>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="font-bold text-blue-200">●</span>
                <span><b>ZRU-547:</b> "Shaxsiy ma'lumotlar to'g'risida"gi qonun (Foydalanuvchi roziligi bilan ma'lumotlarni qayta ishlash qonuniyligi).</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-200">●</span>
                <span><b>ZRU-530-II:</b> "Bank siri to'g'risida"gi qonun (Foydalanuvchi o'z ma'lumotlarini uchinchi tomon dasturiga taqdim etish huquqi).</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-blue-200">●</span>
                <span><b>ZRU-792:</b> "Elektron tijorat to'g'risida"gi qonun (Axborot almashish shartnomaviy asoslari).</span>
              </li>
            </ul>
          </div>
          {/* Abstract background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full -mr-20 -mt-20 opacity-50 blur-3xl"></div>
        </section>
      </main>

      <footer className="bg-white border-t border-neutral-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-neutral-500 mb-4 italic">PayGo Platformasi — Biznesingiz uchun ishonchli texnik ko'prik.</p>
          <p className="text-xs text-neutral-400">© {new Date().getFullYear()} PayGo. Barcha huquqlar himoyalangan.</p>
        </div>
      </footer>
    </div>
  );
}
