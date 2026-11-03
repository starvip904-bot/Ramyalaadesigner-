'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }); if (resetError) setError('تعذر إرسال رسالة الاستعادة. تحقق من البريد وحاول مرة أخرى.'); else setMessage('إذا كان البريد مسجلًا، ستصلك رسالة لاستعادة كلمة المرور.'); setBusy(false) }
  return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"><section className="w-full max-w-lg rounded-3xl border border-[#e8ebef] bg-white p-7 shadow-xl shadow-[#0b5c52]/5 sm:p-12"><Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[#0b5c52]"><ArrowRight size={17}/> العودة لتسجيل الدخول</Link><h1 className="mt-10 text-2xl font-extrabold">استعادة كلمة المرور</h1><p className="mt-3 text-sm leading-6 text-[#697586]">أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لاختيار كلمة مرور جديدة.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="flex flex-col gap-2 text-sm font-bold">البريد الإلكتروني<div className="flex items-center gap-3 rounded-xl border border-[#e1e5e8] px-4 py-3 text-[#8993a1] focus-within:border-[#0b5c52]"><Mail size={18}/><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full outline-none" /></div></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-[#eaf5f2] p-3 text-sm font-bold leading-6 text-[#16735e]">{message}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#0b5c52] py-3.5 font-bold text-white disabled:opacity-60">{busy ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}</button></form></section></main>
}
