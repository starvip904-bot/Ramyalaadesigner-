'use client'

import { FormEvent, useState } from 'react'
import { ArrowLeft, LockKeyhole, Mail, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password })
    if (signInError) { setError('البريد الإلكتروني أو كلمة المرور غير صحيحة'); setBusy(false); return }
    window.location.assign('/dashboard')
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"><div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#e8ebef] bg-white shadow-xl shadow-[#0b5c52]/5 md:grid-cols-2"><div className="hidden bg-[#0b5c52] p-12 text-white md:flex md:flex-col md:justify-between"><div><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-white text-2xl font-extrabold text-[#0b5c52]">د</div><span className="text-2xl font-extrabold">دكان</span></div><h1 className="mt-24 text-4xl font-extrabold leading-tight">أدر متجرك،<br/><span className="text-[#a8ddd2]">وطوّر نجاحك.</span></h1><p className="mt-5 max-w-xs text-sm leading-7 text-[#c4e3de]">كل أدوات إدارة متجرك في مكان واحد. مبيعات، مخزون، تقارير وأكثر.</p></div><p className="text-xs text-[#a8cfc8]">© ٢٠٢٤ دكان. جميع الحقوق محفوظة</p></div><div className="p-7 sm:p-12"><div className="mb-10 md:hidden"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#0b5c52] text-xl font-extrabold text-white">د</div><span className="text-xl font-extrabold text-[#0b5c52]">دكان</span></div></div><div><p className="text-sm text-[#697586]">مرحباً بعودتك</p><h2 className="mt-1 text-2xl font-extrabold">تسجيل الدخول إلى حسابك</h2></div><form onSubmit={submit} className="mt-8 flex flex-col gap-5"><label className="flex flex-col gap-2 text-sm font-bold">البريد الإلكتروني<div className="flex items-center gap-3 rounded-xl border border-[#e1e5e8] px-4 py-3 text-[#8993a1]"><Mail/><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full bg-transparent text-sm outline-none" /></div></label><label className="flex flex-col gap-2 text-sm font-bold">كلمة المرور<div className="flex items-center gap-3 rounded-xl border border-[#e1e5e8] px-4 py-3 text-[#8993a1]"><LockKeyhole/><input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" className="w-full bg-transparent text-sm outline-none" /></div></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-[#0b5c52] py-3.5 font-bold text-white disabled:opacity-60">{busy ? 'جارٍ التحقق...' : 'تسجيل الدخول'} <ArrowLeft className="size-4" /></button></form><p className="mt-8 text-center text-sm text-[#8993a1]">ليس لديك حساب؟ <a href="/sign-up" className="font-bold text-[#0b5c52]">إنشاء حساب</a></p><div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#a0a8b3]"><Store className="size-4"/> مساحة عمل آمنة لمتجرك</div></div></div></main>
}
