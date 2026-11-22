
'use client'

import { useState, type FormEvent } from 'react'
import { createMerchantStore } from '@/app/actions/onboarding'

export default function StoreOnboardingPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy) return

    setBusy(true)
    setError('')

    try {
      const result = await createMerchantStore({
        name,
        phone,
      })

      if (result.error) {
        setError(result.error)
        setBusy(false)
        return
      }

      window.location.assign('/auth/callback')
    } catch {
      setError('حدث خطأ غير متوقع. حاول مرة أخرى.')
      setBusy(false)
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"
    >
      <section className="w-full max-w-lg rounded-3xl border border-[#e2e8f0] bg-white p-7 shadow-xl shadow-[#2563eb]/5 sm:p-12">
        <div className="flex items-center gap-3 text-[#2563eb]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb] text-2xl font-extrabold text-white">
            د
          </div>
          <span className="text-2xl font-extrabold">دكان</span>
        </div>

        <p className="mt-10 text-sm text-[#64748b]">
          أهلاً بك في دكان
        </p>

        <h1 className="mt-1 text-2xl font-extrabold">
          أنشئ متجرك وابدأ العمل
        </h1>

        <p className="mt-3 text-sm leading-7 text-[#64748b]">
          أدخل اسم متجرك لإنشاء مساحة مستقلة خاصة بك،
          وسيتم تجهيز الفرع الرئيسي وإعدادات الفواتير تلقائيًا.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="store-name"
              className="mb-2 block text-sm font-bold text-[#334155]"
            >
              اسم المتجر
            </label>

            <input
              id="store-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: متجر الأمل"
              required
              minLength={2}
              maxLength={120}
              disabled={busy}
              className="w-full rounded-xl border border-[#cbd5e1] px-4 py-3 outline-none focus:border-[#2563eb] disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="store-phone"
              className="mb-2 block text-sm font-bold text-[#334155]"
            >
              رقم الهاتف
              <span className="mr-2 font-normal text-[#94a3b8]">
                (اختياري)
              </span>
            </label>

            <input
              id="store-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="أدخل رقم الهاتف"
              maxLength={40}
              disabled={busy}
              className="w-full rounded-xl border border-[#cbd5e1] px-4 py-3 outline-none focus:border-[#2563eb] disabled:bg-gray-100"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="w-full rounded-xl bg-[#2563eb] py-3.5 font-bold text-white disabled:opacity-60"
          >
            {busy ? 'جارٍ إنشاء المتجر...' : 'إنشاء المتجر والمتابعة'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-6 text-[#94a3b8]">
          سيتم إنشاء متجر مستقل مرتبط بحسابك.
        </p>
      </section>
    </main>
  )
}
