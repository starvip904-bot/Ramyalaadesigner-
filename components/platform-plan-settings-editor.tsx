
'use client'

import { useEffect, useState } from 'react'
import {
  getPlatformPlanSettingsAction,
  updatePlatformPlanSettingsAction,
} from '@/app/actions/platform-plan-settings'

type PlanCode =
  | 'free'
  | 'basic'
  | 'professional'
  | 'enterprise'

type PlanSettings = {
  code: PlanCode
  name: string
  billing: string
  monthlyPriceEgp: number | null
  annualPriceEgp: number | null
  limits: {
    stores: number | string
    branches: number | string
    users: number | string
    products: number | string
    storageGb: number | string
  }
  features: string[]
  [key: string]: unknown
}

type AddonSettings = {
  code: string
  name: string
  priceEgp: number
  billing: string
  [key: string]: unknown
}

type PlatformSettings = {
  currency: string
  currencyLabel: string
  annualDiscountPercent: number
  plans: Record<PlanCode, PlanSettings>
  addons: Record<string, AddonSettings>
  [key: string]: unknown
}

const PLAN_ORDER: PlanCode[] = [
  'free',
  'basic',
  'professional',
  'enterprise',
]

const PLAN_LABELS: Record<PlanCode, string> = {
  free: 'Free - المجانية',
  basic: 'Basic - الأساسية',
  professional: 'Professional - الاحترافية',
  enterprise: 'Enterprise - المؤسسات',
}

const LIMIT_FIELDS = [
  { key: 'stores', label: 'عدد المتاجر' },
  { key: 'branches', label: 'الفروع النشطة' },
  { key: 'users', label: 'مستخدمو الدخول' },
  { key: 'products', label: 'المنتجات النشطة' },
  { key: 'storageGb', label: 'مساحة التخزين GB' },
] as const

const ADDON_LABELS: Record<string, string> = {
  extra_branch: 'فرع إضافي',
  extra_user: 'مستخدم إضافي',
  extra_storage_10gb: 'مساحة تخزين إضافية 10GB',
}

function parseLimit(value: string): number | string {
  const normalized = value.trim().toLowerCase()

  if (
    normalized === 'custom' ||
    normalized === 'unlimited' ||
    normalized === 'pending'
  ) {
    return normalized
  }

  if (normalized === '') {
    return ''
  }

  const number = Number(normalized)

  return Number.isFinite(number) ? number : value
}

function parsePrice(value: string): number {
  if (value.trim() === '') return Number.NaN
  return Number(value)
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  hint,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number'
  disabled?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
      />

      {hint && (
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  )
}

export default function PlatformPlanSettingsEditor() {
  const [settings, setSettings] =
    useState<PlatformSettings | null>(null)

  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [version, setVersion] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        setLoading(true)
        setError('')

        const result = await getPlatformPlanSettingsAction()

        if (!active) return

        setSettings(
          result.settings as unknown as PlatformSettings
        )
        setVersion(result.version)
        setUpdatedAt(result.updatedAt)
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'تعذر تحميل إعدادات الخطط.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSettings()

    return () => {
      active = false
    }
  }, [])

  function updatePlan(
    code: PlanCode,
    field: string,
    value: unknown
  ) {
    setSettings((current) => {
      if (!current) return current

      return {
        ...current,
        plans: {
          ...current.plans,
          [code]: {
            ...current.plans[code],
            [field]: value,
          },
        },
      }
    })

    setSuccess('')
  }

  function updateLimit(
    code: PlanCode,
    field: keyof PlanSettings['limits'],
    value: string
  ) {
    setSettings((current) => {
      if (!current) return current

      const plan = current.plans[code]

      return {
        ...current,
        plans: {
          ...current.plans,
          [code]: {
            ...plan,
            limits: {
              ...plan.limits,
              [field]: parseLimit(value),
            },
          },
        },
      }
    })

    setSuccess('')
  }

  function updateAddon(
    code: string,
    field: string,
    value: unknown
  ) {
    setSettings((current) => {
      if (!current) return current

      const addon = current.addons[code]

      return {
        ...current,
        addons: {
          ...current.addons,
          [code]: {
            ...addon,
            [field]: value,
          },
        },
      }
    })

    setSuccess('')
  }

  function updateFeatures(code: PlanCode, value: string) {
    updatePlan(
      code,
      'features',
      value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  }

  async function handleSave() {
    if (!settings) return

    setError('')
    setSuccess('')

    if (reason.trim().length > 500) {
      setError('سبب التعديل يجب ألا يتجاوز 500 حرف.')
      return
    }

    try {
      setSaving(true)

      const result = await updatePlatformPlanSettingsAction({
        settings,
        reason,
      })

      setSuccess(result.message)
      setVersion(result.version)
      setUpdatedAt(result.updatedAt)
      setReason('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ التعديلات.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section
        dir="rtl"
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
      >
        <div className="mx-auto size-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="mt-4 text-sm font-bold text-slate-600">
          جاري تحميل إعدادات الخطط من قاعدة البيانات...
        </p>
      </section>
    )
  }

  if (!settings) {
    return (
      <section
        dir="rtl"
        className="rounded-2xl border border-red-200 bg-white p-6"
      >
        <h2 className="font-extrabold text-red-700">
          تعذر تحميل إعدادات الخطط
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {error || 'لم يتم العثور على إعدادات الخطط.'}
        </p>
      </section>
    )
  }

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">
            إدارة الخطط والأسعار
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            تعديل الأسعار والحدود والمميزات والإضافات من قاعدة البيانات.
          </p>
        </div>

        <span className="w-fit rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
          إعدادات المنصة
        </span>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        التعديلات هنا تؤثر على إعدادات الخطط المستخدمة في المنصة.
        لا تقوم بتغيير اشتراكات المتاجر الحالية أو حذف بياناتها.
        راجع الأسعار والحدود جيدًا قبل الحفظ.
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="العملة"
          value={settings.currency || 'EGP'}
          disabled
          onChange={() => undefined}
        />

        <Field
          label="اسم العملة"
          value={settings.currencyLabel || 'جنيه'}
          disabled
          onChange={() => undefined}
        />

        <Field
          label="نسبة التوفير السنوي %"
          type="number"
          value={settings.annualDiscountPercent}
          onChange={(value) =>
            setSettings((current) =>
              current
                ? {
                    ...current,
                    annualDiscountPercent: parsePrice(value),
                  }
                : current
            )
          }
          hint="قيمة توضيحية للخصم السنوي، من 0 إلى 100."
        />
      </div>

      <div className="flex flex-col gap-6">
        {PLAN_ORDER.map((code) => {
          const plan = settings.plans[code]

          if (!plan) return null

          const isFree = code === 'free'
          const isEnterprise = code === 'enterprise'

          return (
            <article
              key={code}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {PLAN_LABELS[code]}
                </h3>

                {isFree ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    مجانية مدى الحياة
                  </span>
                ) : isEnterprise ? (
                  <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
                    حسب الاتفاق
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
                    خطة مدفوعة
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="اسم الخطة"
                  value={plan.name}
                  onChange={(value) =>
                    updatePlan(code, 'name', value)
                  }
                />

                <Field
                  label="دورة الاشتراك"
                  value={
                    isFree
                      ? 'مدى الحياة'
                      : isEnterprise
                        ? 'حسب الاتفاق'
                        : 'شهري / سنوي'
                  }
                  disabled
                  onChange={() => undefined}
                />

                <Field
                  label="السعر الشهري - جنيه"
                  type="number"
                  value={
                    plan.monthlyPriceEgp === null
                      ? 'حسب الاتفاق'
                      : plan.monthlyPriceEgp
                  }
                  disabled={isFree || isEnterprise}
                  onChange={(value) =>
                    updatePlan(
                      code,
                      'monthlyPriceEgp',
                      parsePrice(value)
                    )
                  }
                />

                <Field
                  label="السعر السنوي - جنيه"
                  type="number"
                  value={
                    plan.annualPriceEgp === null
                      ? 'حسب الاتفاق'
                      : plan.annualPriceEgp
                  }
                  disabled={isFree || isEnterprise}
                  onChange={(value) =>
                    updatePlan(
                      code,
                      'annualPriceEgp',
                      parsePrice(value)
                    )
                  }
                />
              </div>

              <div className="my-5 border-t border-slate-200" />

              <h4 className="mb-4 text-sm font-extrabold text-slate-800">
                حدود الخطة
              </h4>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {LIMIT_FIELDS.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    value={String(plan.limits[field.key])}
                    onChange={(value) =>
                      updateLimit(code, field.key, value)
                    }
                    hint="يمكن إدخال رقم أو custom أو unlimited."
                  />
                ))}
              </div>

              <div className="my-5 border-t border-slate-200" />

              <label className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-800">
                  مميزات الخطة
                </span>

                <textarea
                  rows={7}
                  value={plan.features.join('\n')}
                  onChange={(event) =>
                    updateFeatures(code, event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="اكتب كل ميزة في سطر مستقل"
                />

                <span className="mt-1 block text-xs text-slate-500">
                  كل سطر يمثل ميزة مستقلة تظهر ضمن الخطة.
                </span>
              </label>
            </article>
          )
        })}
      </div>

      <div className="my-7 border-t border-slate-200" />

      <div>
        <h3 className="mb-4 text-lg font-extrabold text-slate-950">
          أسعار الإضافات
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(settings.addons).map(([code, addon]) => (
            <article
              key={code}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="mb-3 text-sm font-extrabold text-slate-800">
                {ADDON_LABELS[code] || addon.name}
              </p>

              <Field
                label="السعر الشهري - جنيه"
                type="number"
                value={addon.priceEgp}
                onChange={(value) =>
                  updateAddon(
                    code,
                    'priceEgp',
                    parsePrice(value)
                  )
                }
              />

              <p className="mt-2 text-xs text-slate-500">
                السعر لكل وحدة شهريًا.
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="my-7 border-t border-slate-200" />

      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-extrabold text-slate-800">
            سبب تعديل الأسعار أو الحدود
          </span>

          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثال: تحديث أسعار الاشتراكات لشهر جديد"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <span className="mt-1 block text-xs text-slate-500">
            اختياري - سيتم تسجيل السبب ضمن سجل العمليات الإدارية.
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
          {success}
        </div>
      )}

      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="text-xs leading-6 text-slate-500">
          {version !== null && (
            <p>إصدار الإعدادات: {version}</p>
          )}

          {updatedAt && (
            <p>
              آخر تحديث:{' '}
              {new Date(updatedAt).toLocaleString('ar-EG')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الخطط'}
        </button>
      </div>
    </section>
  )
}
