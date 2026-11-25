
'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import {
  acceptEmployeeInvitation,
  getEmployeeInvitationDetails,
} from '@/app/actions/employee-invitations'

type AuthClient = ReturnType<typeof createClient>

export default function AcceptEmployeeInvitationPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<AuthClient | null>(null)
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [invitationEmail, setInvitationEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [emailMatches, setEmailMatches] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    let active = true

    const client = createClient()
    setSupabase(client)

    const params = new URLSearchParams(window.location.search)
    const invitationToken = params.get('token') || ''

    if (!/^[a-f0-9]{64}$/.test(invitationToken)) {
      setError('رابط الدعوة غير صحيح أو غير مكتمل.')
      setChecking(false)
      return
    }

    setToken(invitationToken)

    async function verifyInvitationAndSession() {
      try {
        // Supabase may return invitation session tokens in the URL hash.
        // The hash is available only in the browser, not in the server callback.
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, '')
        )

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const authType = hashParams.get('type')

        if (accessToken || refreshToken) {
          if (
            !accessToken ||
            !refreshToken ||
            authType !== 'invite'
          ) {
            throw new Error(
              'بيانات التحقق في رابط الدعوة غير مكتملة أو غير صحيحة.'
            )
          }

          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            throw new Error(
              'تعذر إنشاء جلسة الموظف من رابط الدعوة. اطلب إرسال دعوة جديدة.'
            )
          }

          // Remove sensitive tokens from the visible browser URL.
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${window.location.search}`
          )
        }

        const [invitation, authResult] = await Promise.all([
          getEmployeeInvitationDetails(invitationToken),
          client.auth.getUser(),
        ])

        if (!active) return

        const user = authResult.data.user
        const sessionEmail = user?.email?.trim().toLowerCase() || ''
        const invitedEmail = invitation.email.trim().toLowerCase()

        setInvitationEmail(invitedEmail)
        setEmail(sessionEmail)
        setHasSession(Boolean(user))

        const matches = Boolean(
          user &&
          user.email_confirmed_at &&
          sessionEmail === invitedEmail
        )

        setEmailMatches(matches)

        if (user && !user.email_confirmed_at) {
          setError('يجب تأكيد بريد الموظف الإلكتروني أولًا.')
        } else if (user && !matches) {
          setError(
            'الحساب المفتوح حاليًا لا يطابق بريد الموظف صاحب الدعوة. لم يتم تغيير كلمة المرور.'
          )
        } else if (authResult.error) {
          setError('تعذر التحقق من جلسة الحساب.')
        }
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'تعذر التحقق من رابط الدعوة.'
        )
      } finally {
        if (active) setChecking(false)
      }
    }

    verifyInvitationAndSession()

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase || !token) {
      setError('رابط الدعوة غير صالح.')
      return
    }

    if (!hasSession || !emailMatches) {
      setError(
        'لا يمكن المتابعة قبل تسجيل الدخول بالبريد الصحيح الخاص بالموظف.'
      )
      return
    }

    if (password.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف.')
      return
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }

    setBusy(true)

    try {
      // Re-check the invitation and authenticated user immediately
      // before changing the password.
      const invitation = await getEmployeeInvitationDetails(token)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(
          'انتهت جلسة الدعوة. افتح رابط الدعوة من بريد الموظف مرة أخرى.'
        )
      }

      const currentEmail = user.email?.trim().toLowerCase() || ''
      const expectedEmail = invitation.email.trim().toLowerCase()

      if (
        !user.email_confirmed_at ||
        !currentEmail ||
        currentEmail !== expectedEmail
      ) {
        setEmailMatches(false)
        setHasSession(Boolean(user))
        setEmail(currentEmail)

        throw new Error(
          'الحساب المفتوح لا يطابق بريد الدعوة. لم يتم تغيير كلمة المرور.'
        )
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      })

      if (passwordError) {
        throw new Error(passwordError.message)
      }

      const result = await acceptEmployeeInvitation(token)

      if (!result.success) {
        throw new Error('تعذر إكمال ربط حساب الموظف.')
      }

      setAccepted(true)

      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء قبول الدعوة. حاول مرة أخرى.'
      )
      setBusy(false)
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-10 text-[#142B45]"
    >
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-xl shadow-[#142B45]/5">
        <div className="bg-[#142B45] px-7 py-8 text-white sm:px-10">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#159B9B] text-2xl font-extrabold">
            د
          </div>

          <p className="mt-6 text-sm font-semibold text-[#9AD8D4]">
            منصة دكان
          </p>

          <h1 className="mt-2 text-2xl font-extrabold">
            إكمال إنشاء حساب الموظف
          </h1>

          <p className="mt-3 text-sm leading-7 text-white/75">
            أهلًا بك في فريق المتجر. تحقق من بريدك أولًا، ثم عيّن كلمة
            المرور لإكمال قبول الدعوة.
          </p>
        </div>

        <div className="p-7 sm:p-10">
          {checking ? (
            <div className="py-10 text-center text-sm text-slate-500">
              جارٍ التحقق من رابط الدعوة والبريد الإلكتروني...
            </div>
          ) : accepted ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#E3F4F2] text-[#159B9B]">
                <ShieldCheck size={34} />
              </div>

              <h2 className="mt-5 text-xl font-extrabold">
                تم قبول الدعوة بنجاح
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                تم ربط حسابك بالمتجر والصلاحيات والفروع المحددة لك.
                جارٍ تحويلك إلى لوحة دكان...
              </p>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-700"
              >
                {error || 'رابط الدعوة غير صالح.'}
              </p>
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Mail size={24} />
              </div>

              <h2 className="text-lg font-extrabold">
                يلزم التحقق من حساب الموظف
              </h2>

              <p className="text-sm leading-7 text-slate-600">
                لم نعثر على جلسة موثقة لحساب الموظف. افتح رسالة الدعوة
                التي وصلت إلى بريده الإلكتروني واتبع رابطها.
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
            </div>
          ) : !emailMatches ? (
            <div className="space-y-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle size={24} />
              </div>

              <h2 className="text-lg font-extrabold">
                الحساب المفتوح ليس حساب الموظف
              </h2>

              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">
                  لم يتم تغيير كلمة المرور أو قبول الدعوة.
                </p>
                <p className="mt-2 text-sm leading-6 text-red-700">
                  يجب أن تكون جلسة الدخول بالبريد المخصص للموظف نفسه.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-[#E2E8F0] p-4">
                <div>
                  <p className="text-xs text-slate-500">
                    البريد المسجل في الدعوة
                  </p>
                  <p dir="ltr" className="mt-1 break-all text-sm font-bold">
                    {invitationEmail}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    البريد المفتوح حاليًا
                  </p>
                  <p dir="ltr" className="mt-1 break-all text-sm font-bold">
                    {email || 'غير متاح'}
                  </p>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <p className="text-xs leading-6 text-slate-500">
                لا تكمل من هذه الجلسة. يجب تصحيح جلسة الموظف أولًا.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-[#DCEDEA] bg-[#F3FAF9] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#117F80]">
                  <UserCheck size={18} />
                  تم التحقق من بريد الموظف
                </div>

                <p
                  dir="ltr"
                  className="mt-2 break-all text-sm font-semibold text-[#142B45]"
                >
                  {invitationEmail}
                </p>

                <p className="mt-2 text-xs leading-6 text-slate-500">
                  البريد مطابق للدعوة، ويمكنك الآن تعيين كلمة المرور.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold">
                  كلمة المرور الجديدة
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-[#DCE3EA] px-4 py-3 focus-within:border-[#159B9B]">
                  <LockKeyhole size={19} className="text-slate-400" />

                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8 أحرف على الأقل"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold">
                  تأكيد كلمة المرور
                </span>

                <div className="flex items-center gap-3 rounded-xl border border-[#DCE3EA] px-4 py-3 focus-within:border-[#159B9B]">
                  <LockKeyhole size={19} className="text-slate-400" />

                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !emailMatches}
                className="w-full rounded-xl bg-[#159B9B] px-5 py-3.5 font-bold text-white transition hover:bg-[#117F80] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'جارٍ إنشاء الحساب...' : 'تعيين كلمة المرور وقبول الدعوة'}
              </button>

              <p className="text-center text-xs leading-6 text-slate-500">
                <ShieldCheck
                  size={14}
                  className="ml-1 inline-block align-middle"
                />
                سيتم ربط حسابك بالفروع التي حددها مدير المتجر فقط.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
