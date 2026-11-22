
import { redirect } from 'next/navigation'
import SubscriptionRequestManager from '@/app/subscription/subscription-request-manager'
import {
  PlanGrid,
  SubscriptionHero,
} from '@/components/subscription-plans'
import { requireRedaContext } from '@/lib/reda-scope'
import {
  getPlanDefinition,
  isPermanentFreePlan,
} from '@/lib/subscription-plans'

export const metadata = {
  title: 'اشتراكي | DOKKAN',
  description: 'إدارة خطة اشتراك متجرك وأسعار الخطط وطلبات الترقية.',
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
            تابع اشتراك متجرك، وقارن الخطط والأسعار، وقدم طلب الترقية من مكان واحد.
          </p>
        </header>

        <SubscriptionHero
          eyebrow="DOKKAN SUBSCRIPTIONS"
          title="اختر الخطة المناسبة لنمو متجرك"
          description="ابدأ مجانًا مدى الحياة، أو اختر إحدى الخطط المدفوعة للحصول على إمكانيات وحدود أكبر. جميع طلبات الاشتراك تخضع لمراجعة الإدارة قبل التفعيل."
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
              ولا يتم تحصيل أي مبالغ منك مقابلها.
            </p>
          )}
        </section>

        <section id="available-plans" className="flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-950">
              الخطط والأسعار
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              قارن بين الخطط واختر الاشتراك الشهري أو السنوي،
              وشاهد الحدود والمميزات والإضافات المتاحة.
            </p>
          </div>

          <PlanGrid currentPlan={planCode} />
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="font-extrabold text-blue-950">
            كيف يتم تفعيل الاشتراك؟
          </h2>

          <ol className="mt-3 flex flex-col gap-2 text-sm leading-7 text-blue-900">
            <li>1. اختر الخطة ودورة الاشتراك المناسبة.</li>
            <li>2. قدم طلب الاشتراك وأرفق إثبات الدفع.</li>
            <li>3. تراجع إدارة Dokkan الطلب وإثبات الدفع.</li>
            <li>4. بعد الموافقة يتم تفعيل الاشتراك وتسجيل العملية.</li>
          </ol>

          <p className="mt-3 text-xs leading-6 text-blue-800">
            إرسال الطلب لا يعني تفعيل الاشتراك تلقائيًا.
            يظل اشتراكك الحالي كما هو حتى اعتماد الطلب من الإدارة.
          </p>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-extrabold">
              طلبات الاشتراك
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              قدم طلب اشتراك جديد، وارفع إثبات الدفع،
              وتابع حالة الطلبات السابقة.
            </p>
          </div>

          <SubscriptionRequestManager
            storeName={store.name}
          />
        </section>

      </div>
    </main>
  )
}
