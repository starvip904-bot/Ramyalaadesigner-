
'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createSubscriptionUpgradeDraftAction } from '@/app/actions/subscription-upgrades'
import { uploadSubscriptionProofAndSubmitAction } from '@/app/actions/subscription-requests'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

type CatalogPlan = {
  name?: unknown
}

type SubscriptionCatalog = {
  currencyLabel?: string
  billingCycles?: Record<string, string>
  plans: Record<string, unknown>
}

function getPlanName(code: string, catalog: SubscriptionCatalog) {
  const plan = catalog.plans[code] as CatalogPlan | undefined

  return typeof plan?.name === 'string' ? plan.name : code
}

function formatMoney(value: number, currencyLabel: string) {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyLabel}`
}

function getFileTypeError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'حدث خطأ أثناء تجهيز طلب الترقية.'
}

export default function SubscriptionUpgradeManager({
  currentPlanCode,
  catalog,
}: {
  currentPlanCode: string
  catalog: SubscriptionCatalog
}) {
  const [file, setFile] = useState<File | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<{
    targetPlanPriceEgp: number
    upgradeCreditEgp: number
    amountDueEgp: number
    billingCycle: string
    targetPlanCode: string
  } | null>(null)

  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const currencyLabel = catalog.currencyLabel ?? 'جنيه'
  const targetPlanCode = 'professional'

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('')
    setSuccessMessage('')

    const selectedFile = event.target.files?.[0] ?? null

    if (!selectedFile) {
      setFile(null)
      return
    }

    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setFile(null)
      event.target.value = ''
      setErrorMessage('اختر صورة JPG أو PNG أو WEBP أو ملف PDF.')
      return
    }

    if (selectedFile.size < 1 || selectedFile.size > MAX_FILE_SIZE) {
      setFile(null)
      event.target.value = ''
      setErrorMessage('حجم الملف يجب ألا يتجاوز 5 ميجابايت.')
      return
    }

    setFile(selectedFile)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!file) {
      setErrorMessage('اختر إثبات الدفع أولًا.')
      return
    }

    setBusy(true)

    try {
      let activeRequestId: string = requestId ?? ''

      if (!activeRequestId) {
        const draft = await createSubscriptionUpgradeDraftAction({
          targetPlanCode,
          proofMimeType: file.type,
        })

        activeRequestId = draft.requestId
        setRequestId(draft.requestId)

        setCalculation({
          targetPlanPriceEgp: draft.targetPlanPriceEgp,
          upgradeCreditEgp: draft.upgradeCreditEgp,
          amountDueEgp: draft.amountDueEgp,
          billingCycle: draft.billingCycle,
          targetPlanCode: draft.targetPlanCode,
        })
      }

      if (!activeRequestId) {
        throw new Error('تعذر الحصول على رقم طلب الترقية.')
      }

      await uploadSubscriptionProofAndSubmitAction(
        activeRequestId,
        file
      )

      setSuccessMessage(
        'تم إرسال طلب الترقية وإثبات الدفع للمراجعة. ستظل خطتك الحالية فعالة حتى اعتماد الإدارة.'
      )

      setFile(null)
      setRequestId(null)

    } catch (error) {
      setErrorMessage(getFileTypeError(error))
    } finally {
      setBusy(false)
    }
  }

  if (currentPlanCode !== 'basic') {
    return null
  }

  return (
    <section className="rounded-[1.5rem] border border-blue-200 bg-white p-5 shadow-sm md:p-7">
      <div>
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
          ترقية الخطة
        </span>

        <h2 className="mt-3 text-xl font-extrabold text-slate-950">
          الترقية إلى {getPlanName(targetPlanCode, catalog)}
        </h2>

        <p className="mt-2 text-sm leading-7 text-slate-500">
          احصل على حساب المبلغ المطلوب للترقية مع خصم القيمة المتبقية من اشتراكك الحالي.
          تحتفظ بدورة اشتراكك الحالية، شهرية أو سنوية.
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            خطتك الحالية
          </span>

          <strong className="text-sm text-slate-950">
            {getPlanName(currentPlanCode, catalog)}
          </strong>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">
            الخطة الجديدة
          </span>

          <strong className="text-sm text-blue-700">
            {getPlanName(targetPlanCode, catalog)}
          </strong>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
        {calculation && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="font-extrabold text-blue-950">
              تفاصيل حساب الترقية
            </h3>

            <div className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">
                  سعر الخطة الجديدة
                </span>

                <strong className="text-slate-950">
                  {formatMoney(
                    calculation.targetPlanPriceEgp,
                    currencyLabel
                  )}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-600">
                  رصيد المدة المتبقية
                </span>

                <strong className="text-emerald-700">
                  - {formatMoney(
                    calculation.upgradeCreditEgp,
                    currencyLabel
                  )}
                </strong>
              </div>

              <div className="border-t border-blue-200 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold text-slate-800">
                    المبلغ المطلوب للترقية
                  </span>

                  <strong className="text-lg font-extrabold text-blue-800">
                    {formatMoney(
                      calculation.amountDueEgp,
                      currencyLabel
                    )}
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                دورة الاشتراك:{' '}
                {catalog.billingCycles?.[calculation.billingCycle] ??
                  (calculation.billingCycle === 'annual' ? 'سنوي' : 'شهري')}
              </p>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-800">
            إثبات دفع فرق الترقية
          </span>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            disabled={busy || Boolean(requestId)}
            onChange={handleFileChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700 disabled:bg-slate-100"
          />

          <span className="text-xs leading-6 text-slate-500">
            JPG أو PNG أو WEBP أو PDF، بحد أقصى 5 ميجابايت.
          </span>
        </label>

        {file && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            الملف المختار: <strong>{file.name}</strong>
          </p>
        )}

        {requestId && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            تم إنشاء مسودة الترقية برقم:
            <strong className="mt-1 block break-all">{requestId}</strong>
            إذا تعذر رفع الإثبات، يمكنك إعادة المحاولة بنفس الملف دون إنشاء طلب جديد.
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? 'جارٍ تجهيز وإرسال طلب الترقية...'
            : requestId
              ? 'إعادة محاولة إرسال إثبات الدفع'
              : 'حساب الترقية وإرسال الطلب'}
        </button>

        <p className="text-xs leading-6 text-slate-500">
          لا تتغير خطتك الحالية بمجرد إرسال الطلب. تتم الترقية فقط بعد مراجعة الإدارة واعتماد المبلغ، وتبدأ الدورة الجديدة من تاريخ الموافقة.
        </p>
      </form>
    </section>
  )
}
