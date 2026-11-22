
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CreditCard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { plans } from '@/components/subscription-plans'
import { requirePlatformOwner } from '@/lib/tenant-context'

type PlatformStore = {
  id: string
  name: string
  subscription_status: string | null
  plan_code: string | null
  member_count: number
  created_at: string
}

function formatDate(value: string | null) {
  if (!value) return 'غير متاح'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'غير متاح'

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getPlanName(code: string | null) {
  if (!code) return 'غير محددة'

  return plans.find((plan) => plan.code === code)?.name || 'خطة غير معروفة'
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case 'active':
      return 'نشط'
    case 'pending':
      return 'قيد المراجعة'
    case 'expired':
      return 'منتهي'
    case 'cancelled':
      return 'ملغي'
    case 'paused':
      return 'متوقف مؤقتًا'
    case 'suspended':
      return 'موقوف'
    default:
      return status || 'بدون اشتراك'
  }
}

function getStatusStyle(status: string | null) {
  if (status === 'active') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  if (status === 'pending') {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  if (['expired', 'cancelled', 'paused', 'suspended'].includes(status || '')) {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default async function PlatformStoreDetailsPage({
  params,
}: {
  params: Promise<{ storeId: string }>
}) {
  const { storeId } = await params

  const { supabase } = await requirePlatformOwner().catch(() =>
    redirect('/dashboard')
  )

  const { data, error } = await supabase
    .rpc('dokkan_platform_stores')
    .eq('id', storeId)
    .maybeSingle()

  if (error) {
    throw new Error('تعذر تحميل بيانات المتجر')
  }

  if (!data) {
    notFound()
  }

  const store = data as PlatformStore

  const details = [
    {
      label: 'اسم المتجر',
      value: store.name || 'بدون اسم',
      icon: Building2,
    },
    {
      label: 'الخطة الحالية',
      value: getPlanName(store.plan_code),
      icon: CreditCard,
    },
    {
      label: 'حالة الاشتراك',
      value: getStatusLabel(store.subscription_status),
      icon: ShieldCheck,
    },
    {
      label: 'عدد العضويات',
      value: Number(store.member_count || 0).toLocaleString('ar-EG'),
      icon: Users,
    },
    {
      label: 'تاريخ إنشاء المتجر',
      value: formatDate(store.created_at),
      icon: CalendarDays,
    },
  ]

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f5f7fb] p-4 text-slate-950 md:p-8"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6">

        <Link
          href="/platform"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowRight size={17} />
          العودة إلى لوحة المنصة
        </Link>

        <header className="rounded-[1.5rem] bg-slate-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
            <ShieldCheck size={18} />
            DOKKAN PLATFORM
          </div>

          <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
            تفاصيل المتجر
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-300">
            عرض معلومات المتجر والاشتراك المسجلة في المنصة.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                المتجر المحدد
              </p>

              <h2 className="mt-2 text-2xl font-extrabold">
                {store.name || 'متجر بدون اسم'}
              </h2>
            </div>

            <span
              className={`w-fit rounded-full border px-4 py-2 text-xs font-bold ${getStatusStyle(
                store.subscription_status
              )}`}
            >
              {getStatusLabel(store.subscription_status)}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {details.map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <Icon size={17} />
                    {item.label}
                  </div>

                  <p className="mt-3 break-words text-lg font-extrabold text-slate-900">
                    {item.value}
                  </p>
                </article>
              )
            })}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">
              معرّف المتجر
            </p>

            <p className="mt-2 break-all font-mono text-xs text-slate-700">
              {store.id}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-extrabold text-amber-900">
            وظائف الإدارة
          </h3>

          <p className="mt-2 text-sm leading-7 text-amber-800">
            هذه الصفحة للعرض فقط حاليًا. تعديل بيانات المتجر أو تغيير
            الخطة أو إيقاف الاشتراك يحتاج وظائف إدارية محمية وتسجيل
            كل عملية في سجل المراجعة.
          </p>
        </section>

      </div>
    </main>
  )
}
