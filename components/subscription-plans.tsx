'use client'

import { Check, ChevronLeft, Crown, Sparkles } from 'lucide-react'
import Link from 'next/link'

export type Plan = {
  code: string
  name: string
  price: string
  cadence: string
  description: string
  accent: string
  limits: string[]
  features: string[]
  featured?: boolean
}

export const plans: Plan[] = [
  { code: 'free', name: 'Free', price: '0', cadence: 'ج.م / شهريًا', description: 'ابدأ بإدارة أساسية لمتجرك دون تكلفة.', accent: 'slate', limits: ['فرع واحد', 'موظف واحد', 'حتى 50 منتجًا'], features: ['نقطة بيع أساسية', 'تقارير أساسية'] },
  { code: 'starter', name: 'Starter', price: '199', cadence: 'ج.م / شهريًا', description: 'الأدوات الأساسية لنمو متجرك بثبات.', accent: 'blue', limits: ['فرع واحد', '3 موظفين', 'حتى 500 منتج'], features: ['المبيعات والمشتريات', 'العملاء والموردون', 'تقارير أساسية'] },
  { code: 'pro', name: 'Pro', price: '399', cadence: 'ج.م / شهريًا', description: 'تحكم أوسع للمخزون والفروع المتنامية.', accent: 'purple', featured: true, limits: ['3 فروع', '10 موظفين', 'منتجات غير محدودة'], features: ['مخزون متقدم', 'تحويلات بين الفروع', 'المرتجعات', 'كشوف الحسابات', 'تقارير متقدمة'] },
  { code: 'business', name: 'Business', price: '799', cadence: 'ج.م / شهريًا', description: 'تشغيل احترافي للفرق متعددة الفروع.', accent: 'navy', limits: ['10 فروع', '30 موظفًا', 'منتجات غير محدودة'], features: ['صلاحيات متقدمة', 'تقارير موحدة للفروع', 'دعم ذو أولوية'] },
  { code: 'enterprise', name: 'Enterprise', price: 'حسب الطلب', cadence: '', description: 'حل مرن للعمليات الأكبر والاحتياجات الخاصة.', accent: 'violet', limits: ['حدود مخصصة', 'ميزات مخصصة'], features: ['تهيئة مخصصة', 'تواصل مباشر مع المبيعات'] },
]

function accentClasses(accent: Plan['accent']) {
  return { slate: 'border-slate-200', blue: 'border-blue-200', purple: 'border-violet-300', navy: 'border-sky-200', violet: 'border-purple-200' }[accent]
}

export function PlanGrid({ currentPlan = 'pro' }: { currentPlan?: string }) {
  return <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-5">
    {plans.map((plan) => <article key={plan.code} className={`relative flex flex-col rounded-[1.5rem] border bg-white p-6 shadow-[0_12px_40px_rgba(46,80,120,.06)] ${accentClasses(plan.accent)} ${plan.featured ? 'ring-2 ring-violet-200 ring-offset-2' : ''}`}>
      {plan.featured && <div className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white"><Sparkles data-icon="inline-start" /> الأكثر اختيارًا</div>}
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">خطة {plan.name}</p><h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{plan.price === 'حسب الطلب' ? plan.price : <><span className="text-4xl">{plan.price}</span> <span className="text-sm font-bold text-slate-500">{plan.cadence}</span></>}</h3></div>{plan.code === currentPlan && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">خطتك الحالية</span>}</div>
      <p className="mt-4 min-h-12 text-sm leading-6 text-slate-500">{plan.description}</p>
      <div className="mt-5 flex flex-col gap-2 border-y border-slate-100 py-4">{plan.limits.map((limit) => <p key={limit} className="text-sm font-bold text-slate-800">{limit}</p>)}</div>
      <ul className="mt-5 flex flex-1 flex-col gap-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-slate-600"><Check className="mt-0.5 text-blue-600" data-icon="inline-start" />{feature}</li>)}</ul>
      <Link href={plan.code === 'enterprise' ? '/subscription?contact=sales' : `/subscription?plan=${plan.code}`} className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${plan.featured ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-200 hover:bg-blue-50'}`}>{plan.code === currentPlan ? 'إدارة الاشتراك' : plan.code === 'enterprise' ? 'تواصل مع المبيعات' : 'اختيار الخطة'}<ChevronLeft data-icon="inline-end" /></Link>
    </article>)}
  </div>
}

export function UsageCard({ label, used, limit, tone = 'blue' }: { label: string; used: number; limit: string; tone?: 'blue' | 'purple' | 'green' }) {
  const percentage = limit === 'غير محدود' ? 18 : Math.min(Math.round((used / Number(limit)) * 100), 100)
  const colors = { blue: 'bg-blue-600', purple: 'bg-violet-600', green: 'bg-emerald-500' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-700">{label}</p><p className="text-xs text-slate-500">{used} / {limit}</p></div><div className="mt-4 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${colors[tone]}`} style={{ width: `${percentage}%` }} /></div><p className="mt-3 text-xs text-slate-500">{limit === 'غير محدود' ? 'استخدام مرن ضمن خطتك' : `${percentage}% من الحد المتاح`}</p></div>
}

export function SubscriptionHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white shadow-[0_24px_60px_rgba(15,23,42,.14)] md:px-10 md:py-11"><div className="absolute -left-16 -top-20 size-64 rounded-full bg-blue-600/25 blur-3xl" /><div className="absolute -bottom-28 right-10 size-72 rounded-full bg-violet-600/20 blur-3xl" /><div className="relative max-w-3xl"><div className="flex items-center gap-2 text-sm font-bold text-blue-200"><Crown data-icon="inline-start" />{eyebrow}</div><h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{description}</p></div></div>
}
