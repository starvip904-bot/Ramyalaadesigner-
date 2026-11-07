'use client'

import { useState } from 'react'
import { createMerchantStore } from '@/app/actions/onboarding'

export default function StoreOnboardingPage() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')

    try {
      const result = await createMerchantStore()
      if (result.error) {
        setError(result.error)
        setBusy(false)
        return
      }
      window.location.assign('/dashboard')
    } catch {
      setError('حدث خطأ غير متوقع. حاول مرة أخرى.')
      setBusy(false)
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4">
      <section className="w-full max-w-lg rounded-3xl border border-[#e2e8f0] bg-white p-7 shadow-xl shadow-[#2563eb]/5 sm:p-12">
        <div className="flex items-center gap-3 text-[#2563eb]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb] text-2xl font-extrabold text-white">د</div>
          <span className="text-2xl font-extrabold">دكان</span>
        </div>

        <p className="mt-10 text-sm text-[#64748b]">خطوة واحدة لبدء العمل</p>
        <h1 className="mt-1 text-2xl font-extrabold">تفعيل حساب مالك المتجر</h1>
        <p className="mt-3 text-sm leading-7 text-[#64748b]">
          تم تجهيز المتجر والفرع الرئيسي وإعدادات الفواتير مسبقًا. اضغط على الزر لتفعيل عضويتك كمالك
          وربط حسابك بالمتجر، ثم ستنتقل مباشرة إلى لوحة التحكم.
        </p>

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-8 w-full rounded-xl bg-[#2563eb] py-3.5 font-bold text-white disabled:opacity-60"
        >
          {busy ? 'جارٍ تفعيل المتجر...' : 'تفعيل المتجر والدخول'}
        </button>
      </section>
    </main>
  )
}
