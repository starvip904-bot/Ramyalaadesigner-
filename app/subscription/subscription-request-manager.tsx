'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  cancelSubscriptionRequestDraftAction,
  createSubscriptionRequestDraftAction,
  getMySubscriptionRequestsAction,
  uploadSubscriptionProofAndSubmitAction,
} from '@/app/actions/subscription-requests'

const WHATSAPP_NUMBER = '201146570929'
const MAX_FILE_SIZE = 5 * 1024 * 1024

const plans = [
  {
    code: 'basic',
    name: 'Basic',
    description: 'للمتاجر التي تحتاج إلى إمكانيات إضافية.',
  },
  {
    code: 'professional',
    name: 'Professional',
    description: 'للمتاجر التي تحتاج إلى إدارة أكثر تقدمًا.',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'للاحتياجات الكبيرة والحلول المخصصة.',
  },
] as const

type PlanCode = (typeof plans)[number]['code']

type RequestRow = Awaited<
  ReturnType<typeof getMySubscriptionRequestsAction>
>[number]

const statusLabels: Record<string, string> = {
  draft: 'مسودة غير مكتملة',
  pending: 'قيد مراجعة الإدارة',
  approved: 'تمت الموافقة والتفعيل',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
}

function formatDate(value: string | null) {
  if (!value) return 'غير محدد'

  return new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  })
}

function getPlanName(code: string) {
  return plans.find((plan) => plan.code === code)?.name ?? code
}

function getWhatsAppUrl(
  requestId: string,
  storeName: string,
  planCode: string,
  amount?: number | null
) {
  const message = [
    'مرحبًا، أرسلت طلب اشتراك جديد في Dokkan.',
    `رقم الطلب: ${requestId}`,
    `اسم المتجر: ${storeName}`,
    `الخطة المطلوبة: ${getPlanName(planCode)}`,
    amount != null ? `المبلغ المحوّل: ${amount} جنيه` : null,
    'تم رفع إثبات الدفع داخل Dokkan، برجاء مراجعة الطلب.',
  ]
    .filter(Boolean)
    .join('\n')

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export default function SubscriptionRequestManager({
  storeName,
}: {
  storeName: string
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode | ''>('')
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const selectedPlanName = useMemo(
    () => plans.find((plan) => plan.code === selectedPlan)?.name ?? '',
    [selectedPlan]
  )

  async function loadRequests() {
    try {
      const result = await getMySubscriptionRequestsAction()
      setRequests(result)
    } catch {
      setErrorMessage('تعذر تحميل طلبات الاشتراك. حاول تحديث الصفحة.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setErrorMessage('')
    setSuccessMessage('')

    const selectedFile = event.target.files?.[0] ?? null

    if (!selectedFile) {
      setFile(null)
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    if (!allowedTypes.includes(selectedFile.type)) {
      setFile(null)
      event.target.value = ''
      setErrorMessage('اختر صورة JPG أو PNG أو WEBP أو ملف PDF.')
      return
    }

    if (
      selectedFile.size < 1 ||
      selectedFile.size > MAX_FILE_SIZE
    ) {
      setFile(null)
      event.target.value = ''
      setErrorMessage('حجم الملف يجب ألا يتجاوز 5 ميجابايت.')
      return
    }

    setFile(selectedFile)
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedPlan) {
      setErrorMessage('اختر الخطة التي تريد الاشتراك بها.')
      return
    }

    const numericAmount = Number(amount)

    if (
      !amount.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage('اكتب المبلغ الذي قمت بتحويله بشكل صحيح.')
      return
    }

    if (!file && !draftRequestId) {
      setErrorMessage('اختر صورة أو PDF لإثبات الدفع.')
      return
    }

    setBusy(true)

    try {
      let requestId = draftRequestId

      if (!requestId) {
        const draft = await createSubscriptionRequestDraftAction({
          planCode: selectedPlan,
          proofMimeType: file!.type,
          claimedAmountEgp: numericAmount,
        })

        requestId = draft.requestId
        setDraftRequestId(requestId)
      }

      if (!file) {
        throw new Error(
          'المسودة موجودة. اختر ملف الإثبات لإكمال إرسال الطلب.'
        )
      }

      await uploadSubscriptionProofAndSubmitAction(
        requestId,
        file
      )

      setSuccessMessage('تم إرسال طلب الاشتراك للمراجعة بنجاح.')
      setDraftRequestId(null)
      setFile(null)
      setAmount('')
      setSelectedPlan('')

      await loadRequests()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء إرسال طلب الاشتراك.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelDraft(requestId: string) {
    const confirmed = window.confirm(
      'هل تريد إلغاء هذه المسودة؟'
    )

    if (!confirmed) return

    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await cancelSubscriptionRequestDraftAction(requestId)

      if (draftRequestId === requestId) {
        setDraftRequestId(null)
        setFile(null)
      }

      setSuccessMessage('تم إلغاء المسودة.')
      await loadRequests()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر إلغاء المسودة.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">
            طلب الاشتراك في خطة مدفوعة
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-500">
            اختر الخطة المطلوبة، ثم اكتب المبلغ الذي قمت بتحويله
            وارفع إثبات الدفع. ستراجع الإدارة الطلب قبل تفعيل
            الاشتراك.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-6"
        >
          <div>
            <p className="mb-3 text-sm font-bold text-slate-800">
              اختر الخطة المطلوبة
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((plan) => {
                const active = selectedPlan === plan.code

                return (
                  <button
                    key={plan.code}
                    type="button"
                    disabled={busy || Boolean(draftRequestId)}
                    onClick={() => {
                      setSelectedPlan(plan.code)
                      setErrorMessage('')
                    }}
                    className={`rounded-2xl border p-4 text-right transition ${
                      active
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-950">
                        {plan.name}
                      </span>

                      <span
                        className={`flex size-5 items-center justify-center rounded-full border text-xs ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {active ? '✓' : ''}
                      </span>
                    </span>

                    <span className="mt-2 block text-xs leading-6 text-slate-500">
                      {plan.description}
                    </span>

                    <span className="mt-3 block text-xs font-bold text-slate-600">
                      السعر والتفاصيل يحددهما اعتماد الإدارة
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-800">
                المبلغ المحوّل بالجنيه المصري
              </span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                disabled={busy || Boolean(draftRequestId)}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="اكتب المبلغ"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-800">
                صورة أو PDF لإثبات الدفع
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                required={!draftRequestId}
                disabled={busy}
                onChange={handleFileChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700"
              />

              <span className="text-xs text-slate-500">
                JPG أو PNG أو WEBP أو PDF، بحد أقصى 5 ميجابايت.
              </span>
            </label>
          </div>

          {file && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              الملف المختار: <strong>{file.name}</strong>
            </p>
          )}

          {draftRequestId && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              لديك مسودة غير مكتملة برقم {draftRequestId}.
              اختر ملف الإثبات لإعادة محاولة الإرسال. لا تنشئ طلبًا
              جديدًا قبل إكمال هذه المسودة أو إلغائها.
            </p>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-700"
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? 'جارٍ إرسال الطلب...'
              : draftRequestId
                ? 'إكمال رفع الإثبات وإرسال الطلب'
                : 'إرسال طلب الاشتراك'}
          </button>

          {draftRequestId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCancelDraft(draftRequestId)}
              className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              إلغاء المسودة الحالية
            </button>
          )}

          <p className="text-xs leading-6 text-slate-500">
            لن يتم تفعيل الخطة بمجرد إرسال الطلب. التفعيل يتم بعد
            مراجعة الإدارة واعتماد المبلغ والاشتراك.
          </p>
        </form>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              طلبات الاشتراك الخاصة بمتجرك
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              تابع حالة الطلبات ومراجعة الإدارة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading || busy}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            تحديث الطلبات
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            جارٍ تحميل الطلبات...
          </p>
        ) : requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            لا توجد طلبات اشتراك حتى الآن.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {requests.map((request) => {
              const whatsappUrl = getWhatsAppUrl(
                request.id,
                storeName,
                request.requested_plan_code,
                request.claimed_amount_egp
              )

              return (
                <article
                  key={request.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-slate-950">
                        خطة {getPlanName(request.requested_plan_code)}
                      </p>

                      <p className="mt-1 break-all text-xs text-slate-500">
                        رقم الطلب: {request.id}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {statusLabels[request.status] ?? request.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <p className="text-slate-600">
                      المبلغ المعلن: {' '}
                      <strong className="text-slate-900">
                        {request.claimed_amount_egp ?? 'غير محدد'} جنيه
                      </strong>
                    </p>

                    <p className="text-slate-600">
                      تاريخ الطلب: {' '}
                      <strong className="text-slate-900">
                        {formatDate(request.created_at)}
                      </strong>
                    </p>

                    {request.verified_amount_egp != null && (
                      <p className="text-slate-600">
                        المبلغ المعتمد: {' '}
                        <strong className="text-slate-900">
                          {request.verified_amount_egp} جنيه
                        </strong>
                      </p>
                    )}

                    {request.subscription_ends_at && (
                      <p className="text-slate-600">
                        انتهاء الاشتراك: {' '}
                        <strong className="text-slate-900">
                          {formatDate(request.subscription_ends_at)}
                        </strong>
                      </p>
                    )}
                  </div>

                  {request.rejection_reason && (
                    <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
                      <strong>سبب الرفض:</strong>{' '}
                      {request.rejection_reason}
                    </div>
                  )}

                  {request.status === 'pending' && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
                    >
                      متابعة الطلب عبر واتساب
                    </a>
                  )}

                  {request.status === 'draft' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancelDraft(request.id)}
                      className="mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      إلغاء المسودة
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}