
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { verifyStoreSectionPinAction } from '@/app/actions/store-section-pin'

export default function StoreSectionPinPrompt() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!/^\d{4,8}$/.test(pin)) {
      setError('أدخل رمز PIN مكوّنًا من 4 إلى 8 أرقام.')
      return
    }

    setBusy(true)

    try {
      const result = await verifyStoreSectionPinAction(pin)

      if (!result.success) {
        setError(result.message || 'رمز PIN غير صحيح. حاول مرة أخرى.')
        setPin('')
        return
      }

      setPin('')
      router.refresh()
    } catch {
      setError('تعذر التحقق من الرمز حاليًا. حاول مرة أخرى.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-[65vh] items-center justify-center py-8"
      dir="rtl"
    >
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <LockKeyhole size={30} />
        </div>

        <div className="mt-6 text-center">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">
            القسم محمي برمز PIN
          </h2>

          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            أدخل رمز الحماية الخاص بمتجرك للمتابعة.
            بعد التحقق لن تحتاج إلى إدخاله مرة أخرى خلال جلسة الحماية.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--foreground)]">
              رمز PIN
            </span>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, '').slice(0, 8))
                setError('')
              }}
              placeholder="أدخل رمز PIN"
              disabled={busy}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-center text-xl font-bold tracking-[0.5em] text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
              aria-label="رمز PIN الخاص بالمتجر"
              autoFocus
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--danger)]/10 px-3 py-3 text-center text-sm font-semibold text-[var(--danger)]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck size={19} />
            {busy ? 'جارٍ التحقق...' : 'تحقق وفتح القسم'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-6 text-[var(--muted)]">
          رمز PIN يخص متجرك، ولا تشاركه مع أي شخص غير مصرح له.
        </p>
      </section>
    </div>
  )
}
