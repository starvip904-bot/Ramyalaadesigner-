
'use client'

import { useState } from 'react'
import { Check, ChevronLeft, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'

type PlanCode =
  | 'free'
  | 'basic'
  | 'professional'
  | 'enterprise'

type PlanAccent = 'slate' | 'blue' | 'purple' | 'violet'

type PlanData = {
  code: string
  name: string
  billing: string
  monthlyPriceEgp: number | null
  annualPriceEgp: number | null
  limits: Record<string, number | string>
  features: string[]
}

type AddonData = {
  code: string
  name: string
  priceEgp: number
  billing?: string
}

type SubscriptionCatalog = {
  currency?: string
  currencyLabel?: string
  billingCycles?: Record<string, string>
  annualDiscountPercent?: number
  plans: Record<string, unknown>
  addons: Record<string, unknown>
}

const PLAN_ORDER: PlanCode[] = [
  'free',
  'basic',
  'professional',
  'enterprise',
]

const descriptions: Record<PlanCode, string> = {
  free: 'ابدأ بإدارة متجرك واختبر أساسيات Dokkan دون أي رسوم اشتراك.',
  basic: 'للمتاجر النامية التي تحتاج إلى إدارة أكثر احترافية للمبيعات والمخزون.',
  professional: 'للمتاجر المتوسعة التي تحتاج إلى تحكم مالي وإداري متقدم.',
  enterprise: 'حلول مرنة ومخصصة للأنشطة الكبيرة والمتاجر متعددة الفروع.',
}

const accents: Record<PlanCode, PlanAccent> = {
  free: 'slate',
  basic: 'blue',
  professional: 'purple',
  enterprise: 'violet',
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function parsePlan(
  code: PlanCode,
  value: unknown
): PlanData | null {
  if (!isObject(value) || !isObject(value.limits)) {
    return null
  }

  if (
    typeof value.name !== 'string' ||
    typeof value.billing !== 'string' ||
    !Array.isArray(value.features)
  ) {
    return null
  }

  const monthlyPriceEgp =
    typeof value.monthlyPriceEgp === 'number'
      ? value.monthlyPriceEgp
      : null

  const annualPriceEgp =
    typeof value.annualPriceEgp === 'number'
      ? value.annualPriceEgp
      : null

  const features = value.features.filter(
    (feature): feature is string =>
      typeof feature === 'string'
  )

  const limits: Record<string, number | string> = {}

  for (const [key, limit] of Object.entries(value.limits)) {
    if (
      typeof limit === 'number' ||
      typeof limit === 'string'
    ) {
      limits[key] = limit
    }
  }

  return {
    code,
    name: value.name,
    billing: value.billing,
    monthlyPriceEgp,
    annualPriceEgp,
    limits,
    features,
  }
}

function parseAddon(value: unknown): AddonData | null {
  if (!isObject(value)) return null

  if (
    typeof value.code !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.priceEgp !== 'number' ||
    !Number.isFinite(value.priceEgp)
  ) {
    return null
  }

  return {
    code: value.code,
    name: value.name,
    priceEgp: value.priceEgp,
    billing:
      typeof value.billing === 'string'
        ? value.billing
        : 'monthly',
  }
}

function formatLimit(
  value: number | string | undefined,
  label: string
) {
  if (value === undefined) {
    return `${label}: غير محدد`
  }

  if (value === 'custom') {
    return `${label}: حسب الاتفاق`
  }

  if (value === 'unlimited') {
    return `${label}: غير محدود`
  }

  if (value === 'pending') {
    return `${label}: قيد التحديد`
  }

  if (typeof value === 'number') {
    return `${label}: ${value.toLocaleString('ar-EG')}`
  }

  return `${label}: ${value}`
}

function getLimits(plan: PlanData) {
  const limits = plan.limits

  return [
    formatLimit(limits.stores, 'المتاجر'),
    formatLimit(limits.branches, 'الفروع النشطة'),
    formatLimit(limits.users, 'مستخدمو الدخول'),
    formatLimit(limits.products, 'المنتجات النشطة'),
    `${formatLimit(limits.storageGb, 'مساحة التخزين')}${
      typeof limits.storageGb === 'number' ? 'GB' : ''
    }`,
  ]
}

function accentClasses(accent: PlanAccent) {
  return {
    slate: 'border-slate-200',
    blue: 'border-blue-300',
    purple: 'border-violet-300',
    violet: 'border-purple-300',
  }[accent]
}

function formatPrice(
  value: number | null,
  currencyLabel: string
) {
  if (value === null) return 'حسب الاتفاق'

  if (value === 0) return 'مجانًا'

  return `${value.toLocaleString('ar-EG')} ${currencyLabel}`
}

function getAnnualSaving(plan: PlanData) {
  if (
    plan.monthlyPriceEgp === null ||
    plan.annualPriceEgp === null ||
    plan.monthlyPriceEgp <= 0
  ) {
    return 0
  }

  return (
    plan.monthlyPriceEgp * 12 -
    plan.annualPriceEgp
  )
}

export const plans: PlanData[] = []

export function PlanGrid({
  currentPlan = 'free',
  catalog,
}: {
  currentPlan?: string
  catalog: SubscriptionCatalog
}) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>(
    'monthly'
  )

  const currencyLabel =
    typeof catalog.currencyLabel === 'string'
      ? catalog.currencyLabel
      : 'جنيه'

  const billingCycles = catalog.billingCycles ?? {}

  const planDefinitions = PLAN_ORDER
    .map((code) => parsePlan(code, catalog.plans[code]))
    .filter((plan): plan is PlanData => plan !== null)

  const addons = Object.values(catalog.addons)
    .map(parseAddon)
    .filter((addon): addon is AddonData => addon !== null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
        <div className="text-center sm:text-right">
          <p className="font-extrabold text-slate-900">
            اختر دورة الاشتراك
          </p>

          <p className="mt-1 text-xs text-slate-500">
            وفر عند اختيار الاشتراك السنوي
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            aria-pressed={billing === 'monthly'}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
              billing === 'monthly'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {billingCycles.monthly ?? 'شهري'}
          </button>

          <button
            type="button"
            onClick={() => setBilling('annual')}
            aria-pressed={billing === 'annual'}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold transition ${
              billing === 'annual'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {billingCycles.annual ?? 'سنوي'}
          </button>
        </div>
      </div>

      {planDefinitions.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-7 text-amber-800">
          لا توجد بيانات خطط متاحة حاليًا. يرجى المحاولة مرة أخرى لاحقًا.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {planDefinitions.map((plan) => {
            const code = plan.code as PlanCode
            const isCurrent = plan.code === currentPlan
            const isFree = code === 'free'
            const isEnterprise = code === 'enterprise'

            const price =
              billing === 'annual'
                ? plan.annualPriceEgp
                : plan.monthlyPriceEgp

            const saving = getAnnualSaving(plan)

            return (
              <article
                key={plan.code}
                className={`relative flex flex-col rounded-[1.5rem] border bg-white p-5 shadow-[0_12px_40px_rgba(46,80,120,.06)] sm:p-6 ${accentClasses(accents[code])} ${
                  code === 'professional'
                    ? 'ring-2 ring-violet-100'
                    : ''
                }`}
              >
                {code === 'professional' && (
                  <div className="mb-4 flex items-center gap-2 self-start rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700">
                    <Sparkles size={14} />
                    الأنسب للمتاجر المتوسعة
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      خطة {plan.name}
                    </p>

                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
                      {plan.name}
                    </h3>
                  </div>

                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      خطتك الحالية
                    </span>
                  )}
                </div>

                <div className="mt-5 min-h-[100px]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-950">
                      {isEnterprise
                        ? 'حسب الاتفاق'
                        : formatPrice(price, currencyLabel)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {isFree
                      ? billingCycles.lifetime ?? 'مدى الحياة - بدون تجديد'
                      : isEnterprise
                        ? 'تسعير يناسب احتياجات نشاطك'
                        : billing === 'annual'
                          ? 'للسنة كاملة'
                          : 'لكل شهر'}
                  </p>

                  {billing === 'annual' && saving > 0 && (
                    <p className="mt-2 text-xs font-extrabold text-emerald-700">
                      وفر {saving.toLocaleString('ar-EG')} {currencyLabel} سنويًا
                    </p>
                  )}
                </div>

                <p className="min-h-[72px] text-sm leading-7 text-slate-500">
                  {descriptions[code]}
                </p>

                <div className="mt-5 border-y border-slate-100 py-4">
                  <p className="mb-3 text-sm font-extrabold text-slate-900">
                    حدود الخطة
                  </p>

                  <ul className="flex flex-col gap-3">
                    {getLimits(plan).map((limit) => (
                      <li
                        key={limit}
                        className="flex items-start gap-2 text-xs font-semibold leading-6 text-slate-700"
                      >
                        <Check
                          size={16}
                          className="mt-1 shrink-0 text-emerald-600"
                        />
                        {limit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex-1">
                  <p className="mb-3 text-sm font-extrabold text-slate-900">
                    المميزات
                  </p>

                  <ul className="flex flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-xs leading-6 text-slate-600"
                      >
                        <Check
                          size={16}
                          className="mt-1 shrink-0 text-blue-600"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {isFree ? (
                  <Link
                    href="/subscription"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    إدارة الخطة المجانية
                    <ChevronLeft size={17} />
                  </Link>
                ) : (
                  <Link
                    href={`/subscription?plan=${encodeURIComponent(plan.code)}&cycle=${billing}`}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                      code === 'professional'
                        ? 'bg-violet-600 hover:bg-violet-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isEnterprise
                      ? 'تواصل لطلب خطة مخصصة'
                      : 'طلب الاشتراك'}
                    <ChevronLeft size={17} />
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Crown size={19} className="text-blue-600" />
          <h3 className="font-extrabold text-slate-900">
            الإضافات الاختيارية
          </h3>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          يمكنك طلب إضافات لزيادة إمكانيات متجرك حسب احتياجك.
          تُحسب الإضافات شهريًا وتُراجع ضمن طلب الاشتراك.
        </p>

        {addons.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            لا توجد إضافات متاحة حاليًا.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {addons.map((addon) => (
              <div
                key={addon.code}
                className="rounded-xl bg-slate-50 p-4"
              >
                <p className="text-sm font-bold text-slate-800">
                  {addon.name}
                </p>

                <p className="mt-2 text-lg font-extrabold text-blue-700">
                  {addon.priceEgp.toLocaleString('ar-EG')} {currencyLabel}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  شهريًا
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs leading-6 text-slate-400">
        جميع الأسعار بالعملة المحددة في إعدادات المنصة.
        تقديم طلب الاشتراك لا يعني التفعيل الفوري؛
        تتم مراجعة الطلب وإثبات الدفع بواسطة إدارة Dokkan.
      </p>
    </div>
  )
}

export function UsageCard({
  label,
  used,
  limit,
  tone = 'blue',
}: {
  label: string
  used: number
  limit: string
  tone?: 'blue' | 'purple' | 'green'
}) {
  const numericLimit = Number(limit)

  const hasNumericLimit =
    limit.trim() !== '' &&
    Number.isFinite(numericLimit) &&
    numericLimit > 0

  const percentage = hasNumericLimit
    ? Math.min(
        Math.round((used / numericLimit) * 100),
        100
      )
    : 0

  const colors = {
    blue: 'bg-blue-600',
    purple: 'bg-violet-600',
    green: 'bg-emerald-500',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-700">
          {label}
        </p>

        <p className="text-xs text-slate-500">
          {used} / {limit}
        </p>
      </div>

      {hasNumericLimit ? (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all ${colors[tone]}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {percentage}% من الحد المتاح
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs leading-6 text-slate-500">
          {limit === 'غير محدود'
            ? 'استخدام مرن ضمن خطتك'
            : 'سيتم تحديد الحد عند اعتماد تفاصيل الخطة'}
        </p>
      )}
    </div>
  )
}

export function SubscriptionHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white shadow-[0_24px_60px_rgba(15,23,42,.14)] md:px-10 md:py-11">
      <div className="absolute -left-16 -top-20 size-64 rounded-full bg-blue-600/25 blur-3xl" />
      <div className="absolute -bottom-28 right-10 size-72 rounded-full bg-violet-600/20 blur-3xl" />

      <div className="relative max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-200">
          <Crown size={18} />
          {eyebrow}
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
          {title}
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
          {description}
        </p>
      </div>
    </div>
  )
}
