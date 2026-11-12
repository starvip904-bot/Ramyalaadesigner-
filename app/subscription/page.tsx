
import { redirect } from 'next/navigation'
import {
  PlanGrid,
  SubscriptionHero,
} from '@/components/subscription-plans'
import { requireRedaContext } from '@/lib/reda-scope'

export const metadata = {
  title: 'اشتراكي | DOKKAN',
  description: 'إدارة خطة اشتراك متجرك.',
}

const planNames: Record<string, string> = {
  free: 'Free المجانية',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
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
  const planName = planNames[planCode] ?? 'خطة غير محددة'

  const statusLabels: Record<string, string> = {
    active: 'نشطة',
    inactive: 'غير نشطة',
    cancelled: 'ملغاة',
    expired: 'منتهية',
    pending: 'قيد الانتظار',
  }

  const status =
    statusLabels[store.subscription_status ?? ''] ??
    'غير محددة'

  const isPermanentFree =
    planCode === 'free' &&
    store.subscription_status === 'active' &&
    !store.subscription_ends_at

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
            بيانات الاشتراك الفعلية المسجلة لمتجرك.
          </p>
        </header>

        <SubscriptionHero
          eyebrow="اشتراك متجرك"
          title={
            isPermanentFree
              ? 'أنت على الخطة المجانية الدائمة'
              : `خطتك الحالية: ${planName}`
          }
          description={
            isPermanentFree
              ? 'تستفيد من خطة Dokkan Free دون رسوم اشتراك ودون تاريخ انتهاء. لن يتم تفعيل أي خطة مدفوعة تلقائيًا.'
              : 'تعرض هذه الصفحة حالة الخطة المسجلة حاليًا في قاعدة البيانات.'
          }
        />

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
              ولا يتم تحصيل أي مبالغ منك.
            </p>
          )}

          <p className="mt-5 text-sm text-slate-500">
            الدفع الإلكتروني وتغيير الخطط المدفوعة غير مفعّلين
            حاليًا.
          </p>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-extrabold">
              الخطط المتاحة
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              يمكنك الاطلاع على الخطط. اختيار خطة مدفوعة لا
              يغيّر اشتراكك حاليًا.
            </p>
          </div>

          <PlanGrid currentPlan={planCode} />
        </section>
      </div>
    </main>
  )
}
