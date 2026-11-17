import { redirect } from 'next/navigation'
import SubscriptionRequestManager from '@/app/subscription/subscription-request-manager'
import { requireRedaContext } from '@/lib/reda-scope'
import {
  getPlanDefinition,
  isPermanentFreePlan,
} from '@/lib/subscription-plans'

export const metadata = {
  title: 'اشتراكي | DOKKAN',
  description: 'إدارة خطة اشتراك متجرك وطلبات الترقية.',
}

function formatDate(value: string | null) {
  if (!value) return 'غير محدد'

  return new Date(value).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Cairo',
  })
}

export default async function SubscriptionPage() {
  const context = await requireRedaContext().catch(() => null)

  if (!context) redirect('/login')

  const { data: store, error } = await context.supabase
    .from('dokkan_stores')
    .select(`
      name,
      plan_code,
      subscription_status,
      subscription_started_at,
      subscription_ends_at
    `)
    .eq('id', context.storeId)
    .single()

  if (error || !store) {
    throw new Error('تعذر تحميل بيانات اشتراك المتجر')
  }

  const planCode = store.plan_code?.toLowerCase() ?? ''
  const planDefinition = getPlanDefinition(planCode)

  const planName =
    planDefinition?.name ??
    (planCode ? 'خطة قديمة تحتاج إلى مراجعة' : 'خطة غير محددة')

  const statusLabels: Record<string, string> = {
    active: 'نشطة',
    inactive: 'غير نشطة',
    cancelled: 'ملغاة',
    expired: 'منتهية',
    pending: 'قيد الانتظار',
    paused: 'متوقفة مؤقتًا',
  }

  const status =
    statusLabels[store.subscription_status ?? ''] ??
    'غير محددة'

  const isPermanentFree = isPermanentFreePlan(
    planCode,
    store.subscription_status,
    store.subscription_ends_at
  )

  return (
    <main
      className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-950 md:px-8 md:py-10"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
        <header>
          <p className="text-sm font-extrabold tracking-wide text-blue-700">
            الاشتراك والفوترة
          </p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            خطة متجرك
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            تابع اشتراك متجرك وقدم طلب الترقية من مكان واحد.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white shadow-xl md:px-10 md:py-11">
          <div className="absolute -left-16 -top-20 size-64 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-28 right-10 size-72 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative max-w-3xl">
            <p className="text-sm font-bold text-blue-200">
              اشتراك متجرك
            </p>

            <h2 className="mt-4 text-3xl font-extrabold md:text-4xl">
              {isPermanentFree
                ? 'أنت على الخطة المجانية الدائمة'
                : `خطتك الحالية: ${planName}`}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              {isPermanentFree
                ? 'تستفيد من خطة Dokkan Free دون رسوم اشتراك ودون تاريخ انتهاء. يمكنك تقديم طلب للترقية إلى إحدى الخطط المدفوعة.'
                : 'يمكنك متابعة حالة اشتراكك وتقديم طلب ترقية يخضع لمراجعة الإدارة.'}
            </p>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                الخطة الحالية
              </p>

              <h2 className="mt-2 text-2xl font-extrabold">
                {planName}
              </h2>
            </div>

            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              {status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                بداية الاشتراك
              </p>

              <p className="mt-2 font-bold">
                {formatDate(store.subscription_started_at)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                تاريخ انتهاء الاشتراك
              </p>

              <p className="mt-2 font-bold">
                {isPermanentFree
                  ? 'لا يوجد تاريخ انتهاء'
                  : formatDate(store.subscription_ends_at)}
              </p>
            </div>
          </div>

          {isPermanentFree && (
            <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-7 text-emerald-800">
              خطتك المجانية دائمة. لا يوجد تجديد شهري أو سنوي،
              ولا يتم تحصيل أي مبالغ منك مقابلها.
            </p>
          )}
        </section>

        <SubscriptionRequestManager
          storeName={store.name}
        />
      </div>
    </main>
  )
}