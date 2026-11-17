'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  approveSubscriptionRequestAction,
  getPlatformSubscriptionRequestsAction,
  rejectSubscriptionRequestAction,
} from '@/app/actions/subscription-requests'

type RequestRow = {
  id: string
  store_id: string
  requested_plan_code: string
  status: 'pending' | 'approved' | 'rejected' | 'draft' | 'cancelled'
  proof_path: string
  proof_mime_type: string
  proof_size: number | null
  claimed_amount_egp: number | null
  verified_amount_egp: number | null
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  admin_notes: string | null
  subscription_started_at: string | null
  subscription_ends_at: string | null
  proofSignedUrl: string | null
  dokkan_stores:
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

const planNames: Record<string, string> = {
  basic: 'Basic',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

const statusNames: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  draft: 'مسودة',
  cancelled: 'ملغي',
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return 'غير محدد'

  return `${Number(value).toLocaleString('ar-EG')} جنيه`
}

function getStore(store: RequestRow['dokkan_stores']) {
  return Array.isArray(store) ? store[0] ?? null : store
}

export default function PlatformSubscriptionRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [status, setStatus] = useState<FilterStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [endDates, setEndDates] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await getPlatformSubscriptionRequestsAction(status)
      setRequests(data as RequestRow[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل طلبات الاشتراك.'
      )
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  async function handleApprove(request: RequestRow) {
    const amount = Number(amounts[request.id])
    const endDate = endDates[request.id]

    if (!Number.isFinite(amount) || amount < 0) {
      window.alert('أدخل المبلغ الذي تم استلامه بشكل صحيح.')
      return
    }

    if (!endDate) {
      window.alert('حدد تاريخ انتهاء الاشتراك.')
      return
    }

    const endDateObject = new Date(endDate)

    if (
      Number.isNaN(endDateObject.getTime()) ||
      endDateObject.getTime() <= Date.now()
    ) {
      window.alert('تاريخ الانتهاء يجب أن يكون في المستقبل.')
      return
    }

    const confirmed = window.confirm(
      'هل أنت متأكد من اعتماد الطلب وتفعيل الخطة للمتجر؟'
    )

    if (!confirmed) return

    setBusyId(request.id)

    try {
      await approveSubscriptionRequestAction({
        requestId: request.id,
        verifiedAmountEgp: amount,
        subscriptionEndsAt: endDateObject.toISOString(),
        adminNotes: notes[request.id] || '',
      })

      window.alert('تم اعتماد الاشتراك بنجاح.')
      await loadRequests()
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'تعذر اعتماد الطلب.'
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(request: RequestRow) {
    const reason = window.prompt(
      'اكتب سبب رفض طلب الاشتراك:'
    )

    if (reason === null) return

    if (!reason.trim()) {
      window.alert('يجب كتابة سبب الرفض.')
      return
    }

    const confirmed = window.confirm(
      'هل تريد رفض طلب الاشتراك؟ لن يتم تغيير اشتراك المتجر الحالي.'
    )

    if (!confirmed) return

    setBusyId(request.id)

    try {
      await rejectSubscriptionRequestAction({
        requestId: request.id,
        rejectionReason: reason.trim(),
      })

      window.alert('تم رفض الطلب وتسجيل السبب.')
      await loadRequests()
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'تعذر رفض الطلب.'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7fb] p-4 text-slate-900 md:p-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg md:p-8">
          <p className="text-sm font-bold text-blue-300">
            DOKKAN PLATFORM
          </p>

          <h1 className="mt-3 text-2xl font-extrabold md:text-3xl">
            طلبات الاشتراك وإثباتات الدفع
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            مراجعة إثباتات الدفع واعتماد الاشتراكات أو رفضها.
            لا يتم تفعيل أي خطة إلا بعد اعتماد مدير المنصة.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['pending', 'طلبات قيد المراجعة'],
                ['approved', 'الموافق عليها'],
                ['rejected', 'المرفوضة'],
                ['all', 'كل الطلبات'],
              ] as [FilterStatus, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                  status === value
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
              className="mr-auto rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              تحديث
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-500">
            جارٍ تحميل طلبات الاشتراك...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-lg font-extrabold text-slate-700">
              لا توجد طلبات للعرض
            </p>
            <p className="mt-2 text-sm text-slate-500">
              ستظهر الطلبات هنا بمجرد إرسالها من المتاجر.
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-5">
            {requests.map((request) => {
              const store = getStore(request.dokkan_stores)
              const isPending = request.status === 'pending'
              const isBusy = busyId === request.id

              return (
                <article
                  key={request.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div>
                      <h2 className="text-lg font-extrabold">
                        {store?.name || 'متجر بدون اسم'}
                      </h2>

                      <p className="mt-1 break-all text-xs text-slate-400">
                        رقم الطلب: {request.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-2 text-xs font-extrabold ${
                        request.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : request.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {statusNames[request.status] || request.status}
                    </span>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            الخطة المطلوبة
                          </p>
                          <p className="mt-2 font-extrabold text-blue-700">
                            {planNames[request.requested_plan_code] ||
                              request.requested_plan_code}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            المبلغ المعلن
                          </p>
                          <p className="mt-2 font-extrabold">
                            {formatMoney(request.claimed_amount_egp)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            هاتف المتجر
                          </p>
                          <p className="mt-2 font-bold" dir="ltr">
                            {store?.phone || 'غير مسجل'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">
                            تاريخ الإرسال
                          </p>
                          <p className="mt-2 text-sm font-bold">
                            {formatDate(request.submitted_at)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-sm font-extrabold">
                          إثبات الدفع
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {request.proof_mime_type} —{' '}
                          {request.proof_size
                            ? `${(
                                request.proof_size /
                                (1024 * 1024)
                              ).toFixed(2)} MB`
                            : 'الحجم غير متاح'}
                        </p>

                        {request.proofSignedUrl ? (
                          <a
                            href={request.proofSignedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800"
                          >
                            فتح إثبات الدفع
                          </a>
                        ) : (
                          <p className="mt-3 text-sm text-amber-700">
                            رابط الإثبات غير متاح حاليًا.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {isPending ? (
                        <>
                          <div>
                            <label className="mb-2 block text-sm font-bold">
                              المبلغ المستلم فعليًا بالجنيه
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={amounts[request.id] ?? ''}
                              onChange={(event) =>
                                setAmounts((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              placeholder="أدخل المبلغ المستلم"
                              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold">
                              تاريخ انتهاء الاشتراك
                            </label>

                            <input
                              type="datetime-local"
                              value={endDates[request.id] ?? ''}
                              onChange={(event) =>
                                setEndDates((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold">
                              ملاحظات الإدارة (اختياري)
                            </label>

                            <textarea
                              rows={3}
                              value={notes[request.id] ?? ''}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              placeholder="ملاحظات داخلية..."
                              className="w-full resize-y rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleApprove(request)}
                              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isBusy
                                ? 'جارٍ التنفيذ...'
                                : 'قبول وتفعيل الاشتراك'}
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleReject(request)}
                              className="flex-1 rounded-xl bg-rose-600 px-4 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              رفض الطلب
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="font-extrabold">
                            بيانات المراجعة
                          </p>

                          <p className="mt-3 text-sm text-slate-600">
                            المبلغ المعتمد:{' '}
                            <strong>
                              {formatMoney(request.verified_amount_egp)}
                            </strong>
                          </p>

                          <p className="mt-2 text-sm text-slate-600">
                            تاريخ المراجعة:{' '}
                            <strong>
                              {formatDate(request.reviewed_at)}
                            </strong>
                          </p>

                          {request.subscription_ends_at && (
                            <p className="mt-2 text-sm text-slate-600">
                              انتهاء الاشتراك:{' '}
                              <strong>
                                {formatDate(request.subscription_ends_at)}
                              </strong>
                            </p>
                          )}

                          {request.rejection_reason && (
                            <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                              سبب الرفض: {request.rejection_reason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}