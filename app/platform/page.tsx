
import {
  Activity,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { redirect } from 'next/navigation'
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

function formatNumber(value: unknown) {
  const number = Number(value)

  return Number.isFinite(number)
    ? number.toLocaleString('ar-EG')
    : '—'
}

function formatDate(value: string | null | undefined) {
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

  const plan = plans.find((item) => item.code === code)

  return plan?.name || 'خطة غير معروفة'
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
    case 'suspended':
      return 'موقوف'
    default:
      return status || 'بدون اشتراك'
  }
}

function getStatusStyle(status: string | null) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'pending':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'expired':
    case 'cancelled':
    case 'suspended':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

export default async function PlatformPage() {
  const { supabase } = await requirePlatformOwner().catch(() =>
    redirect('/dashboard')
  )

  const [overviewResult, storesResult] = await Promise.all([
    supabase.rpc('dokkan_platform_overview'),
    supabase.rpc('dokkan_platform_stores'),
  ])

  const overviewError = overviewResult.error
  const storesError = storesResult.error

  const overview = (overviewResult.data ?? {}) as Record<
    string,
    unknown
  >

  const platformStores = (storesResult.data ?? []) as PlatformStore[]

  const statCards = [
    {
      label: 'إجمالي المتاجر',
      value: formatNumber(overview.stores),
      icon: Building2,
      description: 'عدد المتاجر المسجلة بالمنصة',
      iconStyle: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'المستخدمون',
      value: formatNumber(overview.users),
      icon: Users,
      description: 'حسابات المستخدمين',
      iconStyle: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'العضويات',
      value: formatNumber(overview.memberships),
      icon: Store,
      description: 'عضويات المتاجر المسجلة',
      iconStyle: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'الاشتراكات النشطة',
      value: formatNumber(overview.active_subscriptions),
      icon: Activity,
      description: 'حسب حالة الاشتراك المسجلة',
      iconStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'الإيرادات الفعلية',
      value: 'غير متاحة',
      icon: Wallet,
      description: 'لم يتم ربط نظام المدفوعات بعد',
      iconStyle: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <main
      className="min-h-screen bg-[#f5f7fb] p-4 text-slate-950 md:p-8"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-7">

        {/* Header */}
        <header className="overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
                <ShieldCheck size={19} />
                DOKKAN PLATFORM
              </div>

              <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
                لوحة مدير المنصة
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                متابعة المتاجر والمستخدمين والاشتراكات من مكان واحد.
                هذه اللوحة مخصصة لإدارة ومراقبة منصة دكان.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300 md:self-center">
              <ShieldCheck size={16} />
              صلاحية مدير المنصة مفعّلة
            </div>
          </div>
        </header>

        {/* Statistics */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold">
              ملخص المنصة
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              نظرة عامة على بيانات المنصة الحالية.
            </p>
          </div>

          {overviewError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              تعذر تحميل بعض إحصائيات المنصة. يمكنك مراجعة قائمة المتاجر
              أدناه، وقد تظهر بعض الأرقام كغير متاحة.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((stat) => {
              const Icon = stat.icon

              return (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      {stat.label}
                    </p>

                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
                    >
                      <Icon size={20} />
                    </span>
                  </div>

                  <p className="mt-5 text-2xl font-extrabold tracking-tight">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {stat.description}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Plans */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-extrabold">
                خطط الاشتراك
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                الخطط المعتمدة حاليًا في نظام دكان.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              عرض فقط
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.code}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold">
                    {plan.name}
                  </h3>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      plan.available
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {plan.available ? 'متاحة' : 'قيد التجهيز'}
                  </span>
                </div>

                <p className="mt-4 text-2xl font-extrabold text-blue-700">
                  {plan.price}
                </p>

                {plan.cadence && (
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {plan.cadence}
                  </p>
                )}

                <p className="mt-4 min-h-12 text-sm leading-6 text-slate-500">
                  {plan.description}
                </p>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
                  {plan.limits.map((limit) => (
                    <p
                      key={limit}
                      className="text-xs font-semibold leading-5 text-slate-700"
                    >
                      • {limit}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
            تعديل الخطط والأسعار والحدود غير متاح من هذه الصفحة حاليًا.
            تفاصيل الخطط المدفوعة لم يتم اعتمادها بعد.
          </p>
        </section>

        {/* Stores */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:p-6">
            <div>
              <h2 className="text-xl font-extrabold">
                المتاجر والاشتراكات
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                متابعة بيانات المتاجر وحالة اشتراكاتها.
              </p>
            </div>

            <button
              type="button"
              disabled
              title="التصدير غير متاح في هذه المرحلة"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400"
            >
              <Download size={17} />
              التصدير قريبًا
            </button>
          </div>

          {storesError ? (
            <div className="p-8 text-center">
              <p className="font-bold text-rose-700">
                تعذر تحميل قائمة المتاجر.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                يرجى مراجعة اتصال قاعدة البيانات وصلاحيات الوصول.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-500">
                <Store size={15} />
                عدد المتاجر المعروضة: {formatNumber(platformStores.length)}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-right text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4 font-bold">اسم المتجر</th>
                      <th className="p-4 font-bold">حالة الاشتراك</th>
                      <th className="p-4 font-bold">الخطة</th>
                      <th className="p-4 font-bold">الأعضاء</th>
                      <th className="p-4 font-bold">تاريخ الإنشاء</th>
                      <th className="p-4 font-bold">التفاصيل</th>
                    </tr>
                  </thead>

                  <tbody>
                    {platformStores.map((store) => (
                      <tr
                        key={store.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="p-4 font-extrabold text-slate-800">
                          {store.name || 'متجر بدون اسم'}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${getStatusStyle(
                              store.subscription_status
                            )}`}
                          >
                            {getStatusLabel(store.subscription_status)}
                          </span>
                        </td>

                        <td className="p-4 font-bold text-blue-700">
                          {getPlanName(store.plan_code)}
                        </td>

                        <td className="p-4 font-semibold">
                          {formatNumber(store.member_count)}
                        </td>

                        <td className="p-4 text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays size={15} />
                            {formatDate(store.created_at)}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
                            التفاصيل قريبًا
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {platformStores.length === 0 && (
                  <div className="p-10 text-center">
                    <Building2
                      size={32}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-3 font-bold text-slate-600">
                      لا توجد متاجر مسجلة للعرض.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Future modules */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold">
              أدوات إدارة المنصة
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              أقسام سنستكمل وظائفها في المراحل القادمة.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'إدارة المتاجر',
                description: 'عرض تفاصيل كل متجر ومتابعة حالته.',
                icon: Store,
              },
              {
                title: 'إدارة المشتركين',
                description: 'متابعة حسابات وعضويات المستخدمين.',
                icon: Users,
              },
              {
                title: 'طلبات الترقية',
                description: 'مراجعة طلبات الانتقال إلى الخطط المدفوعة.',
                icon: CreditCard,
              },
              {
                title: 'التقارير المالية',
                description: 'متابعة المدفوعات والإيرادات بعد تفعيلها.',
                icon: Wallet,
              },
            ].map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-dashed border-slate-300 bg-white p-5"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={20} />
                  </span>

                  <h3 className="mt-4 font-extrabold">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    {item.description}
                  </p>

                  <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                    قيد التطوير
                  </span>
                </article>
              )
            })}
          </div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs leading-6 text-slate-500">
          لوحة مدير منصة DOKKAN — بعض وظائف الإدارة والتصدير والدفع
          والتقارير المالية لم يتم تفعيلها بعد.
        </footer>

      </div>
    </main>
  )
}
