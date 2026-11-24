
'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
  BarChart3,
  Package,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function AuthBrand() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-2xl font-extrabold text-white shadow-lg shadow-[var(--brand)]/20">
        د
      </span>
      <span className="flex flex-col">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
          دكان
        </span>
        <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--muted)]">
          DOKKAN
        </span>
      </span>
    </Link>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy) return

    setBusy(true)
    setError('')

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('confirm')
          ? 'يجب تأكيد بريدك الإلكتروني أولًا. تحقق من صندوق الوارد.'
          : 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      )
      setBusy(false)
      return
    }

    window.location.assign('/auth/callback')
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 sm:p-6"
    >
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] md:min-h-[680px] md:grid-cols-2">
        {/* الجانب التعريفي */}
        <section className="relative hidden overflow-hidden bg-[var(--navy)] p-10 text-white md:flex md:flex-col md:justify-between lg:p-14">
          <div className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full border-[45px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full border-[55px] border-[var(--brand)]/15" />

          <div className="relative z-10">
            <AuthBrand />

            <div className="mt-24">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/85">
                <ShieldCheck size={15} />
                إدارة متجرك بثقة وسهولة
              </span>

              <h1 className="mt-7 text-4xl font-extrabold leading-[1.5] lg:text-5xl">
                كل تجارتك
                <br />
                <span className="text-[var(--brand)]">في مكان واحد.</span>
              </h1>

              <p className="mt-6 max-w-md text-sm leading-8 text-white/70 lg:text-base">
                دكان يساعدك على إدارة المبيعات والمخزون والفروع والموظفين،
                ومتابعة نشاط تجارتك من لوحة تحكم واحدة.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Store className="mb-3 text-[var(--brand)]" size={22} />
                <p className="text-sm font-bold">إدارة الفروع</p>
                <p className="mt-1 text-xs text-white/55">نظّم نشاط متجرك</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <BarChart3 className="mb-3 text-[var(--brand)]" size={22} />
                <p className="text-sm font-bold">تقارير واضحة</p>
                <p className="mt-1 text-xs text-white/55">تابع أداء تجارتك</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <Package className="text-[var(--brand)]" size={22} />
                  <div>
                    <p className="text-sm font-bold">المبيعات والمخزون</p>
                    <p className="mt-1 text-xs text-white/55">
                      تحكم في عملياتك اليومية بسهولة
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="relative z-10 mt-10 text-xs text-white/45">
            © ٢٠٢٦ دكان DOKKAN. جميع الحقوق محفوظة
          </p>
        </section>

        {/* نموذج تسجيل الدخول */}
        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-12 md:hidden">
              <AuthBrand />
            </div>

            <div className="mb-8">
              <span className="text-sm font-bold text-[var(--brand)]">
                مرحبًا بعودتك
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
                تسجيل الدخول
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                أدخل بيانات حسابك للمتابعة إلى لوحة تحكم متجرك.
              </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--foreground)]">
                البريد الإلكتروني
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3.5 transition focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
                  <Mail size={19} className="shrink-0 text-[var(--muted)]" />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--foreground)]">
                كلمة المرور
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3.5 transition focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
                  <LockKeyhole size={19} className="shrink-0 text-[var(--muted)]" />
                  <input
                    required
                    minLength={6}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                  />
                </div>
              </label>

              <div className="flex justify-start">
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-[var(--brand)] transition hover:underline"
                >
                  نسيت كلمة المرور؟
                </Link>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--brand)] py-4 font-extrabold text-white shadow-lg shadow-[var(--brand)]/15 transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
                <ArrowLeft size={19} />
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-xs text-[var(--muted)]">أو</span>
              <div className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <p className="text-center text-sm text-[var(--muted)]">
              ليس لديك حساب؟
              <Link
                href="/register"
                className="mr-2 font-extrabold text-[var(--brand)] transition hover:underline"
              >
                إنشاء حساب جديد
              </Link>
            </p>

            <p className="mt-10 text-center text-[11px] text-[var(--muted)] md:hidden">
              © ٢٠٢٦ دكان DOKKAN. جميع الحقوق محفوظة
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
