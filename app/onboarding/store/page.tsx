'use client'

import { useState, type FormEvent } from 'react'
import { createMerchantStore } from '@/app/actions/onboarding'

export default function StoreOnboardingPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); const result = await createMerchantStore({ name, phone }); if (result.error) { setError(result.error); setBusy(false); return }; window.location.assign('/dashboard') }
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"><section className="w-full max-w-lg rounded-3xl border border-[#e2e8f0] bg-white p-7 shadow-xl shadow-[#2563eb]/5 sm:p-12"><div className="flex items-center gap-3 text-[#2563eb]"><div className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb] text-2xl font-extrabold text-white">د</div><span className="text-2xl font-extrabold">دكان</span></div><p className="mt-10 text-sm text-[#64748b]">خطوة واحدة لبدء العمل</p><h1 className="mt-1 text-2xl font-extrabold">أنشئ متجرك الأول</h1><p className="mt-3 text-sm leading-6 text-[#64748b]">سيتم إنشاء عضويتك كمالك، وتفعيل خطة Free تلقائيًا. يمكنك إضافة متاجر أخرى لاحقًا.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-bold">اسم المتجر<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e1e5e8] px-4 py-3 outline-none focus:border-[#2563eb]" placeholder="مثال: رضا شوب" /></label><label className="block text-sm font-bold">رقم الهاتف <span className="font-normal text-[#94a3b8]">(اختياري)</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e1e5e8] px-4 py-3 outline-none focus:border-[#2563eb]" dir="ltr" /></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#2563eb] py-3.5 font-bold text-white disabled:opacity-60">{busy ? 'جارٍ إنشاء المتجر...' : 'إنشاء المتجر والدخول'}</button></form></section></main>
}
