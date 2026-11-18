
'use client'

import { useState } from 'react'
import { Check, ChevronLeft, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import {
  PLAN_DEFINITIONS,
  SUBSCRIPTION_ADDONS,
  SUBSCRIPTION_BILLING,
  type PlanCode,
} from '@/lib/subscription-plans'

export type Plan = {
  code: string
  name: string
  price: string
  cadence: string
  description: string
  accent: 'slate' | 'blue' | 'purple' | 'violet'
  limits: string[]
  features: string[]
  available: boolean
}

const descriptions: Record<PlanCode, string> = {
  free: 'ابدأ بإدارة متجرك واختبر أساسيات Dokkan دون أي رسوم اشتراك.',
  basic: 'للمتاجر النامية التي تحتاج إلى إدارة أكثر احترافية للمبيعات والمخزون.',
  professional: 'للمتاجر المتوسعة التي تحتاج إلى تحكم مالي وإداري متقدم.',
  enterprise: 'حلول مرنة ومخصصة للأنشطة الكبيرة والمتاجر متعددة الفروع.',
}

const accents: Record<PlanCode, Plan['accent']> = {
  free: 'slate',
  basic: 'blue',
  professional: 'purple',
  enterprise: 'violet',
}

function formatLimit(value: number | string, label: string) {
  if (value === 'custom') return `${label}: حسب الاتفاق`
  if (value === 'unlimited') return `${label}: غير محدود`
  if (value === 'pending') return `${label}: قيد التحديد`

  return `${label}: ${Number(value).toLocaleString('ar-EG')}`
}

function getLimits(code: PlanCode) {
  const limits = PLAN_DEFINITIONS[code].limits

  return [
    formatLimit(limits.stores, 'المتاجر'),
    formatLimit(limits.branches, 'الفروع النشطة'),
    formatLimit(limits.users, 'مستخدمو الدخول'),
    formatLimit(limits.products, 'المنتجات النشطة'),
    formatLimit(limits.storageGb, 'مساحة التخزين') +
      (typeof limits.storageGb === 'number' ? 'GB' : ''),
  ]
}

export const plans: Plan[] = (
  Object.keys(PLAN_DEFINITIONS) as PlanCode[]
).map((code) => {
  const definition = PLAN_DEFINITIONS[code]

  return {
    code,
    name: definition.name,
    price:
      definition.priceEgp === null
        ? 'حسب الاتفاق'
        : definition.priceEgp === 0
          ? 'مجاني'
          : `${definition.priceEgp.toLocaleString('ar-EG')} جنيه`,
    cadence:
      definition.billing === 'lifetime'
        ? 'مدى الحياة'
        : definition.billing === 'custom'
          ? 'تسعير مخصص'
          : 'شهريًا',
    description: descriptions[code],
    accent: accents[code],
    limits: getLimits(code),
    features: [...definition.features],
    available: true,
  }
})

function accentClasses(accent: Plan['accent']) {
  return {
    slate: 'border-slate-200',
    blue: 'border-blue-300',
    purple: 'border-violet-300',
    violet: 'border-purple-300',
  }[accent]
}

function formatPrice(value: number | null) {
  if (value === null) return 'حسب الاتفاق'

  if (value === 0) return 'مجانًا'

  return value.toLocaleString('ar-EG')
}

function getAnnualSaving(code: PlanCode) {
  const definition = PLAN_DEFINITIONS[code]

  if (
    definition.monthlyPriceEgp === null ||
    definition.annualPriceEgp === null ||
    definition.monthlyPriceEgp <= 0
  ) {
    return 0
  }

  return (
    definition.monthlyPriceEgp * 12 -
    definition.annualPriceEgp
  )
}

export function PlanGrid({
  currentPlan = 'free',
}: {
  currentPlan?: string
}) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>(
    'monthly'
  )

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
            شهري
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
            سنوي
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const code = plan.code as PlanCode
          const definition = PLAN_DEFINITIONS[code]
          const isCurrent = plan.code === currentPlan
          const isFree = code === 'free'
          const isEnterprise = code === 'enterprise'

          const price =
            billing === 'annual'
              ? definition.annualPriceEgp
              : definition.monthlyPriceEgp

          const saving = getAnnualSaving(code)

          return (
            <article
              key={plan.code}
              className={`relative flex flex-col rounded-[1.5rem] border bg-white p-5 shadow-[0_12px_40px_rgba(46,80,120,.06)] sm:p-6 ${accentClasses(plan.accent)} ${
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
                      : formatPrice(price)}
                  </span>

                  {!isFree && !isEnterprise && (
                    <span className="text-sm font-semibold text-slate-500">
                      جنيه
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs font-bold text-slate-500">
                  {isFree
                    ? 'مدى الحياة - بدون تجديد'
                    : isEnterprise
                      ? 'تسعير يناسب احتياجات نشاطك'
                      : billing === 'annual'
                        ? 'للسنة كاملة'
                        : 'لكل شهر'}
                </p>

                {billing === 'annual' && saving > 0 && (
                  <p className="mt-2 text-xs font-extrabold text-emerald-700">
                    وفر {saving.toLocaleString('ar-EG')} جنيه سنويًا
                  </p>
                )}
              </div>

              <p className="min-h-[72px] text-sm leading-7 text-slate-500">
                {plan.description}
              </p>

              <div className="mt-5 border-y border-slate-100 py-4">
                <p className="mb-3 text-sm font-extrabold text-slate-900">
                  حدود الخطة
                </p>

                <ul className="flex flex-col gap-3">
                  {plan.limits.map((limit) => (
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
                  href="/subscription"
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.values(SUBSCRIPTION_ADDONS).map((addon) => (
            <div
              key={addon.code}
              className="rounded-xl bg-slate-50 p-4"
            >
              <p className="text-sm font-bold text-slate-800">
                {addon.name}
              </p>

              <p className="mt-2 text-lg font-extrabold text-blue-700">
                {addon.priceEgp.toLocaleString('ar-EG')} جنيه
              </p>

              <p className="mt-1 text-xs text-slate-500">
                شهريًا
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs leading-6 text-slate-400">
        جميع الأسعار بالجنيه المصري. تقديم طلب الاشتراك لا يعني
        التفعيل الفوري؛ تتم مراجعة الطلب وإثبات الدفع بواسطة إدارة Dokkan.
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
