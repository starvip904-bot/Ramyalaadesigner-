
'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined

    async function initialize() {
      try {
        const client = createClient()

        if (!active) return

        setSupabase(client)

        const {
          data: { subscription: authSubscription },
        } = client.auth.onAuthStateChange((_event, session) => {
          if (!active) return
          setHasSession(Boolean(session))
          setChecking(false)
        })

        subscription = authSubscription

        const {
          data: { session },
          error: sessionError,
        } = await client.auth.getSession()

        if (!active) return

        if (sessionError) {
          setError(sessionError.message)
        }

        setHasSession(Boolean(session))
        setChecking(false)
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'تعذر تهيئة الاتصال بخدمة الاستعادة.'
        )
        setChecking(false)
      }
    }

    initialize()

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('الاتصال بالخدمة غير جاهز. أعد تحميل الصفحة.')
      return
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف.')
      return
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }

    setBusy(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (!session) {
        setHasSession(false)
        throw new Error(
          'جلسة الاستعادة غير موجودة أو انتهت صلاحيتها. اطلب رابط استعادة جديدًا.'
        )
      }

      const { error: updateError } =
        await supabase.auth.updateUser({ password })

      if (updateError) throw updateError

      router.replace('/auth/callback')
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير معروف أثناء تحديث كلمة المرور.'

      setError(`تعذر تحديث كلمة المرور: ${message}`)
      setBusy(false)
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"
    >
      <section className="w-full max-w-lg rounded-3xl border border-[#e2e8f0] bg-white p-7 shadow-xl shadow-[#2563eb]/5 sm:p-12">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb] text-2xl font-extrabold text-white">
          د
        </div>

        <h1 className="mt-8 text-2xl font-extrabold">
          تعيين كلمة مرور جديدة
        </h1>

        {checking ? (
          <p className="mt-6 text-sm text-slate-600">
            جارٍ التحقق من رابط الاستعادة...
          </p>
        ) : !hasSession ? (
          <div className="mt-6 space-y-4">
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
            >
              {error ||
                'لا توجد جلسة استعادة صالحة. اطلب رابط استعادة جديدًا.'}
            </p>

            <button
              type="button"
              onClick={() => router.replace('/forgot-password')}
              className="w-full rounded-xl bg-[#2563eb] py-3.5 font-bold text-white"
            >
              طلب رابط استعادة جديد
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="flex flex-col gap-2 text-sm font-bold">
              كلمة المرور الجديدة

              <div className="flex items-center gap-3 rounded-xl border border-[#e1e5e8] px-4 py-3 text-[#94a3b8] focus-within:border-[#2563eb]">
                <LockKeyhole size={18} />

                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full outline-none"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold">
              تأكيد كلمة المرور

              <div className="flex items-center gap-3 rounded-xl border border-[#e1e5e8] px-4 py-3 text-[#94a3b8] focus-within:border-[#2563eb]">
                <LockKeyhole size={18} />

                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  className="w-full outline-none"
                />
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
              >
                {error}
              </p>
            )}

            <button
              disabled={busy || !hasSession || !supabase}
              className="w-full rounded-xl bg-[#2563eb] py-3.5 font-bold text-white disabled:opacity-60"
            >
              {busy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
